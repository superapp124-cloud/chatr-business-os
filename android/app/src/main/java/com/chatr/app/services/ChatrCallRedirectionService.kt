package com.chatr.app.services

import android.net.Uri
import android.telecom.CallRedirectionService
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telephony.PhoneNumberUtils
import android.util.Log
import com.chatr.app.nativecalls.NativeGsmDefenseEngine

class ChatrCallRedirectionService : CallRedirectionService() {
    override fun onPlaceCall(
        handle: Uri,
        initialPhoneAccount: PhoneAccountHandle,
        allowInteractiveResponse: Boolean,
    ) {
        if (handle.scheme != PhoneAccount.SCHEME_TEL) {
            placeCallUnmodified()
            return
        }

        val rawNumber = handle.schemeSpecificPart.orEmpty()
        if (rawNumber.isBlank() || PhoneNumberUtils.isEmergencyNumber(rawNumber)) {
            placeCallUnmodified()
            return
        }

        val result = try {
            NativeGsmDefenseEngine.evaluateIncoming(
                context = this,
                rawNumber = rawNumber,
                status = "outgoing_route",
                source = "call_redirection_service",
                direction = "outgoing",
                allowLiveLookup = false,
                persist = true,
            )
        } catch (error: Exception) {
            Log.w(TAG, "Outgoing GSM defense failed; placing call unchanged: ${error.message}")
            null
        }

        if (
            result?.shouldBlock == true &&
            NativeGsmDefenseEngine.isFeatureEnabled(this, NativeGsmDefenseEngine.FEATURE_SCAM_ENGINE)
        ) {
            Log.i(TAG, "Cancelled high-risk outgoing GSM call to ${result.hashedNumber}")
            cancelCall()
        } else {
            placeCallUnmodified()
        }
    }

    private companion object {
        private const val TAG = "ChatrCallRedirect"
    }
}
