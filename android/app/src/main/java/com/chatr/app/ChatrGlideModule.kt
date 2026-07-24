package com.chatr.app

import android.content.Context
import com.bumptech.glide.GlideBuilder
import com.bumptech.glide.annotation.GlideModule
import com.bumptech.glide.load.engine.cache.MemorySizeCalculator
import com.bumptech.glide.module.AppGlideModule

/**
 * Custom Glide Module to optimize image loading performance
 * Tuning memory limits saves cold startup time when loading avatars
 */
@GlideModule
class ChatrGlideModule : AppGlideModule() {
    override fun applyOptions(context: Context, builder: GlideBuilder) {
        builder.setMemorySizeCalculator(
            MemorySizeCalculator.Builder(context)
                .setMemoryCacheScreens(2.0f)
                .build()
        )
    }
}
