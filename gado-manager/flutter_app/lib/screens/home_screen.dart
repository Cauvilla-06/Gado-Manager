import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';
import 'add_animal_screen.dart';
import 'add_record_screen.dart';
import 'animal_detail_screen.dart';
import 'edit_animal_screen.dart';
import 'edit_record_screen.dart';
import 'farm_selection_screen.dart';
import 'login_screen.dart';
import 'offline_report_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _db = DatabaseHelper.instance;
  final _auth = AuthService();
  late final ApiService _api = ApiService(_auth);

  List<Animal> _animals = [];
  List<PendingRecord> _pending = [];
  bool _online = false;
  bool _loading = true;
  bool _syncing = false;
  bool _pendingExpanded = false;
  String? _userName;
  String? _farmName;
  Timer? _autoReconnectTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    _startAutoReconnect();
  }

  @override
  void dispose() {
    _autoReconnectTimer?.cancel();
    super.dispose();
  }

  /// Verifica periodicamente se o servidor está acessível e sincroniza dados.
  /// A cada 30 segundos tenta descobrir o servidor automaticamente.
  void _startAutoReconnect() {
    _autoReconnectTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _autoReconnect(),
    );
  }

  Future<void> _autoReconnect() async {
    if (_syncing) return;
    try {
      final isOn = await _api.isOnline();
      if (!isOn) {
        if (mounted) setState(() => _online = false);
        return;
      }
      // Tenta buscar dados do servidor sem mostrar loading
      final animals = await _api.fetchAnimals();
      animals.sort((a, b) => a.numero.compareTo(b.numero));
      await _db.replaceAnimals(animals);
      if (!mounted) return;
      setState(() {
        _animals = animals;
        _online = true;
      });
      _api.resetRediscovery();

      // Cache automático de todos os detalhes dos animais
      _cacheAllAnimalDetails(animals);

      // Sincroniza pendentes automaticamente
      final pending = await _db.getPendingRecords();
      if (pending.isNotEmpty && !_syncing) {
        await _sync();
      }
    } catch (_) {
      if (mounted) setState(() => _online = false);
    }
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);

    // 1. Carrega cache local instantaneamente
    final animals = await _db.getAnimals();
    animals.sort((a, b) => a.numero.compareTo(b.numero));
    final pending = await _db.getPendingRecords();
    final userName = await _auth.userName;
    final farmName = await _auth.selectedFarmName;

    if (!mounted) return;
    setState(() {
      _animals = animals;
      _pending = pending;
      _userName = userName;
      _farmName = farmName;
      _loading = false;
    });

    // 2. Se online, tenta atualizar do servidor e sincronizar pendentes
    if (await _api.isOnline()) {
      await _refreshFromServer();
      await _sync();
    } else {
      if (mounted) setState(() => _online = false);
    }
  }

  Future<void> _refreshFromServer() async {
    try {
      final animals = await _api.fetchAnimals();
      animals.sort((a, b) => a.numero.compareTo(b.numero));
      await _db.replaceAnimals(animals);
      if (!mounted) return;
      setState(() {
        _animals = animals;
        _online = true;
      });
      _api.resetRediscovery();

      // Cache automático de todos os detalhes dos animais para offline
      _cacheAllAnimalDetails(animals);
    } catch (_) {
      if (mounted) setState(() => _online = false);
    }
  }

  /// Busca detalhes de todos os animais e salva no cache local.
  /// Salva incrementalmente — cada animal é cacheado assim que obtém sucesso.
  /// Roda em background (sem bloquear a UI).
  void _cacheAllAnimalDetails(List<Animal> animals) async {
    final results = <String, AnimalDetail>{};
    final failed = <Animal>[];

    // 1ª passada: busca cada animal e salva imediatamente no cache
    for (final a in animals) {
      try {
        final detail = await _api.fetchAnimalDetail(a.id, maxRetries: 1);
        if (detail != null) {
          results[a.id] = detail;
          // Salva no cache imediatamente para não perder dados
          await _db.cacheAnimalDetail(a.id, detail);
        } else {
          failed.add(a);
        }
      } catch (_) {
        failed.add(a);
      }
    }

    // Retry: tenta novamente os que falharam (até 2x)
    _api.resetRediscovery();
    for (var retry = 0; retry < 2 && failed.isNotEmpty; retry++) {
      await Future.delayed(const Duration(seconds: 3));
      final stillFailed = <Animal>[];
      for (final a in failed) {
        try {
          final detail = await _api.fetchAnimalDetail(a.id, maxRetries: 1);
          if (detail != null) {
            results[a.id] = detail;
            await _db.cacheAnimalDetail(a.id, detail);
          } else {
            stillFailed.add(a);
          }
        } catch (_) {
          stillFailed.add(a);
        }
      }
      failed.clear();
      failed.addAll(stillFailed);
    }
  }

  Future<void> _sync() async {
    if (_pending.isEmpty || _syncing) return;
    setState(() => _syncing = true);

    try {
      final syncedIds = await _api.syncPending(_pending);
      await _db.deleteSyncedRecords(syncedIds);
      final remaining = await _db.getPendingRecords();
      if (!mounted) return;
      setState(() {
        _pending = remaining;
        _online = true;
      });
      if (mounted && syncedIds.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${syncedIds.length} registro(s) sincronizado(s)!'),
            backgroundColor: Colors.green,
          ),
        );
        // Atualiza animais após sincronização
        await _refreshFromServer();
      }
    } catch (_) {
      // Sem conexão ou erro — mantém tudo salvo localmente
      if (mounted) setState(() => _online = false);
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _logout() async {
    await _auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  Future<void> _reconnect() async {
    setState(() => _loading = true);
    try {
      // Reseta flag para permitir nova tentativa de rediscovery
      _api.resetRediscovery();
      final url = await _auth.rediscoverServer();
      if (url != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Servidor encontrado: $url'),
            backgroundColor: Colors.green,
          ),
        );
        await _refreshFromServer();
        await _sync();
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Servidor não encontrado. Verifique se está rodando.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Erro ao reconectar.'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _switchFarm() async {
    final result = await Navigator.of(context).push<Farm>(
      MaterialPageRoute(builder: (_) => const FarmSelectionScreen()),
    );
    if (result != null && mounted) {
      await _loadData();
    }
  }

  Future<void> _addAnimal() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddAnimalScreen()),
    );
    if (created == true) {
      // Recarrega pendentes
      final pending = await _db.getPendingRecords();
      if (!mounted) return;
      setState(() => _pending = pending);
      // Tenta sincronizar se online
      if (_online) await _sync();
    }
  }

  void _openAddRecord() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => AddRecordScreen(animals: _animals)),
    );
    // Recarrega pendentes ao voltar
    final pending = await _db.getPendingRecords();
    if (!mounted) return;
    setState(() => _pending = pending);
  }

  void _openAnimalDetail(Animal animal) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AnimalDetailScreen(
          animal: animal,
          allAnimals: _animals,
        ),
      ),
    );
    // Recarrega pendentes ao voltar
    final pending = await _db.getPendingRecords();
    if (!mounted) return;
    setState(() => _pending = pending);
  }

  void _openOfflineReport() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OfflineReportScreen(animals: _animals),
      ),
    );
  }

  // --- Edição/exclusão de registros pendentes na home ---

  IconData _getIconForType(RecordType tipo) {
    switch (tipo) {
      case RecordType.pesagem: return Icons.monitor_weight_outlined;
      case RecordType.vacina: return Icons.vaccines;
      case RecordType.vermifugo: return Icons.bug_report;
      case RecordType.vitamina: return Icons.medication;
      case RecordType.cadastro: return Icons.pets;
    }
  }

  Future<void> _editPendingFromHome(PendingRecord record) async {
    if (record.tipo == RecordType.cadastro) {
      // Busca registros vinculados (mesmo batchId)
      final allPending = await _db.getPendingRecords();
      final linked = allPending
          .where((r) => r.batchId == record.batchId && r.id != record.id)
          .toList();

      if (!mounted) return;
      final changed = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => EditAnimalScreen(
            cadastroRecord: record,
            linkedRecords: linked,
          ),
        ),
      );
      if (changed == true || true) {
        final pending = await _db.getPendingRecords();
        if (mounted) setState(() => _pending = pending);
      }
      return;
    }

    // Para outros tipos, navega para a tela de edição completa
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => EditRecordScreen(record: record),
      ),
    );
    if (changed == true) {
      final pending = await _db.getPendingRecords();
      if (mounted) setState(() => _pending = pending);
    }
  }

  Future<void> _deletePendingFromHome(PendingRecord record) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir registro?'),
        content: Text('Excluir ${record.tipo.label} de ${DateFormat('dd/MM/yyyy').format(record.criadoEm)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await _db.deletePendingRecord(record.id);
      final pending = await _db.getPendingRecords();
      if (mounted) {
        setState(() => _pending = pending);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registro excluído'), backgroundColor: Colors.orange),
        );
      }
    }
  }

  String get _statusLabel =>
      _online ? 'Online' : 'Offline — dados salvos no aparelho';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_farmName != null ? 'GadoManager — $_farmName' : 'GadoManager'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Atualizar',
            onPressed: _loading ? null : () async {
              await _refreshFromServer();
              await _sync();
              final pending = await _db.getPendingRecords();
              if (!mounted) return;
              setState(() => _pending = pending);
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              switch (value) {
                case 'reconnect':
                  _reconnect();
                  break;
                case 'switch_farm':
                  _switchFarm();
                  break;
                case 'logout':
                  _logout();
                  break;
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_userName ?? '',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (_farmName != null)
                      Text('Fazenda: $_farmName',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade600)),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'reconnect',
                child: ListTile(
                  leading: Icon(Icons.wifi_find),
                  title: Text('Reconectar ao servidor'),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'switch_farm',
                child: ListTile(
                  leading: Icon(Icons.swap_horiz),
                  title: Text('Trocar fazenda'),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'logout',
                child: ListTile(
                  leading: Icon(Icons.logout),
                  title: Text('Sair'),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'add_animal',
            onPressed: _addAnimal,
            tooltip: 'Cadastrar boi',
            child: const Icon(Icons.add_circle_outline),
          ),
          const SizedBox(height: 8),
          FloatingActionButton.extended(
            heroTag: 'add_record',
            onPressed: _openAddRecord,
            icon: const Icon(Icons.add),
            label: const Text('Novo Registro'),
          ),
        ],
      ),
      body: Column(
        children: [
          // Banner de status
          Container(
            width: double.infinity,
            color: _online ? Colors.green.shade50 : Colors.orange.shade100,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Icon(
                  _online ? Icons.wifi : Icons.wifi_off,
                  size: 18,
                  color: _online ? Colors.green : Colors.orange.shade900,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _statusLabel,
                    style: TextStyle(
                      fontSize: 13,
                      color:
                          _online ? Colors.green.shade900 : Colors.orange.shade900,
                    ),
                  ),
                ),
                Badge(
                  isLabelVisible: _pending.isNotEmpty,
                  label: Text('${_pending.length}'),
                  child: TextButton.icon(
                    onPressed: (_syncing || !_online || _pending.isEmpty)
                        ? null
                        : _sync,
                    icon: _syncing
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.sync, size: 18),
                    label: const Text('Sincronizar'),
                  ),
                ),
              ],
            ),
          ),
          // Pendentes - lista expansiva com edição
          if (_pending.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Card(
                color: Colors.orange.shade50,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ListTile(
                      leading: const Icon(Icons.cloud_upload_outlined),
                      title: Text(
                          '${_pending.length} registro(s) aguardando sincronização'),
                      subtitle: Text(_describePending()),
                      trailing: Icon(
                        _pendingExpanded ? Icons.expand_less : Icons.expand_more,
                      ),
                      onTap: () => setState(() => _pendingExpanded = !_pendingExpanded),
                    ),
                    if (_pendingExpanded)
                      ..._pending.map((r) {
                        final date = DateFormat('dd/MM/yyyy').format(r.criadoEm);
                        String detail;
                        switch (r.tipo) {
                          case RecordType.pesagem:
                            detail = '${r.payload['pesoKg'] ?? '?'} kg - $date';
                            break;
                          case RecordType.vacina:
                            detail = '${r.payload['nomeVacina'] ?? '?'} - $date';
                            break;
                          case RecordType.vermifugo:
                            detail = '${r.payload['nomeVermifugo'] ?? '?'} - $date';
                            break;
                          case RecordType.vitamina:
                            detail = '${r.payload['nomeVitamina'] ?? '?'} - $date';
                            break;
                          case RecordType.cadastro:
                            detail = 'Boi #${r.payload['numeroIdentificacao'] ?? '?'} - $date';
                            break;
                        }
                        return ListTile(
                          dense: true,
                          leading: Icon(_getIconForType(r.tipo), size: 18, color: Colors.orange.shade700),
                          title: Text(r.tipo.label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          subtitle: Text(detail, style: const TextStyle(fontSize: 11)),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 18),
                                onPressed: () => _editPendingFromHome(r),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 18),
                                onPressed: () => _deletePendingFromHome(r),
                              ),
                            ],
                          ),
                        );
                      }),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          // Botão de relatório offline
          if (_animals.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Card(
                child: ListTile(
                  leading: Icon(
                    Icons.assessment,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  title: const Text('Relatório Offline'),
                  subtitle: const Text('Visualizar dados locais'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: _openOfflineReport,
                ),
              ),
            ),
          // Lista de animais
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _animals.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.pets,
                                  size: 48, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              Text(
                                _online
                                    ? 'Nenhum animal cadastrado ainda'
                                    : 'Sem dados locais.\nConecte-se à internet uma vez para baixar a lista de animais.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.grey.shade600),
                              ),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async {
                          await _refreshFromServer();
                        },
                        child: ListView.separated(
                          itemCount: _animals.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final animal = _animals[index];
                            return ListTile(
                              leading: CircleAvatar(
                                backgroundColor: animal.status == 'ATIVO'
                                    ? Colors.green.shade100
                                    : Colors.grey.shade300,
                                child: Icon(
                                  Icons.pets,
                                  size: 20,
                                  color: animal.status == 'ATIVO'
                                      ? Colors.green.shade800
                                      : Colors.grey.shade600,
                                ),
                              ),
                              title: Text('Boi #${animal.numero}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(animal.status == 'ATIVO'
                                  ? 'Ativo'
                                  : animal.status == 'VENDIDO'
                                      ? 'Vendido'
                                      : 'Inativo'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (animal.status != 'ATIVO')
                                    Chip(
                                      label: Text(animal.status),
                                      visualDensity: VisualDensity.compact,
                                    ),
                                  const Icon(Icons.chevron_right, size: 20),
                                ],
                              ),
                              onTap: () => _openAnimalDetail(animal),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  String _describePending() {
    final byType = <RecordType, int>{};
    for (final p in _pending) {
      byType[p.tipo] = (byType[p.tipo] ?? 0) + 1;
    }
    return byType.entries
        .map((e) => '${e.value} ${e.key.label.toLowerCase()}(s)')
        .join(', ');
  }
}

String formatDate(String iso) {
  return DateFormat('dd/MM/yyyy').format(DateTime.parse(iso));
}
