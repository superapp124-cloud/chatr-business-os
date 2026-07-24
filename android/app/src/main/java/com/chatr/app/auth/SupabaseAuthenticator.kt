package com.chatr.app.auth

import android.content.Context
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

class SupabaseAuthenticator(private val context: Context) : Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        // Only retry once per response. If we've already retried, give up to prevent an infinite loop.
        if (response.priorResponse != null) {
            return null
        }
        val oldToken = response.request.header("Authorization")?.removePrefix("Bearer ")

        // getValidTokenBlocking will handle expiration checking, synchronized refreshing, 
        // and thread-safety natively without us having to duplicate the locks here.
        val newToken = NativeAuthManager.getValidTokenBlocking(context)

        if (!newToken.isNullOrBlank() && newToken != oldToken) {
            return response.request.newBuilder()
                .removeHeader("Authorization") // Remove old header
                .addHeader("Authorization", "Bearer $newToken") // Add new token
                .build()
        }
        
        return null
    }
}
