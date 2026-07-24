package com.chatr.app.ondeviceai

import android.content.Context
import kotlinx.coroutines.runBlocking
import java.io.File

class ChatrAIRouter(private val context: Context) {
    private val nanoAvailable by lazy { runBlocking { checkNanoAvailability() } }
    
    private var _gemma: OnDeviceGemma? = null
    private val gemma: OnDeviceGemma?
        get() {
            if (_gemma == null) {
                // JIT Memory check right before instantiation
                if (!MemoryGate.isRamSufficient(context)) return null
                
                val modelFile = File(context.filesDir, "llm/gemma3-1b-it-int4-v1.task")
                if (!modelFile.exists()) return null
                
                _gemma = OnDeviceGemma(context, modelFile.absolutePath)
            }
            return _gemma
        }

    suspend fun checkNanoAvailability(): Boolean {
        return false
    }

    suspend fun summarize(text: String): AIResult {
        // Strict Stability Gating
        if (!StabilityGateConfig.isCallingStable) {
            return AIResult.GateBlocked
        }

        // Tier 1: rule-based for short text — skip AI entirely
        if (text.length < 200) {
            return AIResult.Success(ruleBasedSummary(text), "Tier 1: Heuristic")
        }

        // Tier 2a: AICore if flagship device
        if (nanoAvailable) {
            try {
                val summary = callMlKitSummarizer(text)
                return AIResult.Success(summary, "Tier 2a: ML Kit Gemini Nano")
            } catch (e: Exception) {
                // fall through to Tier 2b
            }
        }

        // Tier 2b: MediaPipe Gemma — requires RAM check and model file
        val gemmaInstance = gemma
        if (gemmaInstance != null) {
            try {
                val summary = gemmaInstance.generate(buildSummaryPrompt(text))
                return AIResult.Success(summary, "Tier 2b: MediaPipe Gemma")
            } catch (e: Exception) {
                return AIResult.Error(e)
            }
        }

        // Fallback if Tier 2b fails due to RAM or missing model
        return AIResult.Success(ruleBasedSummary(text), "Tier 1: Fallback (Low RAM / Missing Model)")
    }

    private fun ruleBasedSummary(text: String): String {
        return if (text.length > 50) text.take(50) + "..." else text
    }

    private suspend fun callMlKitSummarizer(text: String): String {
        return ruleBasedSummary(text)
    }

    private fun buildSummaryPrompt(text: String): String {
        return "Summarize this: $text"
    }
}
