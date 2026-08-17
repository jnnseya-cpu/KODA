package africa.koda.sentinel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/** Fires on every inbound SMS; persists only operator payment messages to the outbox. */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        if (!Prefs.isPaired(context)) return

        val msgs = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        // reassemble multipart SMS by sender
        val bySender = LinkedHashMap<String, StringBuilder>()
        for (m in msgs) {
            val from = m.displayOriginatingAddress ?: m.originatingAddress ?: ""
            bySender.getOrPut(from) { StringBuilder() }.append(m.messageBody ?: "")
        }
        val now = System.currentTimeMillis()
        var queued = false
        for ((sender, sb) in bySender) {
            val op = OperatorFilter.operatorFor(context, sender) ?: continue // privacy: skip non-operator SMS
            Outbox.enqueue(context, sb.toString(), op, sender, now)          // durable BEFORE any network call
            queued = true
        }
        // wake the foreground service to drain the outbox immediately (WorkManager is the backstop)
        if (queued) ForwardService.kick(context)
    }
}
