package africa.koda.sentinel

import android.content.Context
import africa.koda.sentinel.data.OutboxDb
import africa.koda.sentinel.data.OutboxEntry

/**
 * At-least-once delivery of operator SMS. Every message is persisted to Room
 * before any network call; a drain sends the backlog and marks each row on 200.
 * Duplicates are harmless (KODA's replay index), so we favour never-lose.
 */
object Outbox {
    private const val DEDUPE_WINDOW_MS = 60_000L        // same sender+body within 60s = same SMS
    private const val MAX_ATTEMPTS = 12                 // then park it (still visible in the log)
    private const val RETENTION_MS = 7L * 24 * 3600 * 1000

    fun enqueue(ctx: Context, raw: String, operator: String, sender: String, receivedAt: Long) {
        val dao = OutboxDb.get(ctx).outbox()
        if (dao.seen(sender, raw, receivedAt - DEDUPE_WINDOW_MS) > 0) return
        dao.insert(OutboxEntry(raw = raw, operator = operator, sender = sender, receivedAt = receivedAt))
    }

    fun pendingCount(ctx: Context): Int = OutboxDb.get(ctx).outbox().pendingCount()

    /**
     * Send everything pending. Returns true if the queue is fully drained (or was
     * already empty), false if any message still needs a retry. Called from the
     * foreground service and from DrainWorker.
     */
    fun drain(ctx: Context): Boolean {
        val dao = OutboxDb.get(ctx).outbox()
        val base = Prefs.baseUrl(ctx)
        val token = Prefs.token(ctx) ?: return true       // unpaired → nothing to do
        dao.prune(System.currentTimeMillis() - RETENTION_MS)

        var allSent = true
        val battery = DeviceInfo.batteryPct(ctx)
        val attested = IntegrityGate.cachedToken(ctx)
        for (e in dao.pending()) {
            val short = e.raw.take(48).replace("\n", " ")
            try {
                val r = KodaClient.forward(base, token, e.raw, e.operator, battery, attested)
                when {
                    r.code == 200 -> {
                        dao.markSent(e.id)
                        Prefs.appendLog(ctx, "OK  [${e.operator}] $short")
                    }
                    r.code == 401 -> {                     // token dead — stop, surface re-pair
                        dao.markFailed(e.id, "401")
                        Prefs.setNeedsRepair(ctx, true)
                        allSent = false
                        break
                    }
                    else -> { park(dao, e, "ERR ${r.code}"); allSent = false }
                }
            } catch (ex: Exception) {
                park(dao, e, "OFFLINE"); allSent = false
                Prefs.appendLog(ctx, "QUEUED $short")
                break                                      // network down — stop, WorkManager retries
            }
        }
        return allSent
    }

    private fun park(dao: africa.koda.sentinel.data.OutboxDao, e: OutboxEntry, err: String) {
        // give up on a poison message rather than block the queue forever
        if (e.attempts + 1 >= MAX_ATTEMPTS) dao.markSent(e.id)
        else dao.markFailed(e.id, err)
    }
}
