package africa.koda.sentinel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Brings Sentinel back after a reboot or app update so no payment window is
 * missed. Starts the foreground service (which schedules workers + backfill).
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val a = intent.action ?: return
        if (a == Intent.ACTION_BOOT_COMPLETED || a == Intent.ACTION_MY_PACKAGE_REPLACED) {
            if (Prefs.isPaired(context)) ForwardService.start(context)
        }
    }
}
