package ai.chatr.gsm.core.telecom

import android.media.AudioManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BluetoothTelecomCoordinatorTest {
    @Test
    fun bluetoothObservationRecordsRouteWithoutRoutingChanges() {
        val recorder = BoundedInMemoryTelecomEventRecorder()
        val coordinator = BluetoothTelecomCoordinator(
            snapshotProvider = object : BluetoothTelecomSnapshotProvider {
                override fun currentSnapshot(): BluetoothTelecomSnapshot {
                    return BluetoothTelecomSnapshot(
                        route = BluetoothTelecomRoute.CAR,
                        bluetoothOutputCount = 1,
                        isBluetoothAudioPresent = true,
                        isAndroidAutoLikely = true,
                        audioMode = AudioManager.MODE_IN_CALL,
                        capturedAtMillis = 100L,
                    )
                }
            },
            recorder = recorder,
        )

        val snapshot = coordinator.observe("call_added")

        assertEquals(BluetoothTelecomRoute.CAR, snapshot.route)
        assertTrue(recorder.snapshot().any { it.type == TelecomRecordedEventType.BLUETOOTH_STATE_REPORTED })
    }
}
