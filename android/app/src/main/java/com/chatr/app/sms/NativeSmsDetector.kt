package com.chatr.app.sms

import java.util.Locale

object NativeSmsDetector {
    private val otpContext = Regex(
        pattern = "(?i)\\b(otp|one[ -]?time|verification|verify|code|passcode|login|auth|pin)\\b",
    )
    private val otpCode = Regex("\\b\\d{4,8}\\b")
    private val url = Regex("(?i)\\bhttps?://|\\bwww\\.|\\b(?:bit\\.ly|tinyurl\\.com|t\\.co|goo\\.gl|cutt\\.ly|shorturl\\.at)/")
    private val fraudRules = listOf(
        FraudRule(
            category = "Bank Scam",
            pattern = rx("""\b(?:share|send|tell|forward|read out)\b.{0,32}\b(?:otp|one[ -]?time password|verification code|pin|cvv)\b|\b(?:otp|one[ -]?time password|verification code|pin|cvv)\b.{0,32}\b(?:share|send|tell|forward|read out)\b"""),
            weight = 45,
            flag = "otp_or_pin_request",
        ),
        FraudRule(
            category = "Bank Scam",
            pattern = rx("""\b(?:kyc|account (?:will be )?(?:blocked|freeze|frozen)|debit card blocked|credit card blocked|bank manager|rbi|aadhaar blocked|pan update)\b"""),
            weight = 24,
            flag = "bank_urgency_claim",
        ),
        FraudRule(
            category = "UPI Scam",
            pattern = rx("""\b(?:upi collect|collect request|approve request|gpay request|phonepe request|paytm request|upi pin|enter pin)\b"""),
            weight = 34,
            flag = "upi_collect_or_pin_prompt",
        ),
        FraudRule(
            category = "UPI Scam",
            pattern = rx("""\b(?:scan (?:this )?qr|qr code|refund.{0,24}upi|cashback.{0,24}upi|receive money.{0,24}pin)\b"""),
            weight = 28,
            flag = "upi_qr_or_refund_prompt",
        ),
        FraudRule(
            category = "Remote Access Scam",
            pattern = rx("""\b(?:anydesk|teamviewer|quick support|screen share|share your screen|remote access|install app|download app)\b"""),
            weight = 40,
            flag = "remote_access_request",
        ),
        FraudRule(
            category = "Digital Arrest Scam",
            pattern = rx("""\b(?:digital arrest|police case|arrest warrant|cyber cell|customs|narcotics|court notice|money laundering)\b"""),
            weight = 42,
            flag = "authority_impersonation",
        ),
        FraudRule(
            category = "Courier Scam",
            pattern = rx("""\b(?:parcel|package|courier).{0,40}\b(?:held|blocked|customs|release|illegal item|address issue)\b"""),
            weight = 28,
            flag = "courier_customs_pressure",
        ),
        FraudRule(
            category = "Investment Scam",
            pattern = rx("""\b(?:guaranteed return|double your money|crypto profit|trading group|urgent deposit|limited slot|stock tip|daily profit)\b"""),
            weight = 30,
            flag = "investment_pressure",
        ),
        FraudRule(
            category = "Loan Scam",
            pattern = rx("""\b(?:loan approved|instant loan|processing fee|security deposit|required to release loan|pre-approved loan)\b"""),
            weight = 26,
            flag = "loan_fee_pressure",
        ),
        FraudRule(
            category = "Coercion",
            pattern = rx("""\b(?:immediately|right now|do not disconnect|do not tell anyone|last warning|within \d+ minutes|urgent action required)\b"""),
            weight = 16,
            flag = "coercive_urgency",
        ),
        FraudRule(
            category = "Transaction Prompt",
            pattern = rx("""\b(?:send money|transfer amount|security deposit|processing fee|release fee|pay fine|pay now|wallet verification)\b"""),
            weight = 24,
            flag = "transaction_prompt",
        ),
    )

