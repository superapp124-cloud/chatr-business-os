package com.chatr.app

import android.Manifest
import android.content.ContentProviderOperation
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.ContactsContract
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object ChatrSystemContactSync {

    private const val TAG = "ChatrSystemContact"
    private const val MANAGED_NOTE_PREFIX = "CHATR_MANAGED"
    private const val PHOTO_TIMEOUT_MS = 5000
    private val e164PhonePattern = Regex("^\\+[1-9]\\d{7,14}$")

    private val executor = Executors.newSingleThreadExecutor()
    private val uuidLikePattern = Regex("^[0-9a-fA-F-]{32,}$")

    private data class ContactMatch(
        val contactId: Long,
        val rawContactId: Long,
        val displayName: String?,
        val managed: Boolean,
    )

    fun ensureContact(
        context: Context,
        phoneNumber: String?,
        displayName: String?,
        remoteId: String? = null,
    ) {
        try {
            upsertContact(context.applicationContext, phoneNumber, displayName, remoteId)
        } catch (error: Throwable) {
            Log.e(TAG, "Failed to sync system contact", error)
        }
    }

    fun syncAsync(
        context: Context,
        phoneNumber: String?,
        displayName: String?,
        avatarUrl: String?,
        remoteId: String? = null,
    ) {
        executor.execute {
            try {
                sync(context.applicationContext, phoneNumber, displayName, avatarUrl, remoteId)
            } catch (error: Throwable) {
                Log.e(TAG, "Failed to sync system contact photo", error)
            }
        }
    }

    private fun sync(
        context: Context,
        phoneNumber: String?,
        displayName: String?,
        avatarUrl: String?,
        remoteId: String?,
    ) {
        val match = upsertContact(context, phoneNumber, displayName, remoteId) ?: return

        if (!match.managed || avatarUrl.isNullOrBlank()) {
            return
        }

        val photoBytes = loadPhotoBytes(avatarUrl) ?: return
        replaceMimeRows(
            context = context,
            rawContactId = match.rawContactId,
            mimeType = ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE,
            values = ContentValues().apply {
                put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Photo.CONTENT_ITEM_TYPE)
                put(ContactsContract.CommonDataKinds.Photo.PHOTO, photoBytes)
            },
        )
    }

    private fun upsertContact(
        context: Context,
        phoneNumber: String?,
        displayName: String?,
        remoteId: String?,
    ): ContactMatch? {
        if (!hasContactPermissions(context)) {
            Log.d(TAG, "Contacts permissions not granted; skipping system dialer sync")
            return null
        }

        val storedPhone = sanitizePhoneNumber(phoneNumber) ?: return null
        val safeName = sanitizeDisplayName(displayName, storedPhone)
        val existingMatch = findContactByPhone(context, storedPhone)

        return when {
            existingMatch?.managed == true -> {
                updateManagedContact(context, existingMatch.rawContactId, storedPhone, safeName, remoteId)
                existingMatch.copy(displayName = safeName, managed = true)
            }
            existingMatch != null -> {
                Log.d(TAG, "Existing device contact already owns $storedPhone")
                existingMatch
            }
            else -> createManagedContact(context, storedPhone, safeName, remoteId)
        }
    }

    private fun createManagedContact(
        context: Context,
        phoneNumber: String,
        displayName: String,
        remoteId: String?,
    ): ContactMatch? {
        val operations = arrayListOf(
            ContentProviderOperation.newInsert(ContactsContract.RawContacts.CONTENT_URI)
                .withValue(ContactsContract.RawContacts.ACCOUNT_TYPE, null)
                .withValue(ContactsContract.RawContacts.ACCOUNT_NAME, null)
                .build(),
            ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, displayName)
                .withValue(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME, displayName)
                .build(),
            ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Phone.NUMBER, phoneNumber)
                .withValue(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
                .build(),
            ContentProviderOperation.newInsert(ContactsContract.Data.CONTENT_URI)
                .withValueBackReference(ContactsContract.Data.RAW_CONTACT_ID, 0)
                .withValue(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                .withValue(ContactsContract.CommonDataKinds.Note.NOTE, buildManagedNote(remoteId))
                .build(),
        )

        val results = context.contentResolver.applyBatch(ContactsContract.AUTHORITY, operations)
        val rawContactUri = results.firstOrNull()?.uri ?: return null
        val rawContactId = ContentUris.parseId(rawContactUri)
        val contactId = lookupContactIdForRawContact(context, rawContactId) ?: return null

        Log.i(TAG, "Created managed system contact $contactId for $phoneNumber")
        return ContactMatch(contactId = contactId, rawContactId = rawContactId, displayName = displayName, managed = true)
    }

    private fun updateManagedContact(
        context: Context,
        rawContactId: Long,
        phoneNumber: String,
        displayName: String,
        remoteId: String?,
    ) {
        replaceMimeRows(
            context = context,
            rawContactId = rawContactId,
            mimeType = ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE,
            values = ContentValues().apply {
                put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.StructuredName.CONTENT_ITEM_TYPE)
                put(ContactsContract.CommonDataKinds.StructuredName.DISPLAY_NAME, displayName)
                put(ContactsContract.CommonDataKinds.StructuredName.GIVEN_NAME, displayName)
            },
        )

        replaceMimeRows(
            context = context,
            rawContactId = rawContactId,
            mimeType = ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE,
            values = ContentValues().apply {
                put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE)
                put(ContactsContract.CommonDataKinds.Phone.NUMBER, phoneNumber)
                put(ContactsContract.CommonDataKinds.Phone.TYPE, ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE)
            },
        )

        replaceMimeRows(
            context = context,
            rawContactId = rawContactId,
            mimeType = ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE,
            values = ContentValues().apply {
                put(ContactsContract.Data.MIMETYPE, ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE)
                put(ContactsContract.CommonDataKinds.Note.NOTE, buildManagedNote(remoteId))
            },
        )
    }

    private fun replaceMimeRows(
        context: Context,
        rawContactId: Long,
        mimeType: String,
        values: ContentValues,
    ) {
        context.contentResolver.delete(
            ContactsContract.Data.CONTENT_URI,
            "${ContactsContract.Data.RAW_CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
            arrayOf(rawContactId.toString(), mimeType),
        )

        values.put(ContactsContract.Data.RAW_CONTACT_ID, rawContactId)
        context.contentResolver.insert(ContactsContract.Data.CONTENT_URI, values)
    }

    private fun findContactByPhone(context: Context, phoneNumber: String): ContactMatch? {
        val candidates = linkedSetOf(phoneNumber, normalizePhoneForLookup(phoneNumber))
        var fallbackMatch: ContactMatch? = null

        for (candidate in candidates) {
            if (candidate.isBlank()) {
                continue
            }

            val uri = Uri.withAppendedPath(
                ContactsContract.CommonDataKinds.Phone.CONTENT_FILTER_URI,
                Uri.encode(candidate),
            )

            context.contentResolver.query(
                uri,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ),
                null,
                null,
                null,
            )?.use { cursor ->
                val contactIdIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val displayNameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)

                while (cursor.moveToNext()) {
                    val contactId = cursor.getLong(contactIdIndex)
                    val rawContactId = lookupRawContactIdForContact(context, contactId) ?: continue
                    val displayName = cursor.getString(displayNameIndex)
                    val managed = isManagedRawContact(context, rawContactId)
                    val match = ContactMatch(contactId, rawContactId, displayName, managed)

                    if (managed) {
                        return match
                    }

                    if (fallbackMatch == null) {
                        fallbackMatch = match
                    }
                }
            }
        }

        return fallbackMatch
    }

    private fun isManagedRawContact(context: Context, rawContactId: Long): Boolean {
        context.contentResolver.query(
            ContactsContract.Data.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Note.NOTE),
            "${ContactsContract.Data.RAW_CONTACT_ID} = ? AND ${ContactsContract.Data.MIMETYPE} = ?",
            arrayOf(rawContactId.toString(), ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE),
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val note = cursor.getString(0)
                if (note?.startsWith(MANAGED_NOTE_PREFIX) == true) {
                    return true
                }
            }
        }

        return false
    }

    private fun lookupContactIdForRawContact(context: Context, rawContactId: Long): Long? {
        context.contentResolver.query(
            ContactsContract.RawContacts.CONTENT_URI,
            arrayOf(ContactsContract.RawContacts.CONTACT_ID),
            "${ContactsContract.RawContacts._ID} = ?",
            arrayOf(rawContactId.toString()),
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getLong(0)
            }
        }

        return null
    }

    private fun lookupRawContactIdForContact(context: Context, contactId: Long): Long? {
        context.contentResolver.query(
            ContactsContract.RawContacts.CONTENT_URI,
            arrayOf(ContactsContract.RawContacts._ID),
            "${ContactsContract.RawContacts.CONTACT_ID} = ?",
            arrayOf(contactId.toString()),
            "${ContactsContract.RawContacts._ID} ASC",
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getLong(0)
            }
        }

        return null
    }

    private fun loadPhotoBytes(avatarUrl: String): ByteArray? {
        val rawBytes = when {
            avatarUrl.startsWith("data:image", ignoreCase = true) -> {
                val base64Payload = avatarUrl.substringAfter(',', "")
                if (base64Payload.isBlank()) return null
                Base64.decode(base64Payload, Base64.DEFAULT)
            }
            else -> {
                val connection = (URL(avatarUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = PHOTO_TIMEOUT_MS
                    readTimeout = PHOTO_TIMEOUT_MS
                    instanceFollowRedirects = true
                }

                try {
                    connection.inputStream.use { it.readBytes() }
                } finally {
                    connection.disconnect()
                }
            }
        }

        return compressPhoto(rawBytes)
    }

    private fun compressPhoto(rawBytes: ByteArray): ByteArray {
        val bitmap = BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size) ?: return rawBytes
        val scaledBitmap = downscaleBitmap(bitmap)
        val output = ByteArrayOutputStream()

        scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 88, output)

        if (scaledBitmap !== bitmap) {
            scaledBitmap.recycle()
        }
        bitmap.recycle()

        return output.toByteArray()
    }

    private fun downscaleBitmap(bitmap: Bitmap): Bitmap {
        val maxDimension = maxOf(bitmap.width, bitmap.height)
        if (maxDimension <= 512) {
            return bitmap
        }

        val scale = 512f / maxDimension.toFloat()
        val width = (bitmap.width * scale).toInt().coerceAtLeast(1)
        val height = (bitmap.height * scale).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, width, height, true)
    }

    private fun sanitizePhoneNumber(phoneNumber: String?): String? {
        val normalized = normalizePhoneForLookup(phoneNumber?.trim().orEmpty())
        return normalized.takeIf { e164PhonePattern.matches(it) }
    }

    private fun sanitizeDisplayName(displayName: String?, phoneNumber: String): String {
        val trimmed = displayName?.trim().orEmpty()
        if (trimmed.isBlank()) {
            return phoneNumber
        }

        if (uuidLikePattern.matches(trimmed)) {
            return phoneNumber
        }

        return trimmed
    }

    private fun normalizePhoneForLookup(phoneNumber: String): String {
        return buildString(phoneNumber.length) {
            phoneNumber.forEachIndexed { index, char ->
                if (char.isDigit() || (char == '+' && index == 0)) {
                    append(char)
                }
            }
        }
    }

    private fun buildManagedNote(remoteId: String?): String {
        return if (remoteId.isNullOrBlank()) {
            MANAGED_NOTE_PREFIX
        } else {
            "$MANAGED_NOTE_PREFIX:$remoteId"
        }
    }

    private fun hasContactPermissions(context: Context): Boolean {
        val readGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
        val writeGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CONTACTS) == PackageManager.PERMISSION_GRANTED
        return readGranted && writeGranted
    }
}
