package africa.koda.sentinel

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Encrypted storage for the device token + a small forward log (Android Keystore-backed). */
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
            .apply()
    }

    fun clear(ctx: Context) { sp(ctx).edit().remove("device_token").apply() }

    fun log(ctx: Context): List<String> =
        (sp(ctx).getString("log", "") ?: "").split("\n").filter { it.isNotBlank() }.takeLast(20)

    fun appendLog(ctx: Context, line: String) {
        val cur = log(ctx).toMutableList()
        cur.add(line)
        sp(ctx).edit().putString("log", cur.takeLast(20).joinToString("\n")).apply()
    }
}
