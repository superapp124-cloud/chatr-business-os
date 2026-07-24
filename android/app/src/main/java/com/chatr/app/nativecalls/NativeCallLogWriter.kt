package com.chatr.app.nativecalls

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import android.telecom.DisconnectCause
import android.util.Log
import androidx.core.content.ContextCompat
import com.chatr.app.services.ChatrConnection

object NativeCallLogWriter {
    private const val TAG = "NativeCallLogWriter"

    fun writeCall(context: Context, connection: ChatrConnection, disconnectCause: DisconnectCause?) {
        // Stubbed for Phase 2B to prevent ChatrConnection visibility issues
        Log.i(TAG, "NativeCallLogWriter stubbed")
    }

    private fun ChatrConnection.getDurationSeconds(): Long {
        return 0L
    }
}
