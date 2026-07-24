package ai.chatr.gsm.overlay

import android.app.KeyguardManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.activation.GsmFeatureActivationManager
import ai.chatr.gsm.core.compat.TelecomCompatibilityMatrix
import ai.chatr.gsm.core.di.GsmDependencyRegistry
import ai.chatr.gsm.core.telemetry.GsmTelemetryEvent
import ai.chatr.gsm.core.telemetry.GsmTelemetryEventName
import ai.chatr.gsm.core.telemetry.GsmTelemetrySink
import ai.chatr.gsm.core.telecom.ProcessRecoveryOverlaySnapshot
import ai.chatr.gsm.core.telecom.SessionAuditOverlaySnapshot
import ai.chatr.gsm.core.telecom.TelecomProcessRecoveryAction
import ai.chatr.gsm.core.telecom.TelecomProcessRecoveryReason
import ai.chatr.gsm.shield.ShieldAnalysis
import ai.chatr.gsm.shield.ShieldVerdict

class PassiveIncomingCallOverlayService : Service() {
    private var overlayView: ComposeView? = null
    private var overlayParams: WindowManager.LayoutParams? = null
    private var currentOverlayCallId: String? = null
    private val serviceMemoryKey = "passive_overlay_service:${System.identityHashCode(this)}"
    private val windowManager by lazy {
        getSystemService(WindowManager::class.java)
    }
    private val overlayLifecycleCoordinator by lazy {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        OverlayLifecycleCoordinator(
            recorder = graph.telecomEventRecorder,
            recoveryManager = graph.safetyRecoveryManager,
        )
    }
    private val overlayWatchdog by lazy {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        OverlayWatchdog(
            recorder = graph.telecomEventRecorder,
            recoveryManager = graph.safetyRecoveryManager,
        )
    }

