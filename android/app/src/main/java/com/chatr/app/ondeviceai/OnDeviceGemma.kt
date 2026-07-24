package com.chatr.app.ondeviceai

import android.content.Context
import com.google.mediapipe.tasks.genai.llminference.LlmInference

class OnDeviceGemma(context: Context, modelPath: String) {
    private var llmInference: LlmInference

    init {
        val options = LlmInference.LlmInferenceOptions.builder()
            .setModelPath(modelPath)
            .setMaxTokens(512)
            .build()
        llmInference = LlmInference.createFromOptions(context, options)
    }

    fun generate(prompt: String): String {
        return llmInference.generateResponse(prompt)
    }

    fun generateAsync(prompt: String, onPartial: (String) -> Unit) {
        llmInference.generateResponseAsync(prompt)
    }

    fun close() = llmInference.close()
}
