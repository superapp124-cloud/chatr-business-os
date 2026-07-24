package com.chatr.app.shield

import android.content.Context
import com.chatr.app.nativecalls.NativeGsmDefenseEngine
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.UUID
import java.util.concurrent.Executors

object ShieldAnalyticsEngine {
    private val executor = Executors.newSingleThreadExecutor()

    fun recordScreenedCall(
        context: Context,
        id: String,
        normalizedNumber: String,
        hashedNumber: String,
        direction: String,
        decision: String,
        riskScore: Int,
        riskLevel: String,
        scamCategory: String?,
        confidence: Double,
        recommendedAction: String,
        verificationStatus: String?,
        latencyMs: Long,
        source: String,
        rawPayload: String?,
        startedAt: Long = System.currentTimeMillis(),
    ) {
        val appContext = context.applicationContext
        executor.execute {
            val dao = ShieldDatabase.get(appContext).dao()
            val entity = ScreenedCallEntity(
                id = id,
                normalizedNumber = normalizedNumber,
                hashedNumber = hashedNumber,
                direction = direction,
                decision = decision,
                riskScore = riskScore.coerceIn(0, 100),
                riskLevel = riskLevel,
                scamCategory = scamCategory,
                confidence = confidence.coerceIn(0.0, 1.0),
                recommendedAction = recommendedAction,
                verificationStatus = verificationStatus,
                latencyMs = latencyMs.coerceAtLeast(0),
                source = source,
                rawPayload = rawPayload,
                startedAt = startedAt,
            )
            dao.upsertScreenedCall(entity)

            if (decision in setOf("block", "blocked", "reject", "cancel")) {
                dao.upsertBlockedCall(
                    BlockedCallEntity(
                        id = "blocked:$id",
                        normalizedNumber = normalizedNumber,
                        hashedNumber = hashedNumber,
                        reason = scamCategory ?: riskLevel,
                        source = source,
                        blockedAt = startedAt,
                    ),
                )
            }

            if (riskScore >= 45 || decision in setOf("warn", "challenge", "block", "blocked", "reject", "cancel")) {
                dao.upsertScamReport(
                    ScamReportEntity(
                        id = "scam:$id",
                        normalizedNumber = normalizedNumber,
                        hashedNumber = hashedNumber,
                        category = scamCategory ?: riskLevel,
                        confidence = confidence.coerceIn(0.0, 1.0),
                        reporterType = source,
                        notes = recommendedAction,
                        createdAt = startedAt,
                    ),
                )
            }

            if (riskScore >= 60 || decision in setOf("warn", "challenge", "block", "blocked", "reject", "cancel")) {
                dao.upsertProtectionEvent(
                    ProtectionEventEntity(
                        id = "threat:$id",
                        eventType = "call_risk",
                        severity = if (riskScore >= 75) "high" else "medium",
                        message = recommendedAction,
                        payload = rawPayload,
                        createdAt = startedAt,
                    ),
                )
            }
        }
    }

    fun recordTrackerEvent(
        context: Context,
        domain: String,
        packageName: String?,
        category: String,
        blocked: Boolean,
    ) {
        if (domain.isBlank()) return
        val appContext = context.applicationContext
        executor.execute {
            ShieldDatabase.get(appContext).dao().upsertTrackerEvent(
                TrackerEventEntity(
                    id = "tracker:${domain.lowercase()}:${System.currentTimeMillis()}",
                    domain = domain.lowercase(),
                    packageName = packageName,
                    trackerCategory = category,
                    blocked = blocked,
                    blockedAt = System.currentTimeMillis(),
                ),
            )
        }
    }

    fun recordLeakResult(
        context: Context,
        emailHash: String,
        provider: String,
        breachName: String?,
        severity: String,
        exposedDataClasses: String,
        remediation: String?,
        foundAt: Long,
    ) {
        if (emailHash.isBlank()) return
        val appContext = context.applicationContext
        executor.execute {
            ShieldDatabase.get(appContext).dao().upsertLeakResult(
                LeakResultEntity(
                    id = "leak:${provider}:${emailHash}:${breachName.orEmpty()}",
                    emailHash = emailHash,
                    provider = provider,
                    breachName = breachName,
                    severity = severity,
                    exposedDataClasses = exposedDataClasses,
                    remediation = remediation,
                    foundAt = foundAt,
                    syncedAt = System.currentTimeMillis(),
                ),
            )
        }
    }

