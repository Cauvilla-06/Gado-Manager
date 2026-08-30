package com.gadomanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Scale
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gadomanager.data.local.database.AppDatabase
import com.gadomanager.data.local.entity.WeightRecordEntity
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegisterWeightScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val database = remember { AppDatabase.getInstance(context) }

    var animalNumero by remember { mutableStateOf("") }
    var pesoKg by remember { mutableStateOf("") }
    var observacao by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val today = remember {
        SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Registrar Pesagem", fontWeight = FontWeight.Bold) },
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
            // Success state
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
                Text(
                    "Registro salvo no dispositivo!",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    "Será sincronizado automaticamente.",
                    fontSize = 14.sp,
                    color = Color(0xFF6B7280)
                )
                Spacer(Modifier.height(24.dp))
                OutlinedButton(
                    onClick = {
                        saved = false
                        animalNumero = ""
                        pesoKg = ""
                        observacao = ""
                    },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Registrar Outro")
                }
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = onBack) {
                    Text("Voltar")
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Animal number
                OutlinedTextField(
                    value = animalNumero,
                    onValueChange = { animalNumero = it.filter { c -> c.isDigit() || c == '-' || c == 'A'.. 'Z' || c == 'a'..'z' } },
                    label = { Text("Número do Boi *") },
                    placeholder = { Text("Ex: 157") },
                    leadingIcon = { Icon(Icons.Default.Scale, null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )

                // Weight
                OutlinedTextField(
                    value = pesoKg,
                    onValueChange = { pesoKg = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Peso (kg) *") },
                    placeholder = { Text("Ex: 451.5") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                )

                // Observation (optional)
                OutlinedTextField(
                    value = observacao,
                    onValueChange = { observacao = it },
                    label = { Text("Observação (opcional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                // Date display
                Text(
                    "Data: $today",
                    fontSize = 13.sp,
                    color = Color(0xFF6B7280)
                )

                // Error
                error?.let { msg ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEE2E2)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            msg,
                            modifier = Modifier.padding(12.dp),
                            color = Color(0xFF991B1B),
                            fontSize = 13.sp
                        )
                    }
                }

                Spacer(Modifier.weight(1f))

                // Save button
                Button(
                    onClick = {
                        error = null

                        // Validation
                        val numero = animalNumero.trim()
                        val peso = pesoKg.toDoubleOrNull()

                        when {
                            numero.isEmpty() -> error = "Informe o número do boi."
                            peso == null -> error = "Informe um peso válido."
                            peso <= 0 -> error = "O peso deve ser maior que zero."
                            peso > 2000 -> error = "Peso excessivamente alto. Verifique o valor."
                            else -> {
                                scope.launch {
                                    val uuid = UUID.randomUUID().toString()
                                    val record = WeightRecordEntity(
                                        clientGeneratedId = uuid,
                                        animalNumero = numero,
                                        pesoKg = peso,
                                        dataPesagem = today,
                                        observacao = observacao.ifBlank { null },
                                        sincronizado = false
                                    )
                                    database.weightRecordDao().insert(record)
                                    saved = true
                                }
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    )
                ) {
                    Text(
                        "Salvar Pesagem",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}
