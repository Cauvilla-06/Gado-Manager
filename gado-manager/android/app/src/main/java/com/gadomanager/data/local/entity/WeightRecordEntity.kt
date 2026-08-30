package com.gadomanager.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "weight_records",
    indices = [
        Index(value = ["animalNumero"]),
        Index(value = ["clientGeneratedId"], unique = true),
        Index(value = ["sincronizado"])
    ]
)
data class WeightRecordEntity(
    @PrimaryKey val clientGeneratedId: String,
    val animalNumero: String,
    val pesoKg: Double,
    val dataPesagem: String,
    val cicloId: String?,
    val observacao: String?,
    val sincronizado: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)
