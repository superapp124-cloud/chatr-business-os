package ai.chatr.gsm.shield

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

interface LocalUserHashProvider {
    fun localUserHash(): String?
}

object EmptyLocalUserHashProvider : LocalUserHashProvider {
    override fun localUserHash(): String? = null
}

class ChatrCallerIdentityResolver(
    private val context: Context,
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
    private val peerIdentityEnricher: ChatrPeerIdentityEnricher = ChatrPeerIdentityEnricher(flags),
    private val localUserHashProvider: LocalUserHashProvider = EmptyLocalUserHashProvider,
) : CallerIdentityResolver {

    override suspend fun resolve(phoneNumber: String?): CallerIdentity {
        val localIdentity = resolveLocalContact(phoneNumber)
        if (!flags.isEnabled(GsmFeature.GSM_INTELLIGENCE)) return localIdentity

        val localUserHash = localUserHashProvider.localUserHash() ?: return localIdentity
        val phoneNumberHash = phoneNumber?.stableHash() ?: return localIdentity

        return peerIdentityEnricher.enrich(
            baseIdentity = localIdentity,
            localUserHash = localUserHash,
            phoneNumberHash = phoneNumberHash,
        )
    }

    private suspend fun resolveLocalContact(phoneNumber: String?): CallerIdentity {
        if (phoneNumber.isNullOrBlank()) {
            return unknown(phoneNumber)
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return unknown(phoneNumber)
        }

        return withContext(Dispatchers.IO) {
            val lookupUri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(phoneNumber),
            )
            val projection = arrayOf(
                ContactsContract.PhoneLookup.DISPLAY_NAME,
                ContactsContract.PhoneLookup.PHOTO_URI,
            )

            context.contentResolver.query(
                lookupUri,
                projection,
                null,
                null,
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                    val photoIndex = cursor.getColumnIndex(ContactsContract.PhoneLookup.PHOTO_URI)
                    CallerIdentity(
                        phoneNumber = phoneNumber,
                        displayName = cursor.getStringOrNull(nameIndex),
                        isSavedContact = true,
                        verifiedProfile = cursor.getStringOrNull(photoIndex)?.let { photoUri ->
                            ChatrVerifiedProfile(
                                displayName = cursor.getStringOrNull(nameIndex) ?: phoneNumber,
                                avatarUri = photoUri,
                                verificationLevel = VerificationLevel.DEVICE_CONTACT,
                            )
                        },
                    )
                } else {
                    unknown(phoneNumber)
                }
            } ?: unknown(phoneNumber)
        }
    }

    private fun unknown(phoneNumber: String?): CallerIdentity {
        return CallerIdentity(
            phoneNumber = phoneNumber,
            displayName = null,
            isSavedContact = false,
            verifiedProfile = null,
        )
    }

    private fun android.database.Cursor.getStringOrNull(index: Int): String? {
        if (index < 0 || isNull(index)) return null
        return getString(index)
    }

    private fun String.stableHash(): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(filter { it.isDigit() || it == '+' }.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { byte -> "%02x".format(byte) }
    }
}
