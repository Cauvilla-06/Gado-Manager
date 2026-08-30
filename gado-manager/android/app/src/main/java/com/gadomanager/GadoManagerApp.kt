package com.gadomanager

import android.app.Application
import androidx.work.Configuration
import com.gadomanager.data.local.database.AppDatabase

class GadoManagerApp : Application(), Configuration.Provider {

    val database: AppDatabase by lazy {
        AppDatabase.getInstance(this)
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()
}
