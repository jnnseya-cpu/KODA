package africa.koda.sentinel.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One durable row per operator SMS. Persisted BEFORE any network attempt so a
 * payment is never lost if the phone is offline or the app is killed mid-send.
 * KODA's replay index makes re-delivery harmless, so at-least-once is safe.
 */
@Entity(tableName = "outbox")
data class OutboxEntry(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val raw: String,
    val operator: String,
    val sender: String,
    val receivedAt: Long,          // epoch millis the SMS arrived
    val attempts: Int = 0,
    val sent: Boolean = false,
    val lastError: String? = null,
)
