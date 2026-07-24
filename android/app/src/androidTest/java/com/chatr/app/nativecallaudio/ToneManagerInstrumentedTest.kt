package com.chatr.app.nativecallaudio

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ToneManagerInstrumentedTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private lateinit var toneManager: ToneManager

    @Before
    fun setUp() {
        toneManager = ToneManager.getInstance(instrumentation.targetContext)
        instrumentation.runOnMainSync {
            toneManager.listener = null
            toneManager.setMuted(false)
            toneManager.stopTone()
        }

        // SoundPool loads samples asynchronously. Give it a short warm-up before play assertions.
        Thread.sleep(750)
    }

    @After
    fun tearDown() {
        instrumentation.runOnMainSync {
            toneManager.listener = null
            toneManager.setMuted(false)
            toneManager.stopTone()
        }
    }

    @Test
    fun loopedTonesPlayPauseResumeAndStopWithoutCrashing() {
        listOf(CallTone.RINGBACK, CallTone.RECONNECTING).forEach { tone ->
            instrumentation.runOnMainSync {
                toneManager.playTone(tone, "instrumented-${tone.name.lowercase()}")
            }
            Thread.sleep(500)

            instrumentation.runOnMainSync {
                toneManager.pauseTone()
            }
            Thread.sleep(150)

            instrumentation.runOnMainSync {
                toneManager.resumeTone()
            }
            Thread.sleep(300)

            instrumentation.runOnMainSync {
                toneManager.stopTone()
            }
        }
    }

    @Test
    fun terminalTonesPlayAndStopWithoutCrashing() {
        listOf(CallTone.FAILED, CallTone.ENDED).forEach { tone ->
            instrumentation.runOnMainSync {
                toneManager.playTone(tone, "instrumented-${tone.name.lowercase()}")
            }
            Thread.sleep(1_300)

            instrumentation.runOnMainSync {
                toneManager.stopTone()
            }
        }
    }

    @Test
    fun busyToneAutoDisconnectsInCarrierWindow() {
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync {
            toneManager.listener = object : ToneManager.ToneEventListener {
                override fun onToneAutoDisconnect(callId: String?, tone: CallTone) {
                    if (callId == "instrumented-busy" && tone == CallTone.BUSY) {
                        latch.countDown()
                    }
                }
            }
            toneManager.playTone(CallTone.BUSY, "instrumented-busy")
        }

        assertTrue("Busy tone should auto-disconnect after about 6.5 seconds", latch.await(8, TimeUnit.SECONDS))
    }

    @Test
    fun failedToneAutoDisconnectsAfterTripleBeep() {
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync {
            toneManager.listener = object : ToneManager.ToneEventListener {
                override fun onToneAutoDisconnect(callId: String?, tone: CallTone) {
                    if (callId == "instrumented-failed" && tone == CallTone.FAILED) {
                        latch.countDown()
                    }
                }
            }
            toneManager.playTone(CallTone.FAILED, "instrumented-failed")
        }

        assertTrue("Failed tone should auto-disconnect after the triple beep", latch.await(2, TimeUnit.SECONDS))
    }

    @Test
    fun muteSuppressesTonePlaybackWithoutCrashing() {
        instrumentation.runOnMainSync {
            toneManager.setMuted(true)
            toneManager.playTone(CallTone.RINGBACK, "instrumented-muted")
            toneManager.setMuted(false)
            toneManager.stopTone()
        }
    }
}
