package africa.koda.sentinel

import android.content.Context
import org.json.JSONObject

/**
 * Only mobile-money operator SMS are forwarded — personal messages are never
 * read or sent. The allowlist is the global registry pulled from KODA
 * (/v1/device/config, cached in Prefs); a built-in fallback keeps the privacy
 * filter working before the first sync or fully offline.
 */
object OperatorFilter {
    // Fallback used until the device syncs the global allowlist from KODA.
    private val FALLBACK = linkedMapOf(
        "ORANGEMONEY" to "orange_cd", "ORANGE" to "orange_cd",
        "M-PESA" to "mpesa_cd", "MPESA" to "mpesa_cd", "VODACOM" to "mpesa_cd",
        "AIRTELMONEY" to "airtel_cd", "AIRTEL" to "airtel_cd",
        "AFRICELL" to "africell_cd", "AFRIMONEY" to "africell_cd",
        "MTN" to "mtn_momo", "MOMO" to "mtn_momo",
        "WAVE" to "wave", "MOOV" to "moov", "TIGO" to "tigo",
        "BKASH" to "bkash", "NAGAD" to "nagad", "GCASH" to "gcash",
        "JAZZCASH" to "jazzcash", "EASYPAISA" to "easypaisa", "EVCPLUS" to "evc_plus"
    )

    private fun allowlist(ctx: Context): Map<String, String> {
        val json = Prefs.allowlistJson(ctx) ?: return FALLBACK
        return try {
            val o = JSONObject(json)
            val m = LinkedHashMap<String, String>()
            for (k in o.keys()) m[k.uppercase()] = o.getString(k)
            if (m.isEmpty()) FALLBACK else m
        } catch (e: Exception) { FALLBACK }
    }

    /**
     * Returns the best-effort KODA operator id if the sender is a known operator,
     * else null (skip — never forwarded). The backend re-resolves the operator
     * from the device's enrolled network, so an approximate tag is fine here.
     */
    fun operatorFor(ctx: Context, sender: String?): String? {
        val s = (sender ?: "").uppercase().replace(" ", "")
        if (s.isEmpty()) return null
        val map = allowlist(ctx)
        // exact first, then contains — sender IDs vary (e.g. "OrangeMoney", "M-PESA")
        map[s]?.let { return it }
        for ((needle, op) in map) if (s.contains(needle)) return op
        return null
    }

    // Operator (and default-SMS) app packages → KODA operator id. Used by the Play
    // build's NotificationForwarder to recognise a payment notification by its source
    // app when the title alone doesn't carry an operator sender. Messaging apps are
    // included so an operator SMS surfaced as a notification still resolves via title.
    private val PACKAGES = linkedMapOf(
        "com.orange.orangemoney" to "orange_cd", "cd.orange.money" to "orange_cd",
        "com.vodacom.mpesa" to "mpesa_cd", "com.vodacash.mpesa" to "mpesa_cd", "vodacom.mpesa" to "mpesa_cd",
        "com.airtel.africa.money" to "airtel_cd", "com.airtel.money" to "airtel_cd",
        "com.africell.afrimoney" to "africell_cd",
        "com.mtn.momo" to "mtn_momo", "com.wave.personal" to "wave"
    )
    // Default SMS apps that post operator SMS as notifications — resolved by TITLE (sender).
    private val MESSAGING = setOf(
        "com.google.android.apps.messaging", "com.samsung.android.messaging",
        "com.android.messaging", "com.android.mms"
    )

    /** Operator id if the posting app is a known operator app; null otherwise. */
    fun operatorForPackage(pkg: String?): String? {
        val p = (pkg ?: "").lowercase()
        if (p.isEmpty() || p in MESSAGING) return null   // messaging apps resolve by title, not package
        return PACKAGES[p]
    }
}
