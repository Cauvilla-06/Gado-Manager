import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';

class AddAnimalScreen extends StatefulWidget {
  const AddAnimalScreen({super.key});

  @override
  State<AddAnimalScreen> createState() => _AddAnimalScreenState();
}

class _AddAnimalScreenState extends State<AddAnimalScreen> {
  final _formKey = GlobalKey<FormState>();
  final _numeroCtrl = TextEditingController();
  final _db = DatabaseHelper.instance;

  bool _saving = false;

  // Registros adicionais (pesagens, vacinas, etc.)
  final List<_AdditionalRecord> _additionalRecords = [];

  // Campos para novo registro
  RecordType _newTipo = RecordType.pesagem;
  final _pesoCtrl = TextEditingController();
  final _nomeCtrl = TextEditingController();
  final _doseCtrl = TextEditingController();
  final _loteCtrl = TextEditingController();
  DateTime _newData = DateTime.now();
  DateTime? _newDataProximaDose;
  final _obsCtrl = TextEditingController();

  @override
  void dispose() {
    _numeroCtrl.dispose();
    _pesoCtrl.dispose();
    _nomeCtrl.dispose();
    _doseCtrl.dispose();
    _loteCtrl.dispose();
    _obsCtrl.dispose();
    super.dispose();
  }

