package africa.koda.sentinel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/** Fires on every inbound SMS; forwards only operator payment messages. */
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
        for ((sender, sb) in bySender) {
            val op = OperatorFilter.operatorFor(sender) ?: continue // privacy: skip non-operator SMS
            ForwardService.enqueue(context, sb.toString(), op)
        }
    }
}
