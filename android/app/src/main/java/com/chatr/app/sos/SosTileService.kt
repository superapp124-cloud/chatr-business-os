package com.chatr.app.sos

import android.content.Context
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log

/**
 * SosTileService
 *
 * Android Quick Settings tile for SOS.
 * Shows in the notification shade — user long-presses to configure contacts,
 * or taps to instantly trigger SOS.
 *
 * Requires API 24+ (already satisfied by minSdk=24).
 * Declared in manifest with <service android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
 */
class SosTileService : TileService() {

    companion object {
        private const val TAG = "SosTileService"
        private const val PREFS_SOS = "chatr_sos_config"
        private const val KEY_CONTACTS = "sos_contacts"
    }

    override fun onTileAdded() {
        super.onTileAdded()
        Log.i(TAG, "🆘 SOS Tile added to Quick Settings")
        updateTileState()
    }

    override fun onStartListening() {
        super.onStartListening()
        updateTileState()
    }

    override fun onClick() {
        super.onClick()
        val prefs = getSharedPreferences(PREFS_SOS, Context.MODE_PRIVATE)
        val contacts = prefs.getString(KEY_CONTACTS, "") ?: ""

        if (contacts.isBlank()) {
            Log.w(TAG, "⚠️ SOS tapped but no contacts configured")
            // Show unavailable state — user must configure contacts first
            qsTile?.state = Tile.STATE_UNAVAILABLE
            qsTile?.subtitle = "Set contacts in Chatr+"
            qsTile?.updateTile()
        } else {
            Log.i(TAG, "🆘 SOS tile tapped — dispatching alert")
            SosService.start(this, contacts)
            qsTile?.state = Tile.STATE_ACTIVE
            qsTile?.subtitle = "SOS Active"
            qsTile?.updateTile()
        }
    }

    override fun onStopListening() {
        super.onStopListening()
    }

    override fun onTileRemoved() {
        super.onTileRemoved()
        Log.i(TAG, "SOS Tile removed from Quick Settings")
    }

    private fun updateTileState() {
        val prefs = getSharedPreferences(PREFS_SOS, Context.MODE_PRIVATE)
        val contacts = prefs.getString(KEY_CONTACTS, "") ?: ""
        val tile = qsTile ?: return

        tile.state = if (contacts.isNotBlank()) Tile.STATE_INACTIVE else Tile.STATE_UNAVAILABLE
        tile.label = "SOS"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = if (contacts.isNotBlank()) "Tap to send SOS" else "Configure in Chatr+"
        }
        tile.updateTile()
    }
}
