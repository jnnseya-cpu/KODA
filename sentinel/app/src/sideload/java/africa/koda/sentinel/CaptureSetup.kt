package africa.koda.sentinel

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Sideload flavor: capture comes from reading the SMS directly, so we request the
 * SMS runtime permissions (plus POST_NOTIFICATIONS for the foreground-service
 * notice on Android 13+).
 */
object CaptureSetup {
    fun ensure(activity: Activity) {
        val need = mutableListOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)
        if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS)
        val ask = need.filter {
            ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED
        }
        if (ask.isNotEmpty()) ActivityCompat.requestPermissions(activity, ask.toTypedArray(), 7)
    }
}
