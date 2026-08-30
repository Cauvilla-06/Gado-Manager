import 'package:flutter/material.dart';

import '../models.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class FarmSelectionScreen extends StatefulWidget {
  const FarmSelectionScreen({super.key});

  @override
  State<FarmSelectionScreen> createState() => _FarmSelectionScreenState();
}

class _FarmSelectionScreenState extends State<FarmSelectionScreen> {
  final _auth = AuthService();
  late final _api = ApiService(_auth);

  List<Farm> _farms = [];
  bool _loading = true;
  String? _error;
  String? _currentFarmId;

  @override
  void initState() {
    super.initState();
    _loadFarms();
  }

  Future<void> _loadFarms() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    _currentFarmId = await _auth.selectedFarmId;

    try {
      final farms = await _api.fetchFarms();
      if (!mounted) return;
      setState(() {
        _farms = farms;
        _loading = false;
      });

      // If user has only one farm, select it automatically
      if (farms.length == 1) {
        await _selectFarm(farms.first);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Erro ao carregar fazendas. Verifique a conexão.';
        _loading = false;
      });
    }
  }

  Future<void> _selectFarm(Farm farm) async {
    setState(() => _loading = true);

    try {
      await _api.switchFarm(farm.id);
      await _auth.setSelectedFarm(farm.id, farm.name);

      if (!mounted) return;
      // Navega para HomeScreen limpando toda a pilha.
      // Isso funciona tanto quando a tela foi abrira com pushReplacement
      // (pós-login) quanto com push (troca de fazenda no menu).
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erro ao selecionar fazenda: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _createFarm() async {
    final nameCtrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nova Fazenda'),
        content: TextField(
          controller: nameCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Nome da fazenda',
            hintText: 'Ex.: Fazenda São José',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(nameCtrl.text.trim()),
            child: const Text('Criar'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      try {
        setState(() => _loading = true);
        await _api.createFarm(result);
        await _loadFarms();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Fazenda "$result" criada!'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          setState(() => _loading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _joinFarm() async {
    final codeCtrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Entrar em Fazenda'),
        content: TextField(
          controller: codeCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'Código da fazenda',
            hintText: 'Ex.: farm-abc12345',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(codeCtrl.text.trim()),
            child: const Text('Enviar Pedido'),
          ),
        ],
      ),
    );

    if (result != null && result.isNotEmpty) {
      try {
        await _api.joinFarm(result);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Pedido enviado! Aguarde aprovação do proprietário.'),
              backgroundColor: Colors.blue,
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Selecionar Fazenda'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _loadFarms,
          ),
        ],
      ),
      bottomNavigationBar: _farms.isNotEmpty
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _createFarm,
                        icon: const Icon(Icons.add),
                        label: const Text('Criar Fazenda'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _joinFarm,
                        icon: const Icon(Icons.login),
                        label: const Text('Entrar em Fazenda'),
                      ),
                    ),
                  ],
                ),
              ),
            )
          : null,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _farms.isEmpty
                  ? _buildEmpty()
                  : _buildFarmList(),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 12),
            Text(_error!,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.red.shade700)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loadFarms,
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.agriculture, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'Você não pertence a nenhuma fazenda.\nCrie uma ou peça o código ao proprietário.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _createFarm,
              icon: const Icon(Icons.add),
              label: const Text('Criar Fazenda'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _joinFarm,
              icon: const Icon(Icons.login),
              label: const Text('Entrar em Fazenda Existente'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFarmList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _farms.length,
      itemBuilder: (context, index) {
        final farm = _farms[index];
        final isSelected = farm.id == _currentFarmId;

        return Card(
          color: isSelected
              ? Theme.of(context).colorScheme.primaryContainer
              : null,
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: isSelected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.grey.shade300,
              child: Icon(
                Icons.agriculture,
                color: isSelected ? Colors.white : Colors.grey.shade700,
              ),
            ),
            title: Text(
              farm.name,
              style: TextStyle(
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Código: ${farm.code}'),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(Icons.pets, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text('${farm.animalCount} animal(is)',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600)),
                    const SizedBox(width: 12),
                    Icon(Icons.people, size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Text('${farm.memberCount} membro(s)',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600)),
                    const SizedBox(width: 12),
                    Chip(
                      label: Text(farm.role,
                          style: const TextStyle(fontSize: 10)),
                      visualDensity: VisualDensity.compact,
                      padding: EdgeInsets.zero,
                    ),
                  ],
                ),
              ],
            ),
            trailing: isSelected
                ? const Icon(Icons.check_circle, color: Colors.green)
                : const Icon(Icons.chevron_right),
            onTap: () => _selectFarm(farm),
          ),
        );
      },
    );
  }
}
