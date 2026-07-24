package com.chatr.app.plugins

import android.content.Context
import com.chatr.app.nativecalls.IntentPredictor
import com.chatr.app.nativecalls.NativeCallRepository
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ChatrIntelligence")
class ChatrIntelligencePlugin : Plugin() {

    @PluginMethod
    fun getRecentCalls(call: PluginCall) {
        val limit = call.getInt("limit", 50) ?: 50
        val repo = NativeCallRepository.getInstance(context)
        val jsonArrayStr = repo.recentEventsJson(limit).toString()
        val result = JSObject()
        result.put("calls", JSArray(jsonArrayStr))
        call.resolve(result)
    }

    @PluginMethod
    fun getStats(call: PluginCall) {
        val repo = NativeCallRepository.getInstance(context)
        val statsObjStr = repo.statsJson().toString()
        call.resolve(JSObject(statsObjStr))
    }

    @PluginMethod
    fun predictIntent(call: PluginCall) {
        val number = call.getString("number")
        if (number.isNullOrBlank()) {
            call.reject("Must provide 'number'")
            return
        }
        val prediction = IntentPredictor.predict(context, number)
        call.resolve(JSObject(prediction.toJson().toString()))
    }
}
