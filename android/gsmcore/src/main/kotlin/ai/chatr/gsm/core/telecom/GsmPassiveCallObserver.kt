package ai.chatr.gsm.core.telecom

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

interface GsmPassiveCallObserver {
    val activeCalls: StateFlow<List<GsmCallSnapshot>>
    fun onCallObserved(snapshot: GsmCallSnapshot)
    fun onCallRemoved(telecomCallHash: Int)
}

class InMemoryGsmPassiveCallObserver : GsmPassiveCallObserver {
    private val _activeCalls = MutableStateFlow<List<GsmCallSnapshot>>(emptyList())
    override val activeCalls: StateFlow<List<GsmCallSnapshot>> = _activeCalls

    override fun onCallObserved(snapshot: GsmCallSnapshot) {
        _activeCalls.value = _activeCalls.value
            .filterNot { it.telecomCallHash == snapshot.telecomCallHash } + snapshot
    }

    override fun onCallRemoved(telecomCallHash: Int) {
        _activeCalls.value = _activeCalls.value.filterNot { it.telecomCallHash == telecomCallHash }
    }
}
