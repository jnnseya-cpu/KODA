package africa.koda.sentinel.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface OutboxDao {
    @Insert
    fun insert(entry: OutboxEntry): Long

    /** Oldest-first batch of not-yet-sent messages to drain. */
    @Query("SELECT * FROM outbox WHERE sent = 0 ORDER BY receivedAt ASC LIMIT :limit")
    fun pending(limit: Int = 50): List<OutboxEntry>

    @Query("SELECT COUNT(*) FROM outbox WHERE sent = 0")
    fun pendingCount(): Int

    @Query("UPDATE outbox SET sent = 1, lastError = NULL WHERE id = :id")
    fun markSent(id: Long)

    @Query("UPDATE outbox SET attempts = attempts + 1, lastError = :error WHERE id = :id")
    fun markFailed(id: Long, error: String)

    /** De-dupe guard: same sender + body within a short window is the same SMS. */
    @Query("SELECT COUNT(*) FROM outbox WHERE sender = :sender AND raw = :raw AND receivedAt > :since")
    fun seen(sender: String, raw: String, since: Long): Int

    /** Housekeeping — drop sent rows older than the retention window. */
    @Query("DELETE FROM outbox WHERE sent = 1 AND receivedAt < :before")
    fun prune(before: Long)
}
