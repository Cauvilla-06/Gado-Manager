package com.gadomanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Vaccines
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gadomanager.data.local.database.AppDatabase
import com.gadomanager.data.local.entity.VaccinationEntity
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterVaccineScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val database = remember { AppDatabase.getInstance(context) }

    var animalNumero by remember { mutableStateOf("") }
    var nomeVacina by remember { mutableStateOf("") }
    var lote by remember { mutableStateOf("") }
    var observacao by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val today = remember {
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Registrar Vacina", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { padding ->
        if (saved) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    Icons.Default.CheckCircle,
                    contentDescription = null,
                    tint = Color(0xFF16A34A),
                    modifier = Modifier.size(72.dp)
                )
                Spacer(Modifier.height(16.dp))
                Text("Vacina registrada!", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                Text("Salvo no dispositivo. Sincronização automática.", fontSize = 14.sp, color = Color(0xFF6B7280))
                Spacer(Modifier.height(24.dp))
                OutlinedButton(
                    onClick = {
                        saved = false
                        animalNumero = ""
                        nomeVacina = ""
                        lote = ""
                        observacao = ""
                    },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Registrar Outra")
                }
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onBack) { Text("Voltar") }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OutlinedTextField(
                    value = animalNumero,
                    onValueChange = { animalNumero = it.filter { c -> c.isDigit() || c == '-' || c in 'A'..'Z' || c in 'a'..'z' } },
                    label = { Text("Número do Boi *") },
                    leadingIcon = { Icon(Icons.Default.Vaccines, null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = nomeVacina,
                    onValueChange = { nomeVacina = it },
                    label = { Text("Nome da Vacina *") },
                    placeholder = { Text("Ex: Febre Aftosa") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = lote,
                    onValueChange = { lote = it },
                    label = { Text("Lote (opcional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = observacao,
                    onValueChange = { observacao = it },
                    label = { Text("Observação (opcional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                Text("Data: $today", fontSize = 13.sp, color = Color(0xFF6B7280))

                error?.let { msg ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(msg, modifier = Modifier.padding(12.dp), color = Color(0xFF991B1B), fontSize = 13.sp)
                    }
                }

                Spacer(Modifier.weight(1f))

                Button(
                    onClick = {
                        error = null
                        val numero = animalNumero.trim()
                        val vacina = nomeVacina.trim()

                        when {
                            numero.isEmpty() -> error = "Informe o número do boi."
                            vacina.isEmpty() -> error = "Informe o nome da vacina."
                            else -> {
                                scope.launch {
                                    val uuid = UUID.randomUUID().toString()
                                    val record = VaccinationEntity(
                                        clientGeneratedId = uuid,
                                        animalNumero = numero,
                                        nomeVacina = vacina,
                                        dataAplicacao = today,
                                        lote = lote.ifBlank { null },
                                        observacao = observacao.ifBlank { null },
                                        sincronizado = false
                                    )
                                    database.vaccinationDao().insert(record)
                                    saved = true
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Text("Salvar Vacina", fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
