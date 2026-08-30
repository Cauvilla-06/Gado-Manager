package com.gadomanager.sync

import android.util.Log
import com.gadomanager.data.local.database.AppDatabase
import com.gadomanager.data.remote.RetrofitClient
import com.gadomanager.data.remote.SyncRequest
import com.gadomanager.data.remote.SyncVaccinePayload
import com.gadomanager.data.remote.SyncVermifugePayload
import com.gadomanager.data.remote.SyncVitaminPayload
import com.gadomanager.data.remote.SyncWeightPayload

class SyncManager(private val database: AppDatabase) {

    companion object {
        private const val TAG = "SyncManager"
    }

    /**
     * Sync all pending records to the server.
     * Uses clientGeneratedId for idempotency - duplicates are ignored.
     */
    suspend fun syncAll(): SyncResult {
        val weightDao = database.weightRecordDao()
        val vaccinationDao = database.vaccinationDao()

        val pendingWeights = weightDao.getPendingSync()
        val pendingVaccines = vaccinationDao.getPendingSync()

        if (pendingWeights.isEmpty() && pendingVaccines.isEmpty()) {
            return SyncResult(
                pesagensProcessadas = 0,
                vacinasProcessadas = 0,
                duplicados = 0,
                erros = emptyList()
            )
        }

        val request = SyncRequest(
            pesagens = pendingWeights.map { w ->
                SyncWeightPayload(
                    clientGeneratedId = w.clientGeneratedId,
                    animalNumero = w.animalNumero,
                    pesoKg = w.pesoKg,
                    dataPesagem = w.dataPesagem,
                    cicloId = w.cicloId,
                    observacao = w.observacao
                )
            },
            vacinas = pendingVaccines.map { v ->
                SyncVaccinePayload(
                    clientGeneratedId = v.clientGeneratedId,
                    animalNumero = v.animalNumero,
                    nomeVacina = v.nomeVacina,
                    dataAplicacao = v.dataAplicacao,
                    dataProximaDose = v.dataProximaDose,
                    lote = v.lote,
                    observacao = v.observacao,
                    cicloId = v.cicloId
                )
            },
            vermifugos = emptyList(), // TODO: Implementar sync de vermifugos
            vitaminas = emptyList() // TODO: Implementar sync de vitaminas
        )

        return try {
            val response = RetrofitClient.apiService.sync(request)
            if (response.isSuccessful) {
                val body = response.body()!!

                // Mark synced records
                pendingWeights.forEach { w ->
                    weightDao.markSynced(w.clientGeneratedId)
                }
                pendingVaccines.forEach { v ->
                    vaccinationDao.markSynced(v.clientGeneratedId)
                }

                Log.d(TAG, "Sync successful: ${body.pesagensProcessadas} weights, ${body.vacinasProcessadas} vaccines")
                SyncResult(
                    pesagensProcessadas = body.pesagensProcessadas,
                    vacinasProcessadas = body.vacinasProcessadas,
                    duplicados = body.duplicados,
                    erros = body.erros
                )
            } else {
                Log.e(TAG, "Sync failed: ${response.code()}")
                SyncResult(
                    pesagensProcessadas = 0,
                    vacinasProcessadas = 0,
                    duplicados = 0,
                    erros = listOf("Erro do servidor: ${response.code()}")
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Sync error", e)
            SyncResult(
                pesagensProcessadas = 0,
                vacinasProcessadas = 0,
                duplicados = 0,
                erros = listOf("Sem conexão: ${e.message}")
            )
        }
    }

    data class SyncResult(
        val pesagensProcessadas: Int,
        val vacinasProcessadas: Int,
        val duplicados: Int,
        val erros: List<String>
    )
}
