import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';
import 'add_animal_screen.dart';
import 'add_record_screen.dart';
import 'farm_selection_screen.dart';
import 'login_screen.dart';

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
  String? _userName;
  String? _farmName;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);

    // 1. Carrega cache local instantaneamente
    final animals = await _db.getAnimals();
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
      await _db.replaceAnimals(animals);
      if (!mounted) return;
      setState(() {
        _animals = animals;
        _online = true;
      });
    } catch (_) {
      if (mounted) setState(() => _online = false);
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

  Future<void> _switchFarm() async {
    final result = await Navigator.of(context).push<Farm>(
      MaterialPageRoute(builder: (_) => const FarmSelectionScreen()),
    );
    if (result != null && mounted) {
      // Faz reload completo da tela com a nova fazenda
      await _loadData();
    }
  }

  Future<void> _addAnimal() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const AddAnimalScreen()),
    );
    if (created == true) {
      // Refresh animal list
      await _refreshFromServer();
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
          // Pendentes resumo
          if (_pending.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Card(
                color: Theme.of(context).colorScheme.primaryContainer,
                child: ListTile(
                  leading: const Icon(Icons.cloud_upload_outlined),
                  title: Text(
                      '${_pending.length} registro(s) aguardando sincronização'),
                  subtitle: Text(_describePending()),
                  isThreeLine: _pending.length > 3,
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
                              trailing: animal.status != 'ATIVO'
                                  ? Chip(
                                      label: Text(animal.status),
                                      visualDensity: VisualDensity.compact,
                                    )
                                  : null,
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