  void _addRecord() {
    if (_newTipo == RecordType.pesagem) {
      final peso = double.tryParse(_pesoCtrl.text.replaceAll(',', '.'));
      if (peso == null || peso <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informe um peso válido')),
        );
        return;
      }
    } else {
      if (_nomeCtrl.text.trim().isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Informe o nome')),
        );
        return;
      }
    }

    final payload = <String, dynamic>{};

    switch (_newTipo) {
      case RecordType.pesagem:
        payload['pesoKg'] = double.tryParse(_pesoCtrl.text.replaceAll(',', '.'));
        payload['dataPesagem'] = DateFormat('yyyy-MM-dd').format(_newData);
        break;
      case RecordType.vacina:
        payload['nomeVacina'] = _nomeCtrl.text.trim();
        payload['dataAplicacao'] = DateFormat('yyyy-MM-dd').format(_newData);
        if (_newDataProximaDose != null) {
          payload['dataProximaDose'] = DateFormat('yyyy-MM-dd').format(_newDataProximaDose!);
        }
        if (_loteCtrl.text.trim().isNotEmpty) {
          payload['lote'] = _loteCtrl.text.trim();
        }
        break;
      case RecordType.vermifugo:
        payload['nomeVermifugo'] = _nomeCtrl.text.trim();
        payload['dataAplicacao'] = DateFormat('yyyy-MM-dd').format(_newData);
        if (_newDataProximaDose != null) {
          payload['dataProximaDose'] = DateFormat('yyyy-MM-dd').format(_newDataProximaDose!);
        }
        break;
      case RecordType.vitamina:
        payload['nomeVitamina'] = _nomeCtrl.text.trim();
        payload['dataAplicacao'] = DateFormat('yyyy-MM-dd').format(_newData);
        if (_newDataProximaDose != null) {
          payload['dataProximaDose'] = DateFormat('yyyy-MM-dd').format(_newDataProximaDose!);
        }
        break;
      case RecordType.cadastro:
        break;
    }

    if (_newTipo != RecordType.pesagem && _doseCtrl.text.trim().isNotEmpty) {
      payload['dose'] = _doseCtrl.text.trim();
    }
    if (_obsCtrl.text.trim().isNotEmpty) {
      payload['observacao'] = _obsCtrl.text.trim();
    }

    setState(() {
      _additionalRecords.add(_AdditionalRecord(
        tipo: _newTipo,
        payload: payload,
      ));
      // Limpa campos
      _pesoCtrl.clear();
      _nomeCtrl.clear();
      _doseCtrl.clear();
      _loteCtrl.clear();
      _obsCtrl.clear();
      _newData = DateTime.now();
      _newDataProximaDose = null;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${_newTipo.label} adicionada!'),
        backgroundColor: Colors.green.shade700,
        duration: const Duration(seconds: 1),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    final numero = _numeroCtrl.text.trim();
    final clientId = ApiService.newClientId();
    final batchId = ApiService.newClientId(); // Batch link: animal + records

    // 1. Salva o cadastro do animal
    await _db.insertPendingRecord(PendingRecord(
      id: clientId,
      tipo: RecordType.cadastro,
      payload: {
        'clientGeneratedId': clientId,
        'numeroIdentificacao': numero,
        'animalNumero': numero,
      },
      criadoEm: DateTime.now(),
      batchId: batchId,
    ));

    // 2. Salva registros adicionais vinculados ao mesmo batch
    for (final record in _additionalRecords) {
      final recordId = ApiService.newClientId();
      await _db.insertPendingRecord(PendingRecord(
        id: recordId,
        tipo: record.tipo,
        payload: {
          ...record.payload,
          'clientGeneratedId': recordId,
          'animalNumero': numero,
        },
        criadoEm: DateTime.now(),
        batchId: batchId,
      ));
    }

    if (!mounted) return;
    setState(() => _saving = false);


    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Boi #$numero e ${_additionalRecords.length} registro(s) salvos offline! '
          'Será enviado quando houver internet.',
        ),
        backgroundColor: Colors.green.shade700,
      ),
    );

    Navigator.of(context).pop(true); // return true = created
  }

  Future<void> _pickDate({
    required ValueChanged<DateTime> onPicked,
    DateTime? firstDate,
  }) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: firstDate ?? DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) onPicked(picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cadastrar Boi')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Info card
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.info_outline),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'O boi será cadastrado na fazenda selecionada. '
                        'Você pode adicionar pesagens e outros registros abaixo '
                        'para que sejam sincronizados junto.',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Animal number field
            TextFormField(
              controller: _numeroCtrl,
              decoration: const InputDecoration(
                labelText: 'Número de identificação',
                hintText: 'Ex.: 001, BR-12345, etc.',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.tag),
              ),
              textInputAction: TextInputAction.next,
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'Informe o número de identificação';
                }
                if (v.trim().length > 50) {
                  return 'Número muito longo (máx. 50 caracteres)';
                }
                return null;
              },
            ),
            const SizedBox(height: 8),
            Text(
              'O número deve ser único dentro da fazenda.',
              style: Theme.of(context).textTheme.bodySmall,
            ),

            const SizedBox(height: 24),

            // Seção de registros adicionais
            if (_additionalRecords.isNotEmpty) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.list, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Registros vinculados (${_additionalRecords.length})',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      ...List.generate(_additionalRecords.length, (i) {
                        final r = _additionalRecords[i];
                        return ListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(_getIcon(r.tipo), size: 18),
                          title: Text(_getRecordLabel(r), style: const TextStyle(fontSize: 13)),
                          subtitle: Text(_getRecordDetail(r), style: const TextStyle(fontSize: 11)),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline, size: 18),
                            onPressed: () {
                              setState(() => _additionalRecords.removeAt(i));
                            },
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Adicionar novo registro
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Adicionar registro',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Seletor de tipo
                    SegmentedButton<RecordType>(
                      segments: const [
                        ButtonSegment(
                          value: RecordType.pesagem,
                          icon: Icon(Icons.monitor_weight_outlined, size: 18),
                          label: Text('Pesagem', style: TextStyle(fontSize: 11)),
                        ),
                        ButtonSegment(
                          value: RecordType.vacina,
                          icon: Icon(Icons.vaccines, size: 18),
                          label: Text('Vacina', style: TextStyle(fontSize: 11)),
                        ),
                        ButtonSegment(
                          value: RecordType.vermifugo,
                          icon: Icon(Icons.bug_report, size: 18),
                          label: Text('Vermífugo', style: TextStyle(fontSize: 11)),
                        ),
                        ButtonSegment(
                          value: RecordType.vitamina,
                          icon: Icon(Icons.medication, size: 18),
                          label: Text('Vitamina', style: TextStyle(fontSize: 11)),
                        ),
                      ],
                      selected: {_newTipo},
                      onSelectionChanged: (selection) =>
                          setState(() => _newTipo = selection.first),
                    ),
                    const SizedBox(height: 12),

                    // Campos por tipo
                    if (_newTipo == RecordType.pesagem) ...[
                      TextFormField(
                        controller: _pesoCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Peso (kg)',
                          hintText: 'Ex.: 450.5',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.scale),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ] else ...[
                      TextFormField(
                        controller: _nomeCtrl,
                        decoration: InputDecoration(
                          labelText: _newTipo == RecordType.vacina
                              ? 'Nome da vacina'
                              : _newTipo == RecordType.vermifugo
                                  ? 'Nome do vermífugo'
                                  : 'Nome da vitamina',
                          hintText: 'Ex.: Aftosa',
                          border: const OutlineInputBorder(),
                          prefixIcon: const Icon(Icons.label_outline),
                          isDense: true,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (_newTipo != RecordType.vacina) ...[
                        TextFormField(
                          controller: _doseCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Dose (opcional)',
                            hintText: 'Ex.: 10 mL',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.colorize),
                            isDense: true,
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (_newTipo == RecordType.vacina) ...[
                        TextFormField(
                          controller: _loteCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Lote (opcional)',
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.inventory_2_outlined),
                            isDense: true,
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                    ],

                    // Data
                    Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        dense: true,
                        leading: const Icon(Icons.event, size: 20),
                        title: Text(
                          _newTipo == RecordType.pesagem
                              ? 'Data da pesagem'
                              : 'Data de aplicação',
                          style: const TextStyle(fontSize: 13),
                        ),
                        subtitle: Text(
                          DateFormat('dd/MM/yyyy').format(_newData),
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: const Icon(Icons.edit_calendar, size: 18),
                        onTap: () => _pickDate(
                          onPicked: (d) => setState(() => _newData = d),
                        ),
                      ),
                    ),

                    if (_newTipo != RecordType.pesagem) ...[
                      const SizedBox(height: 4),
                      Card(
                        margin: EdgeInsets.zero,
                        child: ListTile(
                          dense: true,
                          leading: const Icon(Icons.event_repeat, size: 20),
                          title: const Text('Próxima dose', style: TextStyle(fontSize: 13)),
                          subtitle: Text(
                            _newDataProximaDose != null
                                ? DateFormat('dd/MM/yyyy').format(_newDataProximaDose!)
                                : 'Não definida',
                            style: const TextStyle(fontSize: 12),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (_newDataProximaDose != null)
                                IconButton(
                                  icon: const Icon(Icons.close, size: 16),
                                  onPressed: () =>
                                      setState(() => _newDataProximaDose = null),
                                ),
                              const Icon(Icons.edit_calendar, size: 18),
                            ],
                          ),
                          onTap: () => _pickDate(
                            onPicked: (d) => setState(() => _newDataProximaDose = d),
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _obsCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Observação (opcional)',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),

                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _addRecord,
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Adicionar'),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Botão cadastrar
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add),
              label: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(_saving
                    ? 'Salvando...'
                    : _additionalRecords.isEmpty
                        ? 'Cadastrar Boi'
                        : 'Cadastrar Boi + ${_additionalRecords.length} registro(s)'),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tudo fica salvo offline e é enviado ao servidor '
              'automaticamente quando você tiver internet.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  IconData _getIcon(RecordType tipo) {
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

  String _getRecordLabel(_AdditionalRecord record) {
    switch (record.tipo) {
      case RecordType.pesagem:
        return 'Pesagem';
      case RecordType.vacina:
        return record.payload['nomeVacina'] ?? 'Vacina';
      case RecordType.vermifugo:
        return record.payload['nomeVermifugo'] ?? 'Vermífugo';
      case RecordType.vitamina:
        return record.payload['nomeVitamina'] ?? 'Vitamina';
      case RecordType.cadastro:
        return 'Cadastro';
    }
  }

  String _getRecordDetail(_AdditionalRecord record) {
    switch (record.tipo) {
      case RecordType.pesagem:
        final peso = record.payload['pesoKg'];
        final data = record.payload['dataPesagem'];
        return '${peso}kg - $data';
      case RecordType.vacina:
      case RecordType.vermifugo:
      case RecordType.vitamina:
        return record.payload['dataAplicacao'] ?? '';
      case RecordType.cadastro:
        return '';
    }
  }
}

class _AdditionalRecord {
  final RecordType tipo;
  final Map<String, dynamic> payload;

  _AdditionalRecord({required this.tipo, required this.payload});
}
