package com.chatr.app.shield

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import com.chatr.app.R
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

class TrackerProtectionService : VpnService() {
    private val running = AtomicBoolean(false)
    private var tunInterface: ParcelFileDescriptor? = null
    private var worker: Thread? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        setRunning(applicationContext, true)
        startTunnel()
        return START_STICKY
    }

    override fun onDestroy() {
        running.set(false)
        worker?.interrupt()
        tunInterface?.close()
        tunInterface = null
        setRunning(applicationContext, false)
        super.onDestroy()
    }

    private fun startTunnel() {
        if (!running.compareAndSet(false, true)) return

        tunInterface = Builder()
            .setSession("CHATR Anti-Tracker")
            .addAddress("10.42.0.2", 32)
            .addDnsServer("1.1.1.1")
            .addRoute("1.1.1.1", 32)
            .allowFamily(android.system.OsConstants.AF_INET)
            .establish()

        val descriptor = tunInterface?.fileDescriptor
        if (descriptor == null) {
            running.set(false)
            stopSelf()
            return
        }

        worker = Thread({
            FileInputStream(descriptor).use { input ->
                FileOutputStream(descriptor).use { output ->
                    val packet = ByteArray(MAX_PACKET_SIZE)
                    while (running.get()) {
                        val length = input.read(packet)
                        if (length <= 0) continue
                        val query = DnsPacketParser.readQueryDomain(packet, length)
                        if (query != null && TrackerDomainClassifier.isTracker(query)) {
                            ShieldAnalyticsEngine.recordTrackerEvent(
                                context = applicationContext,
                                domain = query,
                                packageName = null,
                                category = TrackerDomainClassifier.category(query),
                                blocked = true,
                            )
                            continue
                        }

                        // This service only claims the configured DNS route. Non-tracker DNS
                        // packets are returned unchanged so the OS can retry through the
                        // normal network resolver if this build does not proxy upstream DNS.
                        output.write(packet, 0, length)
                    }
                }
            }
        }, "ChatrTrackerVpn").also { thread ->
            thread.isDaemon = true
            thread.start()
        }
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "CHATR Anti-Tracker",
                    NotificationManager.IMPORTANCE_LOW,
                ),
            )
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setSmallIcon(R.drawable.ic_chatr_notification)
            .setContentTitle("CHATR Anti-Tracker")
            .setContentText("Local DNS tracker filter is running")
            .setOngoing(true)
            .build()
    }

    private object TrackerDomainClassifier {
        private val trackerFragments = listOf(
            "doubleclick.net",
            "googlesyndication.com",
            "google-analytics.com",
            "facebook.com/tr",
            "graph.facebook.com",
            "appsflyer.com",
            "adjust.com",
            "branch.io",
            "crashlytics.com",
            "mixpanel.com",
            "segment.io",
            "hotjar.com",
            "scorecardresearch.com",
        )

        fun isTracker(domain: String): Boolean {
            val lower = domain.lowercase(Locale.US)
            return trackerFragments.any { lower == it || lower.endsWith(".$it") || lower.contains(it) }
        }

        fun category(domain: String): String {
            val lower = domain.lowercase(Locale.US)
            return when {
                "crashlytics" in lower -> "crash_telemetry"
                "analytics" in lower || "mixpanel" in lower || "segment" in lower -> "analytics"
                "doubleclick" in lower || "ad" in lower -> "advertising"
                else -> "tracker"
            }
        }
    }

    private object DnsPacketParser {
        fun readQueryDomain(packet: ByteArray, length: Int): String? {
            if (length < 42) return null
            val version = (packet[0].toInt() ushr 4) and 0x0F
            if (version != 4) return null
            val headerLength = (packet[0].toInt() and 0x0F) * 4
            if (headerLength < 20 || length < headerLength + 12) return null
            val protocol = packet[9].toInt() and 0xFF
            if (protocol != 17) return null
            val udpOffset = headerLength
            val sourcePort = readShort(packet, udpOffset)
            val destPort = readShort(packet, udpOffset + 2)
            if (sourcePort != 53 && destPort != 53) return null
            val dnsOffset = udpOffset + 8
            if (length < dnsOffset + 12) return null
            val qdCount = readShort(packet, dnsOffset + 4)
            if (qdCount <= 0) return null
            var offset = dnsOffset + 12
            val labels = mutableListOf<String>()
            while (offset < length) {
                val labelLength = packet[offset].toInt() and 0xFF
                offset += 1
                if (labelLength == 0) break
                if (labelLength > 63 || offset + labelLength > length) return null
                labels.add(packet.copyOfRange(offset, offset + labelLength).toString(Charsets.UTF_8))
                offset += labelLength
            }
            return labels.takeIf { it.isNotEmpty() }?.joinToString(".")
        }

        private fun readShort(packet: ByteArray, offset: Int): Int {
            return ((packet[offset].toInt() and 0xFF) shl 8) or (packet[offset + 1].toInt() and 0xFF)
        }
    }

    companion object {
        private const val PREFS_NAME = "chatr_shield_runtime"
        private const val KEY_RUNNING = "anti_tracker_running"
        private const val TAG = "TrackerProtection"
        private const val CHANNEL_ID = "chatr_anti_tracker"
        private const val NOTIFICATION_ID = 4242
        private const val MAX_PACKET_SIZE = 32767

        fun isRunning(context: android.content.Context): Boolean {
            return context.applicationContext
                .getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
                .getBoolean(KEY_RUNNING, false)
        }

        private fun setRunning(context: android.content.Context, running: Boolean) {
            context.applicationContext
                .getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_RUNNING, running)
                .apply()
        }
    }
}
