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
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import africa.koda.sentinel.databinding.ActivityMainBinding
import com.google.zxing.integration.android.IntentIntegrator
import java.util.concurrent.Executors

/** Pair screen + status/log. P0 UI is intentionally minimal — this is a utility. */
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
            runOnUiThread {
                if (ok) {
                    Prefs.save(this, baseUrl, token)
                    ensurePermissions()
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

    private fun ensurePermissions() {
        val need = mutableListOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS)
        if (Build.VERSION.SDK_INT >= 33) need.add(Manifest.permission.POST_NOTIFICATIONS)
        val ask = need.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (ask.isNotEmpty()) ActivityCompat.requestPermissions(this, ask.toTypedArray(), 7)
    }

    private fun render() {
        val paired = Prefs.isPaired(this)
        b.status.text = if (paired) getString(R.string.paired_ok) else getString(R.string.not_paired)
        b.pairedGroup.visibility = if (paired) View.VISIBLE else View.GONE
        b.pairGroup.visibility = if (paired) View.GONE else View.VISIBLE
    }

    private fun refreshLog() {
        b.log.text = Prefs.log(this).reversed().joinToString("\n").ifBlank { getString(R.string.no_sms) }
    }

    private fun toast(m: String) = Toast.makeText(this, m, Toast.LENGTH_SHORT).show()
}
