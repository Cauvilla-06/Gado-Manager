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
  /// Prioridade:
  /// 1. Tenta a URL salva (pode ser um tunnel ativo)
  /// 2. Busca o servidor na rede local e obtém a URL do tunnel mais recente
  ///
  /// Quando encontra o servidor local, busca automaticamente a URL
  /// atualizada do Cloudflare Tunnel e salva para uso futuro.
  Future<String?> discoverServerUrl() async {
    // Endereços comuns de rede local para tentar
    final localCandidates = [
      'http://10.0.2.2:3000',      // Android emulator
      'http://localhost:3000',      // Same machine
      'http://127.0.0.1:3000',     // Same machine
      'http://192.168.1.175:3000',  // PC local network IP
      'http://192.168.0.1:3000',   // Common gateway
      'http://192.168.1.1:3000',   // Common gateway
      'http://10.0.0.1:3000',      // Common gateway
    ];

    // 1. Tenta a URL salva primeiro (pode ser tunnel ativo)
    final savedUrl = await serverUrl;
    if (savedUrl != null && savedUrl.isNotEmpty) {
      try {
        final response = await http
            .get(Uri.parse('$savedUrl/api/config/server-url'))
            .timeout(const Duration(seconds: 3));
        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          final tunnelUrl = body['url'] as String?;
          if (tunnelUrl != null && tunnelUrl.isNotEmpty) {
            // Atualiza URL salva se o tunnel mudou
            await setServerUrl(tunnelUrl);
            return tunnelUrl;
          }
          return savedUrl;
        }
      } catch (_) {
        // URL salva não está mais acessível, tenta rede local
      }
    }

    // 2. Tenta rede local para pegar a URL mais recente do tunnel
    for (final candidate in localCandidates) {
      try {
        final response = await http
            .get(Uri.parse('$candidate/api/config/server-url'))
            .timeout(const Duration(seconds: 2));
        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          final tunnelUrl = body['url'] as String?;
          if (tunnelUrl != null && tunnelUrl.isNotEmpty) {
            // Sempre atualiza com a URL mais recente do tunnel
            await setServerUrl(tunnelUrl);
            return tunnelUrl;
          }
          // Servidor local acessível mas sem tunnel configurado
          return candidate;
        }
      } catch (_) {
        // Não acessível, tenta próximo
      }
    }

    return null;
  }

  /// Force re-discover the server URL.
  /// Use this when the user knows the server was restarted.
  Future<String?> rediscoverServer() async {
    return discoverServerUrl();
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
  /// Tenta na URL informada. Se falhar (tunnel morto, etc),
  /// tenta automaticamente os endereços locais.
  Future<String> login(String url, String email, String password) async {
    var base = _normalizeUrl(url);

    // Tenta login na URL informada
    try {
      final result = await _tryLogin(base, email, password);
      if (result != null) return result;
    } catch (_) {
      // URL informada falhou, tenta endereços locais
    }

    // Se falhou, tenta endereços locais automaticamente
    final localCandidates = [
      'http://10.0.2.2:3000',      // Android emulator
      'http://localhost:3000',      // Same machine
      'http://127.0.0.1:3000',     // Same machine
      'http://192.168.1.175:3000',  // PC local network IP
      'http://192.168.0.1:3000',   // Common gateway
      'http://192.168.1.1:3000',   // Common gateway
    ];

    for (final candidate in localCandidates) {
      if (candidate == base) continue; // já tentou
      try {
        final result = await _tryLogin(candidate, email, password);
        if (result != null) {
          // Busca URL do tunnel via este servidor local
          try {
            final tunnelResp = await http
                .get(Uri.parse('$candidate/api/config/server-url'))
                .timeout(const Duration(seconds: 3));
            if (tunnelResp.statusCode == 200) {
              final tunnelBody = jsonDecode(tunnelResp.body) as Map<String, dynamic>;
              final tunnelUrl = tunnelBody['url'] as String?;
              if (tunnelUrl != null && tunnelUrl.isNotEmpty) {
                await setServerUrl(tunnelUrl);
                return tunnelUrl;
              }
            }
          } catch (_) {}
          await setServerUrl(candidate);
          return candidate;
        }
      } catch (_) {
        // Próximo candidato
      }
    }

    throw Exception('Não foi possível conectar ao servidor. '
        'Verifique se o servidor está rodando e tente novamente.');
  }

  /// Normaliza URL (adiciona protocolo, remove barra final)
  String _normalizeUrl(String url) {
    var base = url.trim();
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = 'http://$base';
    }
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }
    return base;
  }

  /// Tenta fazer login em uma URL específica. Retorna null se falhar.
  Future<String?> _tryLogin(String base, String email, String password) async {
    final response = await http
        .post(
          Uri.parse('$base/api/auth/login'),
          headers: {
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'email': email.trim(), 'password': password}),
        )
        .timeout(const Duration(seconds: 10));

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
  bool _rediscovered = false;

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

  /// Executa uma requisição HTTP com auto-retry.
  /// Se a requisição falhar, tenta rediscoverServer() uma vez e repete.
  Future<http.Response> _requestWithRetry(
    Future<http.Response> Function(String baseUrl, Map<String, String> headers) request,
  ) async {
    final baseUrl = await _baseUrl();
    final headers = await _headers();

    try {
      final response = await request(baseUrl, headers).timeout(_timeout);
      return response;
    } catch (_) {
      // Primeira tentativa falhou — tenta rediscover
      if (_rediscovered) rethrow;

      final newUrl = await auth.discoverServerUrl();
      if (newUrl != null && newUrl != baseUrl) {
        _rediscovered = true;
        final newHeaders = await _headers();
        try {
          final response = await request(newUrl, newHeaders).timeout(_timeout);
          return response;
        } catch (_) {
          rethrow;
        }
      }
      rethrow;
    }
  }

  /// Reseta o flag de rediscovery. Chamar após operações de longa duração.
  void resetRediscovery() {
    _rediscovered = false;
  }

  // --- Farm management ---

  /// Fetch all farms the current user belongs to.
  Future<List<Farm>> fetchFarms() async {
    final response = await _requestWithRetry(
      (baseUrl, headers) => http.get(
        Uri.parse('$baseUrl/api/farms'),
        headers: headers,
      ),
    );

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
    final response = await _requestWithRetry(
      (baseUrl, headers) => http.get(
        Uri.parse('$baseUrl/api/animals/summary'),
        headers: headers,
      ),
    );

    if (response.statusCode != 200) {
      throw Exception('Erro ao buscar animais (${response.statusCode})');
    }

    final list = (jsonDecode(response.body) as List).cast<Map<String, dynamic>>();
    return list.map(Animal.fromJson).toList();
  }

  /// Envia todos os registros pendentes ao servidor.
  ///
  /// Processa registros agrupados por batchId:
  /// - Se um batch tem um cadastro de animal + registros, cria o animal
  ///   primeiro e depois sincroniza os registros vinculados.
  /// - Registros sem batchId são sincronizados individualmente.
  ///
  /// Retorna os ids que foram processados com sucesso,
  /// para serem removidos do armazenamento local.
  Future<Set<String>> syncPending(List<PendingRecord> pending) async {
    if (pending.isEmpty) return {};

    final syncedIds = <String>{};

    // Agrupa por batchId
    final batches = <String, List<PendingRecord>>{};
    for (final r in pending) {
      final batchKey = r.batchId ?? r.id;
      batches.putIfAbsent(batchKey, () => []).add(r);
    }

    for (final entry in batches.entries) {
      final batchRecords = entry.value;
      final cadastro = batchRecords
          .where((r) => r.tipo == RecordType.cadastro)
          .toList();
      final outros = batchRecords
          .where((r) => r.tipo != RecordType.cadastro)
          .toList();

      // Se tem cadastro de animal no batch, cria primeiro
      if (cadastro.isNotEmpty) {
        bool animalCreated = false;
        for (final r in cadastro) {
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
              animalCreated = true;
            }
          } catch (_) {
            // Sem conexão ou erro — mantém pendente
          }
        }

        // Se o animal foi criado, sincroniza os registros vinculados
        if (animalCreated && outros.isNotEmpty) {
          await _syncRecordsBatch(outros, syncedIds);
        } else if (!animalCreated && outros.isNotEmpty) {
          // Animal não foi criado, mas podemos tentar sincronizar
          // os registros (o servidor pode aceitar por animalNumero)
          await _syncRecordsBatch(outros, syncedIds);
        }
      } else {
        // Sem cadastro — sincroniza registros diretamente
        await _syncRecordsBatch(outros, syncedIds);
      }
    }

    return syncedIds;
  }

  /// Sincroniza um lote de registros (pesagens, vacinas, etc.)
  Future<void> _syncRecordsBatch(
    List<PendingRecord> records,
    Set<String> syncedIds,
  ) async {
    if (records.isEmpty) return;

    final pesagens = <Map<String, dynamic>>[];
    final vacinas = <Map<String, dynamic>>[];
    final vermifugos = <Map<String, dynamic>>[];
    final vitaminas = <Map<String, dynamic>>[];

    for (final r in records) {
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
          // Não processado aqui
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
        for (final r in records) {
          syncedIds.add(r.id);
        }

        // Se o servidor reportar erros por número de animal,
        // mantém os registros correspondentes para nova tentativa.
        final erros = (body['erros'] as List?)?.cast<String>() ?? const [];
        for (final erro in erros) {
          final match = RegExp(r'Animal nº (.+?) ').firstMatch(erro);
          if (match != null) {
            final numero = match.group(1)!;
            for (final r in records.where(
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

  /// Busca os detalhes de um animal (ciclos, registros, etc.) com retry.
  Future<AnimalDetail?> fetchAnimalDetail(String animalId, {int maxRetries = 2}) async {
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        final response = await _requestWithRetry(
          (baseUrl, headers) => http.get(
            Uri.parse('$baseUrl/api/animals/$animalId'),
            headers: headers,
          ),
        );

        if (response.statusCode == 200) {
          final body = jsonDecode(response.body) as Map<String, dynamic>;
          return AnimalDetail.fromJson(body);
        }
      } catch (_) {
        if (attempt == maxRetries) return null;
      }
      // Espera um pouco antes de retryar (backoff)
      if (attempt < maxRetries) {
        await Future.delayed(Duration(seconds: attempt + 1));
        resetRediscovery();
      }
    }
    return null;
  }

  /// Busca os detalhes de TODOS os animais e retorna como mapa.
  /// Salva cada animal individualmente à medida que obtém sucesso.
  /// Faz 2 retries para animais que falharam.
  Future<Map<String, AnimalDetail>> fetchAllAnimalDetails(List<Animal> animals) async {
    final results = <String, AnimalDetail>{};
    final failed = <Animal>[];

    // 1ª passada: busca tudo sequencialmente para não sobrecarregar o servidor
    for (final a in animals) {
      final detail = await fetchAnimalDetail(a.id, maxRetries: 1);
      if (detail != null) {
        results[a.id] = detail;
      } else {
        failed.add(a);
      }
    }

    // Retry: tenta novamente os que falharam (até 2x)
    for (var retry = 0; retry < 2 && failed.isNotEmpty; retry++) {
      resetRediscovery();
      await Future.delayed(const Duration(seconds: 2));
      final stillFailed = <Animal>[];
      for (final a in failed) {
        final detail = await fetchAnimalDetail(a.id, maxRetries: 1);
        if (detail != null) {
          results[a.id] = detail;
        } else {
          stillFailed.add(a);
        }
      }
      failed.clear();
      failed.addAll(stillFailed);
    }

    return results;
  }

  static String newClientId() => const Uuid().v4();
}
