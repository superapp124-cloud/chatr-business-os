package com.chatr.app.shield

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object LeakMonitoringService {
    fun statusJson(context: Context): JSONObject {
        val dao = ShieldDatabase.get(context.applicationContext).dao()
        val leaks = dao.recentLeakResults(limit = 10)
        return JSONObject().apply {
            put("monitoredEmails", dao.monitoredEmails())
            put("exposureCount", dao.exposureCount())
            put("lastScanAt", leaks.maxOfOrNull { it.foundAt } ?: JSONObject.NULL)
            put(
                "results",
                JSONArray().apply {
                    leaks.forEach { leak ->
                        put(
                            JSONObject().apply {
                                put("id", leak.id)
                                put("provider", leak.provider)
                                put("breachName", leak.breachName ?: JSONObject.NULL)
                                put("severity", leak.severity)
                                put("exposedDataClasses", leak.exposedDataClasses)
                                put("remediation", leak.remediation ?: JSONObject.NULL)
                                put("foundAt", leak.foundAt)
                            },
                        )
                    }
                },
            )
        }
    }

    fun scheduleRefresh(context: Context) {
        ShieldSyncWorker.enqueue(context.applicationContext)
    }
}