    fun analyze(body: String): SmsRisk {
        val normalized = body.trim()
        val lower = normalized.lowercase(Locale.US)
        val reasons = linkedSetOf<String>()
        val categories = linkedSetOf<String>()
        val matchedPhrases = mutableListOf<String>()
        var score = 0

        val possibleOtp = otpContext.containsMatchIn(body)
        val code = if (possibleOtp) otpCode.find(body)?.value else null
        if (code != null) {
            reasons += "otp_detected"
            categories += "OTP"
        }

        if (url.containsMatchIn(body)) {
            score += if (isShortLink(lower)) 32 else 22
            reasons += "contains_link"
            categories += "Suspicious Link"
        }

        fraudRules.forEach { rule ->
            val match = rule.pattern.find(normalized)
            if (match != null) {
                score += rule.weight
                categories += rule.category
                reasons += rule.flag
                matchedPhrases += match.value.trim().take(96)
            }
        }

        if (code != null && reasons.any { it in highRiskOtpContext }) {
            score += 28
            reasons += "otp_with_scam_context"
        }
        if ("coercive_urgency" in reasons && "transaction_prompt" in reasons) {
            score += 12
            reasons += "urgent_payment_combo"
        }
        if ("authority_impersonation" in reasons && "transaction_prompt" in reasons) {
            score += 18
            reasons += "authority_payment_combo"
        }
        if ("remote_access_request" in reasons && ("bank_urgency_claim" in reasons || "otp_or_pin_request" in reasons)) {
            score += 18
            reasons += "remote_access_bank_combo"
        }
        if ("contains_link" in reasons && ("coercive_urgency" in reasons || "bank_urgency_claim" in reasons)) {
            score += 12
            reasons += "urgent_link_combo"
        }
        if (code != null && score == 0) {
            score = 8
        }

        val clampedScore = score.coerceIn(0, 100)
        val level = when {
            clampedScore >= 80 -> "critical"
            clampedScore >= 60 -> "high"
            clampedScore >= 35 -> "medium"
            else -> "low"
        }
        val action = when {
            clampedScore >= 80 -> "block_and_report"
            clampedScore >= 60 -> "do_not_click_or_share"
            clampedScore >= 35 -> "verify_sender"
            code != null -> "protect_otp"
            else -> "allow"
        }
        val summary = buildSummary(
            score = clampedScore,
            categories = categories.toList(),
            reasons = reasons.toList(),
            isOtp = code != null,
        )

        return SmsRisk(
            isOtp = code != null,
            otpCode = code,
            spamScore = clampedScore,
            riskLevel = level,
            reasons = reasons.toList(),
            categories = categories.toList(),
            matchedPhrases = matchedPhrases.distinct().take(8),
            summary = summary,
            recommendedAction = action,
        )
    }

    private fun buildSummary(
        score: Int,
        categories: List<String>,
        reasons: List<String>,
        isOtp: Boolean,
    ): String {
        if (score == 0) return "No CHATR Shield SMS risk signals detected."
        if (isOtp && score < 35) {
            return "OTP detected. Keep it private, especially during calls or screen-sharing."
        }
        val categoryText = categories
            .filter { it != "OTP" }
            .take(3)
            .ifEmpty { categories.take(3) }
            .joinToString(", ")
            .ifBlank { "suspicious SMS" }
        val signalText = reasons
            .filterNot { it == "otp_detected" }
            .take(3)
            .joinToString(", ") { it.replace('_', ' ') }
            .ifBlank { "message context" }
        return "CHATR Shield flagged $categoryText signals: $signalText."
    }

    private fun isShortLink(value: String): Boolean =
        value.contains("bit.ly/") ||
            value.contains("tinyurl.com/") ||
            value.contains("t.co/") ||
            value.contains("goo.gl/") ||
            value.contains("cutt.ly/") ||
            value.contains("shorturl.at/")

    private fun rx(pattern: String): Regex = Regex(pattern, RegexOption.IGNORE_CASE)

    private val highRiskOtpContext = setOf(
        "otp_or_pin_request",
        "upi_collect_or_pin_prompt",
        "remote_access_request",
        "bank_urgency_claim",
        "authority_impersonation",
        "transaction_prompt",
    )

    private data class FraudRule(
        val category: String,
        val pattern: Regex,
        val weight: Int,
        val flag: String,
    )
}