    override fun onCreate() {
        super.onCreate()
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        graph.telecomMemoryGuard.onServiceCreated(serviceMemoryKey)
        graph.overnightIdleMonitor.observeServiceWakeup("passive_overlay_service_created")
        graph.telecomMemoryGuard.evaluate("passive_overlay_service_created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        val recoveryDecision = graph.processRecoveryCoordinator.reconcile(
            reason = TelecomProcessRecoveryReason.OVERLAY_SERVICE_RECREATED,
            overlaySnapshot = overlayLifecycleCoordinator.current().toProcessRecoverySnapshot(),
        )
        if (TelecomProcessRecoveryAction.DETACH_ORPHAN_OVERLAY in recoveryDecision.actions) {
            removeOverlay("process_recovery_orphan")
        } else {
            enforceOverlayWatchdog("start_command")
        }
        reportDogfoodHealth("overlay_service_start")

        val activationManager = GsmFeatureActivationManager(
            flags = graph.flags,
            activationStore = graph.activationStore,
            remoteConfig = graph.remoteConfig,
            recoveryManager = graph.safetyRecoveryManager,
            dogfoodActivationPolicy = graph.dogfoodActivationPolicy,
            pilotRolloutController = graph.pilotRolloutController,
            telemetrySink = graph.telemetrySink,
        )
        if (!activationManager.canActivate(applicationContext, GsmFeature.OVERLAY).allowed) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        val capabilities = graph.capabilityChecker.getCapabilities()
        val compatibility = TelecomCompatibilityMatrix.current(capabilities)
        val state = intent.toOverlayState()
        val decision = overlayLifecycleCoordinator.onOverlayRequested(
            callId = state.callId,
            telecomRingingAtMillis = intent?.getLongExtra(EXTRA_RINGING_AT_MILLIS, -1L)
                ?.takeIf { it > 0 },
            compatibilityProfile = compatibility,
            isDeviceLocked = isDeviceLocked(),
            canDrawOverlay = capabilities.supportsOverlay && Settings.canDrawOverlays(this),
        )
        if (decision.command == OverlayLifecycleCommand.SUPPRESS ||
            decision.command == OverlayLifecycleCommand.NO_OP ||
            decision.command == OverlayLifecycleCommand.DETACH
        ) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        showOverlay(
            state = state,
            telemetrySink = graph.telemetrySink,
            command = decision.command,
        )
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        removeOverlay("service_destroy")
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        graph.telecomMemoryGuard.onServiceDestroyed(serviceMemoryKey)
        graph.telecomMemoryGuard.evaluate("passive_overlay_service_destroyed")
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        removeOverlay("task_removed")
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val decision = overlayLifecycleCoordinator.onOrientationChanged(currentOverlayCallId)
        if (decision.command == OverlayLifecycleCommand.UPDATE) {
            val view = overlayView
            val params = overlayParams
            if (view != null && params != null && view.isAttachedToWindow) {
                runCatching {
                    windowManager.updateViewLayout(view, params)
                }
            }
        }
        enforceOverlayWatchdog("orientation_changed")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun showOverlay(
        state: GsmOverlayState,
        telemetrySink: GsmTelemetrySink,
        command: OverlayLifecycleCommand,
    ) {
        if (!Settings.canDrawOverlays(this)) {
            telemetrySink.trackOverlayFailure("permission_missing")
            overlayLifecycleCoordinator.onAttachFailed(state.callId, "permission_missing")
            return
        }

        val existing = overlayView
        if (existing != null && command == OverlayLifecycleCommand.UPDATE) {
            existing.setContent { PassiveIncomingCallOverlay(state = state) }
            telemetrySink.trackOverlaySuccess("updated")
            return
        }
        if (existing != null) {
            removeOverlay("replace_overlay")
        }

        val view = ComposeView(this).apply {
            setContent {
                PassiveIncomingCallOverlay(state = state)
            }
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = 72
        }

        runCatching {
            windowManager.addView(view, params)
            overlayView = view
            overlayParams = params
            currentOverlayCallId = state.callId
            val graph = GsmDependencyRegistry.resolve(applicationContext)
            graph.telecomMemoryGuard.onOverlayReferenceAttached(state.callId)
            overlayLifecycleCoordinator.onAttachSucceeded(state.callId)
            telemetrySink.trackOverlaySuccess("created")
            reportDogfoodHealth("overlay_attached")
        }.onFailure {
            overlayView = null
            overlayParams = null
            telemetrySink.trackOverlayFailure(it.javaClass.simpleName.ifBlank { "window_manager_failure" })
            overlayLifecycleCoordinator.onAttachFailed(
                callId = state.callId,
                reason = it.javaClass.simpleName.ifBlank { "window_manager_failure" },
            )
            reportDogfoodHealth("overlay_attach_failed")
            stopSelf()
        }
    }

    private fun enforceOverlayWatchdog(reason: String) {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        val activeCallIds = graph.sessionStateMachine.sessions.value.values
            .filterNot { it.isTerminal }
            .map { it.telecomCallHash.toString() }
            .toSet()
        val decision = overlayWatchdog.evaluate(
            overlaySnapshot = overlayLifecycleCoordinator.current(),
            activeOverlayCallIds = activeCallIds,
        )
        if (decision.action == OverlayWatchdogAction.FORCE_DETACH ||
            decision.action == OverlayWatchdogAction.REQUEST_DETACH
        ) {
            removeOverlay("watchdog_${reason}_${decision.reason}")
        }
    }

    private fun removeOverlay(reason: String) {
        val callId = currentOverlayCallId
        val decision = overlayLifecycleCoordinator.onDetachRequested(callId, reason)
        var success = true
        var failureReason = reason
        overlayView?.let { view ->
            runCatching {
                if (view.isAttachedToWindow) {
                    windowManager.removeViewImmediate(view)
                }
            }.onFailure {
                success = false
                failureReason = it.javaClass.simpleName.ifBlank { "remove_failed" }
            }
        }
        overlayView = null
        overlayParams = null
        currentOverlayCallId = null
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        graph.telecomMemoryGuard.onOverlayReferenceCleared(callId)
        if (decision.command == OverlayLifecycleCommand.DETACH) {
            overlayLifecycleCoordinator.onDetached(
                callId = callId,
                success = success,
                reason = failureReason,
            )
            reportDogfoodHealth("overlay_detached")
        }
    }

    private fun isDeviceLocked(): Boolean {
        return getSystemService(KeyguardManager::class.java)?.isKeyguardLocked == true
    }

    private fun OverlayLifecycleSnapshot.toProcessRecoverySnapshot(): ProcessRecoveryOverlaySnapshot {
        return ProcessRecoveryOverlaySnapshot(
            callId = callId,
            isVisible = isVisible,
            attachedAtMillis = attachedAtMillis,
            lastReason = lastReason,
        )
    }

    private fun OverlayLifecycleSnapshot.toSessionAuditSnapshot(): SessionAuditOverlaySnapshot {
        return SessionAuditOverlaySnapshot(
            callId = callId,
            isVisible = isVisible,
        )
    }

    private fun reportDogfoodHealth(reason: String) {
        val graph = GsmDependencyRegistry.resolve(applicationContext)
        val overlaySnapshot = overlayLifecycleCoordinator.current().toSessionAuditSnapshot()
        graph.sessionConsistencyAuditor.audit(
            reason = reason,
            overlaySnapshot = overlaySnapshot,
        )
        graph.overlayLatencyProfiler.profile(reason)
        graph.telecomHealthMonitor.evaluate(reason)
        graph.telecomMemoryGuard.evaluate(reason)
        graph.silentFallbackController.evaluateAndApply(
            feature = GsmFeature.OVERLAY,
            reliability = graph.telecomReliabilityScore.calculate(reason),
            reason = reason,
        )
    }

    private fun Intent?.toOverlayState(): GsmOverlayState {
        val title = this?.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { "Incoming GSM call" }
        val subtitle = this?.getStringExtra(EXTRA_SUBTITLE)
        val verdict = this?.getStringExtra(EXTRA_VERDICT)?.let { raw ->
            runCatching { ShieldVerdict.valueOf(raw) }.getOrNull()
        } ?: ShieldVerdict.UNKNOWN

        return GsmOverlayState(
            callId = this?.getStringExtra(EXTRA_CALL_ID).orEmpty(),
            mode = if (verdict == ShieldVerdict.POTENTIAL_SCAM) {
                GsmOverlayMode.FRAUD_ALERT
            } else {
                GsmOverlayMode.EXPANDED
            },
            title = title,
            subtitle = subtitle,
            shieldAnalysis = ShieldAnalysis(
                verdict = verdict,
                trustScore = this?.getFloatExtra(EXTRA_TRUST_SCORE, 0.5f) ?: 0.5f,
                title = verdict.label,
                reason = subtitle ?: "Passive CHATR GSM enhancement.",
                scamSignal = null,
            ),
        )
    }

    companion object {
        const val EXTRA_CALL_ID = "ai.chatr.gsm.overlay.CALL_ID"
        const val EXTRA_TITLE = "ai.chatr.gsm.overlay.TITLE"
        const val EXTRA_SUBTITLE = "ai.chatr.gsm.overlay.SUBTITLE"
        const val EXTRA_VERDICT = "ai.chatr.gsm.overlay.VERDICT"
        const val EXTRA_TRUST_SCORE = "ai.chatr.gsm.overlay.TRUST_SCORE"
        const val EXTRA_RINGING_AT_MILLIS = "ai.chatr.gsm.overlay.RINGING_AT_MILLIS"
    }
}

private fun GsmTelemetrySink.trackOverlaySuccess(mode: String) {
    track(
        GsmTelemetryEvent(
            name = GsmTelemetryEventName.OVERLAY_RENDER_SUCCESS,
            attributes = mapOf("mode" to mode),
        ),
    )
}

private fun GsmTelemetrySink.trackOverlayFailure(reason: String) {
    track(
        GsmTelemetryEvent(
            name = GsmTelemetryEventName.OVERLAY_RENDER_FAILURE,
            attributes = mapOf("reason" to reason),
        ),
    )
}

@Composable
private fun PassiveIncomingCallOverlay(state: GsmOverlayState) {
    val visible = remember(state.callId, state.title) { mutableStateOf(true) }
    AnimatedVisibility(
        visible = visible.value,
        enter = fadeIn(),
        exit = fadeOut(),
    ) {
        MaterialTheme {
            Surface(
                modifier = Modifier
                    .width(328.dp)
                    .padding(horizontal = 12.dp),
                shape = RoundedCornerShape(20.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
                tonalElevation = 6.dp,
                shadowElevation = 10.dp,
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    ShieldDot(verdict = state.shieldAnalysis?.verdict ?: ShieldVerdict.UNKNOWN)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = state.title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = state.subtitle ?: state.shieldAnalysis?.title ?: "CHATR Shield",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Text(
                        text = state.shieldAnalysis?.verdict?.label ?: "Unknown",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = (state.shieldAnalysis?.verdict ?: ShieldVerdict.UNKNOWN).accentColor,
                    )
                }
            }
        }
    }
}

@Composable
private fun ShieldDot(verdict: ShieldVerdict) {
    Box(
        modifier = Modifier
            .size(14.dp)
            .background(verdict.accentColor, CircleShape),
    )
}

private val ShieldVerdict.label: String
    get() = when (this) {
        ShieldVerdict.TRUSTED -> "Trusted"
        ShieldVerdict.KNOWN_CONTACT -> "Known"
        ShieldVerdict.UNKNOWN -> "Unknown"
        ShieldVerdict.SUSPICIOUS -> "Suspicious"
        ShieldVerdict.POTENTIAL_SCAM -> "Scam Risk"
    }

private val ShieldVerdict.accentColor: Color
    get() = when (this) {
        ShieldVerdict.TRUSTED -> Color(0xFF22C55E)
        ShieldVerdict.KNOWN_CONTACT -> Color(0xFF14B8A6)
        ShieldVerdict.UNKNOWN -> Color(0xFF94A3B8)
        ShieldVerdict.SUSPICIOUS -> Color(0xFFF59E0B)
        ShieldVerdict.POTENTIAL_SCAM -> Color(0xFFEF4444)
    }
