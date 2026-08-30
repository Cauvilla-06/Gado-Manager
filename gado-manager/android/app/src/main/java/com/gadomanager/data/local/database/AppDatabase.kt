package com.gadomanager.data.local.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.gadomanager.data.local.dao.VaccinationDao
import com.gadomanager.data.local.dao.WeightRecordDao
import com.gadomanager.data.local.entity.VaccinationEntity
import com.gadomanager.data.local.entity.WeightRecordEntity

@Database(
    entities = [WeightRecordEntity::class, VaccinationEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun weightRecordDao(): WeightRecordDao
    abstract fun vaccinationDao(): VaccinationDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "gado_manager.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
