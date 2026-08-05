package africa.koda.sentinel

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors

/**
 * Foreground service that keeps Sentinel alive and forwards each SMS to KODA.
 * P0 sends immediately; P1 adds a Room outbox + retry/backoff for offline.
 */
class ForwardService : Service() {
    private val io = Executors.newSingleThreadExecutor()

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification("Protecting payments"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val raw = intent?.getStringExtra(EXTRA_RAW)
        val op = intent?.getStringExtra(EXTRA_OP)
        if (raw != null && op != null) io.execute { send(raw, op) }
        return START_STICKY
    }

    private fun send(raw: String, op: String) {
        val base = Prefs.baseUrl(this)
        val token = Prefs.token(this) ?: return
        val short = raw.take(48).replace("\n", " ")
        try {
            val r = KodaClient.forward(base, token, raw, op, batteryPct())
            Prefs.appendLog(this, if (r.code == 200) "OK  [$op] $short" else "ERR ${r.code} $short")
        } catch (e: Exception) {
            Prefs.appendLog(this, "OFFLINE $short") // P1: persist + retry
        }
        sendBroadcast(Intent(ACTION_LOG_UPDATED).setPackage(packageName))
    }

    private fun batteryPct(): Int =
        (getSystemService(BATTERY_SERVICE) as BatteryManager)
            .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)

    private fun buildNotification(text: String): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL, "KODA Sentinel", NotificationManager.IMPORTANCE_LOW)
            (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
        val pi = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("KODA Sentinel")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_stat_shield)
            .setContentIntent(pi)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { io.shutdown(); super.onDestroy() }

    companion object {
        private const val NOTIF_ID = 1001
        private const val CHANNEL = "koda_sentinel"
        private const val EXTRA_RAW = "raw"
        private const val EXTRA_OP = "op"
        const val ACTION_LOG_UPDATED = "africa.koda.sentinel.LOG_UPDATED"

        fun start(ctx: Context) = launch(ctx, Intent(ctx, ForwardService::class.java))

        fun enqueue(ctx: Context, raw: String, op: String) =
            launch(ctx, Intent(ctx, ForwardService::class.java).putExtra(EXTRA_RAW, raw).putExtra(EXTRA_OP, op))

        private fun launch(ctx: Context, i: Intent) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
            else ctx.startService(i)
        }
    }
}
