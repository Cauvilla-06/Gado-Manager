package com.gadomanager.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
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
import com.gadomanager.data.local.entity.WeightRecordEntity
import com.gadomanager.sync.SyncManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PendingRecordsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val database = remember { AppDatabase.getInstance(context) }

    var pendingWeights by remember { mutableStateOf<List<WeightRecordEntity>>(emptyList()) }
    var pendingVaccines by remember { mutableStateOf<List<VaccinationEntity>>(emptyList()) }
    var syncMessage by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        pendingWeights = database.weightRecordDao().getPendingSync()
        pendingVaccines = database.vaccinationDao().getPendingSync()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Registros Pendentes", fontWeight = FontWeight.Bold) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Sync all button
            if (pendingWeights.isNotEmpty() || pendingVaccines.isNotEmpty()) {
                Button(
                    onClick = {
                        scope.launch {
                            val syncManager = SyncManager(database)
                            val result = syncManager.syncAll()
                            syncMessage = when {
                                result.erros.isNotEmpty() -> "Erro: ${result.erros.first()}"
                                else -> "Sincronizado! ${result.pesagensProcessadas} pesagens, ${result.vacinasProcessadas} vacinas"
                            }
                            pendingWeights = database.weightRecordDao().getPendingSync()
                            pendingVaccines = database.vaccinationDao().getPendingSync()
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Sync, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Sincronizar Tudo")
                }
            }

            syncMessage?.let { msg ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (msg.startsWith("Erro")) Color(0xFFFEE2E2) else Color(0xFFDCFCE7)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        msg,
                        modifier = Modifier.padding(12.dp),
                        fontSize = 13.sp
                    )
                }
            }

            if (pendingWeights.isEmpty() && pendingVaccines.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = Color(0xFF16A34A),
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(Modifier.height(16.dp))
                    Text("Tudo sincronizado!", fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                    Text("Nenhum registro pendente.", color = Color(0xFF6B7280))
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (pendingWeights.isNotEmpty()) {
                        item {
                            Text(
                                "Pesagens (${pendingWeights.size})",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        items(pendingWeights) { weight ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.Scale,
                                        contentDescription = null,
                                        tint = Color(0xFF16A34A),
                                        modifier = Modifier.size(24.dp)
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("Boi #${weight.animalNumero}", fontWeight = FontWeight.Medium)
                                        Text(
                                            "${weight.pesoKg} kg • ${weight.dataPesagem}",
                                            fontSize = 13.sp,
                                            color = Color(0xFF6B7280)
                                        )
                                    }
                                    Icon(
                                        Icons.Default.CloudUpload,
                                        contentDescription = "Pendente",
                                        tint = Color(0xFFF59E0B)
                                    )
                                }
                            }
                        }
                    }

                    if (pendingVaccines.isNotEmpty()) {
                        item {
                            Text(
                                "Vacinas (${pendingVaccines.size})",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        items(pendingVaccines) { vaccine ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.Vaccines,
                                        contentDescription = null,
                                        tint = Color(0xFF8B5CF6),
                                        modifier = Modifier.size(24.dp)
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${vaccine.nomeVacina}", fontWeight = FontWeight.Medium)
                                        Text(
                                            "Boi #${vaccine.animalNumero} • ${vaccine.dataAplicacao}",
                                            fontSize = 13.sp,
                                            color = Color(0xFF6B7280)
                                        )
                                    }
                                    Icon(
                                        Icons.Default.CloudUpload,
                                        contentDescription = "Pendente",
                                        tint = Color(0xFFF59E0B)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
