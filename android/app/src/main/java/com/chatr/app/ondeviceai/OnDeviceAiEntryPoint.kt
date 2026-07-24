package com.chatr.app.ondeviceai

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface OnDeviceAiEntryPoint {
    fun onDeviceAiService(): OnDeviceAiService
}
