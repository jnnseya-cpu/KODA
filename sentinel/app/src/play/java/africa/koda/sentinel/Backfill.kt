package africa.koda.sentinel

import android.content.Context

/**
 * Play build: no SMS access, so there is nothing to back-fill from the SMS
 * inbox. Live capture happens through the NotificationForwarder instead. This
 * no-op keeps ForwardService's call site identical across both flavors.
 */
object Backfill {
    fun run(ctx: Context) { /* notification-listener build reads no SMS inbox */ }
}
