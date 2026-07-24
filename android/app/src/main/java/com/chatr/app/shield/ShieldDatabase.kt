package com.chatr.app.shield

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(
    tableName = "blocked_calls",
    indices = [
        Index(value = ["hashedNumber"]),
        Index(value = ["blockedAt"]),
        Index(value = ["reason"]),
    ],
)
data class BlockedCallEntity(
    @PrimaryKey val id: String,
    val normalizedNumber: String,
    val hashedNumber: String,
    val reason: String,
    val source: String,
    val blockedAt: Long,
    val syncedAt: Long? = null,
)

@Entity(
    tableName = "screened_calls",
    indices = [
        Index(value = ["normalizedNumber"]),
        Index(value = ["hashedNumber"]),
        Index(value = ["direction"]),
        Index(value = ["decision"]),
        Index(value = ["startedAt"]),
    ],
)
data class ScreenedCallEntity(
    @PrimaryKey val id: String,
    val normalizedNumber: String,
    val hashedNumber: String,
    val direction: String,
    val decision: String,
    val riskScore: Int,
    val riskLevel: String,
    val scamCategory: String?,
    val confidence: Double,
    val recommendedAction: String,
    val verificationStatus: String?,
    val latencyMs: Long,
    val source: String,
    val rawPayload: String?,
    val startedAt: Long,
    val syncedAt: Long? = null,
)

@Entity(
    tableName = "scam_reports",
    indices = [
        Index(value = ["hashedNumber"]),
        Index(value = ["category"]),
        Index(value = ["createdAt"]),
    ],
)
data class ScamReportEntity(
    @PrimaryKey val id: String,
    val normalizedNumber: String?,
    val hashedNumber: String,
    val category: String,
    val confidence: Double,
    val reporterType: String,
    val notes: String?,
    val createdAt: Long,
    val syncedAt: Long? = null,
)

@Entity(
    tableName = "tracker_events",
    indices = [
        Index(value = ["domain"]),
        Index(value = ["packageName"]),
        Index(value = ["blockedAt"]),
    ],
)
data class TrackerEventEntity(
    @PrimaryKey val id: String,
    val domain: String,
    val packageName: String?,
    val trackerCategory: String,
    val blocked: Boolean,
    val blockedAt: Long,
    val syncedAt: Long? = null,
)

@Entity(
    tableName = "leak_results",
    indices = [
        Index(value = ["emailHash"]),
        Index(value = ["severity"]),
        Index(value = ["foundAt"]),
    ],
)
data class LeakResultEntity(
    @PrimaryKey val id: String,
    val emailHash: String,
    val provider: String,
    val breachName: String?,
    val severity: String,
    val exposedDataClasses: String,
    val remediation: String?,
    val foundAt: Long,
    val syncedAt: Long? = null,
)

@Entity(
    tableName = "protection_events",
    indices = [
        Index(value = ["eventType"]),
        Index(value = ["createdAt"]),
        Index(value = ["syncedAt"]),
    ],
)
data class ProtectionEventEntity(
    @PrimaryKey val id: String,
    val eventType: String,
    val severity: String,
    val message: String,
    val payload: String?,
    val createdAt: Long,
    val syncedAt: Long? = null,
)

@Entity(
    tableName = "permission_states",
    indices = [
        Index(value = ["permissionKey"], unique = true),
        Index(value = ["state"]),
        Index(value = ["updatedAt"]),
    ],
)
data class PermissionStateEntity(
    @PrimaryKey val id: String,
    val permissionKey: String,
    val state: String,
    val actionKey: String?,
    val manufacturerRestricted: Boolean,
    val updatedAt: Long,
)

@Entity(
    tableName = "trust_contacts",
    indices = [
        Index(value = ["normalizedNumber"], unique = true),
        Index(value = ["hashedNumber"]),
        Index(value = ["trustLevel"]),
    ],
)
data class TrustContactEntity(
    @PrimaryKey val id: String,
    val normalizedNumber: String,
    val hashedNumber: String,
    val displayName: String?,
    val trustLevel: String,
    val source: String,
    val updatedAt: Long,
)

data class ShieldAnalyticsSnapshot(
    val callsScreenedToday: Int,
    val scamsBlocked: Int,
    val riskyCallsDetected: Int,
    val trackersBlocked: Int,
    val monitoredEmails: Int,
    val exposureCount: Int,
    val lastThreatDetectedAt: Long?,
)

