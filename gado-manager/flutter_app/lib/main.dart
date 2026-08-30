import 'package:flutter/material.dart';

import 'screens/farm_selection_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/api_service.dart';

void main() {
  runApp(const GadoManagerApp());
}

class GadoManagerApp extends StatelessWidget {
  const GadoManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GadoManager',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF16A34A),
        appBarTheme: const AppBarTheme(centerTitle: false),
      ),
      home: const _AuthGate(),
    );
  }
}

/// Decide a tela inicial com base no token salvo.
class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  bool? _loggedIn;
  bool _checkingFarm = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final loggedIn = await AuthService().isLoggedIn;
    if (!mounted) return;

    if (!loggedIn) {
      setState(() => _loggedIn = false);
      return;
    }

    // Check if user has a saved farm selection
    final auth = AuthService();
    final savedFarmId = await auth.selectedFarmId;

    if (savedFarmId != null) {
      // Has a saved farm — go to home
      setState(() => _loggedIn = true);
    } else {
      // No saved farm — check farms and show selection if needed
      setState(() {
        _loggedIn = true;
        _checkingFarm = true;
      });

      try {
        final api = ApiService(auth);
        final farms = await api.fetchFarms();
        if (!mounted) return;

        if (farms.length > 1) {
          // Multiple farms — show selection
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const FarmSelectionScreen()),
          );
          return;
        } else if (farms.length == 1) {
          // One farm — auto-select
          await auth.setSelectedFarm(farms.first.id, farms.first.name);
          await api.switchFarm(farms.first.id);
        }
        // else: no farms, proceed to home
      } catch (_) {
        // If check fails, proceed to home
      }

      if (mounted) setState(() => _checkingFarm = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loggedIn == null || _checkingFarm) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_loggedIn == false) {
      return const LoginScreen();
    }

    return const HomeScreen();
  }
}
