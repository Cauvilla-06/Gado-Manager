import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/database_helper.dart';

/// Tela completa de edição offline de um registro pendente.
/// Permite editar TODOS os campos conforme o tipo de registro.
class EditRecordScreen extends StatefulWidget {
  final PendingRecord record;

  const EditRecordScreen({super.key, required this.record});

  @override
  State<EditRecordScreen> createState() => _EditRecordScreenState();
}

class _EditRecordScreenState extends State<EditRecordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _db = DatabaseHelper.instance;

  // Controllers
  late final TextEditingController _pesoCtrl;
  late final TextEditingController _nomeCtrl;
  late final TextEditingController _doseCtrl;
  late final TextEditingController _loteCtrl;
  late final TextEditingController _obsCtrl;

  // Dates
  late DateTime _dataAplicacao;
  DateTime? _dataProximaDose;

  late RecordType _tipo;
  late Map<String, dynamic> _payload;

  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _tipo = widget.record.tipo;
    _payload = Map<String, dynamic>.from(widget.record.payload);

    // Inicializar controllers a partir do payload existente
    _pesoCtrl = TextEditingController(
      text: _payload['pesoKg']?.toString() ?? '',
    );
    _nomeCtrl = TextEditingController(
      text: _payload['nomeVacina'] ??
          _payload['nomeVermifugo'] ??
          _payload['nomeVitamina'] ??
          '',
    );
    _doseCtrl = TextEditingController(
      text: _payload['dose']?.toString() ?? '',
    );
    _loteCtrl = TextEditingController(
      text: _payload['lote']?.toString() ?? '',
    );
    _obsCtrl = TextEditingController(
      text: _payload['observacao']?.toString() ?? '',
    );

    // Datas
    _dataAplicacao = _parseDate(
      _payload['dataPesagem'] ?? _payload['dataAplicacao'],
    );
    final proxStr = _payload['dataProximaDose'] as String?;
    _dataProximaDose = proxStr != null ? _parseDate(proxStr) : null;
  }

  DateTime _parseDate(dynamic value) {
    if (value == null) return DateTime.now();
    try {
      return DateTime.parse(value.toString());
    } catch (_) {
      return DateTime.now();
    }
  }

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
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    // Reconstruir payload completo com todos os campos
    final updatedPayload = <String, dynamic>{
      'clientGeneratedId': _payload['clientGeneratedId'],
      'animalNumero': _payload['animalNumero'],
    };

    switch (_tipo) {
      case RecordType.pesagem:
        updatedPayload['pesoKg'] =
            double.tryParse(_pesoCtrl.text.replaceAll(',', '.'));
        updatedPayload['dataPesagem'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        break;
      case RecordType.vacina:
        updatedPayload['nomeVacina'] = _nomeCtrl.text.trim();
        updatedPayload['dataAplicacao'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        if (_loteCtrl.text.trim().isNotEmpty) {
          updatedPayload['lote'] = _loteCtrl.text.trim();
        }
        break;
      case RecordType.vermifugo:
        updatedPayload['nomeVermifugo'] = _nomeCtrl.text.trim();
        updatedPayload['dataAplicacao'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        break;
      case RecordType.vitamina:
        updatedPayload['nomeVitamina'] = _nomeCtrl.text.trim();
        updatedPayload['dataAplicacao'] =
            DateFormat('yyyy-MM-dd').format(_dataAplicacao);
        break;
      case RecordType.cadastro:
        break;
    }

    // Dose (para vacina, vermífugo e vitamina)
    if (_tipo != RecordType.pesagem && _doseCtrl.text.trim().isNotEmpty) {
      updatedPayload['dose'] = _doseCtrl.text.trim();
    }

    // Próxima dose
    if (_tipo != RecordType.pesagem && _dataProximaDose != null) {
      updatedPayload['dataProximaDose'] =
          DateFormat('yyyy-MM-dd').format(_dataProximaDose!);
    } else if (_tipo != RecordType.pesagem) {
      updatedPayload.remove('dataProximaDose');
    }

    // Observação
    if (_obsCtrl.text.trim().isNotEmpty) {
      updatedPayload['observacao'] = _obsCtrl.text.trim();
    } else {
      updatedPayload.remove('observacao');
    }

    final updated = PendingRecord(
      id: widget.record.id,
      tipo: _tipo,
      payload: updatedPayload,
      criadoEm: widget.record.criadoEm,
      batchId: widget.record.batchId,
    );

    await _db.updatePendingRecord(updated);

    if (!mounted) return;
    setState(() => _saving = false);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Registro atualizado com sucesso'),
        backgroundColor: Colors.green,
      ),
    );
    Navigator.of(context).pop(true); // true = houve alteração
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Editar ${_tipo.label}'),
        actions: [
          TextButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.save),
            label: const Text('Salvar'),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Animal info (somente leitura)
            Card(
              color: Colors.blue.shade50,
              child: ListTile(
                leading: const Icon(Icons.pets, color: Colors.blue),
                title: Text(
                  'Boi #${_payload['animalNumero'] ?? '?'}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: const Text('Animal (não editável)'),
              ),
            ),
            const SizedBox(height: 16),

            // Tipo badge
            Card(
              child: ListTile(
                leading: Icon(_getIconForType(_tipo), color: _getColorForType(_tipo)),
                title: Text(_tipo.label, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(
                  'Criado em ${DateFormat('dd/MM/yyyy HH:mm').format(widget.record.criadoEm)}',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // === CAMPOS ESPECÍFICOS POR TIPO ===

            // PESAGEM
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
                  final val =
                      double.tryParse((v ?? '').replaceAll(',', '.'));
                  if (val == null || val <= 0 || val > 2000) {
                    return 'Informe um peso válido';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
            ],

            // VACINA / VERMÍFUGO / VITAMINA - Nome
            if (_tipo != RecordType.pesagem) ...[
              TextFormField(
                controller: _nomeCtrl,
                decoration: InputDecoration(
                  labelText: _getNomeLabel(),
                  hintText: _getNomeHint(),
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.label_outline),
                ),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Informe o nome' : null,
              ),
              const SizedBox(height: 16),
            ],

            // DOSE (vacina, vermífugo, vitamina)
            if (_tipo != RecordType.pesagem) ...[
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

            // LOTE (apenas vacina)
            if (_tipo == RecordType.vacina) ...[
              TextFormField(
                controller: _loteCtrl,
                decoration: const InputDecoration(
                  labelText: 'Lote (opcional)',
                  hintText: 'Ex.: LOTE-2024-A',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.inventory_2_outlined),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // DATA DA APLICAÇÃO/PESAGEM
            Card(
              margin: EdgeInsets.zero,
              child: ListTile(
                leading: const Icon(Icons.event),
                title: Text(
                  _tipo == RecordType.pesagem
                      ? 'Data da pesagem'
                      : 'Data de aplicação',
                ),
                subtitle: Text(
                  DateFormat('dd/MM/yyyy').format(_dataAplicacao),
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 15),
                ),
                trailing: const Icon(Icons.edit_calendar),
                onTap: () => _pickDate(
                  onPicked: (d) => setState(() => _dataAplicacao = d),
                ),
              ),
            ),

            // PRÓXIMA DOSE (vacina, vermífugo, vitamina)
            if (_tipo != RecordType.pesagem) ...[
              const SizedBox(height: 8),
              Card(
                margin: EdgeInsets.zero,
                child: ListTile(
                  leading: const Icon(Icons.event_repeat),
                  title: const Text('Próxima dose'),
                  subtitle: Text(
                    _dataProximaDose != null
                        ? DateFormat('dd/MM/yyyy').format(_dataProximaDose!)
                        : 'Não definida',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: _dataProximaDose != null
                          ? Colors.blue.shade700
                          : Colors.grey,
                    ),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_dataProximaDose != null)
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          tooltip: 'Remover data',
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

            // OBSERVAÇÃO
            TextFormField(
              controller: _obsCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Observação (opcional)',
                hintText: 'Adicione detalhes, anotações...',
                border: OutlineInputBorder(),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 32),

            // BOTÃO SALVAR
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.save),
              label: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(_saving ? 'Salvando...' : 'Salvar Alterações'),
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  String _getNomeLabel() {
    switch (_tipo) {
      case RecordType.vacina:
        return 'Nome da vacina';
      case RecordType.vermifugo:
        return 'Nome do vermífugo';
      case RecordType.vitamina:
        return 'Nome da vitamina';
      default:
        return 'Nome';
    }
  }

  String _getNomeHint() {
    switch (_tipo) {
      case RecordType.vacina:
        return 'Ex.: Aftosa';
      case RecordType.vermifugo:
        return 'Ex.: Ivomec';
      case RecordType.vitamina:
        return 'Ex.: Vitamina AD';
      default:
        return '';
    }
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

  Color _getColorForType(RecordType tipo) {
    switch (tipo) {
      case RecordType.pesagem:
        return Colors.green;
      case RecordType.vacina:
        return Colors.purple;
      case RecordType.vermifugo:
        return Colors.orange;
      case RecordType.vitamina:
        return Colors.teal;
      case RecordType.cadastro:
        return Colors.blue;
    }
  }
}
