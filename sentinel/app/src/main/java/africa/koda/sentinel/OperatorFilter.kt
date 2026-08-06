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
}
