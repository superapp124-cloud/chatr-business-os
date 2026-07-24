package com.chatr.app.nativecalls

import java.security.MessageDigest

object NativePhoneNormalizer {
    fun digitsOnly(value: String?): String {
        if (value.isNullOrBlank()) return ""
        return value.filter { it.isDigit() }
    }

    fun normalize(raw: String?): String {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isBlank() || trimmed.equals("unknown", ignoreCase = true)) return ""

        val digits = digitsOnly(trimmed)
        if (digits.isBlank()) return ""

        return when {
            trimmed.startsWith("+") -> "+$digits"
            digits.length == 10 -> "+91$digits"
            digits.length == 12 && digits.startsWith("91") -> "+$digits"
            digits.length > 10 -> "+$digits"
            else -> digits
        }
    }

    fun hash(raw: String?): String {
        val normalized = normalize(raw).ifBlank { raw?.trim().orEmpty() }
        if (normalized.isBlank()) return ""

        val bytes = MessageDigest.getInstance("SHA-256").digest(normalized.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
