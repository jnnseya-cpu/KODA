package africa.koda.sentinel

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Talks to the KODA backend. Zero third-party HTTP deps — plain HttpURLConnection. */
object KodaClient {
    data class Result(val code: Int, val body: String)

    private fun open(url: String, token: String, method: String): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }

    private fun read(c: HttpURLConnection): Result {
        val code = c.responseCode
        val stream = if (code in 200..299) c.inputStream else c.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
        return Result(code, body)
    }

    private fun post(url: String, token: String, json: JSONObject): Result {
        val c = open(url, token, "POST").apply {
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
        }
        return try {
            c.outputStream.use { it.write(json.toString().toByteArray(Charsets.UTF_8)) }
            read(c)
        } finally { c.disconnect() }
    }

    private fun get(url: String, token: String): Result {
        val c = open(url, token, "GET")
        return try { read(c) } finally { c.disconnect() }
    }

    /**
     * Fetch device config — validates the token and returns the merchant name,
     * the enrolled operator, and the global sender allowlist. 200 => configured.
     */
    fun config(baseUrl: String, token: String): Result = get("$baseUrl/v1/device/config", token)

    /**
     * Validate a device token. Uses /v1/device/config; anything other than 401
     * means the token authenticates.
     */
    fun validate(baseUrl: String, token: String): Boolean = try {
        config(baseUrl, token).code != 401
    } catch (e: Exception) {
        false
    }

    /** Forward one operator SMS to the live ledger (optionally attested). */
    fun forward(baseUrl: String, token: String, raw: String, operator: String, battery: Int, attestation: String?): Result {
        val body = JSONObject()
            .put("raw", raw)
            .put("operator", operator)
            .put("battery", battery)
            .put("attested", attestation != null)
        if (attestation != null) body.put("attestation", attestation)
        return post("$baseUrl/v1/device/sms", token, body)
    }

    /** Lightweight heartbeat that keeps device health fresh for the resolver. */
    fun heartbeat(baseUrl: String, token: String, battery: Int, parseHealth: Double, attestation: String?): Result {
        val body = JSONObject()
            .put("battery", battery)
            .put("parse_health", parseHealth)
            .put("attested", attestation != null)
            // tell KODA which build this is so the Devices page can show the right mode + tips
            .put("capture", if (BuildConfig.USE_NOTIFICATION_LISTENER) "notification" else "sms")
        if (attestation != null) body.put("attestation", attestation)
        return post("$baseUrl/v1/device/heartbeat", token, body)
    }
}
