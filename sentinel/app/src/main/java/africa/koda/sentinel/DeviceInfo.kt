package africa.koda.sentinel

import android.content.Context
import android.os.BatteryManager

/** Tiny telemetry helpers shared by the service, the outbox drain and heartbeats. */
object DeviceInfo {
    fun batteryPct(ctx: Context): Int = try {
        (ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager)
            .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    } catch (e: Exception) { -1 }
}
