package ai.chatr.gsm.smartdialer

import ai.chatr.gsm.core.GsmFeature
import ai.chatr.gsm.core.GsmFeatureFlagProvider
import ai.chatr.gsm.core.StaticGsmFeatureFlagProvider

class GsmSmartDialerEngine(
    private val flags: GsmFeatureFlagProvider = StaticGsmFeatureFlagProvider,
) {
    fun searchT9(query: String, contacts: List<SmartDialerContact>): List<SmartDialerContact> {
        if (!flags.isEnabled(GsmFeature.SMART_DIALER)) return emptyList()
        val normalized = query.filter(Char::isDigit)
        if (normalized.isBlank()) return emptyList()
        return contacts.filter { contact ->
            contact.t9Key.startsWith(normalized) || contact.phoneNumber.contains(normalized)
        }
    }

    fun suggestRecentCalls(recent: List<SmartDialerSuggestion>): List<SmartDialerSuggestion> {
        if (!flags.isEnabled(GsmFeature.SMART_DIALER)) return emptyList()
        return recent.take(5)
    }
}
