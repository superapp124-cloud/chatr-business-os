package com.chatr.app.nativecalls

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

data class NativeContactMatch(
    val contactId: String,
    val displayName: String,
    val phoneNumber: String,
    val normalizedNumber: String,
    val photoUri: String?,
)

object NativeContactResolver {
    private val avatarPalette = listOf(
        "#3B82F6",
        "#10B981",
        "#8B5CF6",
        "#F59E0B",
        "#EF4444",
        "#06B6D4",
        "#EC4899",
    )

    fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context.applicationContext,
            Manifest.permission.READ_CONTACTS,
        ) == PackageManager.PERMISSION_GRANTED

    fun lookup(context: Context, rawNumber: String?): NativeContactMatch? {
        val appContext = context.applicationContext
        if (!hasPermission(appContext)) return null

        val variants = numberVariants(rawNumber)
        if (variants.isEmpty()) return null

        for (variant in variants) {
            lookupByFilter(appContext, variant)?.let { return it }
        }

        return lookupByLastDigits(appContext, variants)
    }

    fun contactsJson(context: Context, limit: Int = 50): JSONArray {
        val array = JSONArray()
        val appContext = context.applicationContext
        if (!hasPermission(appContext)) return array

        val seenNumbers = mutableSetOf<String>()
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI,
        )

        appContext.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            null,
            null,
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} COLLATE NOCASE ASC",
        )?.use { cursor ->
            while (cursor.moveToNext() && array.length() < limit.coerceIn(1, 500)) {
                val rawPhone = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER))
                    .orEmpty()
                val normalized = NativePhoneNormalizer.normalize(rawPhone)
                if (normalized.isBlank() || !seenNumbers.add(normalized)) continue

                val name = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME))
                    ?.trim()
                    .orEmpty()
                if (name.isBlank() || isPhoneLikeName(name, normalized)) continue

                val contact = NativeContactMatch(
                    contactId = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)),
                    displayName = name,
                    phoneNumber = rawPhone,
                    normalizedNumber = normalized,
                    photoUri = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.PHOTO_URI)),
                )
                array.put(contactToJson(contact))
            }
        }

        return array
    }

    fun profileFor(contact: NativeContactMatch): NativeCallerProfile =
        NativeCallerProfile(
            normalizedNumber = contact.normalizedNumber,
            hashedNumber = NativePhoneNormalizer.hash(contact.normalizedNumber),
            displayName = contact.displayName,
            trustScore = 96,
            spamReports = 0,
            spamPercentage = 0.0,
            totalReports = 0,
            riskLevel = "safe",
            communityLabel = null,
            mostCommonType = null,
            source = "android_contacts",
        )

    fun contactToJson(contact: NativeContactMatch): JSONObject =
        JSONObject().apply {
            put("id", "android-contact:${contact.contactId}:${contact.normalizedNumber}")
            put("contact_id", contact.contactId)
            put("contact_name", contact.displayName)
            put("contact_phone", contact.normalizedNumber)
            put("phone_number", contact.normalizedNumber)
            put("normalized_number", contact.normalizedNumber)
            put("photo_uri", contact.photoUri ?: JSONObject.NULL)
            put("initials", initials(contact.displayName))
            put("avatar_color", avatarColor(contact.displayName, contact.normalizedNumber))
            put("source", "android_contacts")
        }

    private fun lookupByFilter(context: Context, value: String): NativeContactMatch? {
        val uri = Uri.withAppendedPath(
            ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI,
            Uri.encode(value),
        )
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI,
        )

        context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val name = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME))
                    ?.trim()
                    .orEmpty()
                val phone = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER))
                    .orEmpty()
                val normalized = NativePhoneNormalizer.normalize(phone).ifBlank {
                    NativePhoneNormalizer.normalize(value)
                }
                if (name.isBlank() || normalized.isBlank() || isPhoneLikeName(name, normalized)) continue

                return NativeContactMatch(
                    contactId = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)),
                    displayName = name,
                    phoneNumber = phone.ifBlank { value },
                    normalizedNumber = normalized,
                    photoUri = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.PHOTO_URI)),
                )
            }
        }

        return null
    }

    private fun lookupByLastDigits(context: Context, variants: List<String>): NativeContactMatch? {
        val targetLastTen = variants
            .map { NativePhoneNormalizer.digitsOnly(it).takeLast(10) }
            .firstOrNull { it.length == 10 }
            ?: return null

        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.PHOTO_URI,
        )

        context.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            null,
            null,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val phone = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER))
                    .orEmpty()
                if (NativePhoneNormalizer.digitsOnly(phone).takeLast(10) != targetLastTen) continue

                val normalized = NativePhoneNormalizer.normalize(phone)
                val name = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME))
                    ?.trim()
                    .orEmpty()
                if (name.isBlank() || normalized.isBlank() || isPhoneLikeName(name, normalized)) continue

                return NativeContactMatch(
                    contactId = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)),
                    displayName = name,
                    phoneNumber = phone,
                    normalizedNumber = normalized,
                    photoUri = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.PHOTO_URI)),
                )
            }
        }

        return null
    }

    private fun numberVariants(rawNumber: String?): List<String> {
        val raw = rawNumber?.trim().orEmpty()
        val normalized = NativePhoneNormalizer.normalize(raw)
        val digits = NativePhoneNormalizer.digitsOnly(raw.ifBlank { normalized })
        val variants = linkedSetOf<String>()

        if (raw.isNotBlank()) variants.add(raw)
        if (normalized.isNotBlank()) {
            variants.add(normalized)
            variants.add(normalized.removePrefix("+"))
        }
        if (digits.isNotBlank()) {
            variants.add(digits)
            val lastTen = digits.takeLast(10)
            if (lastTen.length == 10) {
                variants.add(lastTen)
                variants.add("0$lastTen")
                variants.add("+91$lastTen")
                variants.add("91$lastTen")
            }
        }

        return variants.filter { it.isNotBlank() }
    }

    private fun isPhoneLikeName(name: String, phone: String): Boolean {
        if (Regex("^\\+?[\\d\\s().-]+$").matches(name.trim())) return true

        val nameDigits = NativePhoneNormalizer.digitsOnly(name)
        if (nameDigits.length < 5) return false
        val phoneDigits = NativePhoneNormalizer.digitsOnly(phone)
        return phoneDigits.contains(nameDigits) ||
            nameDigits.contains(phoneDigits.takeLast(10))
    }

    private fun initials(name: String): String {
        val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        if (parts.isEmpty()) return "?"
        return parts.take(2).map { it.first().uppercaseChar() }.joinToString("")
    }

    private fun avatarColor(name: String, phone: String): String {
        val seed = if (name.isNotBlank()) name else phone
        val index = abs(seed.hashCode()) % avatarPalette.size
        return avatarPalette[index]
    }
}
