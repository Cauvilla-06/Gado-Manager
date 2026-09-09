import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';

class OfflineReportScreen extends StatefulWidget {
  final List<Animal> animals;

  const OfflineReportScreen({super.key, required this.animals});

  @override
  State<OfflineReportScreen> createState() => _OfflineReportScreenState();
}

class _OfflineReportScreenState extends State<OfflineReportScreen> {
  final _db = DatabaseHelper.instance;
  final _auth = AuthService();
  late final ApiService _api = ApiService(_auth);

  List<_AnimalReport> _reports = [];
  bool _loading = true;
  bool _online = false;

  @override
  void initState() {
    super.initState();
    _loadReport();
  }

  Future<void> _loadReport() async {
    setState(() => _loading = true);

    _online = await _api.isOnline();

    if (_online) {
      try {
        final animals = await _api.fetchAnimals();
        await _db.replaceAnimals(animals);
      } catch (_) {
        _online = false;
      }
    }

    final animals = await _db.getAnimals();

    final reports = <_AnimalReport>[];
    for (final animal in animals) {
      final pendingRecords = await _db.getPendingRecordsForAnimal(animal.numero);

      int pesagens = 0;
      int vacinas = 0;
      int vermifugos = 0;
      int vitaminas = 0;

      for (final record in pendingRecords) {
        switch (record.tipo) {
          case RecordType.pesagem:
            pesagens++;
            break;
          case RecordType.vacina:
            vacinas++;
            break;
          case RecordType.vermifugo:
            vermifugos++;
            break;
          case RecordType.vitamina:
            vitaminas++;
            break;
          case RecordType.cadastro:
            break;
        }
      }

      reports.add(_AnimalReport(
        animal: animal,
        pesagens: pesagens,
        vacinas: vacinas,
        vermifugos: vermifugos,
        vitaminas: vitaminas,
      ));
    }

    if (!mounted) return;
    setState(() {
      _reports = reports;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final activeAnimals = _reports.where((r) => r.animal.status == 'ATIVO').length;
    final totalPesagens = _reports.fold(0, (sum, r) => sum + r.pesagens);
    final totalVacinas = _reports.fold(0, (sum, r) => sum + r.vacinas);
    final totalVermifugos = _reports.fold(0, (sum, r) => sum + r.vermifugos);
    final totalVitaminas = _reports.fold(0, (sum, r) => sum + r.vitaminas);
    final totalPending = totalPesagens + totalVacinas + totalVermifugos + totalVitaminas;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Relatório Offline'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Atualizar',
            onPressed: _loadReport,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadReport,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Status banner
                  Card(
                    color: _online ? Colors.green.shade50 : Colors.orange.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(
                            _online ? Icons.wifi : Icons.wifi_off,
                            color: _online ? Colors.green : Colors.orange,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _online ? 'Dados atualizados do servidor' : 'Dados do cache local',
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                                color: _online ? Colors.green.shade800 : Colors.orange.shade800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Resumo geral
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Resumo Geral',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 12),
                          _SummaryRow(label: 'Total de Animais', value: '${_reports.length}', icon: Icons.pets),
                          _SummaryRow(label: 'Ativos', value: '$activeAnimals', icon: Icons.check_circle, color: Colors.green),
                          _SummaryRow(label: 'Pendentes Sincronização', value: '$totalPending', icon: Icons.cloud_upload, color: Colors.orange),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Pie chart de distribuição de registros
                  if (totalPending > 0) ...[
                    _buildPieChart(totalPesagens, totalVacinas, totalVermifugos, totalVitaminas),
                    const SizedBox(height: 16),
                  ],

                  // Detalhes por animal
                  Text(
                    'Detalhes por Animal',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),

                  if (_reports.isEmpty)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Center(
                          child: Text(
                            'Nenhum animal cadastrado',
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                        ),
                      ),
                    )
                  else
                    ..._reports.map((report) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ExpansionTile(
                        leading: CircleAvatar(
                          backgroundColor: report.animal.status == 'ATIVO'
                              ? Colors.green.shade100
                              : Colors.grey.shade200,
                          child: Icon(
                            Icons.pets,
                            color: report.animal.status == 'ATIVO'
                                ? Colors.green.shade800
                                : Colors.grey.shade600,
                          ),
                        ),
                        title: Text(
                          'Boi #${report.animal.numero}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          '${report.totalRecords} registro(s) pendente(s)',
                          style: TextStyle(
                            fontSize: 12,
                            color: report.totalRecords > 0
                                ? Colors.orange.shade700
                                : Colors.grey,
                          ),
                        ),
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            child: Column(
                              children: [
                                _ReportRow(label: 'Pesagens', count: report.pesagens, icon: Icons.monitor_weight, color: Colors.green),
                                _ReportRow(label: 'Vacinas', count: report.vacinas, icon: Icons.vaccines, color: Colors.purple),
                                _ReportRow(label: 'Vermífugos', count: report.vermifugos, icon: Icons.bug_report, color: Colors.orange),
                                _ReportRow(label: 'Vitaminas', count: report.vitaminas, icon: Icons.medication, color: Colors.teal),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )),

                  const SizedBox(height: 24),

                  // Informações
                  Card(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Icon(Icons.info_outline, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Os registros listados estão salvos no aparelho e serão sincronizados com o servidor quando houver internet.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildPieChart(int pesagens, int vacinas, int vermifugos, int vitaminas) {
    final sections = <PieChartSectionData>[];
    if (pesagens > 0) {
      sections.add(PieChartSectionData(
        value: pesagens.toDouble(),
        title: '$pesagens',
        color: Colors.green,
        radius: 50,
        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (vacinas > 0) {
      sections.add(PieChartSectionData(
        value: vacinas.toDouble(),
        title: '$vacinas',
        color: Colors.purple,
        radius: 50,
        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (vermifugos > 0) {
      sections.add(PieChartSectionData(
        value: vermifugos.toDouble(),
        title: '$vermifugos',
        color: Colors.orange,
        radius: 50,
        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (vitaminas > 0) {
      sections.add(PieChartSectionData(
        value: vitaminas.toDouble(),
        title: '$vitaminas',
        color: Colors.teal,
        radius: 50,
        titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    if (sections.isEmpty) return const SizedBox();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Distribuição de Registros',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 200,
              child: PieChart(
                PieChartData(
                  sections: sections,
                  centerSpaceRadius: 30,
                  sectionsSpace: 2,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                if (pesagens > 0) _legendItem('Pesagens', Colors.green),
                if (vacinas > 0) _legendItem('Vacinas', Colors.purple),
                if (vermifugos > 0) _legendItem('Vermífugos', Colors.orange),
                if (vitaminas > 0) _legendItem('Vitaminas', Colors.teal),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _legendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }
}

class _AnimalReport {
  final Animal animal;
  final int pesagens;
  final int vacinas;
  final int vermifugos;
  final int vitaminas;

  _AnimalReport({
    required this.animal,
    required this.pesagens,
    required this.vacinas,
    required this.vermifugos,
    required this.vitaminas,
  });

  int get totalRecords => pesagens + vacinas + vermifugos + vitaminas;
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  const _SummaryRow({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color ?? Colors.grey.shade600),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14))),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportRow extends StatelessWidget {
  final String label;
  final int count;
  final IconData icon;
  final Color color;

  const _ReportRow({
    required this.label,
    required this.count,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 18, color: color),
      title: Text(label, style: const TextStyle(fontSize: 13)),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: count > 0 ? color.withAlpha(25) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          '$count',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: count > 0 ? color : Colors.grey,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