    fun statusJson(context: Context): JSONObject {
        val appContext = context.applicationContext
        val dao = ShieldDatabase.get(appContext).dao()
        val todayStart = startOfToday()
        val callsToday = dao.callsScreenedToday(todayStart)
        val scamsBlocked = dao.scamsBlocked()
        val risky = dao.riskyCallsDetected()
        val trackers = dao.trackersBlocked()
        val monitoredEmails = dao.monitoredEmails()
        val exposureCount = dao.exposureCount()
        val lastThreatAt = dao.lastThreatDetectedAt()
        val permissions = ShieldPermissionManager.snapshot(context)
        val features = NativeGsmDefenseEngine.stateJson(appContext).optJSONObject("features") ?: JSONObject()

        return JSONObject().apply {
            put("permissions", permissions)
            put("metrics", JSONObject().apply {
                put("callsScreenedToday", callsToday)
                put("scamsBlocked", scamsBlocked)
                put("trackersBlocked", trackers)
                put("riskyCallsDetected", risky)
                put("activeDefenses", activeDefenseCount(features, permissions))
                put("protectionUptimeMs", protectionUptimeMs(appContext))
                put("lastThreatDetectedAt", lastThreatAt ?: JSONObject.NULL)
                put("monitoredEmails", monitoredEmails)
                put("exposureCount", exposureCount)
                put("privacyScore", privacyScore(permissions, scamsBlocked, trackers, exposureCount))
            })
            put("defenses", defenseCards(appContext, features, permissions, dao))
        }
    }

    private fun defenseCards(context: Context, features: JSONObject, permissions: JSONObject, dao: ShieldDao): JSONArray {
        val cards = permissions.optJSONArray("cards") ?: JSONArray()
        val byKey = mutableMapOf<String, JSONObject>()
        val trackerRunning = TrackerProtectionService.isRunning(context)
        for (index in 0 until cards.length()) {
            val card = cards.optJSONObject(index) ?: continue
            byKey[card.optString("key")] = card
        }

        fun permissionState(key: String): String = byKey[key]?.optString("state") ?: "denied"
        fun card(
            key: String,
            title: String,
            enabled: Boolean,
            requiredKeys: List<String>,
            setupText: String,
            activeText: String,
        ): JSONObject {
            val missing = requiredKeys.mapNotNull { permissionKey ->
                val permission = byKey[permissionKey]
                if (permission?.optString("state") == "granted") null else permission
            }
            val state = when {
                !enabled -> "disabled"
                missing.isEmpty() -> "active"
                missing.any { it.optString("state") == "unavailable" } -> "error"
                missing.size < requiredKeys.size -> "partially_configured"
                else -> "setup"
            }
            return JSONObject().apply {
                put("key", key)
                put("title", title)
                put("enabled", enabled)
                put("state", state)
                put("verified", state == "active")
                put("setupProgress", if (requiredKeys.isEmpty()) 1.0 else (requiredKeys.size - missing.size).toDouble() / requiredKeys.size.toDouble())
                put("statusText", if (state == "active") activeText else setupText)
                put("missingPermissions", JSONArray().apply { missing.forEach { put(it) } })
                put("primaryAction", missing.firstOrNull()?.optString("actionKey") ?: JSONObject.NULL)
                put("permissionState", requiredKeys.associateWith { permissionState(it) }.let { states ->
                    JSONObject().apply { states.forEach { (permissionKey, value) -> put(permissionKey, value) } }
                })
            }
        }

        return JSONArray().apply {
            put(
                card(
                    key = "aiScreen",
                    title = "AI Call Screen",
                    enabled = features.optBoolean(NativeGsmDefenseEngine.FEATURE_AI_CALL_SCREEN, true),
                    requiredKeys = listOf("read_phone_state", "answer_phone_calls", "system_alert_window"),
                    setupText = "Needs phone and overlay permissions.",
                    activeText = "Live caller warnings are ready.",
                ),
            )
            put(
                card(
                    key = "scamEngine",
                    title = "Scam Engine",
                    enabled = features.optBoolean(NativeGsmDefenseEngine.FEATURE_SCAM_ENGINE, true),
                    requiredKeys = listOf("read_phone_state", "call_screening_role"),
                    setupText = "Needs Android Call Screening role.",
                    activeText = "Incoming GSM calls are scored by local rules and reputation.",
                ),
            )
            put(
                card(
                    key = "darkWeb",
                    title = "Dark Web Scan",
                    enabled = features.optBoolean(NativeGsmDefenseEngine.FEATURE_DARK_WEB_SCAN, true),
                    requiredKeys = emptyList(),
                    setupText = "Waiting for monitored emails or provider sync.",
                    activeText = if (dao.monitoredEmails() > 0) "Leak monitoring has provider data." else "No monitored emails configured.",
                ).apply {
                    if (dao.monitoredEmails() == 0) {
                        put("state", "partially_configured")
                        put("verified", false)
                        put("statusText", "No monitored emails configured.")
                    }
                },
            )
            put(
                card(
                    key = "antiTracker",
                    title = "Anti-Tracker",
                    enabled = features.optBoolean(NativeGsmDefenseEngine.FEATURE_ANTI_TRACKER, true),
                    requiredKeys = listOf("vpn"),
                    setupText = "Needs Android VPN consent.",
                    activeText = "Tracker DNS filter is running.",
                ).apply {
                    if (optString("state") == "active" && !trackerRunning) {
                        put("state", "partially_configured")
                        put("verified", false)
                        put("statusText", "VPN permission granted. Start local filter.")
                        put("primaryAction", "request_vpn")
                    }
                },
            )
        }
    }

