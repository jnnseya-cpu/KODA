package africa.koda.sentinel

import android.content.Context
import org.json.JSONObject

/**
 * Pulls /v1/device/config and caches merchant name, enrolled operator and the
 * global sender allowlist, so the on-device privacy filter tracks KODA's
 * 200+-operator registry without shipping a new APK. Best-effort: on any error
 * the last cached config (or the built-in fallback allowlist) keeps working.
 */
object DeviceConfig {
    /** Blocking refresh — call off the main thread. Returns true on 200. */
    fun refresh(ctx: Context): Boolean {
        val token = Prefs.token(ctx) ?: return false
        return try {
            val r = KodaClient.config(Prefs.baseUrl(ctx), token)
            if (r.code == 401) { Prefs.setNeedsRepair(ctx, true); return false }
            if (r.code != 200) return false
            val o = JSONObject(r.body)
            val allow = o.optJSONObject("allowlist")?.toString()
            Prefs.setConfig(ctx, o.optString("merchant_name", null), o.optString("operator", null), allow)
            Prefs.setNeedsRepair(ctx, false)
            true
        } catch (e: Exception) { false }
    }
}
