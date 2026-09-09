import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';
import 'edit_record_screen.dart';

/// Tela completa de edição offline do cadastro de um animal.
/// Edita o número de identificação E todos os registros vinculados (mesmo batchId).
class EditAnimalScreen extends StatefulWidget {
  final PendingRecord cadastroRecord;
  final List<PendingRecord> linkedRecords;

  const EditAnimalScreen({
    super.key,
    required this.cadastroRecord,
    required this.linkedRecords,
  });

  @override
  State<EditAnimalScreen> createState() => _EditAnimalScreenState();
}

class _EditAnimalScreenState extends State<EditAnimalScreen> {
  final _db = DatabaseHelper.instance;
  late final TextEditingController _numeroCtrl;
  late String _currentNumero;

  @override
  void initState() {
    super.initState();
    _currentNumero =
        widget.cadastroRecord.payload['numeroIdentificacao']?.toString() ?? '';
    _numeroCtrl = TextEditingController(text: _currentNumero);
  }

  @override
  void dispose() {
    _numeroCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveNumero() async {
    final newNumero = _numeroCtrl.text.trim();
    if (newNumero.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Número não pode ser vazio')),
      );
      return;
    }

    final updatedPayload =
        Map<String, dynamic>.from(widget.cadastroRecord.payload);
    updatedPayload['numeroIdentificacao'] = newNumero;
    updatedPayload['animalNumero'] = newNumero;

    await _db.updatePendingRecord(PendingRecord(
      id: widget.cadastroRecord.id,
      tipo: widget.cadastroRecord.tipo,
      payload: updatedPayload,
      criadoEm: widget.cadastroRecord.criadoEm,
      batchId: widget.cadastroRecord.batchId,
    ));

    // Atualizar também o animalNumero nos registros vinculados
    for (final record in widget.linkedRecords) {
      final linkedPayload = Map<String, dynamic>.from(record.payload);
      linkedPayload['animalNumero'] = newNumero;
      await _db.updatePendingRecord(PendingRecord(
        id: record.id,
        tipo: record.tipo,
        payload: linkedPayload,
        criadoEm: record.criadoEm,
        batchId: record.batchId,
      ));
    }

    setState(() => _currentNumero = newNumero);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cadastro atualizado'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  Future<void> _editLinkedRecord(PendingRecord record) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => EditRecordScreen(record: record)),
    );
    if (changed == true && mounted) {
      setState(() {}); // Refresh
    }
  }

  Future<void> _deleteLinkedRecord(PendingRecord record) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir registro?'),
        content: Text(
            'Excluir ${record.tipo.label} de ${DateFormat('dd/MM/yyyy').format(record.criadoEm)}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Excluir', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await _db.deletePendingRecord(record.id);
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registro excluído'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  Future<void> _addLinkedRecord() async {
    final result = await showDialog<RecordType>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Adicionar registro'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, RecordType.pesagem),
            child: const ListTile(
              leading: Icon(Icons.monitor_weight_outlined),
              title: Text('Pesagem'),
            ),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, RecordType.vacina),
            child: const ListTile(
              leading: Icon(Icons.vaccines),
              title: Text('Vacina'),
            ),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, RecordType.vermifugo),
            child: const ListTile(
              leading: Icon(Icons.bug_report),
              title: Text('Vermífugo'),
            ),
          ),
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, RecordType.vitamina),
            child: const ListTile(
              leading: Icon(Icons.medication),
              title: Text('Vitamina'),
            ),
          ),
        ],
      ),
    );
    if (result != null) {
      // Cria um registro vazio para editar
      final newId = ApiService.newClientId();
      final payload = <String, dynamic>{
        'clientGeneratedId': newId,
        'animalNumero': _currentNumero,
      };
      switch (result) {
        case RecordType.pesagem:
          payload['pesoKg'] = 0;
          payload['dataPesagem'] =
              DateFormat('yyyy-MM-dd').format(DateTime.now());
          break;
        case RecordType.vacina:
          payload['nomeVacina'] = '';
          payload['dataAplicacao'] =
              DateFormat('yyyy-MM-dd').format(DateTime.now());
          break;
        case RecordType.vermifugo:
          payload['nomeVermifugo'] = '';
          payload['dataAplicacao'] =
              DateFormat('yyyy-MM-dd').format(DateTime.now());
          break;
        case RecordType.vitamina:
          payload['nomeVitamina'] = '';
          payload['dataAplicacao'] =
              DateFormat('yyyy-MM-dd').format(DateTime.now());
          break;
        case RecordType.cadastro:
          return;
      }

      final newRecord = PendingRecord(
        id: newId,
        tipo: result,
        payload: payload,
        criadoEm: DateTime.now(),
        batchId: widget.cadastroRecord.batchId,
      );
      await _db.insertPendingRecord(newRecord);

      // Navega para edição imediata
      if (mounted) {
        await Navigator.of(context).push<bool>(
          MaterialPageRoute(
              builder: (_) => EditRecordScreen(record: newRecord)),
        );
        if (mounted) setState(() {});
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Editar Boi #$_currentNumero'),
        actions: [
          TextButton(
            onPressed: _saveNumero,
            child: const Text('Salvar'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Dados do animal
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.pets, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Dados do Animal',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _numeroCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Número de identificação',
                      hintText: 'Ex.: 001',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.tag),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Data de cadastro: ${DateFormat('dd/MM/yyyy HH:mm').format(widget.cadastroRecord.criadoEm)}',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _saveNumero,
                      icon: const Icon(Icons.save, size: 18),
                      label: const Text('Salvar Número'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Registros vinculados
          Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Row(
                    children: [
                      const Icon(Icons.link, size: 18, color: Colors.blue),
                      const SizedBox(width: 8),
                      Text(
                        'Registros Vinculados',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.blue.shade700,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${widget.linkedRecords.length}',
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600),
                      ),
                    ],
                  ),
                ),
                if (widget.linkedRecords.isEmpty)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Center(
                      child: Text(
                        'Nenhum registro vinculado',
                        style: TextStyle(
                            color: Colors.grey.shade500, fontSize: 13),
                      ),
                    ),
                  )
                else
                  ...widget.linkedRecords.map((r) {
                    final date = DateFormat('dd/MM/yyyy')
                        .format(r.criadoEm);
                    String detail;
                    switch (r.tipo) {
                      case RecordType.pesagem:
                        detail =
                            '${r.payload['pesoKg'] ?? '?'} kg - $date';
                        break;
                      case RecordType.vacina:
                        detail =
                            '${r.payload['nomeVacina'] ?? '?'} - $date';
                        break;
                      case RecordType.vermifugo:
                        detail =
                            '${r.payload['nomeVermifugo'] ?? '?'} - $date';
                        break;
                      case RecordType.vitamina:
                        detail =
                            '${r.payload['nomeVitamina'] ?? '?'} - $date';
                        break;
                      default:
                        detail = date;
                    }
                    return ListTile(
                      dense: true,
                      leading: Icon(_getIconForType(r.tipo),
                          size: 18, color: Colors.blue.shade700),
                      title: Text(r.tipo.label,
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w500)),
                      subtitle: Text(detail,
                          style: const TextStyle(fontSize: 11)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            onPressed: () => _editLinkedRecord(r),
                          ),
                          IconButton(
                            icon:
                                const Icon(Icons.delete_outline, size: 18),
                            onPressed: () => _deleteLinkedRecord(r),
                          ),
                        ],
                      ),
                    );
                  }),
                // Botão adicionar
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _addLinkedRecord,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Adicionar Registro'),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  IconData _getIconForType(RecordType tipo) {
    switch (tipo) {
      case RecordType.pesagem:
        return Icons.monitor_weight_outlined;
      case RecordType.vacina:
        return Icons.vaccines;
      case RecordType.vermifugo:
        return Icons.bug_report;
      case RecordType.vitamina:
        return Icons.medication;
      case RecordType.cadastro:
        return Icons.pets;
    }
  }
}
