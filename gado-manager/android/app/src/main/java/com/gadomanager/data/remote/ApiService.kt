package com.gadomanager.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

data class SyncWeightPayload(
    val clientGeneratedId: String,
    val animalNumero: String,
    val pesoKg: Double,
    val dataPesagem: String,
    val cicloId: String? = null,
    val observacao: String? = null
)

data class SyncVaccinePayload(
    val clientGeneratedId: String,
    val animalNumero: String,
    val nomeVacina: String,
    val dataAplicacao: String,
    val dataProximaDose: String? = null,
    val lote: String? = null,
    val observacao: String? = null,
    val cicloId: String? = null
)

data class SyncVermifugePayload(
    val clientGeneratedId: String,
    val animalNumero: String,
    val nomeVermifugo: String,
    val dose: String? = null,
    val dataAplicacao: String,
    val dataProximaDose: String? = null,
    val observacao: String? = null,
    val cicloId: String? = null
)

data class SyncVitaminPayload(
    val clientGeneratedId: String,
    val animalNumero: String,
    val nomeVitamina: String,
    val dose: String? = null,
    val dataAplicacao: String,
    val dataProximaDose: String? = null,
    val observacao: String? = null,
    val cicloId: String? = null
)

data class SyncRequest(
    val pesagens: List<SyncWeightPayload>,
    val vacinas: List<SyncVaccinePayload>,
    val vermifugos: List<SyncVermifugePayload> = emptyList(),
    val vitaminas: List<SyncVitaminPayload> = emptyList()
)

data class SyncResponse(
    val pesagensProcessadas: Int,
    val vacinasProcessadas: Int,
    val vermifugosProcessados: Int,
    val vitaminasProcessadas: Int,
    val duplicados: Int,
    val erros: List<String>
)

interface ApiService {

    @POST("api/sync")
    suspend fun sync(@Body request: SyncRequest): Response<SyncResponse>
}
