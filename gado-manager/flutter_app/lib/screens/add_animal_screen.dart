import 'package:flutter/material.dart';

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

  @override
  void dispose() {
    _numeroCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);

    final numero = _numeroCtrl.text.trim();
    final clientId = ApiService.newClientId();

    // Salva offline como registro pendente (mesmo sistema de pesagem/vacinas)
    await _db.insertPendingRecord(PendingRecord(
      id: clientId,
      tipo: RecordType.cadastro,
      payload: {
        'clientGeneratedId': clientId,
        'numeroIdentificacao': numero,
        // animalNumero é usado pelo DatabaseHelper para indexar pendentes
        'animalNumero': numero,
      },
      criadoEm: DateTime.now(),
    ));

    if (!mounted) return;
    setState(() => _saving = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Boi #$numero salvo! Será cadastrado quando houver internet.',
        ),
        backgroundColor: Colors.green.shade700,
      ),
    );

    Navigator.of(context).pop(true); // return true = created
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
                        'Se estiver offline, será enviado quando houver internet.',
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
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _save(),
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
                child: Text(_saving ? 'Salvando...' : 'Cadastrar Boi'),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'O cadastro fica salvo offline e é enviado ao servidor '
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
