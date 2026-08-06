package africa.koda.sentinel

import android.content.Context
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest

/**
 * Play Integrity attestation — proves the forward came from a genuine, unrooted
 * device running the real Sentinel app. The token is attached to /v1/device/sms
 * as `attestation`; the backend sets the device `attested` flag once it verifies.
 *
 * Fail-open by design: if Play services or the integrity project are unavailable
 * (side-loaded fleet, no Google account), forwarding still works — it is simply
 * marked un-attested, and KODA's token + replay index remain the hard gates.
 * A real integrity project number is injected at build time; 0 disables it.
 */
object IntegrityGate {
    // Set to your Play Integrity cloud project number to enable attestation.
    private const val CLOUD_PROJECT_NUMBER = 0L
    @Volatile private var cached: String? = null
    @Volatile private var refreshedAt: Long = 0
    private const val TTL_MS = 30L * 60 * 1000   // refresh every 30 min

    fun cachedToken(ctx: Context): String? = cached

    /** Blocking refresh — call off the main thread (service executor / worker). */
    fun refresh(ctx: Context): String? {
        if (CLOUD_PROJECT_NUMBER == 0L) return null
        if (cached != null && System.currentTimeMillis() - refreshedAt < TTL_MS) return cached
        return try {
            val nonce = Prefs.token(ctx)?.takeLast(16) ?: "koda-sentinel"
            val manager = IntegrityManagerFactory.create(ctx.applicationContext)
            val task = manager.requestIntegrityToken(
                IntegrityTokenRequest.builder()
                    .setNonce(nonce)
                    .setCloudProjectNumber(CLOUD_PROJECT_NUMBER)
                    .build()
            )
            val token = com.google.android.gms.tasks.Tasks.await(task).token()
            cached = token; refreshedAt = System.currentTimeMillis()
            token
        } catch (e: Exception) {
            null   // fail-open: forward un-attested
        }
    }
}
