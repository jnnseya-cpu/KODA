package africa.koda.sentinel

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Talks to the KODA backend. Zero third-party HTTP deps — plain HttpURLConnection. */
object KodaClient {
    data class Result(val code: Int, val body: String)

    private fun post(url: String, token: String, json: JSONObject): Result {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        return try {
            c.outputStream.use { it.write(json.toString().toByteArray(Charsets.UTF_8)) }
            val code = c.responseCode
            val stream = if (code in 200..299) c.inputStream else c.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() } ?: ""
            Result(code, body)
        } finally {
            c.disconnect()
        }
    }

    /**
     * Validate a device token against the real endpoint with an empty body.
     * 401 => bad token. 400 (raw_required) or 200 => the token authenticates.
     */
    fun validate(baseUrl: String, token: String): Boolean = try {
        post("$baseUrl/v1/device/sms", token, JSONObject()).code != 401
    } catch (e: Exception) {
        false
    }

    /** Forward one operator SMS to the live ledger. */
    fun forward(baseUrl: String, token: String, raw: String, operator: String, battery: Int): Result {
        val body = JSONObject()
            .put("raw", raw)
            .put("operator", operator)
            .put("battery", battery)
            .put("attested", false) // P2: set true once Play Integrity passes
        return post("$baseUrl/v1/device/sms", token, body)
    }
}
