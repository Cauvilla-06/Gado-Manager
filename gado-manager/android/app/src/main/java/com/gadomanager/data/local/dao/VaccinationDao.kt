package com.gadomanager.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.gadomanager.data.local.entity.VaccinationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface VaccinationDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(record: VaccinationEntity): Long

    @Query("SELECT * FROM vaccinations WHERE animalNumero = :numero ORDER BY dataAplicacao DESC")
    fun getByAnimalNumero(numero: String): Flow<List<VaccinationEntity>>

    @Query("SELECT * FROM vaccinations WHERE sincronizado = 0 ORDER BY createdAt ASC")
    suspend fun getPendingSync(): List<VaccinationEntity>

    @Query("UPDATE vaccinations SET sincronizado = 1 WHERE clientGeneratedId = :id")
    suspend fun markSynced(id: String)

    @Query("SELECT COUNT(*) FROM vaccinations WHERE sincronizado = 0")
    fun pendingCount(): Flow<Int>
}
