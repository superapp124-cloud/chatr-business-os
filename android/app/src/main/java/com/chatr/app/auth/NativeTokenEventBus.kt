package com.chatr.app.auth

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * NativeTokenEventBus
 *
 * In-process event bus for JWT lifecycle events. All native services that
 * need a valid Supabase token should collect from [events] rather than
 * polling SharedPreferences.
 *
 * Usage:
 *   NativeTokenEventBus.events.collect { event ->
 *       when (event) {
 *           is TokenEvent.Refreshed -> makeAuthenticatedRequest(event.token)
 *           is TokenEvent.Failed    -> handleAuthFailure()
 *       }
 *   }
 *
 * Thread-safe singleton. SharedFlow with replay=1 ensures any new collector
 * immediately gets the most recent event (e.g. token already refreshed before
 * the service subscribed).
 */
object NativeTokenEventBus {

    private val _events = MutableSharedFlow<TokenEvent>(
        replay = 1,
        extraBufferCapacity = 8,
    )

    /** Observe JWT lifecycle events. Safe to collect on any dispatcher. */
    val events: SharedFlow<TokenEvent> = _events.asSharedFlow()

    /**
     * Emit a token event. Called internally by [NativeAuthManager].
     * Do not call this from outside the auth package.
     */
    internal suspend fun emit(event: TokenEvent) {
        _events.emit(event)
    }

    /**
     * Try-emit for non-suspending callers (e.g. legacy blocking refresh path).
     * Drops the event if the buffer is full (should never happen in practice).
     */
    internal fun tryEmit(event: TokenEvent) {
        _events.tryEmit(event)
    }
}

/**
 * Sealed class representing the result of a JWT token lifecycle event.
 */
sealed class TokenEvent {
    /**
     * A valid, non-expired access token is available.
     * @param token The raw JWT string.
     */
    data class Refreshed(val token: String) : TokenEvent()

    /**
     * Token refresh failed — all retry strategies exhausted.
     * Callers should surface a re-authentication prompt.
     */
    object Failed : TokenEvent()
}
