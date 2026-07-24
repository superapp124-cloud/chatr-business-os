package com.chatr.app.plugins

import android.content.Context
import com.chatr.app.sms.NativeSmsRepository
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Telephony
import androidx.core.content.ContextCompat
import com.chatr.app.sms.NativeSmsDetector
import com.chatr.app.sms.NativeSmsMessage
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(
    name = "ChatrSafeSms",
    permissions = [
        Permission(strings = [Manifest.permission.READ_SMS], alias = "sms")
    ]
)
class ChatrSafeSmsPlugin : Plugin() {

    @PluginMethod
    fun getConversations(call: PluginCall) {
        val limit = call.getInt("limit", 100) ?: 100
        val repo = NativeSmsRepository.getInstance(context)
        val jsonArrayStr = repo.conversationsJson(limit).toString()
        val result = JSObject()
        result.put("conversations", JSArray(jsonArrayStr))
        call.resolve(result)
    }

    @PluginMethod
    fun getMessages(call: PluginCall) {
        val conversationId = call.getString("conversationId")
        val limit = call.getInt("limit", 200) ?: 200
        
        if (conversationId.isNullOrBlank()) {
            call.reject("Must provide 'conversationId'")
            return
        }
        
        val repo = NativeSmsRepository.getInstance(context)
        val jsonArrayStr = repo.messagesJson(conversationId, limit).toString()
        val result = JSObject()
        result.put("messages", JSArray(jsonArrayStr))
        call.resolve(result)
    }

    @PluginMethod
    fun getStats(call: PluginCall) {
        val repo = NativeSmsRepository.getInstance(context)
        val statsObjStr = repo.statsJson().toString()
        call.resolve(JSObject(statsObjStr))
    }

    @PluginMethod
    fun syncExistingMessages(call: PluginCall) {
        val hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        if (!hasRead) {
            requestPermissionForAlias("sms", call, "syncExistingMessagesCallback")
            return
        }
        
        syncMessagesInternal(call)
    }

    @PermissionCallback
    private fun syncExistingMessagesCallback(call: PluginCall) {
        val hasRead = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        if (hasRead) {
            syncMessagesInternal(call)
        } else {
            call.reject("Permission denied")
        }
    }

    private fun syncMessagesInternal(call: PluginCall) {
        try {
            val limit = call.getInt("limit", 300) ?: 300
            val uri: Uri = Telephony.Sms.Inbox.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.READ
            )

            val cursor = context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                Telephony.Sms.DEFAULT_SORT_ORDER
            )

            var syncedCount = 0
            val repo = NativeSmsRepository.getInstance(context)

            cursor?.use {
                val idIdx = it.getColumnIndex(Telephony.Sms._ID)
                val addressIdx = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = it.getColumnIndex(Telephony.Sms.DATE)
                val readIdx = it.getColumnIndex(Telephony.Sms.READ)

                while (it.moveToNext() && syncedCount < limit) {
                    val id = it.getLong(idIdx).toString()
                    val address = it.getString(addressIdx) ?: continue
                    val body = it.getString(bodyIdx) ?: ""
                    val timestamp = it.getLong(dateIdx)
                    val isRead = it.getInt(readIdx) == 1

                    repo.upsertSystemMessage(
                        systemId = id.toLong(),
                        address = address,
                        body = body,
                        timestamp = timestamp,
                        type = 1, // 1 = Inbox
                        read = isRead
                    )
                    syncedCount++
                }
            }

            val result = JSObject()
            result.put("synced", syncedCount)
            call.resolve(result)
        } catch (e: Exception) {
            e.printStackTrace()
            call.reject(e.message ?: "Unknown sync error")
        }
    }
}
