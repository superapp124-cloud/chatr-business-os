package ai.chatr.gsm.shield

data class ChatrVerifiedProfile(
    val displayName: String,
    val avatarUri: String?,
    val verificationLevel: VerificationLevel,
)

enum class VerificationLevel {
    NONE,
    DEVICE_CONTACT,
    CHATR_VERIFIED,
}

data class CallerIdentity(
    val phoneNumber: String?,
    val displayName: String?,
    val isSavedContact: Boolean,
    val verifiedProfile: ChatrVerifiedProfile?,
) {
    val bestDisplayName: String?
        get() = verifiedProfile?.displayName ?: displayName
}

interface CallerIdentityResolver {
    suspend fun resolve(phoneNumber: String?): CallerIdentity
}

class DisabledCallerIdentityResolver : CallerIdentityResolver {
    override suspend fun resolve(phoneNumber: String?): CallerIdentity {
        return CallerIdentity(
            phoneNumber = phoneNumber,
            displayName = null,
            isSavedContact = false,
            verifiedProfile = null,
        )
    }
}
