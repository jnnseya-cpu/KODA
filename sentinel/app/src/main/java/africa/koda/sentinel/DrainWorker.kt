package africa.koda.sentinel

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters

/**
 * Drains the outbox when the immediate in-service send couldn't (offline, error).
 * WorkManager gives us OS-managed exponential backoff that survives Doze, reboot
 * and process death — the durability guarantee behind "no lost payment".
 */
class DrainWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        if (!Prefs.isPaired(applicationContext)) return Result.success()
        val done = Outbox.drain(applicationContext)
        return if (done) Result.success() else Result.retry()   // retry() → backoff
    }

    companion object {
        private const val UNIQUE = "koda_outbox_drain"

        /** Enqueue a network-gated drain with exponential backoff. */
        fun schedule(ctx: Context) {
            val req = OneTimeWorkRequestBuilder<DrainWorker>()
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                )
                .build()
            WorkManager.getInstance(ctx).enqueueUniqueWork(UNIQUE, ExistingWorkPolicy.REPLACE, req)
        }
    }
}
