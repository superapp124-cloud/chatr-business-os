package com.chatr.app.services

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.Looper
import android.util.Log
import androidx.core.graphics.drawable.IconCompat
import com.chatr.app.R
import java.net.HttpURLConnection
import java.net.URL

object NotificationBranding {
    private const val TAG = "NotificationBranding"
    val SMALL_ICON: Int = R.drawable.ic_chatr_notification

    fun largeIcon(context: Context): Bitmap? {
        val original = BitmapFactory.decodeResource(context.resources, R.drawable.chatr_splash_mark) ?: return null
        // Scale down to prevent 1MB Binder transaction limit exceptions which cause blank notifications
        return Bitmap.createScaledBitmap(original, 192, 192, true)
    }

    fun avatarIcon(context: Context, avatarUrl: String?): Bitmap? {
        val remoteAvatar = loadRemoteAvatar(avatarUrl)
        return if (remoteAvatar != null) {
            circularCrop(remoteAvatar, 192)
        } else {
            largeIcon(context)
        }
    }

    fun personIcon(context: Context, avatarUrl: String? = null): IconCompat {
        val bitmap = avatarIcon(context, avatarUrl) ?: return IconCompat.createWithResource(context, R.drawable.chatr_splash_mark)
        return IconCompat.createWithBitmap(bitmap)
    }

    private fun loadRemoteAvatar(avatarUrl: String?): Bitmap? {
        val url = avatarUrl?.trim().orEmpty()
        if (url.isBlank() || !(url.startsWith("https://") || url.startsWith("http://"))) {
            return null
        }

        if (Looper.myLooper() == Looper.getMainLooper()) {
            Log.d(TAG, "Skipping remote avatar load on main thread")
            return null
        }

        return try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 1_500
            connection.readTimeout = 2_000
            connection.instanceFollowRedirects = true
            connection.inputStream.use { input ->
                BitmapFactory.decodeStream(input)
            }
        } catch (error: Exception) {
            Log.w(TAG, "Unable to load notification avatar: ${error.message}")
            null
        }
    }

    private fun circularCrop(source: Bitmap, size: Int): Bitmap {
        val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val shader = BitmapShader(source, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val scale = size.toFloat() / minOf(source.width, source.height).toFloat()
        val dx = (size - source.width * scale) / 2f
        val dy = (size - source.height * scale) / 2f
        val matrix = android.graphics.Matrix().apply {
            setScale(scale, scale)
            postTranslate(dx, dy)
        }
        shader.setLocalMatrix(matrix)

        Canvas(output).drawOval(
            RectF(0f, 0f, size.toFloat(), size.toFloat()),
            Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader },
        )
        return output
    }
}
