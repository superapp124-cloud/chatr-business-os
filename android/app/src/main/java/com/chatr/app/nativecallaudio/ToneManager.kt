package com.chatr.app.nativecallaudio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.SoundPool
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.EnumMap
import kotlin.math.PI
import kotlin.math.sin

enum class CallTone {
    RINGBACK,
    BUSY,
    FAILED,
    ENDED,
    RECONNECTING;

    companion object {
        fun from(raw: String?): CallTone? {
            return raw
                ?.trim()
                ?.uppercase()
                ?.replace("-", "_")
                ?.let { value -> values().firstOrNull { it.name == value } }
        }
    }
}

class ToneManager private constructor(context: Context) {
    interface ToneEventListener {
        fun onToneAutoDisconnect(callId: String?, tone: CallTone)
    }

    private data class ToneSample(
        val frequencyHz: Double,
        val secondaryFrequencyHz: Double? = null,
        val durationMs: Int,
        val gain: Double,
    )

    private data class PendingRequest(
        val tone: CallTone,
        val callId: String?,
    )

    private val appContext = context.applicationContext
    private val handler = Handler(Looper.getMainLooper())
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    private val soundPool = SoundPool.Builder()
        .setMaxStreams(3)
        .setAudioAttributes(audioAttributes)
        .build()
    private val focusChangeListener =
        AudioManager.OnAudioFocusChangeListener { focusChange -> onAudioFocusChanged(focusChange) }

    /**
     * Core tone frequency specs.
     * RINGBACK gain raised 0.10→0.16 — original was inaudible on earpiece at half volume.
     */
    private val sampleSpecs = mapOf(
        CallTone.RINGBACK     to ToneSample(425.0, 475.0, 2_000, 0.16),
        CallTone.BUSY         to ToneSample(425.0, null,  500,   0.13),
        CallTone.FAILED       to ToneSample(620.0, 780.0, 160,   0.12),
        CallTone.ENDED        to ToneSample(330.0, 262.0, 240,   0.07),
        CallTone.RECONNECTING to ToneSample(520.0, 660.0, 360,   0.06),
    )

    /**
     * Variant-based frequency shift applied on top of base frequencies.
     * Gives each call "personality" without needing separate audio files.
     *   secure      → +15 Hz  (slightly sharper — encrypted/premium feel)
     *   business    → −20 Hz  (lower/warmer — professional)
     *   international → +30 Hz (more alert — international routing)
     *   ai          →   0 Hz  (pure neutral tone)
     */
    private val variantFrequencyShift = mapOf(
        "secure"        to +15.0,
        "business"      to -20.0,
        "international" to +30.0,
        "ai"            to   0.0,
    )
    private val sampleIds = EnumMap<CallTone, Int>(CallTone::class.java)
    private val tonesBySampleId = mutableMapOf<Int, CallTone>()
    private val loadedSampleIds = mutableSetOf<Int>()
    private val streamIds = mutableSetOf<Int>()

    private var focusRequest: AudioFocusRequest? = null
    private var currentTone: CallTone? = null
    private var currentCallId: String? = null
    private var pausedTone: CallTone? = null
    private var pausedCallId: String? = null
    private var loopRunnable: Runnable? = null
    private var autoDisconnectRunnable: Runnable? = null
    private val sequenceRunnables = mutableListOf<Runnable>()
    private var pendingRequest: PendingRequest? = null
    private var muted = false

    var listener: ToneEventListener? = null

    init {
        soundPool.setOnLoadCompleteListener { _, sampleId, status ->
            handler.post {
                if (status == 0) {
                    loadedSampleIds.add(sampleId)
                    val pending = pendingRequest
                    val loadedTone = tonesBySampleId[sampleId]
                    if (pending != null && pending.tone == loadedTone) {
                        pendingRequest = null
                        playTone(pending.tone, pending.callId)
                    }
                } else {
                    Log.w(TAG, "SoundPool failed to load tone sample=$sampleId status=$status")
                }
            }
        }
        loadSamples()
    }

