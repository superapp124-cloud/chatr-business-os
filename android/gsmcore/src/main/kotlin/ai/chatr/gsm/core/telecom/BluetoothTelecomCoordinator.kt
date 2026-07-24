package ai.chatr.gsm.core.telecom

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

enum class BluetoothTelecomRoute {
    NONE,
    HEADSET,
    CAR,
    HEARING_AID,
    UNKNOWN,
}

data class BluetoothTelecomSnapshot(
    val route: BluetoothTelecomRoute,
    val bluetoothOutputCount: Int,
    val isBluetoothAudioPresent: Boolean,
    val isAndroidAutoLikely: Boolean,
    val audioMode: Int,
    val capturedAtMillis: Long,
)

interface BluetoothTelecomSnapshotProvider {
    fun currentSnapshot(): BluetoothTelecomSnapshot
}

class AndroidBluetoothTelecomSnapshotProvider(
    private val context: Context,
    private val now: () -> Long = System::currentTimeMillis,
) : BluetoothTelecomSnapshotProvider {
    override fun currentSnapshot(): BluetoothTelecomSnapshot {
        val audioManager = context.getSystemService(AudioManager::class.java)
        val uiModeManager = context.getSystemService(UiModeManager::class.java)
        val devices = audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS).orEmpty()
        val bluetoothDevices = devices.filter { it.isBluetoothTelecomDevice() }
        val isCar = uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_CAR
        val route = when {
            isCar -> BluetoothTelecomRoute.CAR
            bluetoothDevices.any { it.type == AudioDeviceInfo.TYPE_HEARING_AID } -> BluetoothTelecomRoute.HEARING_AID
            bluetoothDevices.isNotEmpty() -> BluetoothTelecomRoute.HEADSET
            devices.isEmpty() -> BluetoothTelecomRoute.UNKNOWN
            else -> BluetoothTelecomRoute.NONE
        }

        return BluetoothTelecomSnapshot(
            route = route,
            bluetoothOutputCount = bluetoothDevices.size,
            isBluetoothAudioPresent = bluetoothDevices.isNotEmpty(),
            isAndroidAutoLikely = isCar,
            audioMode = audioManager?.mode ?: AudioManager.MODE_INVALID,
            capturedAtMillis = now(),
        )
    }

    private fun AudioDeviceInfo.isBluetoothTelecomDevice(): Boolean {
        return type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
            type == AudioDeviceInfo.TYPE_HEARING_AID ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_HEADSET) ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_SPEAKER) ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == AudioDeviceInfo.TYPE_BLE_BROADCAST)
    }
}

class BluetoothTelecomCoordinator(
    private val snapshotProvider: BluetoothTelecomSnapshotProvider,
    private val recorder: TelecomEventRecorder = NoOpTelecomEventRecorder,
) {
    fun observe(reason: String): BluetoothTelecomSnapshot {
        val snapshot = snapshotProvider.currentSnapshot()
        recorder.record(
            TelecomRecordedEvent(
                type = TelecomRecordedEventType.BLUETOOTH_STATE_REPORTED,
                sessionKey = null,
                timestampMillis = snapshot.capturedAtMillis,
                activationPath = "phase_1d_internal_hardening",
                attributes = mapOf(
                    "reason" to reason,
                    "route" to snapshot.route.name,
                    "output_count" to snapshot.bluetoothOutputCount.toString(),
                    "android_auto_likely" to snapshot.isAndroidAutoLikely.toString(),
                    "audio_mode" to snapshot.audioMode.toString(),
                ),
            ),
        )
        return snapshot
    }
}
