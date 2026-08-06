package africa.koda.sentinel

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Encrypted storage for the device token + config + a small forward log (Keystore-backed). */
object Prefs {
    private const val FILE = "koda_sentinel_secure"
    private const val DEFAULT_BASE = "https://kodajnn.com"

    private fun sp(ctx: Context) = EncryptedSharedPreferences.create(
        ctx, FILE,
        MasterKey.Builder(ctx).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun baseUrl(ctx: Context): String = sp(ctx).getString("base_url", DEFAULT_BASE) ?: DEFAULT_BASE
    fun token(ctx: Context): String? = sp(ctx).getString("device_token", null)
    fun isPaired(ctx: Context): Boolean = token(ctx) != null

    fun save(ctx: Context, baseUrl: String, token: String) {
        sp(ctx).edit()
            .putString("base_url", baseUrl.trimEnd('/'))
            .putString("device_token", token)
            .putBoolean("needs_repair", false)
            .apply()
    }

    fun clear(ctx: Context) {
        sp(ctx).edit()
            .remove("device_token").remove("merchant_name").remove("operator")
            .remove("allowlist").remove("needs_repair").remove("last_backfill")
            .apply()
    }

    // ---- device config (from /v1/device/config) ----
    fun setConfig(ctx: Context, merchant: String?, operator: String?, allowlistJson: String?) {
        val e = sp(ctx).edit()
        merchant?.let { e.putString("merchant_name", it) }
        operator?.let { e.putString("operator", it) }
        allowlistJson?.let { e.putString("allowlist", it) }
        e.apply()
    }

    fun merchantName(ctx: Context): String? = sp(ctx).getString("merchant_name", null)
    fun operator(ctx: Context): String? = sp(ctx).getString("operator", null)
    fun allowlistJson(ctx: Context): String? = sp(ctx).getString("allowlist", null)

    // ---- re-pair flag (set on repeated 401) ----
    fun needsRepair(ctx: Context): Boolean = sp(ctx).getBoolean("needs_repair", false)
    fun setNeedsRepair(ctx: Context, v: Boolean) = sp(ctx).edit().putBoolean("needs_repair", v).apply()

    // ---- cold-start backfill watermark ----
    fun lastBackfill(ctx: Context): Long = sp(ctx).getLong("last_backfill", 0L)
    fun setLastBackfill(ctx: Context, t: Long) = sp(ctx).edit().putLong("last_backfill", t).apply()

    // ---- rolling forward log (UI) ----
    fun log(ctx: Context): List<String> =
        (sp(ctx).getString("log", "") ?: "").split("\n").filter { it.isNotBlank() }.takeLast(30)

    fun appendLog(ctx: Context, line: String) {
        val cur = log(ctx).toMutableList()
        cur.add(line)
        sp(ctx).edit().putString("log", cur.takeLast(30).joinToString("\n")).apply()
    }
}
