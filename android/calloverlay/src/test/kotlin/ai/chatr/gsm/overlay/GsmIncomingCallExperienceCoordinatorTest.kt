package ai.chatr.gsm.overlay

import ai.chatr.gsm.shield.CallerIdentity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GsmIncomingCallExperienceCoordinatorTest {
    @Test
    fun overlayIsAbsentWhenGsmFlagsAreDisabled() {
        val coordinator = GsmIncomingCallExperienceCoordinator()

        val experience = coordinator.buildIncomingExperience(
            callId = "call-1",
            callerIdentity = CallerIdentity(
                phoneNumber = "+919999999999",
                displayName = "Arshid",
                isSavedContact = true,
                verifiedProfile = null,
            ),
            localSpamScore = 0f,
            localReportCount = 0,
            robocallProbability = 0f,
        )

        assertNull(experience.overlayState)
        assertTrue(experience.availableActions.isEmpty())
        assertEquals(false, experience.contract.mayRouteAudioOverInternet)
    }
}
