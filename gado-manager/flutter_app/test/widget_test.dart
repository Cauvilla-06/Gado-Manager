import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:gado_manager/main.dart';
import 'package:gado_manager/screens/login_screen.dart';

void main() {
  testWidgets('App renders LoginScreen when not logged in', (tester) async {
    // No saved token -> _AuthGate must land on the LoginScreen.
    // (AuthService discovers the server in the background; without a saved
    // URL and with no reachable host it resolves to null and shows the
    // manual-entry hint.)
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const GadoManagerApp());

    // AuthGate: async check in progress -> spinner first.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Let the futures complete.
    await tester.pumpAndSettle(const Duration(seconds: 3));

    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('GadoManager'), findsOneWidget);
    expect(find.text('Entrar'), findsOneWidget);
  });
}