    private fun activeDefenseCount(features: JSONObject, permissions: JSONObject): Int {
        val cards = permissions.optJSONArray("cards") ?: JSONArray()
        val grantedKeys = mutableSetOf<String>()
        for (index in 0 until cards.length()) {
            val card = cards.optJSONObject(index) ?: continue
            if (card.optString("state") == "granted") grantedKeys.add(card.optString("key"))
        }
        var count = 0
        if (features.optBoolean(NativeGsmDefenseEngine.FEATURE_AI_CALL_SCREEN, true) &&
            grantedKeys.contains("read_phone_state") &&
            grantedKeys.contains("system_alert_window")
        ) count++
        if (features.optBoolean(NativeGsmDefenseEngine.FEATURE_SCAM_ENGINE, true) &&
            grantedKeys.contains("call_screening_role")
        ) count++
        if (features.optBoolean(NativeGsmDefenseEngine.FEATURE_DARK_WEB_SCAN, true)) count++
        if (features.optBoolean(NativeGsmDefenseEngine.FEATURE_ANTI_TRACKER, true) &&
            grantedKeys.contains("vpn")
        ) count++
        return count
    }

    private fun privacyScore(permissions: JSONObject, scamsBlocked: Int, trackersBlocked: Int, exposureCount: Int): Int {
        val setup = permissions.optDouble("setupProgress", 0.0)
        val base = (setup * 70.0).toInt()
        val protection = (scamsBlocked.coerceAtMost(10) + trackersBlocked.coerceAtMost(20) / 2).coerceAtMost(20)
        val leakPenalty = (exposureCount * 5).coerceAtMost(25)
        return (base + protection - leakPenalty).coerceIn(0, 100)
    }

    private fun protectionUptimeMs(context: Context): Long {
        val prefs = context.getSharedPreferences("chatr_shield_runtime", Context.MODE_PRIVATE)
        val existing = prefs.getLong("enabled_since", 0L)
        val now = System.currentTimeMillis()
        if (existing > 0L) return now - existing
        prefs.edit().putLong("enabled_since", now).apply()
        return 0L
    }

    private fun startOfToday(): Long {
        return Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    fun eventId(prefix: String): String = "$prefix:${UUID.randomUUID()}"
}
