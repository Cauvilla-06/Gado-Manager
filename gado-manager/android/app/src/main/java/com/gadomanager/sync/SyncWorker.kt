package com.gadomanager.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.gadomanager.data.local.database.AppDatabase

class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "SyncWorker"
        const val WORK_NAME = "gado_sync_work"
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "Starting sync...")

        val database = AppDatabase.getInstance(applicationContext)
        val syncManager = SyncManager(database)

        val result = syncManager.syncAll()

        return if (result.erros.isEmpty()) {
            Log.d(TAG, "Sync completed successfully")
            Result.success()
        } else {
            Log.w(TAG, "Sync completed with errors: ${result.erros}")
            Result.retry()
        }
    }
}
