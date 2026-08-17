package africa.koda.sentinel

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Play Store build — the Google-Play-compliant capture path.
 *
 * Instead of the restricted READ_SMS / RECEIVE_SMS permissions (which Google Play
 * does not allow for payment-verification apps), the Play build reads the operator
 * PAYMENT NOTIFICATION the phone already shows — the same "Vous avez reçu 25 000 FC…
 * Réf…" banner — via NotificationListenerService, and feeds it into the exact same
 * outbox pipeline as the SMS path. Notification access is a user-granted, disclosed
 * permission that IS permitted on Play.
 *
 * Privacy is preserved end to end: a notification is only read and forwarded when it
 * resolves to a known mobile-money operator (by the SMS-notification sender/title, or
 * by the operator app's package). Everything else is ignored on-device and never
 * leaves the phone — identical to the SMS OperatorFilter guarantee.
 */
class NotificationForwarder : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val ctx = applicationContext
        if (!Prefs.isPaired(ctx)) return

        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val body = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        if (body.isBlank()) return

        // Match an operator either by the notification title (the SMS sender, e.g. "M-PESA"
        // when the Messages app posts the SMS) or by the posting app's package (an operator
        // app's own "you received" notification). No match → not a payment notice → skip.
        val op = OperatorFilter.operatorFor(ctx, title)
            ?: OperatorFilter.operatorForPackage(sbn.packageName)
            ?: return

        val sender = title.ifBlank { sbn.packageName }
        Outbox.enqueue(ctx, body, op, sender, sbn.postTime)     // durable BEFORE any network call
        ForwardService.kick(ctx)                                // drain now; WorkManager is the backstop
    }

    override fun onListenerConnected() {
        // ensure the drain service is up as soon as notification access is granted
        if (Prefs.isPaired(applicationContext)) ForwardService.start(applicationContext)
    }
}
