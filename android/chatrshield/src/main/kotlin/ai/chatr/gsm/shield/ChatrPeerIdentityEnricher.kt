package ai.chatr.gsm.shield

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import ai.chatr.gsm.core.handshake.DisabledGsmMetadataHandshakeClient
import ai.chatr.gsm.core.handshake.GsmHandshakeCapability
import ai.chatr.gsm.core.handshake.GsmMetadataHandshakeClient
import ai.chatr.gsm.core.handshake.GsmMetadataHandshakeOffer

class ChatrPeerIdentityEnricher(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val handshakeClient: GsmMetadataHandshakeClient = DisabledGsmMetadataHandshakeClient(),
) {
    suspend fun enrich(
        baseIdentity: CallerIdentity,
        localUserHash: String,
        phoneNumberHash: String,
    ): CallerIdentity {
        if (!flags.isEnabled(GsmFeature.GSM_INTELLIGENCE)) return baseIdentity

        val result = handshakeClient.exchangeMetadataOnly(
            GsmMetadataHandshakeOffer(
                localUserHash = localUserHash,
                phoneNumberHash = phoneNumberHash,
                capabilities = setOf(
                    GsmHandshakeCapability.VERIFIED_CHATR_PROFILE,
                    GsmHandshakeCapability.TRUST_SCORE,
                    GsmHandshakeCapability.SPAM_REPUTATION,
                    GsmHandshakeCapability.AI_ENHANCEMENT,
                    GsmHandshakeCapability.SUBTITLE_CAPABILITY,
                ),
                createdAtMillis = System.currentTimeMillis(),
            ),
        ) ?: return baseIdentity

        val remoteDisplayName = result.remoteDisplayName?.takeIf { it.isNotBlank() }
        if (!result.remoteUserVerified || remoteDisplayName == null) {
            return baseIdentity
        }

        return baseIdentity.copy(
            displayName = baseIdentity.displayName ?: remoteDisplayName,
            verifiedProfile = ChatrVerifiedProfile(
                displayName = remoteDisplayName,
                avatarUri = null,
                verificationLevel = VerificationLevel.CHATR_VERIFIED,
            ),
        )
    }
}
