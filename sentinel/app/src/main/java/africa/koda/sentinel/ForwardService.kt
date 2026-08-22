package africa.koda.sentinel

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledThreadPoolExecutor
import java.util.concurrent.TimeUnit

/**
 * Foreground service — the always-on heart of Sentinel. It drains the durable
 * outbox, emits a ~5-minute heartbeat (inside the resolver's 10-minute health
 * window), runs cold-start backfill, and refreshes config. WorkManager is the
 * backstop for whatever the OS kills.
 */
class ForwardService : Service() {
    private val io = Executors.newSingleThreadExecutor()
    private lateinit var beat: ScheduledExecutorService

    override fun onCreate() {
        super.onCreate()
        // Android 12+ can refuse a foreground-service start from the background
        // (ForegroundServiceStartNotAllowedException); Android 14+ also requires the
        // declared service type. Because we are START_STICKY, the OS may relaunch us
        // in the background, so this MUST NOT throw — otherwise the app crash-loops.
        // If the foreground start is refused, the durable outbox + WorkManager cover it.
        val foregrounded = try {
            val notif = buildNotification(statusLine())
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                    this, NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIF_ID, notif)
            }
            true
        } catch (e: Throwable) {
            runCatching { Prefs.appendLog(this, "FGS start refused: ${e.javaClass.simpleName}") }
            DrainWorker.schedule(this)
            HeartbeatWorker.schedule(this)
            false
        }
        if (!foregrounded) { stopSelf(); return }

        beat = ScheduledThreadPoolExecutor(1)
        // primary heartbeat: keeps the device HEALTHY for the payment-method resolver
        beat.scheduleWithFixedDelay({ heartbeat() }, 5, HEARTBEAT_MIN, TimeUnit.MINUTES)
        // schedule the periodic WorkManager backstop once
        HeartbeatWorker.schedule(this)
        io.execute {
            try {
                DeviceConfig.refresh(this)     // pull merchant + global sender allowlist
                Backfill.run(this)             // recover SMS missed while we were down
                drain()
            } catch (e: Throwable) {
                runCatching { Prefs.appendLog(this, "startup task failed: ${e.javaClass.simpleName}") }
                DrainWorker.schedule(this)
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // legacy direct-forward path (kept for compatibility): route into the outbox
        val raw = intent?.getStringExtra(EXTRA_RAW)
        val op = intent?.getStringExtra(EXTRA_OP)
        if (raw != null && op != null) {
            Outbox.enqueue(this, raw, op, op, System.currentTimeMillis())
        }
        io.execute { drain() }
        return START_STICKY
    }

    /** Send the outbox; if anything remains, hand off to WorkManager's backoff. */
    private fun drain() {
        try {
            val fullyDrained = Outbox.drain(this)
            updateNotification()
            if (!fullyDrained) DrainWorker.schedule(this)
        } catch (e: Throwable) {
            // never let a drain failure crash the (background) service thread
            runCatching { Prefs.appendLog(this, "drain failed: ${e.javaClass.simpleName}") }
            DrainWorker.schedule(this)
        }
    }

    private fun heartbeat() {
        val token = Prefs.token(this) ?: return
        try {
            val attestation = IntegrityGate.refresh(this)
            KodaClient.heartbeat(Prefs.baseUrl(this), token, DeviceInfo.batteryPct(this), 1.0, attestation)
        } catch (e: Exception) { /* transient — next beat or worker covers it */ }
        // opportunistically drain in case a message is stuck
        if (Outbox.pendingCount(this) > 0) drain()
    }

    private fun statusLine(): String {
        val merchant = Prefs.merchantName(this)
        val pending = try { Outbox.pendingCount(this) } catch (e: Exception) { 0 }
        val who = if (merchant != null) "Protecting $merchant" else "Protecting payments"
        return if (pending > 0) "$who · $pending queued" else who
    }

    private fun updateNotification() {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIF_ID, buildNotification(statusLine()))
        sendBroadcast(Intent(ACTION_LOG_UPDATED).setPackage(packageName))
    }

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
    override fun onDestroy() {
        runCatching { beat.shutdownNow() }
        io.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val NOTIF_ID = 1001
        private const val CHANNEL = "koda_sentinel"
        private const val HEARTBEAT_MIN = 5L
        private const val EXTRA_RAW = "raw"
        private const val EXTRA_OP = "op"
        const val ACTION_LOG_UPDATED = "africa.koda.sentinel.LOG_UPDATED"

        fun start(ctx: Context) = launch(ctx, Intent(ctx, ForwardService::class.java))

        /** Nudge the running service to drain the outbox now. */
        fun kick(ctx: Context) = launch(ctx, Intent(ctx, ForwardService::class.java))

        private fun launch(ctx: Context, i: Intent) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i)
                else ctx.startService(i)
            } catch (e: Exception) {
                // Android 12+ can refuse a background FGS start; the outbox is durable
                // and WorkManager will drain it, so this is safe to swallow.
                DrainWorker.schedule(ctx)
            }
        }
    }
}
