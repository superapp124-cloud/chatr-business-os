package ai.chatr.gsm.core.handshake

enum class GsmHandshakeCapability {
    VERIFIED_CHATR_PROFILE,
    TRUST_SCORE,
    SPAM_REPUTATION,
    ENCRYPTED_CALL_NOTES,
    AI_ENHANCEMENT,
    SUBTITLE_CAPABILITY,
}

data class GsmMetadataHandshakeOffer(
    val localUserHash: String,
    val phoneNumberHash: String,
    val capabilities: Set<GsmHandshakeCapability>,
    val createdAtMillis: Long,
)

data class GsmMetadataHandshakeResult(
    val remoteUserVerified: Boolean,
    val remoteDisplayName: String?,
    val remoteTrustScore: Float?,
    val sharedCapabilities: Set<GsmHandshakeCapability>,
)

interface GsmMetadataHandshakeClient {
    suspend fun exchangeMetadataOnly(offer: GsmMetadataHandshakeOffer): GsmMetadataHandshakeResult?
}

class DisabledGsmMetadataHandshakeClient : GsmMetadataHandshakeClient {
    override suspend fun exchangeMetadataOnly(
        offer: GsmMetadataHandshakeOffer,
    ): GsmMetadataHandshakeResult? = null
}
