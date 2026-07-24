package ai.chatr.gsm.core

import org.junit.Assert.assertFalse
import org.junit.Test

class GsmIntelligenceFlagsTest {
    @Test
    fun allGsmFeaturesAreDisabledByDefault() {
        val flags = StaticGsmFeatureFlagProvider

        GsmFeature.values().forEach { feature ->
            assertFalse("Expected $feature to be disabled by default", flags.isEnabled(feature))
        }
    }
}
