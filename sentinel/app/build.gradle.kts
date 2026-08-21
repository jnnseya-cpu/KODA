plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "africa.koda.sentinel"
    compileSdk = 35

    defaultConfig {
        applicationId = "africa.koda.sentinel"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "0.2.2"
    }

    // Two distribution paths from one codebase:
    //  · sideload — reads SMS directly (restricted permission); distributed as a direct
    //    APK for pilots (kodajnn.com/sentinel). This is the default flavor.
    //  · play — reads the operator payment NOTIFICATION via a NotificationListenerService
    //    (no SMS permission); Google-Play-compliant, shipped as an AAB.
    // The capture code and manifests are flavor-specific source sets; the outbox,
    // pairing, heartbeat and UI are shared in `main`.
    flavorDimensions += "dist"
    productFlavors {
        create("sideload") {
            dimension = "dist"
            buildConfigField("boolean", "USE_NOTIFICATION_LISTENER", "false")
        }
        create("play") {
            dimension = "dist"
            buildConfigField("boolean", "USE_NOTIFICATION_LISTENER", "true")
            versionNameSuffix = "-play"
        }
    }

    // Release signing. In CI, a keystore is provided via env (decoded from a GitHub
    // secret); locally without one, release falls back to the debug key so
    // assembleRelease still yields an installable APK for side-load pilots.
    val ksPath = System.getenv("KODA_KEYSTORE_FILE")
    val hasKeystore = !ksPath.isNullOrBlank() && file(ksPath).exists()
    signingConfigs {
        if (hasKeystore) {
            create("release") {
                storeFile = file(ksPath!!)
                storePassword = System.getenv("KODA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KODA_KEY_ALIAS")
                keyPassword = System.getenv("KODA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (hasKeystore) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { viewBinding = true; buildConfig = true }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    // P1 reliability — durable outbox (Room) + background retry/heartbeat (WorkManager)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")

    // P2 trust — Play Integrity device attestation
    implementation("com.google.android.play:integrity:1.4.0")
}
