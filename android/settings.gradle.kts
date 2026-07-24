pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.10.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "Chatr+"
include(":app")

// ============================================================
// CHATR+ NATIVE MODULES — registered June 2026
// ============================================================
include(":gsmcore")          // 104 kt — GSM engine, phone account mgmt, call routing
include(":audioprocessing")  // 3 kt  — GSM audio recorder, noise filter
include(":calloverlay")      // 8 kt  — Truecaller-style floating overlay (Compose)
include(":callscreening")    // 1 kt  — AI pre-screen layer (calls :gsmcore)
include(":callsummary")      // 2 kt  — Post-call AI summary (calls :calltranscription)
include(":calltranscription") // 2 kt — Real-time transcription (calls :audioprocessing)
include(":chatrai")          // 1 kt  — AI reply suggestions (calls :callsummary)
include(":chatrshield")      // 8 kt  — Tracker blocker, scam detection wrapper
include(":gsmsettings")      // 3 kt  — Settings UI (Compose)
include(":scamdetection")    // 3 kt  — ML scam classifier
include(":smartdialer")      // 2 kt  — Smart dialer engine

apply(from = "capacitor.settings.gradle")

gradle.allprojects {
    afterEvaluate {
        tasks.withType(JavaCompile::class.java).configureEach {
            sourceCompatibility = "17"
            targetCompatibility = "17"
        }
    }
}
