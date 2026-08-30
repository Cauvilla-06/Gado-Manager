package com.gadomanager.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "vaccinations",
    indices = [
        Index(value = ["animalNumero"]),
        Index(value = ["clientGeneratedId"], unique = true),
        Index(value = ["sincronizado"])
    ]
)
data class VaccinationEntity(
    @PrimaryKey val clientGeneratedId: String,
    val animalNumero: String,
    val nomeVacina: String,
    val dataAplicacao: String,
    val dataProximaDose: String?,
    val lote: String?,
    val observacao: String?,
    val cicloId: String?,
    val sincronizado: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
