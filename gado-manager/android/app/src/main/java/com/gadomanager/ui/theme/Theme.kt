package com.gadomanager.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Green500 = Color(0xFF16A34A)
private val Green600 = Color(0xFF15803D)
private val Green700 = Color(0xFF166534)
private val Green50 = Color(0xFFF0FDF4)
private val Green100 = Color(0xFFDCFCE7)

private val LightColorScheme = lightColorScheme(
    primary = Green600,
    onPrimary = Color.White,
    primaryContainer = Green100,
    onPrimaryContainer = Green700,
    secondary = Color(0xFF6B7280),
    onSecondary = Color.White,
    background = Color(0xFFFAFAFA),
    onBackground = Color(0xFF1F2937),
    surface = Color.White,
    onSurface = Color(0xFF1F2937),
    error = Color(0xFFDC2626),
    onError = Color.White,
)

@Composable
fun GadoManagerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