@Dao
interface ShieldDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertScreenedCall(entity: ScreenedCallEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertBlockedCall(entity: BlockedCallEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertScamReport(entity: ScamReportEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertTrackerEvent(entity: TrackerEventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertLeakResult(entity: LeakResultEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertProtectionEvent(entity: ProtectionEventEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertPermissionState(entity: PermissionStateEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertTrustContact(entity: TrustContactEntity)

    @Query("SELECT COUNT(*) FROM screened_calls WHERE startedAt >= :todayStart")
    fun callsScreenedToday(todayStart: Long): Int

    @Query("SELECT COUNT(*) FROM screened_calls WHERE decision IN ('block', 'blocked', 'reject', 'cancel')")
    fun scamsBlocked(): Int

    @Query("SELECT COUNT(*) FROM screened_calls WHERE riskScore >= :threshold OR decision IN ('warn', 'challenge', 'block', 'blocked', 'reject', 'cancel')")
    fun riskyCallsDetected(threshold: Int = 60): Int

    @Query("SELECT COUNT(*) FROM tracker_events WHERE blocked = 1")
    fun trackersBlocked(): Int

    @Query("SELECT COUNT(DISTINCT emailHash) FROM leak_results")
    fun monitoredEmails(): Int

    @Query("SELECT COUNT(*) FROM leak_results WHERE severity NOT IN ('none', 'clean')")
    fun exposureCount(): Int

    @Query("SELECT MAX(startedAt) FROM screened_calls WHERE riskScore >= :threshold OR decision IN ('warn', 'challenge', 'block', 'blocked', 'reject', 'cancel')")
    fun lastThreatDetectedAt(threshold: Int = 60): Long?

    @Query("SELECT * FROM leak_results ORDER BY foundAt DESC LIMIT :limit")
    fun recentLeakResults(limit: Int = 5): List<LeakResultEntity>

    @Query("SELECT * FROM tracker_events WHERE blocked = 1 ORDER BY blockedAt DESC LIMIT :limit")
    fun recentTrackerEvents(limit: Int = 5): List<TrackerEventEntity>

    @Query("SELECT * FROM protection_events WHERE syncedAt IS NULL ORDER BY createdAt ASC LIMIT :limit")
    fun pendingProtectionEvents(limit: Int = 50): List<ProtectionEventEntity>

    @Query("SELECT * FROM scam_reports WHERE syncedAt IS NULL ORDER BY createdAt ASC LIMIT :limit")
    fun pendingScamReports(limit: Int = 50): List<ScamReportEntity>

    @Query("UPDATE protection_events SET syncedAt = :syncedAt WHERE id IN (:ids)")
    fun markProtectionEventsSynced(ids: List<String>, syncedAt: Long)

    @Query("UPDATE scam_reports SET syncedAt = :syncedAt WHERE id IN (:ids)")
    fun markScamReportsSynced(ids: List<String>, syncedAt: Long)
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertChatMessage(entity: ShieldChatMessageEntity)
    
    @Query("SELECT * FROM shield_chat_messages WHERE conversationId = :conversationId ORDER BY createdAt ASC")
    fun getChatMessages(conversationId: String): kotlinx.coroutines.flow.Flow<List<ShieldChatMessageEntity>>
}

@Database(
    entities = [
        BlockedCallEntity::class,
        ScreenedCallEntity::class,
        ScamReportEntity::class,
        TrackerEventEntity::class,
        LeakResultEntity::class,
        ProtectionEventEntity::class,
        PermissionStateEntity::class,
        TrustContactEntity::class,
        ShieldChatMessageEntity::class,
    ],
    version = 2,
    exportSchema = false,
)
abstract class ShieldDatabase : RoomDatabase() {
    abstract fun dao(): ShieldDao

    companion object {
        @Volatile
        private var instance: ShieldDatabase? = null

        fun get(context: Context): ShieldDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    ShieldDatabase::class.java,
                    "chatr_shield.db",
                )
                    .fallbackToDestructiveMigration()
                    .allowMainThreadQueries()
                    .build()
                    .also { instance = it }
            }
        }
    }
}
