package com.gadomanager.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.gadomanager.data.local.entity.WeightRecordEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface WeightRecordDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(record: WeightRecordEntity): Long

    @Query("SELECT * FROM weight_records WHERE animalNumero = :numero ORDER BY dataPesagem DESC")
    fun getByAnimalNumero(numero: String): Flow<List<WeightRecordEntity>>

    @Query("SELECT * FROM weight_records WHERE sincronizado = 0 ORDER BY createdAt ASC")
    suspend fun getPendingSync(): List<WeightRecordEntity>

    @Query("UPDATE weight_records SET sincronizado = 1 WHERE clientGeneratedId = :id")
    suspend fun markSynced(id: String)

    @Query("SELECT COUNT(*) FROM weight_records WHERE sincronizado = 0")
    fun pendingCount(): Flow<Int>

    @Query("DELETE FROM weight_records WHERE clientGeneratedId = :id")
    suspend fun deleteById(id: String)
}
