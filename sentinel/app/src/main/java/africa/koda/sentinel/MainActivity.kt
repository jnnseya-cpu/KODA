package africa.koda.sentinel

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import africa.koda.sentinel.databinding.ActivityMainBinding
import com.google.zxing.integration.android.IntentIntegrator
import java.util.concurrent.Executors

/** Pair screen + status/log. Minimal by design — Sentinel is a background utility. */
class MainActivity : AppCompatActivity() {
    private lateinit var b: ActivityMainBinding
    private val io = Executors.newSingleThreadExecutor()

    private val logReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) = refreshLog()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.baseUrl.setText(Prefs.baseUrl(this))
        b.scanBtn.setOnClickListener {
            IntentIntegrator(this).setOrientationLocked(true)
                .setPrompt("Scan the KODA pairing QR").initiateScan()
        }
        b.pairBtn.setOnClickListener {
            pair(b.baseUrl.text.toString().trim(), b.token.text.toString().trim())
        }
        b.unpairBtn.setOnClickListener { Prefs.clear(this); render() }
        render()
    }

    override fun onResume() {
        super.onResume()
        ContextCompat.registerReceiver(
            this, logReceiver, IntentFilter(ForwardService.ACTION_LOG_UPDATED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        refreshLog(); render()
    }

    override fun onPause() {
        super.onPause()
        runCatching { unregisterReceiver(logReceiver) }
    }

    private fun pair(baseUrl: String, tokenRaw: String) {
        val token = parseToken(tokenRaw)
        if (token == null || !token.startsWith("dvk_")) { toast("Enter a valid pairing token"); return }
        b.status.text = getString(R.string.checking)
        io.execute {
            val ok = KodaClient.validate(baseUrl, token)
            if (ok) {
                Prefs.save(this, baseUrl, token)
                DeviceConfig.refresh(this)          // learn merchant + operator + allowlist
            }
            runOnUiThread {
                if (ok) {
                    ensurePermissions()
                    requestBatteryExemption()
                    ForwardService.start(this)
                    render(); toast("Paired ✓")
                } else toast("Pairing failed — check the token / URL")
            }
        }
    }

    /** Accept a raw dvk_ token, or a koda://enroll/<code>?t=dvk_... pairing URL. */
    private fun parseToken(s: String): String? {
        if (s.startsWith("koda://")) return Uri.parse(s).getQueryParameter("t")
        return s.ifBlank { null }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val res = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (res != null && res.contents != null) {
            parseToken(res.contents)?.let { t ->
                b.token.setText(t)
                pair(b.baseUrl.text.toString().trim(), t)
            }
        } else super.onActivityResult(requestCode, resultCode, data)
    }

    // Capture setup is flavor-specific: the `sideload` build requests the SMS
    // permissions; the `play` build requests notification access. Keeping this in a
    // per-flavor CaptureSetup means the Play build carries no SMS references at all.
    private fun ensurePermissions() = CaptureSetup.ensure(this)

    /** Ask Android to exempt Sentinel from Doze so the outbox drains during idle. */
    private fun requestBatteryExemption() {
        try {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                startActivity(
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                        .setData(Uri.parse("package:$packageName"))
                )
            }
        } catch (e: Exception) { /* OEM without the settings screen — service still runs */ }
    }

    private fun render() {
        val paired = Prefs.isPaired(this)
        val repair = Prefs.needsRepair(this)
        val merchant = Prefs.merchantName(this)
        b.status.text = when {
            !paired -> getString(R.string.not_paired)
            repair -> getString(R.string.needs_repair)
            merchant != null -> getString(R.string.paired_to, merchant)
            else -> getString(R.string.paired_ok)
        }
        b.pairedGroup.visibility = if (paired) View.VISIBLE else View.GONE
        b.pairGroup.visibility = if (paired) View.GONE else View.VISIBLE
    }

    private fun refreshLog() {
        b.log.text = Prefs.log(this).reversed().joinToString("\n").ifBlank { getString(R.string.no_sms) }
    }

    private fun toast(m: String) = Toast.makeText(this, m, Toast.LENGTH_SHORT).show()
}
