package africa.koda.sentinel.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [OutboxEntry::class], version = 1, exportSchema = false)
abstract class OutboxDb : RoomDatabase() {
    abstract fun outbox(): OutboxDao

    companion object {
        @Volatile private var INSTANCE: OutboxDb? = null

        fun get(ctx: Context): OutboxDb = INSTANCE ?: synchronized(this) {
            INSTANCE ?: Room.databaseBuilder(
                ctx.applicationContext, OutboxDb::class.java, "koda_outbox.db"
            ).build().also { INSTANCE = it }
        }
    }
}
