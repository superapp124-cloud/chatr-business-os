package com.chatr.app.plugins

import com.chatr.app.ondeviceai.OnDeviceAiAvailability
import com.chatr.app.ondeviceai.OnDeviceAiEntryPoint
import com.chatr.app.ondeviceai.OnDeviceAiGeneration
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

import com.chatr.app.ondeviceai.ChatrAIRouter
import com.chatr.app.ondeviceai.AIResult

@CapacitorPlugin(name = "OnDeviceAi")
class OnDeviceAiPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val router by lazy {
        ChatrAIRouter(context.applicationContext)
    }

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        scope.launch {
            try {
                val available = router.checkNanoAvailability()
                withContext(Dispatchers.Main) {
                    call.resolve(JSObject().apply {
                        put("available", available)
                        put("status", if (available) "available" else "unavailable")
                        put("geminiOnDevice", available)
                    })
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    call.reject(e.message ?: "Availability check failed")
                }
            }
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("prompt", "").orEmpty()
        if (prompt.isBlank()) {
            call.reject("prompt_required")
            return
        }

        scope.launch {
            try {
                val result = router.summarize(prompt)
                withContext(Dispatchers.Main) {
                    when (result) {
                        is AIResult.Success -> {
                            call.resolve(JSObject().apply {
                                put("text", result.text)
                                put("tier", result.tier)
                                put("geminiOnDevice", true)
                                put("gateBlocked", false)
                            })
                        }
                        is AIResult.GateBlocked -> {
                            call.resolve(JSObject().apply {
                                put("gateBlocked", true)
                                put("text", "")
                            })
                        }
                        is AIResult.Error -> {
                            call.reject(result.exception.message ?: "Generation failed")
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    call.reject(e.message ?: "Generation failed")
                }
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }


}
