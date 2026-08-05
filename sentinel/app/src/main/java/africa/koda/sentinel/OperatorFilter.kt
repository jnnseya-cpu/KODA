package africa.koda.sentinel

/**
 * Only mobile-money operator SMS are forwarded — personal messages are never
 * read or sent. Mirrors the sender allowlist in KODA's shared/parser.js.
 */
object OperatorFilter {
    private val MAP = linkedMapOf(
        "ORANGEMONEY" to "orange_cd", "ORANGE" to "orange_cd",
        "M-PESA" to "mpesa_cd", "MPESA" to "mpesa_cd", "VODACOM" to "mpesa_cd",
        "AIRTELMONEY" to "airtel_cd", "AIRTEL" to "airtel_cd",
        "AFRICELL" to "africell_cd",
        "MTN" to "mtn_momo", "MOMO" to "mtn_momo",
        "WAVE" to "wave"
    )

    /** Returns the KODA operator id if the sender is a known operator, else null (skip). */
    fun operatorFor(sender: String?): String? {
        val s = (sender ?: "").uppercase()
        for ((needle, op) in MAP) if (s.contains(needle)) return op
        return null
    }
}
