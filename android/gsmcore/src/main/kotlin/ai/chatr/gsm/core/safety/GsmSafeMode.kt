package ai.chatr.gsm.core.safety

import android.content.Context
import android.os.Build
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.telecom.NoOpTelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomEventRecorder
import ai.chatr.gsm.core.telecom.TelecomRecordedEvent
import ai.chatr.gsm.core.telecom.TelecomRecordedEventType
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telemetry.NoOpGsmTelemetrySink

enum class GsmSafeModeTrigger {
    DEADMAN_SWITCH,
    CRASH_LOOP,
    DEVICE_READINESS_FAILURE,
    SAFETY_RECOVERY,
    MANUAL,
}

data class GsmSafeModeState(
    val active: Boolean = false,
    val trigger: GsmSafeModeTrigger? = null,
    val reason: String? = null,
    val enteredAtMillis: Long = 0L,
    val manualReenableRequired: Boolean = false,
    val disabledFeatures: Set<GsmFeature> = emptySet(),
    val passiveDiagnosticsOnly: Boolean = false,
)

interface GsmSafeModeStore {
    fun current(): GsmSafeModeState
    fun save(state: GsmSafeModeState)
}

class InMemoryGsmSafeModeStore(
    private var state: GsmSafeModeState = GsmSafeModeState(),
) : GsmSafeModeStore {
    override fun current(): GsmSafeModeState = state

    override fun save(state: GsmSafeModeState) {
        this.state = state
    }
}

class SharedPreferencesGsmSafeModeStore(
    private val context: Context,
) : GsmSafeModeStore {
    private val prefs by lazy {
        val appContext = context.applicationContext
        val isLocked = Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && 
            !(appContext.getSystemService(android.os.UserManager::class.java)?.isUserUnlocked ?: true)
        val safeContext = if (isLocked) {
            appContext.createDeviceProtectedStorageContext()
        } else {
            appContext
        }
        safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    override fun current(): GsmSafeModeState {
        val trigger = prefs.getString(KEY_TRIGGER, null)?.let { raw ->
            runCatching { GsmSafeModeTrigger.valueOf(raw) }.getOrNull()
        }
        val disabled = prefs.getString(KEY_DISABLED_FEATURES, null)
            .orEmpty()
            .split(",")
            .mapNotNull { raw -> raw.takeIf { it.isNotBlank() } }
            .mapNotNull { raw -> runCatching { GsmFeature.valueOf(raw) }.getOrNull() }
            .toSet()
        return GsmSafeModeState(
            active = prefs.getBoolean(KEY_ACTIVE, false),
            trigger = trigger,
            reason = prefs.getString(KEY_REASON, null),
            enteredAtMillis = prefs.getLong(KEY_ENTERED_AT, 0L),
            manualReenableRequired = prefs.getBoolean(KEY_MANUAL_REENABLE_REQUIRED, false),
            disabledFeatures = disabled,
            passiveDiagnosticsOnly = prefs.getBoolean(KEY_PASSIVE_DIAGNOSTICS_ONLY, false),
        )
    }

    override fun save(state: GsmSafeModeState) {
        prefs.edit()
            .putBoolean(KEY_ACTIVE, state.active)
            .putString(KEY_TRIGGER, state.trigger?.name)
            .putString(KEY_REASON, state.reason)
            .putLong(KEY_ENTERED_AT, state.enteredAtMillis)
            .putBoolean(KEY_MANUAL_REENABLE_REQUIRED, state.manualReenableRequired)
            .putString(KEY_DISABLED_FEATURES, state.disabledFeatures.joinToString(",") { it.name })
            .putBoolean(KEY_PASSIVE_DIAGNOSTICS_ONLY, state.passiveDiagnosticsOnly)
            .apply()
    }

    private companion object {
        const val PREFS_NAME = "ai.chatr.gsm.safe_mode"
        const val KEY_ACTIVE = "active"
        const val KEY_TRIGGER = "trigger"
        const val KEY_REASON = "reason"
        const val KEY_ENTERED_AT = "entered_at"
        const val KEY_MANUAL_REENABLE_REQUIRED = "manual_reenable_required"
        const val KEY_DISABLED_FEATURES = "disabled_features"
        const val KEY_PASSIVE_DIAGNOSTICS_ONLY = "passive_diagnostics_only"
    }
}

class GsmSafeMode(
    private val store: GsmSafeModeStore = InMemoryGsmSafeModeStore(),
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val telemetrySink: GsmTelemetrySink = NoOpGsmTelemetrySink(),
    private val now: () -> Long = System::currentTimeMillis,
) {
    fun enter(
        trigger: GsmSafeModeTrigger,
        reason: String,
        disabledFeatures: Set<GsmFeature> = defaultDisabledFeatures,
        manualReenableRequired: Boolean = true,
    ): GsmSafeModeState {
        val state = GsmSafeModeState(
            active = true,
            trigger = trigger,
            reason = reason,
            enteredAtMillis = now(),
            manualReenableRequired = manualReenableRequired,
            disabledFeatures = disabledFeatures,
            passiveDiagnosticsOnly = true,
        )
        store.save(state)
        record("entered", state)
        return state
    }

    fun exitManually(reason: String): GsmSafeModeState {
        val state = GsmSafeModeState(
            active = false,
            trigger = GsmSafeModeTrigger.MANUAL,
            reason = reason,
            enteredAtMillis = now(),
            manualReenableRequired = false,
            disabledFeatures = emptySet(),
            passiveDiagnosticsOnly = false,
        )
        store.save(state)
        record("manual_reenable", state)
        return state
    }

    fun current(): GsmSafeModeState = store.current()

    fun isActive(): Boolean = current().active

    fun canCollectPassiveDiagnostics(): Boolean {
        val state = current()
        return state.active && state.passiveDiagnosticsOnly
    }

    fun isFeatureSuppressed(feature: GsmFeature): Boolean {
        val state = current()
        if (!state.active) return false
        return feature != GsmFeature.PASSIVE_CALL_OBSERVATION ||
            GsmFeature.PASSIVE_CALL_OBSERVATION in state.disabledFeatures
    }

    private fun record(
        action: String,
        state: GsmSafeModeState,
    ) {
        val attributes = mapOf(
            "action" to action,
            "active" to state.active.toString(),
            "trigger" to state.trigger?.name.orEmpty(),
            "reason" to state.reason.orEmpty(),
            "manual_reenable_required" to state.manualReenableRequired.toString(),
            "disabled_features" to state.disabledFeatures.joinToString { it.name },
            "passive_diagnostics_only" to state.passiveDiagnosticsOnly.toString(),
        )
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.GSM_SAFE_MODE_CHANGED,
                sessionKey = null,
                timestampMillis = now(),
                activationPath = "phase_2e_device_ship_readiness",
                attributes = attributes,
            ),
        )
        telemetrySink.track(
            GsmTelemetryEvent(
                name = GsmTelemetryEventName.GSM_SAFE_MODE_CHANGED,
                attributes = attributes,
            ),
        )
    }

    companion object {
        val defaultDisabledFeatures = setOf(
            GsmFeature.GSM_INTELLIGENCE,
            GsmFeature.SHIELD,
            GsmFeature.CALL_SCREENING,
            GsmFeature.SMART_DIALER,
            GsmFeature.AI,
            GsmFeature.TRANSCRIPTION,
            GsmFeature.OVERLAY,
            GsmFeature.RECORDING,
        )
    }
}
