package com.gadomanager.ui.screens

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.work.*
import com.gadomanager.data.local.database.AppDatabase
import com.gadomanager.sync.SyncManager
import com.gadomanager.sync.SyncWorker
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onRegisterWeight: () -> Unit,
    onRegisterVaccine: () -> Unit,
    onShowPending: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val database = remember { AppDatabase.getInstance(context) }

    val pendingWeightCount by database.weightRecordDao().pendingCount().collectAsState(initial = 0)
    val pendingVaccineCount by database.vaccinationDao().pendingCount().collectAsState(initial = 0)
    val totalPending = pendingWeightCount + pendingVaccineCount

    var isOnline by remember { mutableStateOf(checkNetwork(context)) }
    var syncMessage by remember { mutableStateOf<String?>(null) }

    // Schedule periodic sync
    LaunchedEffect(Unit) {
        schedulePeriodicSync(context)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "GadoManager",
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = Color.White
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Status indicator
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (isOnline) Color(0xFFDCFCE7) else Color(0xFFFEE2E2)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = if (isOnline) Icons.Default.CheckCircle else Icons.Default.WifiOff,
                        contentDescription = null,
                        tint = if (isOnline) Color(0xFF16A34A) else Color(0xFFDC2626),
                        modifier = Modifier.size(28.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (isOnline) "ONLINE" else "OFFLINE",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = if (isOnline) Color(0xFF166534) else Color(0xFF991B1B)
                        )
                        if (totalPending > 0) {
                            Text(
                                text = "$totalPending registro(s) aguardando sincronização",
                                fontSize = 13.sp,
                                color = if (isOnline) Color(0xFF15803D) else Color(0xFFB91C1C)
                            )
                        }
                    }
                }
            }

            // Sync button
            if (totalPending > 0 && isOnline) {
                Button(
                    onClick = {
                        scope.launch {
                            val syncManager = SyncManager(database)
                            val result = syncManager.syncAll()
                            syncMessage = when {
                                result.erros.isNotEmpty() -> "Erro: ${result.erros.first()}"
                                else -> "Sincronizado! ${result.pesagensProcessadas} pesagens, ${result.vacinasProcessadas} vacinas"
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.primary
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Sync, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Sincronizar ($totalPending pendente(s))")
                }
            }

            // Sync message
            syncMessage?.let { msg ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (msg.startsWith("Erro")) Color(0xFFFEE2E2) else Color(0xFFDCFCE7)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = if (msg.startsWith("Erro")) Icons.Default.Error else Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = if (msg.startsWith("Erro")) Color(0xFFDC2626) else Color(0xFF16A34A)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(msg, fontSize = 13.sp)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            // Action buttons - fast registration
            Text(
                "Ações Rápidas",
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            ActionCard(
                title = "Registrar Pesagem",
                subtitle = "Boi #____ → ____ kg",
                icon = Icons.Default.Scale,
                onClick = onRegisterWeight
            )

            ActionCard(
                title = "Registrar Vacina",
                subtitle = "Boi #____ → Vacina",
                icon = Icons.Default.Vaccines,
                onClick = onRegisterVaccine
            )

            ActionCard(
                title = "Registros Pendentes",
                subtitle = if (totalPending > 0) "$totalPending registro(s)" else "Nenhum pendente",
                icon = Icons.Default.Queue,
                onClick = onShowPending
            )
        }
    }
}

@Composable
fun ActionCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(32.dp)
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Medium, fontSize = 16.sp)
                Text(subtitle, fontSize = 13.sp, color = Color(0xFF6B7280))
            }
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = Color(0xFF9CA3AF)
            )
        }
    }
}

private fun checkNetwork(context: Context): Boolean {
    val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = connectivityManager.activeNetwork ?: return false
    val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
}

private fun schedulePeriodicSync(context: Context) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    val syncWork = PeriodicWorkRequestBuilder<SyncWorker>(
        15, TimeUnit.MINUTES
    )
        .setConstraints(constraints)
        .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        SyncWorker.WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        syncWork
    )
}
