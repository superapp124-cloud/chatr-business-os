package ai.chatr.gsm.core.telecom

enum class LifecycleExhaustionFailure {
    REJECTED_TRANSITIONS,
    ACTIVE_SESSION_LEAK,
    CLEANUP_LEAK,
    CONSISTENCY_FAILURE,
}

data class LifecycleExhaustionConfig(
    val repeatedRingingLoops: Int = 40,
    val answerRejectLoops: Int = 40,
    val rapidDisconnectLoops: Int = 40,
    val processRecreationStorms: Int = 20,
    val multiCallChurnLoops: Int = 20,
    val orientationStorms: Int = 30,
)

data class LifecycleExhaustionResult(
    val passed: Boolean,
    val failures: Set<LifecycleExhaustionFailure>,
    val transitionCount: Int,
    val rejectedTransitionCount: Int,
    val activeSessionCount: Int,
    val cleanupRequiredCount: Int,
    val recordedEventCount: Int,
)

class LifecycleExhaustionTester(
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
    private val nowStartMillis: Long = 1_000L,
    private val nowStepMillis: Long = 10L,
) {
    fun run(
        reason: String,
        config: LifecycleExhaustionConfig = LifecycleExhaustionConfig(),
    ): LifecycleExhaustionResult {
        var clock = nowStartMillis
        fun tick(): Long {
            clock += nowStepMillis
            return clock
        }

        val localRecorder = BoundedInMemoryTelecomEventRecorder(maxEvents = 5_000)
        val stateMachine = GsmSessionStateMachine(
            recorder = localRecorder,
            now = { clock },
        )
        val resolver = MultiCallConflictResolver(recorder = localRecorder)
        val recoveryCoordinator = TelecomProcessRecoveryCoordinator(
            stateMachine = stateMachine,
            telecomStateProbe = object : AndroidTelecomStateProbe {
                override fun currentState(): AndroidTelecomState {
                    return AndroidTelecomState(
                        canValidate = true,
                        isInCall = false,
                        source = "lifecycle_exhaustion_simulation",
                        capturedAtMillis = tick(),
                    )
                }
            },
            recorder = localRecorder,
            now = { clock },
        )
        val auditor = SessionConsistencyAuditor(
            stateMachine = stateMachine,
            recorder = localRecorder,
            now = { clock },
        )

        var nextKey = 1_000
        fun nextSessionKey(): Int = nextKey++
        fun snapshot(
            key: Int,
            lifecycle: GsmCallLifecycle,
            direction: GsmCallDirection = GsmCallDirection.INCOMING,
        ): GsmCallSnapshot {
            return GsmCallSnapshot(
                telecomCallHash = key,
                phoneNumber = null,
                direction = direction,
                lifecycle = lifecycle,
                phoneAccountId = "sim-${key % 2}",
                simSlotIndex = key % 2,
                capturedAtMillis = tick(),
            )
        }

        repeat(config.repeatedRingingLoops) {
            val key = nextSessionKey()
            stateMachine.onSnapshot(snapshot(key, GsmCallLifecycle.RINGING))
            stateMachine.onRemoved(snapshot(key, GsmCallLifecycle.DISCONNECTED))
            stateMachine.markCleanupComplete(key, success = true, reason = "stress_ringing_cleanup")
        }

        repeat(config.answerRejectLoops) {
            val key = nextSessionKey()
            stateMachine.onSnapshot(snapshot(key, GsmCallLifecycle.RINGING))
            stateMachine.onSnapshot(snapshot(key, GsmCallLifecycle.ACTIVE))
            stateMachine.onSnapshot(snapshot(key, GsmCallLifecycle.DISCONNECTING))
            stateMachine.onRemoved(snapshot(key, GsmCallLifecycle.DISCONNECTED))
            stateMachine.markCleanupComplete(key, success = true, reason = "stress_answer_cleanup")
        }

        repeat(config.rapidDisconnectLoops) {
            val key = nextSessionKey()
            stateMachine.onSnapshot(snapshot(key, GsmCallLifecycle.RINGING))
            stateMachine.onRemoved(snapshot(key, GsmCallLifecycle.DISCONNECTED))
            stateMachine.markCleanupComplete(key, success = true, reason = "stress_rapid_disconnect")
        }

        repeat(config.processRecreationStorms) {
            val key = nextSessionKey()
            stateMachine.onSnapshot(snapshot(key, GsmCallLifecycle.ACTIVE))
            recoveryCoordinator.reconcile(TelecomProcessRecoveryReason.PROCESS_RECREATED)
        }

        repeat(config.multiCallChurnLoops) {
            val activeKey = nextSessionKey()
            val ringingKey = nextSessionKey()
            stateMachine.onSnapshot(snapshot(activeKey, GsmCallLifecycle.ACTIVE, GsmCallDirection.OUTGOING))
            stateMachine.onSnapshot(snapshot(ringingKey, GsmCallLifecycle.RINGING))
            resolver.resolve(
                sessions = stateMachine.sessions.value.values,
                currentOverlaySessionKey = ringingKey,
            )
            stateMachine.onRemoved(snapshot(ringingKey, GsmCallLifecycle.DISCONNECTED))
            stateMachine.markCleanupComplete(ringingKey, success = true, reason = "stress_waiting_cleanup")
            stateMachine.onRemoved(snapshot(activeKey, GsmCallLifecycle.DISCONNECTED))
            stateMachine.markCleanupComplete(activeKey, success = true, reason = "stress_active_cleanup")
        }

        repeat(config.orientationStorms) { index ->
            localRecorder.record(
                TelecomRecordedEvent(
                    type = TelecomRecordedEventType.OVERLAY_ATTACH_REQUESTED,
                    sessionKey = null,
                    timestampMillis = tick(),
                    activationPath = "phase_1f_long_run_validation",
                    attributes = mapOf(
                        "reason" to "orientation_storm",
                        "index" to index.toString(),
                    ),
                ),
            )
        }

        val audit = auditor.audit("lifecycle_exhaustion_final")
        val events = localRecorder.snapshot()
        val rejectedTransitions = events.count { it.type == TelecomRecordedEventType.CALLBACK_IGNORED }
        val transitions = events.count {
            it.type == TelecomRecordedEventType.SESSION_TRANSITION ||
                it.type == TelecomRecordedEventType.CALLBACK_IGNORED
        }
        val activeSessions = stateMachine.sessions.value.values.count { !it.isTerminal }
        val cleanupRequired = stateMachine.sessions.value.values.count { it.cleanupRequired }
        val failures = buildSet {
            if (rejectedTransitions > 0) add(LifecycleExhaustionFailure.REJECTED_TRANSITIONS)
            if (activeSessions > 0) add(LifecycleExhaustionFailure.ACTIVE_SESSION_LEAK)
            if (cleanupRequired > 0) add(LifecycleExhaustionFailure.CLEANUP_LEAK)
            if (!audit.consistent) add(LifecycleExhaustionFailure.CONSISTENCY_FAILURE)
        }
        val result = LifecycleExhaustionResult(
            passed = failures.isEmpty(),
            failures = failures,
            transitionCount = transitions,
            rejectedTransitionCount = rejectedTransitions,
            activeSessionCount = activeSessions,
            cleanupRequiredCount = cleanupRequired,
            recordedEventCount = events.size,
        )
        record(reason, result, clock)
        return result
    }

    private fun record(
        reason: String,
        result: LifecycleExhaustionResult,
        timestamp: Long,
    ) {
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.LIFECYCLE_EXHAUSTION_TEST_REPORTED,
                sessionKey = null,
                timestampMillis = timestamp,
                activationPath = "phase_1f_long_run_validation",
                attributes = mapOf(
                    "reason" to reason,
                    "passed" to result.passed.toString(),
                    "failures" to result.failures.joinToString { it.name },
                    "transitions" to result.transitionCount.toString(),
                    "rejected_transitions" to result.rejectedTransitionCount.toString(),
                    "active_sessions" to result.activeSessionCount.toString(),
                    "cleanup_required" to result.cleanupRequiredCount.toString(),
                    "recorded_events" to result.recordedEventCount.toString(),
                ),
            ),
        )
    }
}
