package com.chatr.app.nativecalls

data class NativeCallerProfile(
    val normalizedNumber: String,
    val hashedNumber: String,
    val displayName: String,
    val trustScore: Int,
    val spamReports: Int,
    val spamPercentage: Double,
    val totalReports: Int,
    val riskLevel: String,
    val communityLabel: String?,
    val mostCommonType: String?,
    val source: String,
    val lookedUpAt: Long = System.currentTimeMillis(),
)

data class NativeCallEvent(
    val deviceEventId: String,
    val callLogId: String?,
    val phoneNumber: String,
    val normalizedNumber: String,
    val hashedNumber: String,
    val contactName: String?,
    val callerName: String?,
    val direction: String,
    val status: String,
    val startedAt: Long,
    val endedAt: Long?,
    val durationSeconds: Long,
    val trustScore: Int,
    val spamReports: Int,
    val riskLevel: String,
    val source: String,
    val rawPayload: String?,
    val syncState: String = "pending",
)
