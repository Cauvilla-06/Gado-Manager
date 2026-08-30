package com.gadomanager.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.gadomanager.ui.screens.HomeScreen
import com.gadomanager.ui.screens.RegisterWeightScreen
import com.gadomanager.ui.screens.RegisterVaccineScreen
import com.gadomanager.ui.screens.PendingRecordsScreen

object Routes {
    const val HOME = "home"
    const val REGISTER_WEIGHT = "register_weight"
    const val REGISTER_VACCINE = "register_vaccine"
    const val PENDING_RECORDS = "pending_records"
}

@Composable
fun GadoNavHost() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            HomeScreen(
                onRegisterWeight = { navController.navigate(Routes.REGISTER_WEIGHT) },
                onRegisterVaccine = { navController.navigate(Routes.REGISTER_VACCINE) },
                onShowPending = { navController.navigate(Routes.PENDING_RECORDS) }
            )
        }

        composable(Routes.REGISTER_WEIGHT) {
            RegisterWeightScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.REGISTER_VACCINE) {
            RegisterVaccineScreen(
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.PENDING_RECORDS) {
            PendingRecordsScreen(
                onBack = { navController.popBackStack() }
            )
        }
    }
}