    fun playTone(type: CallTone, callId: String? = null) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post { playTone(type, callId) }
            return
        }

        if (muted) {
            Log.i(TAG, "Tone suppressed by mute: $type")
            return
        }

        val sampleId = sampleIds[type]
        if (sampleId == null || !loadedSampleIds.contains(sampleId)) {
            pendingRequest = PendingRequest(type, callId)
            return
        }

        stopToneInternal(abandonFocus = false)
        if (!requestAudioFocus()) {
            Log.w(TAG, "Audio focus denied for tone: $type")
            return
        }

        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        currentTone = type
        currentCallId = callId
        pausedTone = null
        pausedCallId = null

        when (type) {
            CallTone.RINGBACK -> scheduleLoop(type, periodMs = 6_000L)
            CallTone.BUSY -> {
                scheduleLoop(type, periodMs = 1_000L)
                scheduleAutoDisconnect(type, delayMs = 6_500L)
            }
            CallTone.RECONNECTING -> scheduleLoop(type, periodMs = 1_400L)
            CallTone.FAILED -> {
                scheduleSequence(type, offsetsMs = listOf(0L, 260L, 520L))
                scheduleAutoDisconnect(type, delayMs = 1_150L)
            }
            CallTone.ENDED -> {
                playSample(type)
                scheduleStop(delayMs = 650L)
            }
        }
    }

    /** Called from JS bridge — rawType = "RINGBACK" etc., variant = "secure" | "business" | "ai" */
    fun playTone(rawType: String?, callId: String? = null, variant: String? = null): Boolean {
        val tone = CallTone.from(rawType) ?: return false
        // Apply variant frequency shift by temporarily regenerating the tone sample if needed
        variant?.lowercase()?.let { v ->
            val shift = variantFrequencyShift[v] ?: 0.0
            if (shift != 0.0) {
                val base = sampleSpecs[tone]
                if (base != null) {
                    val shifted = base.copy(
                        frequencyHz          = base.frequencyHz + shift,
                        secondaryFrequencyHz = base.secondaryFrequencyHz?.plus(shift),
                    )
                    val toneDir = java.io.File(appContext.cacheDir, "call_progress_tones")
                        .apply { if (!exists()) mkdirs() }
                    val variantFile = java.io.File(toneDir, "${tone.name.lowercase()}_${v}.wav")
                    if (!variantFile.exists() || variantFile.length() == 0L) {
                        writeToneWav(variantFile, shifted)
                    }
                    // Load this variant sample inline (non-blocking re-use if already loaded)
                    val variantId = soundPool.load(variantFile.absolutePath, 1)
                    val variantVolume = if (tone == CallTone.ENDED) 0.45f
                                       else if (tone == CallTone.RECONNECTING) 0.55f
                                       else 0.75f
                    handler.postDelayed({
                        soundPool.play(variantId, variantVolume, variantVolume, 1, 0, 1f)
                    }, 120) // give SoundPool 120ms to load
                    return true
                }
            }
        }
        playTone(tone, callId)
        return true
    }

    fun stopTone() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post { stopTone() }
            return
        }

        stopToneInternal(abandonFocus = true)
    }

    fun pauseTone() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post { pauseTone() }
            return
        }

        pausedTone = currentTone
        pausedCallId = currentCallId
        stopToneInternal(abandonFocus = false)
    }

    fun resumeTone() {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post { resumeTone() }
            return
        }

        val tone = pausedTone ?: return
        val callId = pausedCallId
        pausedTone = null
        pausedCallId = null
        playTone(tone, callId)
    }

    fun setMuted(isMuted: Boolean) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            handler.post { setMuted(isMuted) }
            return
        }

        muted = isMuted
        if (isMuted) {
            pauseTone()
        }
    }

    fun release() {
        stopTone()
        soundPool.release()
    }

    private fun loadSamples() {
        val toneDir = File(appContext.cacheDir, "call_progress_tones").apply {
            if (!exists()) mkdirs()
        }

        sampleSpecs.forEach { (tone, sample) ->
            val file = File(toneDir, "${tone.name.lowercase()}.wav")
            if (!file.exists() || file.length() == 0L) {
                writeToneWav(file, sample)
            }
            val sampleId = soundPool.load(file.absolutePath, 1)
            sampleIds[tone] = sampleId
            tonesBySampleId[sampleId] = tone
        }
    }

    private fun requestAudioFocus(): Boolean {
        // Start Bluetooth SCO so tones route to BT headset if one is connected
        if (audioManager.isBluetoothScoAvailableOffCall) {
            try {
                audioManager.startBluetoothSco()
                audioManager.isBluetoothScoOn = true
            } catch (e: Exception) {
                Log.d(TAG, "Bluetooth SCO start skipped: ${e.message}")
            }
        }

        val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(audioAttributes)
                .setOnAudioFocusChangeListener(focusChangeListener, handler)
                .setWillPauseWhenDucked(false)
                .build()
            focusRequest = request
            audioManager.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_VOICE_CALL,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
            )
        }

        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonAudioFocus() {
        // Stop Bluetooth SCO when tones are done
        try {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
        } catch (e: Exception) {
            Log.d(TAG, "Bluetooth SCO stop skipped: ${e.message}")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest?.let(audioManager::abandonAudioFocusRequest)
            focusRequest = null
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(focusChangeListener)
        }
    }

    private fun onAudioFocusChanged(focusChange: Int) {
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS,
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> pauseTone()
            AudioManager.AUDIOFOCUS_GAIN -> resumeTone()
        }
    }

    private fun scheduleLoop(tone: CallTone, periodMs: Long) {
        val runnable = object : Runnable {
            override fun run() {
                if (currentTone != tone || muted) return
                playSample(tone)
                handler.postDelayed(this, periodMs)
            }
        }
        loopRunnable = runnable
        handler.post(runnable)
    }

    private fun scheduleSequence(tone: CallTone, offsetsMs: List<Long>) {
        offsetsMs.forEach { offset ->
            val runnable = Runnable {
                if (currentTone == tone && !muted) {
                    playSample(tone)
                }
            }
            sequenceRunnables.add(runnable)
            handler.postDelayed(runnable, offset)
        }
    }

    private fun scheduleAutoDisconnect(tone: CallTone, delayMs: Long) {
        val runnable = Runnable {
            if (currentTone == tone) {
                val callId = currentCallId
                stopToneInternal(abandonFocus = true)
                listener?.onToneAutoDisconnect(callId, tone)
            }
        }
        autoDisconnectRunnable = runnable
        handler.postDelayed(runnable, delayMs)
    }

    private fun scheduleStop(delayMs: Long) {
        val runnable = Runnable {
            stopToneInternal(abandonFocus = true)
        }
        autoDisconnectRunnable = runnable
        handler.postDelayed(runnable, delayMs)
    }

    private fun playSample(tone: CallTone) {
        val sampleId = sampleIds[tone] ?: return
        if (!loadedSampleIds.contains(sampleId)) return

        val volume = when (tone) {
            CallTone.ENDED -> 0.45f
            CallTone.RECONNECTING -> 0.55f
            else -> 0.75f
        }

        val streamId = soundPool.play(sampleId, volume, volume, 1, 0, 1f)
        if (streamId != 0) {
            streamIds.add(streamId)
        }
    }

    private fun stopToneInternal(abandonFocus: Boolean) {
        loopRunnable?.let(handler::removeCallbacks)
        loopRunnable = null

        sequenceRunnables.forEach(handler::removeCallbacks)
        sequenceRunnables.clear()

        autoDisconnectRunnable?.let(handler::removeCallbacks)
        autoDisconnectRunnable = null

        streamIds.forEach { streamId ->
            runCatching { soundPool.stop(streamId) }
        }
        streamIds.clear()

        currentTone = null
        currentCallId = null
        pendingRequest = null

        if (abandonFocus) {
            abandonAudioFocus()
        }
    }

    private fun writeToneWav(file: File, sample: ToneSample) {
        val sampleRate = 44_100
        val sampleCount = (sampleRate * sample.durationMs) / 1_000
        val pcmBytes = ByteArray(sampleCount * 2)
        val fadeSamples = (sampleRate * 0.012).toInt()

        for (i in 0 until sampleCount) {
            val primary = sin(2.0 * PI * sample.frequencyHz * i / sampleRate)
            val secondary = sample.secondaryFrequencyHz?.let {
                sin(2.0 * PI * it * i / sampleRate) * 0.35
            } ?: 0.0
            val envelope = when {
                i < fadeSamples -> i.toDouble() / fadeSamples
                i > sampleCount - fadeSamples -> (sampleCount - i).toDouble() / fadeSamples
                else -> 1.0
            }.coerceIn(0.0, 1.0)
            val mixed = ((primary * 0.75) + secondary).coerceIn(-1.0, 1.0)
            val value = (mixed * sample.gain * envelope * Short.MAX_VALUE).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())
            val index = i * 2
            pcmBytes[index] = (value and 0xff).toByte()
            pcmBytes[index + 1] = ((value shr 8) and 0xff).toByte()
        }

        val dataSize = pcmBytes.size
        val out = ByteArrayOutputStream(44 + dataSize)
        writeAscii(out, "RIFF")
        writeIntLe(out, 36 + dataSize)
        writeAscii(out, "WAVE")
        writeAscii(out, "fmt ")
        writeIntLe(out, 16)
        writeShortLe(out, 1)
        writeShortLe(out, 1)
        writeIntLe(out, sampleRate)
        writeIntLe(out, sampleRate * 2)
        writeShortLe(out, 2)
        writeShortLe(out, 16)
        writeAscii(out, "data")
        writeIntLe(out, dataSize)
        out.write(pcmBytes)

        FileOutputStream(file).use { stream ->
            stream.write(out.toByteArray())
        }
    }

    private fun writeAscii(out: ByteArrayOutputStream, value: String) {
        out.write(value.toByteArray(Charsets.US_ASCII))
    }

    private fun writeIntLe(out: ByteArrayOutputStream, value: Int) {
        out.write(value and 0xff)
        out.write((value shr 8) and 0xff)
        out.write((value shr 16) and 0xff)
        out.write((value shr 24) and 0xff)
    }

    private fun writeShortLe(out: ByteArrayOutputStream, value: Int) {
        out.write(value and 0xff)
        out.write((value shr 8) and 0xff)
    }

    companion object {
        private const val TAG = "ChatrToneManager"

        @Volatile
        private var instance: ToneManager? = null

        fun getInstance(context: Context): ToneManager {
            return instance ?: synchronized(this) {
                instance ?: ToneManager(context).also { instance = it }
            }
        }
    }
}
