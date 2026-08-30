import 'dart:async';
import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import '../models.dart';

/// Resultado da sincronização com o servidor.
class SyncResultSummary {
  final int enviados;
  final int duplicados;
  final List<String> erros;

  SyncResultSummary({
    required this.enviados,
    required this.duplicados,
    required this.erros,
  });

  bool get sucesso => erros.isEmpty;
}

class AuthService {
  static const _kServerUrl = 'server_url';
  static const _kSelectedFarmId = 'selected_farm_id';
  static const _kSelectedFarmName = 'selected_farm_name';
  static const _kToken = 'auth_token';
  static const _kUserName = 'user_name';

  Future<String?> get serverUrl async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kServerUrl);
  }

  /// Save the server URL to SharedPreferences.
  Future<void> setServerUrl(String url) async {
    var base = url.trim();
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = 'http://$base';
    }
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kServerUrl, base);
  }

  /// Try to discover the server URL from known local addresses.
  /// Returns the first reachable server URL, or null.
  ///
  /// When a tunnel URL is found via the local server's
  /// /api/config/server-url endpoint, it is saved automatically
  /// so the Flutter app stays in sync with the Cloudflare tunnel.
  Future<String?> discoverServerUrl() async {
    // First: check if we already have a saved URL from a previous session
    final savedUrl = await serverUrl;
    if (savedUrl != null && savedUrl.isNotEmpty) {
      // Verify it's still reachable
      try {
        final response = await http
            .get(Uri.parse('$savedUrl/api/config/server-url'))
            .timeout(const Duration(seconds: 3));
        if (response.statusCode == 200) {
          return savedUrl;
        }
      } catch (_) {
        // Saved URL not reachable anymore, continue discovery
      }
    }

    // Common local addresses to try
    final candidates = [
      'http://10.0.2.2:3000',    // Android emulator
      'http://localhost:3000',    // Same machine
      'http://127.0.0.1:3000',   // Same machine
      'http://192.168.1.175:3000', // PC local network IP
      'http://192.168.0.1:3000',  // Common gateway
      'http://192.168.1.1:3000',  // Common gateway
      'http://10.0.0.1:3000',     // Common gateway
    ];

    // Try each candidate in parallel with a short timeout
    for (final candidate in candidates) {
      try {
        final response = await http
            .get(Uri.parse('$candidate/api/config/server-url'))
            .timeout(const Duration(seconds: 2));
        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          final tunnelUrl = body['url'] as String?;
          if (tunnelUrl != null && tunnelUrl.isNotEmpty) {
            // Auto-save the discovered tunnel URL
            await setServerUrl(tunnelUrl);
            return tunnelUrl;
          }
          // No tunnel URL saved, but local server is reachable
          return candidate;
        }
      } catch (_) {
        // Not reachable, try next
      }
    }
    return null;
  }

  /// Try to reach a specific server URL directly.
  Future<bool> pingServer(String url) async {
    try {
      var base = url.trim();
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        base = 'http://$base';
      }
      while (base.endsWith('/')) {
        base = base.substring(0, base.length - 1);
      }
      final response = await http
          .get(Uri.parse('$base/api/config/server-url'))
          .timeout(const Duration(seconds: 5));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<String?> get token async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kToken);
  }

  Future<bool> get isLoggedIn async => (await token) != null;

  /// Faz login no servidor e guarda o token JWT.
  ///
  /// [url] pode vir sem protocolo; normalizamos para http:// nesse caso.
  Future<String> login(String url, String email, String password) async {
    var base = url.trim();
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = 'http://$base';
    }
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }

    final response = await http
        .post(
          Uri.parse('$base/api/auth/login'),
          headers: {
            'Content-Type': 'application/json',
            // Necessario para tuneis (localtunnel/ngrok) nao interceptarem a requisicao
            'bypass-tunnel-reminder': 'true',
            'ngrok-skip-browser-warning': 'true',
          },
          body: jsonEncode({'email': email.trim(), 'password': password}),
        )
        .timeout(const Duration(seconds: 15));

    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200 || body['token'] == null) {
      throw Exception(body['error'] ?? 'Falha no login');
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kServerUrl, base);
    await prefs.setString(_kToken, body['token'] as String);
    final user = body['user'] as Map<String, dynamic>?;
    await prefs.setString(_kUserName, user?['name'] as String? ?? '');

    return base;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kToken);
    await prefs.remove(_kUserName);
    await prefs.remove(_kSelectedFarmId);
    await prefs.remove(_kSelectedFarmName);
  }

  Future<String?> get userName async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kUserName);
  }

  // --- Farm selection ---

  Future<String?> get selectedFarmId async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kSelectedFarmId);
  }

  Future<String?> get selectedFarmName async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kSelectedFarmName);
  }

  Future<void> setSelectedFarm(String farmId, String farmName) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kSelectedFarmId, farmId);
    await prefs.setString(_kSelectedFarmName, farmName);
  }
}

