import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';

class AddRecordScreen extends StatefulWidget {
  final List<Animal> animals;
  final Animal? preSelectedAnimal;

  const AddRecordScreen({super.key, required this.animals, this.preSelectedAnimal});

  @override
  State<AddRecordScreen> createState() => _AddRecordScreenState();
}

class _AddRecordScreenState extends State<AddRecordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _db = DatabaseHelper.instance;

  Animal? _selectedAnimal;
  RecordType _tipo = RecordType.pesagem;

  @override
  void initState() {
    super.initState();
    if (widget.preSelectedAnimal != null) {
      _selectedAnimal = widget.preSelectedAnimal;
    }
  }

  // Campos dinâmicos
  final _pesoCtrl = TextEditingController();
  final _nomeCtrl = TextEditingController();
  final _doseCtrl = TextEditingController();
  final _loteCtrl = TextEditingController();
  DateTime _dataAplicacao = DateTime.now();
  DateTime? _dataProximaDose;
  final _obsCtrl = TextEditingController();

  bool _saving = false;

  @override
  void dispose() {
    _pesoCtrl.dispose();
    _nomeCtrl.dispose();
    _doseCtrl.dispose();
    _loteCtrl.dispose();
    _obsCtrl.dispose();
    super.dispose();
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

  Future<void> _save() async {
    if (_selectedAnimal == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Selecione o animal')),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    final payload = <String, dynamic>{
      'clientGeneratedId': ApiService.newClientId(),
      'animalNumero': _selectedAnimal!.numero,
    };

    switch (_tipo) {
      case RecordType.pesagem:
        payload['pesoKg'] = double.tryParse(_pesoCtrl.text.replaceAll(',', '.'));
        payload['dataPesagem'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        break;
      case RecordType.vacina:
        payload['nomeVacina'] = _nomeCtrl.text.trim();
        payload['dataAplicacao'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        if (_dataProximaDose != null) {
          payload['dataProximaDose'] =
              DateFormat('yyyy-MM-dd').format(_dataProximaDose!);
        }
        if (_loteCtrl.text.trim().isNotEmpty) {
          payload['lote'] = _loteCtrl.text.trim();
        }
        break;
      case RecordType.vermifugo:
        payload['nomeVermifugo'] = _nomeCtrl.text.trim();
        payload['dataAplicacao'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        if (_dataProximaDose != null) {
          payload['dataProximaDose'] =
              DateFormat('yyyy-MM-dd').format(_dataProximaDose!);
        }
        break;
      case RecordType.vitamina:
        payload['nomeVitamina'] = _nomeCtrl.text.trim();
        payload['dataAplicacao'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        if (_dataProximaDose != null) {
          payload['dataProximaDose'] =
              DateFormat('yyyy-MM-dd').format(_dataProximaDose!);
        }
        break;
      case RecordType.cadastro:
        break; // Não utilizado nesta tela
    }

    if (_tipo != RecordType.pesagem && _doseCtrl.text.trim().isNotEmpty) {
      payload['dose'] = _doseCtrl.text.trim();
    }
    if (_obsCtrl.text.trim().isNotEmpty) {
      payload['observacao'] = _obsCtrl.text.trim();
    }

    await _db.insertPendingRecord(PendingRecord(
      id: payload['clientGeneratedId'] as String,
      tipo: _tipo,
      payload: payload,
      criadoEm: DateTime.now(),
    ));

    if (!mounted) return;
    setState(() => _saving = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Registro salvo! Será enviado quando houver internet.'),
        backgroundColor: Colors.green.shade700,
      ),
    );

    // Reset para próximo registro rápido
    _pesoCtrl.clear();
    _nomeCtrl.clear();
    _doseCtrl.clear();
    _loteCtrl.clear();
    _obsCtrl.clear();
    setState(() {
      _dataAplicacao = DateTime.now();
      _dataProximaDose = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Novo Registro')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Seletor de animal
            DropdownButtonFormField<Animal>(
              initialValue: _selectedAnimal,
              decoration: const InputDecoration(
                labelText: 'Animal',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.pets),
              ),
              items: widget.animals
                  .where((a) => a.status == 'ATIVO')
                  .map((a) => DropdownMenuItem(
                        value: a,
                        child: Text('Boi #${a.numero}'),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _selectedAnimal = v),
              validator: (v) =>
                  v == null ? 'Selecione um animal' : null,
            ),
            const SizedBox(height: 20),

            // Seletor de tipo (cadastro é feito pela tela separada)
            SegmentedButton<RecordType>(
              segments: RecordType.values
                  .where((t) => t != RecordType.cadastro)
                  .map((t) {
                IconData icon;
                switch (t) {
                  case RecordType.pesagem:
                    icon = Icons.monitor_weight_outlined;
                    break;
                  case RecordType.vacina:
                    icon = Icons.vaccines;
                    break;
                  case RecordType.vermifugo:
                    icon = Icons.bug_report;
                    break;
                  case RecordType.vitamina:
                    icon = Icons.medication;
                    break;
                  case RecordType.cadastro:
                    icon = Icons.pets;
                    break;
                }
                return ButtonSegment(value: t, icon: Icon(icon));
              }).toList(),
              selected: {_tipo},
              onSelectionChanged: (selection) =>
                  setState(() => _tipo = selection.first),
            ),
            const SizedBox(height: 4),
            Center(
              child: Text(_tipo.label,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 16),

            // Campos por tipo
            if (_tipo == RecordType.pesagem) ...[
              TextFormField(
                controller: _pesoCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Peso (kg)',
                  hintText: 'Ex.: 450.5',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.scale),
                ),
                validator: (v) {
                  final value = double.tryParse((v ?? '').replaceAll(',', '.'));
                  if (value == null || value <= 0 || value > 2000) {
                    return 'Informe um peso válido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ] else ...[
              TextFormField(
                controller: _nomeCtrl,
                decoration: InputDecoration(
                  labelText: _tipo == RecordType.vacina
                      ? 'Nome da vacina'
                      : _tipo == RecordType.vermifugo
                          ? 'Nome do vermífugo'
                          : 'Nome da vitamina',
                  hintText: 'Ex.: Aftosa',
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.label_outline),
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Informe o nome' : null,
              ),
              const SizedBox(height: 16),
              if (_tipo != RecordType.vacina) ...[
                TextFormField(
                  controller: _doseCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Dose (opcional)',
                    hintText: 'Ex.: 10 mL',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.colorize),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              if (_tipo == RecordType.vacina) ...[
                TextFormField(
                  controller: _loteCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Lote (opcional)',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.inventory_2_outlined),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ],

            // Data da aplicação/pesagem
            Card(
              margin: EdgeInsets.zero,
              child: ListTile(
                leading: const Icon(Icons.event),
                title: Text(_tipo == RecordType.pesagem
                    ? 'Data da pesagem'
                    : 'Data de aplicação'),
                subtitle: Text(DateFormat('dd/MM/yyyy').format(_dataAplicacao)),
                trailing: const Icon(Icons.edit_calendar),
                onTap: () => _pickDate(
                  onPicked: (d) => setState(() => _dataAplicacao = d),
                ),
              ),
            ),

            // Próxima dose (vacina/vermífugo/vitamina)
            if (_tipo != RecordType.pesagem) ...[
              const SizedBox(height: 8),
              Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  leading: const Icon(Icons.event_repeat),
                  title: const Text('Próxima dose'),
                  subtitle: Text(_dataProximaDose != null
                      ? DateFormat('dd/MM/yyyy').format(_dataProximaDose!)
                      : 'Não definida'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () =>
                            setState(() => _dataProximaDose = null),
                      ),
                      const Icon(Icons.edit_calendar),
                    ],
                  ),
                  onTap: () => _pickDate(
                    onPicked: (d) => setState(() => _dataProximaDose = d),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 16),
            TextFormField(
              controller: _obsCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Observação (opcional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),

            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: const Icon(Icons.save),
              label: const Padding(
                padding: EdgeInsets.symmetric(vertical: 14),
                child: Text('Salvar no aparelho'),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'O registro fica salvo offline e é enviado ao servidor '
              'automaticamente quando você tiver internet.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
