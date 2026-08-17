package africa.koda.sentinel

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Play flavor: capture comes from the operator payment NOTIFICATION, so instead of
 * SMS permissions we request POST_NOTIFICATIONS and then guide the user to grant
 * "Notification access" (a system settings screen — it cannot be granted from a
 * runtime dialog). A prominent disclosure is shown before sending them there.
 */
object CaptureSetup {
    fun ensure(activity: Activity) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
        }
        if (!isNotificationAccessGranted(activity)) {
            Toast.makeText(activity, activity.getString(R.string.grant_notif_access), Toast.LENGTH_LONG).show()
            runCatching { activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        }
    }

    /** True once the user has enabled Notification access for this app. */
    fun isNotificationAccessGranted(activity: Activity): Boolean {
        val flat = Settings.Secure.getString(activity.contentResolver, "enabled_notification_listeners")
            ?: return false
        return flat.split(":").any { it.contains(activity.packageName) }
    }
}