class ApiService {
  static const _timeout = Duration(seconds: 20);

  final AuthService auth;

  ApiService(this.auth);

  Future<Map<String, String>> _headers() async {
    final token = await auth.token;
    final farmId = await auth.selectedFarmId;
    return {
      'Content-Type': 'application/json',
      // Necessario para tuneis (localtunnel/ngrok) nao interceptarem a requisicao
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true',
      if (token != null) 'Authorization': 'Bearer $token',
      // Envia o cookie selected-farm-id em cada request para que
      // o servidor saiba qual fazenda esta ativa (o servidor usa esse
      // cookie no middleware para resolver getCurrentFarm()).
      if (farmId != null) 'Cookie': 'selected-farm-id=$farmId',
    };
  }

  Future<String> _baseUrl() async {
    final url = await auth.serverUrl;
    if (url == null || url.isEmpty) {
      throw Exception('Servidor não configurado');
    }
    return url;
  }

  Future<bool> isOnline() async {
    final results = await Connectivity().checkConnectivity();
    return results.any(
      (r) =>
          r == ConnectivityResult.wifi ||
          r == ConnectivityResult.ethernet ||
          r == ConnectivityResult.mobile ||
          r == ConnectivityResult.vpn,
    );
  }

  // --- Farm management ---

  /// Fetch all farms the current user belongs to.
  Future<List<Farm>> fetchFarms() async {
    final response = await http
        .get(
          Uri.parse('${await _baseUrl()}/api/farms'),
          headers: await _headers(),
        )
        .timeout(_timeout);

    if (response.statusCode != 200) {
      throw Exception('Erro ao buscar fazendas (${response.statusCode})');
    }

    final list = (jsonDecode(response.body) as List).cast<Map<String, dynamic>>();
    return list.map(Farm.fromJson).toList();
  }

  /// Switch the active farm on the server (sets cookie).
  Future<void> switchFarm(String farmId) async {
    final response = await http
        .post(
          Uri.parse('${await _baseUrl()}/api/farms/switch'),
          headers: await _headers(),
          body: jsonEncode({'farmId': farmId}),
        )
        .timeout(_timeout);

    if (response.statusCode != 200) {
      throw Exception('Erro ao trocar fazenda (${response.statusCode})');
    }
  }

