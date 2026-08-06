package africa.koda.sentinel

import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat

/**
 * Cold-start recovery: scan the SMS inbox for operator messages that arrived
 * while Sentinel was down (reboot, force-stop, crash) and enqueue any not yet
 * seen. The de-dupe guard in Outbox makes overlaps harmless, so a payment made
 * while the app was dead is still verified — late, but verified.
 */
object Backfill {
    private const val LOOKBACK_MS = 24L * 3600 * 1000   // scan the last 24h on each launch

    fun run(ctx: Context) {
        if (!Prefs.isPaired(ctx)) return
        if (ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.READ_SMS)
            != PackageManager.PERMISSION_GRANTED) return

        val since = maxOf(System.currentTimeMillis() - LOOKBACK_MS, Prefs.lastBackfill(ctx))
        val uri = Telephony.Sms.Inbox.CONTENT_URI
        val cols = arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
        var count = 0
        try {
            ctx.contentResolver.query(uri, cols, "${Telephony.Sms.DATE} > ?", arrayOf(since.toString()), "${Telephony.Sms.DATE} ASC")
                ?.use { c ->
                    val iAddr = c.getColumnIndex(Telephony.Sms.ADDRESS)
                    val iBody = c.getColumnIndex(Telephony.Sms.BODY)
                    val iDate = c.getColumnIndex(Telephony.Sms.DATE)
                    while (c.moveToNext()) {
                        val sender = if (iAddr >= 0) c.getString(iAddr) else null
                        val body = if (iBody >= 0) c.getString(iBody) else null
                        val date = if (iDate >= 0) c.getLong(iDate) else System.currentTimeMillis()
                        val op = OperatorFilter.operatorFor(ctx, sender) ?: continue
                        Outbox.enqueue(ctx, body ?: "", op, sender ?: "", date)
                        count++
                    }
                }
            Prefs.setLastBackfill(ctx, System.currentTimeMillis())
            if (count > 0) Prefs.appendLog(ctx, "BACKFILL enqueued $count")
        } catch (e: Exception) {
            // inbox read can be restricted on some OEMs — live capture still works
        }
    }
}
