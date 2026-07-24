import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.kapt")
    id("com.google.dagger.hilt.android")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
}

apply(from = "capacitor.build.gradle")

android {
    namespace = "com.chatr.app"
    compileSdk = 35

    val localProperties = Properties()
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localProperties.load(localPropertiesFile.inputStream())
    }
    val geminiApiKey = localProperties.getProperty("GEMINI_API_KEY") ?: ""

    val envFile = rootProject.file("../.env")
    var socketUrl = "https://api.chatr.chat"
    var supabaseUrl = ""
    var supabaseKey = ""
    if (envFile.exists()) {
        envFile.readLines().forEach { line ->
            if (line.startsWith("VITE_SOCKET_URL=")) {
                socketUrl = line.substringAfter("=").trim().removeSurrounding("\"")
            } else if (line.startsWith("VITE_SUPABASE_URL=")) {
                supabaseUrl = line.substringAfter("=").trim().removeSurrounding("\"")
            } else if (line.startsWith("VITE_SUPABASE_PUBLISHABLE_KEY=")) {
                supabaseKey = line.substringAfter("=").trim().removeSurrounding("\"")
            }
        }
    }

    defaultConfig {
        applicationId = "com.chatr.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 101
        versionName = "1.0.101"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Capacitor configuration
        manifestPlaceholders["appAuthRedirectScheme"] = "com.chatr.app"
        
        buildConfigField("String", "GEMINI_API_KEY", "\"${geminiApiKey}\"")
        buildConfigField("String", "SUPABASE_URL", if (supabaseUrl.isNotEmpty()) "\"$supabaseUrl\"" else "\"https://sbayuqgomlflmxgicplz.supabase.co\"")
        buildConfigField("String", "SUPABASE_KEY", if (supabaseKey.isNotEmpty()) "\"$supabaseKey\"" else "\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYXl1cWdvbWxmbG14Z2ljcGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTk0ODQsImV4cCI6MjA5NjU5NTQ4NH0.L41a_j-GZ6jA0i7_Z7-XvS2yWv_uD2W-qH-uO7W-uO4\"")
        buildConfigField("String", "SOCKET_URL", if (socketUrl.isNotEmpty()) "\"$socketUrl\"" else "\"http://192.168.31.37:3000\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug") // TODO: Use release keystore
        }
        debug {
            isMinifyEnabled = false
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Capacitor Core
    implementation(project(":capacitor-android"))

    // ============================================================
    // CHATR+ NATIVE MODULE LINKING — June 2026
    // All 11 modules now compiled into the APK
    // ============================================================
    implementation(project(":gsmcore"))
    implementation(project(":audioprocessing"))
    implementation(project(":calloverlay"))
    implementation(project(":callscreening"))
    implementation(project(":callsummary"))
    implementation(project(":calltranscription"))
    implementation(project(":chatrai"))
    implementation(project(":chatrshield"))
    implementation(project(":gsmsettings"))
    implementation(project(":scamdetection"))
    implementation(project(":smartdialer"))

    // Native WebRTC
    implementation("io.getstream:stream-webrtc-android:1.1.1")
    
    // Socket.IO and OkHttp for Signaling
    implementation("io.socket:socket.io-client:2.1.0") {
        exclude(group = "org.json", module = "json")
    }
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Gemini Nano / ML Kit GenAI Prompt API
    implementation("com.google.mlkit:genai-prompt:1.0.0-beta2")
    implementation("com.google.mlkit:genai-summarization:1.0.0-beta1")
    // implementation("com.google.mlkit:genai-smart-reply:1.0.0-beta1") // Failing to resolve in tests
    implementation("com.google.mediapipe:tasks-genai:0.10.21")

    // Dependency injection
    implementation("com.google.dagger:hilt-android:2.51.1")
    kapt("com.google.dagger:hilt-android-compiler:2.51.1")

    // Room Database (required by ShieldDatabase and future modules)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    
    // AndroidX Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.activity:activity-ktx:1.8.2")
    implementation("androidx.fragment:fragment-ktx:1.6.2")
    
    // Material Design
    implementation("com.google.android.material:material:1.11.0")
    
    // Splash Screen
    implementation("androidx.core:core-splashscreen:1.0.1")
    
    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.7.3")
    
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("com.google.firebase:firebase-analytics-ktx")
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    
    // WorkManager for background tasks
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    
    // Glide for image loading
    implementation("com.github.bumptech.glide:glide:4.16.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    
    // LocalBroadcastManager
    implementation("androidx.localbroadcastmanager:localbroadcastmanager:1.1.0")
}

kapt {
    correctErrorTypes = true
}