  /// Create a new farm.
  Future<Map<String, dynamic>> createFarm(String name) async {
    final response = await http
        .post(
          Uri.parse('${await _baseUrl()}/api/farms'),
          headers: await _headers(),
          body: jsonEncode({'name': name}),
        )
        .timeout(_timeout);

    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Erro ao criar fazenda (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Join an existing farm by code.
  Future<Map<String, dynamic>> joinFarm(String farmCode) async {
    final response = await http
        .post(
          Uri.parse('${await _baseUrl()}/api/farms/join'),
          headers: await _headers(),
          body: jsonEncode({'farmCode': farmCode}),
        )
        .timeout(_timeout);

    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Erro ao entrar na fazenda (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Create a new animal in the current farm.
  Future<Map<String, dynamic>> createAnimal(String numeroIdentificacao) async {
    final response = await http
        .post(
          Uri.parse('${await _baseUrl()}/api/animals'),
          headers: await _headers(),
          body: jsonEncode({'numeroIdentificacao': numeroIdentificacao}),
        )
        .timeout(_timeout);

    if (response.statusCode != 200 && response.statusCode != 201) {
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      throw Exception(body['error'] ?? 'Erro ao criar animal (${response.statusCode})');
    }

    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  /// Busca os animais do servidor (endpoint leve) e retorna a lista.
  Future<List<Animal>> fetchAnimals() async {
    final response = await http
        .get(
          Uri.parse('${await _baseUrl()}/api/animals/summary'),
          headers: await _headers(),
        )
        .timeout(_timeout);

    if (response.statusCode != 200) {
      throw Exception('Erro ao buscar animais (${response.statusCode})');
    }

    final list = (jsonDecode(response.body) as List).cast<Map<String, dynamic>>();
    return list.map(Animal.fromJson).toList();
  }

  /// Envia todos os registros pendentes ao servidor.
  ///
  /// - Cadastros de animal → POST /api/animals (individual)
  /// - Pesagens/vacinas/etc → POST /api/sync (lote)
  ///
  /// Retorna os ids que foram processados com sucesso,
  /// para serem removidos do armazenamento local.
  Future<Set<String>> syncPending(List<PendingRecord> pending) async {
    if (pending.isEmpty) return {};

    final syncedIds = <String>{};

    // Separa cadastros de animais dos demais registros
    final cadastros = pending.where((r) => r.tipo == RecordType.cadastro).toList();
    final outros = pending.where((r) => r.tipo != RecordType.cadastro).toList();

    // 1. Sincroniza cadastros de animais (individualmente via POST /api/animals)
    for (final r in cadastros) {
      try {
        final response = await http
            .post(
              Uri.parse('${await _baseUrl()}/api/animals'),
              headers: await _headers(),
              body: jsonEncode({
                'numeroIdentificacao': r.payload['numeroIdentificacao'],
              }),
            )
            .timeout(_timeout);

        if (response.statusCode == 200 || response.statusCode == 201) {
          syncedIds.add(r.id);
        }
        // Se der erro (ex: número duplicado), mantém pendente para nova tentativa
      } catch (_) {
        // Sem conexão ou erro — mantém pendente
      }
    }

    // 2. Sincroniza registros de pesagem/vacina/etc (lote via POST /api/sync)
    if (outros.isNotEmpty) {
      final pesagens = <Map<String, dynamic>>[];
      final vacinas = <Map<String, dynamic>>[];
      final vermifugos = <Map<String, dynamic>>[];
      final vitaminas = <Map<String, dynamic>>[];

      for (final r in outros) {
        switch (r.tipo) {
          case RecordType.pesagem:
            pesagens.add(r.payload);
            break;
          case RecordType.vacina:
            vacinas.add(r.payload);
            break;
          case RecordType.vermifugo:
            vermifugos.add(r.payload);
            break;
          case RecordType.vitamina:
            vitaminas.add(r.payload);
            break;
          case RecordType.cadastro:
            // Já processado acima
            break;
        }
      }

      try {
        final response = await http
            .post(
              Uri.parse('${await _baseUrl()}/api/sync'),
              headers: await _headers(),
              body: jsonEncode({
                'pesagens': pesagens,
                'vacinas': vacinas,
                'vermifugos': vermifugos,
                'vitaminas': vitaminas,
              }),
            )
            .timeout(_timeout);

        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;

          // Marca todos como sincronizados por padrão
          for (final r in outros) {
            syncedIds.add(r.id);
          }

          // Se o servidor reportar erros por número de animal,
          // mantém os registros correspondentes para nova tentativa.
          final erros = (body['erros'] as List?)?.cast<String>() ?? const [];
          for (final erro in erros) {
            final match = RegExp(r'Animal nº (.+?) ').firstMatch(erro);
            if (match != null) {
              final numero = match.group(1)!;
              for (final r in outros.where(
                  (p) => p.payload['animalNumero'] == numero)) {
                syncedIds.remove(r.id);
              }
            }
          }
        }
      } catch (_) {
        // Sem conexão ou erro — mantém tudo pendente
      }
    }

    return syncedIds;
  }

  static String newClientId() => const Uuid().v4();
}
