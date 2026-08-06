package africa.koda.sentinel

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Periodic backstop heartbeat (WorkManager min interval is 15 min). The primary
 * heartbeat cadence (~5 min, inside the resolver's 10-min health window) is driven
 * by the foreground service; this worker keeps last_seen fresh even if the service
 * was killed, and also drains any stragglers.
 */
class HeartbeatWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val ctx = applicationContext
        if (!Prefs.isPaired(ctx)) return Result.success()
        // config refresh keeps the allowlist current; heartbeat keeps the device HEALTHY
        DeviceConfig.refresh(ctx)
        val attestation = IntegrityGate.refresh(ctx)
        runCatching {
            KodaClient.heartbeat(Prefs.baseUrl(ctx), Prefs.token(ctx)!!, DeviceInfo.batteryPct(ctx), 1.0, attestation)
        }
        Outbox.drain(ctx)
        return Result.success()
    }

    companion object {
        private const val UNIQUE = "koda_heartbeat"

        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                )
                .build()
            WorkManager.getInstance(ctx)
                .enqueueUniquePeriodicWork(UNIQUE, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
