import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models.dart';
import '../services/api_service.dart';
import '../services/database_helper.dart';
import 'add_record_screen.dart';
import 'edit_animal_screen.dart';
import 'edit_record_screen.dart';

class AnimalDetailScreen extends StatefulWidget {
  final Animal animal;
  final List<Animal> allAnimals;

  const AnimalDetailScreen({
    super.key,
    required this.animal,
    required this.allAnimals,
  });

  @override
  State<AnimalDetailScreen> createState() => _AnimalDetailScreenState();
}

class _AnimalDetailScreenState extends State<AnimalDetailScreen> {
  final _auth = AuthService();
  late final ApiService _api = ApiService(_auth);
  final _db = DatabaseHelper.instance;

  AnimalDetail? _detail;
  bool _loading = true;
  bool _online = false;
  Timer? _autoRefreshTimer;

  @override
  void initState() {
    super.initState();
    _loadDetail();
    _autoRefreshTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => _loadDetailSilent(),
    );
  }

  @override
  void dispose() {
    _autoRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadDetail() async {
    // 1. Carrega do cache IMEDIATAMENTE (sem spinner)
    final cached = await _db.getCachedAnimalDetail(widget.animal.id);
    if (mounted && cached != null) {
      setState(() { _detail = cached; _loading = false; });
    } else if (mounted) {
      setState(() => _loading = true);
    }

    // 2. Se online, busca do servidor e atualiza cache
    _online = await _api.isOnline();
    if (_online) {
      try {
        final detail = await _api.fetchAnimalDetail(widget.animal.id);
        if (detail != null) {
          await _db.cacheAnimalDetail(widget.animal.id, detail);
        }
        if (mounted && detail != null) setState(() => _detail = detail);
        return;
      } catch (_) {}
    }
    // 3. Sem cache e sem servidor — mostra pelo menos info básica do animal
    if (mounted && _detail == null) {
      // Cria um detail vazio a partir do animal local
      setState(() {
        _detail = AnimalDetail(
          id: widget.animal.id,
          numeroIdentificacao: widget.animal.numero,
          status: widget.animal.status,
          ciclos: [],
        );
        _loading = false;
      });
    }
  }

  Future<void> _loadDetailSilent() async {
    if (!await _api.isOnline()) return;
    try {
      final detail = await _api.fetchAnimalDetail(widget.animal.id, maxRetries: 1);
      if (detail != null) {
        await _db.cacheAnimalDetail(widget.animal.id, detail);
        if (mounted) setState(() => _detail = detail);
      }
    } catch (_) {}
  }

  void _openRecord([RecordType? tipo]) async {
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => AddRecordScreen(
        animals: widget.allAnimals,
        preSelectedAnimal: widget.animal,
      ),
    ));
    _loadDetailSilent();
  }

  @override
  Widget build(BuildContext context) {
    final cycle = _detail?.activeCycle;
    final report = cycle != null ? _computeReport(cycle) : null;
    final chartData = _buildChartData(cycle);

    return Scaffold(
      appBar: AppBar(
        title: Text('Boi #${widget.animal.numero}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadDetail,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openRecord(),
        icon: const Icon(Icons.add),
        label: const Text('Novo Registro'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadDetail,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Status chip
                  _buildStatusChip(),
                  const SizedBox(height: 16),

                  // Quick action buttons
                  _buildQuickActions(),
                  const SizedBox(height: 16),

                  // Stats cards (if we have server data)
                  if (report != null) ...[
                    _buildStatsCards(report),
                    const SizedBox(height: 16),
                    _buildInterpretation(report),
                    const SizedBox(height: 16),
                  ],

                  // Weight chart (if we have server data)
                  if (chartData.length > 1) ...[
                    _buildWeightChart(chartData),
                    const SizedBox(height: 16),
                  ],

                  // Record history
                  if (cycle != null) ...[
                    _buildPesagensSection(cycle),
                    const SizedBox(height: 12),
                    _buildVacinasSection(cycle),
                    const SizedBox(height: 12),
                    if (cycle.vermifugos.isNotEmpty)
                      _buildVermifugosSection(cycle),
                    if (cycle.vermifugos.isNotEmpty)
                      const SizedBox(height: 12),
                    if (cycle.vitaminas.isNotEmpty)
                      _buildVitaminasSection(cycle),
                    if (cycle.vitaminas.isNotEmpty)
                      const SizedBox(height: 12),
                  ],

                  // Pending records
                  _buildPendingSection(),
                  const SizedBox(height: 80),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusChip() {
    final isActive = widget.animal.status == 'ATIVO';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: isActive ? Colors.green.shade100 : Colors.grey.shade200,
              radius: 24,
              child: Icon(
                Icons.pets,
                color: isActive ? Colors.green.shade800 : Colors.grey.shade600,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Boi #${widget.animal.numero}',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        isActive ? Icons.check_circle : Icons.info_outline,
                        size: 14,
                        color: isActive ? Colors.green : Colors.grey,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        widget.animal.status,
                        style: TextStyle(
                          fontSize: 13,
                          color: isActive ? Colors.green.shade700 : Colors.grey.shade600,
                        ),
                      ),
                      if (_detail?.activeCycle != null) ...[
                        const SizedBox(width: 12),
                        Icon(Icons.loop, size: 14, color: Colors.blue.shade600),
                        const SizedBox(width: 4),
                        Text(
                          'Ciclo ${_detail!.activeCycle!.numeroCiclo}',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.blue.shade700,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _actionButton(
          'Pesagem',
          Icons.monitor_weight_outlined,
          Colors.green,
          () => _openRecord(RecordType.pesagem),
        ),
        _actionButton(
          'Vacina',
          Icons.vaccines,
          Colors.purple,
          () => _openRecord(RecordType.vacina),
        ),
        _actionButton(
          'Vermífugo',
          Icons.bug_report,
          Colors.orange,
          () => _openRecord(RecordType.vermifugo),
        ),
        _actionButton(
          'Vitamina',
          Icons.medication,
          Colors.teal,
          () => _openRecord(RecordType.vitamina),
        ),
      ],
    );
  }

  Widget _actionButton(String label, IconData icon, Color color, VoidCallback onTap) {
    return ActionChip(
      avatar: Icon(icon, size: 18, color: color),
      label: Text(label, style: TextStyle(fontSize: 13, color: color)),
      onPressed: onTap,
      backgroundColor: color.withAlpha(20),
      side: BorderSide(color: color.withAlpha(60)),
    );
  }

  Widget _buildStatsCards(_ReportData report) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Resumo',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 8),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 8,
          crossAxisSpacing: 8,
          childAspectRatio: 1.6,
          children: [
            _statCard('Peso Atual', report.pesoAtual != null ? '${report.pesoAtual!.toStringAsFixed(1)} kg' : '—', Icons.monitor_weight, Colors.green),
            _statCard('Peso Inicial', report.pesoInicial != null ? '${report.pesoInicial!.toStringAsFixed(1)} kg' : '—', Icons.monitor_weight, Colors.blue),
            _statCard(
              'Ganho',
              report.ganhoKg != null ? '${report.ganhoKg! >= 0 ? '+' : ''}${report.ganhoKg!.toStringAsFixed(1)} kg' : '—',
              report.ganhoKg != null && report.ganhoKg! >= 0 ? Icons.trending_up : Icons.trending_down,
              report.ganhoKg != null && report.ganhoKg! >= 0 ? Colors.green : Colors.red,
            ),
            _statCard(
              'Evolução',
              report.ganhoPercentual != null ? '${report.ganhoPercentual! >= 0 ? '+' : ''}${report.ganhoPercentual!.toStringAsFixed(2)}%' : '—',
              Icons.show_chart,
              report.ganhoPercentual != null && report.ganhoPercentual! >= 0 ? Colors.green : Colors.red,
            ),
          ],
        ),
      ],
    );
  }

  Widget _statCard(String label, String value, IconData icon, Color color) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, size: 14, color: color),
                const SizedBox(width: 4),
                Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInterpretation(_ReportData report) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(report.interpretacao, style: const TextStyle(fontSize: 13)),
      ),
    );
  }

  Widget _buildWeightChart(List<FlSpot> spots) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Evolução do Peso',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 220,
              child: LineChart(
                LineChartData(
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    horizontalInterval: _calcInterval(spots),
                    getDrawingHorizontalLine: (value) => FlLine(
                      color: Colors.grey.shade200,
                      strokeWidth: 1,
                    ),
                  ),
                  titlesData: FlTitlesData(
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 45,
                        getTitlesWidget: (value, meta) => Text(
                          '${value.toInt()}',
                          style: const TextStyle(fontSize: 10),
                        ),
                      ),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 24,
                        getTitlesWidget: (value, meta) {
                          final idx = value.toInt();
                          if (idx < 0 || idx >= _chartLabels.length) return const SizedBox();
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              _chartLabels[idx],
                              style: const TextStyle(fontSize: 9),
                            ),
                          );
                        },
                      ),
                    ),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  borderData: FlBorderData(show: false),
                  minX: 0,
                  maxX: (spots.length - 1).toDouble(),
                  lineBarsData: [
                    LineChartBarData(
                      spots: spots,
                      isCurved: true,
                      color: Colors.green,
                      barWidth: 2.5,
                      isStrokeCapRound: true,
                      dotData: FlDotData(
                        show: true,
                        getDotPainter: (spot, percent, barData, index) =>
                            FlDotCirclePainter(
                          radius: 4,
                          color: Colors.green,
                          strokeWidth: 2,
                          strokeColor: Colors.white,
                        ),
                      ),
                      belowBarData: BarAreaData(
                        show: true,
                        color: Colors.green.withAlpha(30),
                      ),
                    ),
                  ],
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (touchedSpots) {
                        return touchedSpots.map((spot) {
                          return LineTooltipItem(
                            '${spot.y.toStringAsFixed(1)} kg',
                            const TextStyle(color: Colors.white, fontSize: 12),
                          );
                        }).toList();
                      },
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  double _calcInterval(List<FlSpot> spots) {
    if (spots.isEmpty) return 1;
    final values = spots.map((s) => s.y).toList();
    final min = values.reduce((a, b) => a < b ? a : b);
    final max = values.reduce((a, b) => a > b ? a : b);
    final range = max - min;
    if (range <= 0) return 1;
    return (range / 4).ceilToDouble();
  }

  List<String> _chartLabels = [];
  List<FlSpot> _buildChartData(CycleData? cycle) {
    if (cycle == null) return [];
    final sorted = [...cycle.pesagens]
      ..sort((a, b) => a.dataPesagem.compareTo(b.dataPesagem));
    _chartLabels = sorted.map((p) {
      final d = DateTime.parse(p.dataPesagem);
      return DateFormat('dd/MM').format(d);
    }).toList();
    return sorted.asMap().entries.map((entry) {
      return FlSpot(entry.key.toDouble(), entry.value.pesoKg);
    }).toList();
  }

  Widget _buildPesagensSection(CycleData cycle) {
    final sorted = [...cycle.pesagens]
      ..sort((a, b) => b.dataPesagem.compareTo(a.dataPesagem));
    return _historySection(
      'Pesagens',
      Icons.monitor_weight,
      Colors.green,
      sorted.isEmpty,
      'Nenhuma pesagem registrada',
      sorted.map((p) {
        final date = DateFormat('dd/MM/yyyy').format(DateTime.parse(p.dataPesagem));
        return ListTile(
          dense: true,
          leading: const Icon(Icons.monitor_weight, size: 18, color: Colors.green),
          title: Text('${p.pesoKg.toStringAsFixed(1)} kg', style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(date + (p.observacao != null ? ' • ${p.observacao}' : '')),
        );
      }).toList(),
    );
  }

  Widget _buildVacinasSection(CycleData cycle) {
    final sorted = [...cycle.vacinas]
      ..sort((a, b) => b.dataAplicacao.compareTo(a.dataAplicacao));
    return _historySection(
      'Vacinas',
      Icons.vaccines,
      Colors.purple,
      sorted.isEmpty,
      'Nenhuma vacina registrada',
      sorted.map((v) {
        final date = DateFormat('dd/MM/yyyy').format(DateTime.parse(v.dataAplicacao));
        return ListTile(
          dense: true,
          leading: const Icon(Icons.vaccines, size: 18, color: Colors.purple),
          title: Text(v.nomeVacina, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(date + (v.lote != null ? ' • Lote: ${v.lote}' : '')),
          trailing: v.dataProximaDose != null
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('Próx. dose', style: TextStyle(fontSize: 10, color: Colors.grey)),
                    Text(
                      DateFormat('dd/MM').format(DateTime.parse(v.dataProximaDose!)),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                )
              : null,
        );
      }).toList(),
    );
  }

  Widget _buildVermifugosSection(CycleData cycle) {
    final sorted = [...cycle.vermifugos]
      ..sort((a, b) => b.dataAplicacao.compareTo(a.dataAplicacao));
    return _historySection(
      'Vermífugos',
      Icons.bug_report,
      Colors.orange,
      false,
      '',
      sorted.map((v) {
        final date = DateFormat('dd/MM/yyyy').format(DateTime.parse(v.dataAplicacao));
        return ListTile(
          dense: true,
          leading: const Icon(Icons.bug_report, size: 18, color: Colors.orange),
          title: Text(v.nomeVermifugo, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(date + (v.dose != null ? ' • Dose: ${v.dose}' : '')),
        );
      }).toList(),
    );
  }

  Widget _buildVitaminasSection(CycleData cycle) {
    final sorted = [...cycle.vitaminas]
      ..sort((a, b) => b.dataAplicacao.compareTo(a.dataAplicacao));
    return _historySection(
      'Vitaminas',
      Icons.medication,
      Colors.teal,
      false,
      '',
      sorted.map((v) {
        final date = DateFormat('dd/MM/yyyy').format(DateTime.parse(v.dataAplicacao));
        return ListTile(
          dense: true,
          leading: const Icon(Icons.medication, size: 18, color: Colors.teal),
          title: Text(v.nomeVitamina, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(date + (v.dose != null ? ' • Dose: ${v.dose}' : '')),
        );
      }).toList(),
    );
  }

  Widget _historySection(
    String title,
    IconData icon,
    Color color,
    bool isEmpty,
    String emptyMsg,
    List<Widget> children,
  ) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                Icon(icon, size: 18, color: color),
                const SizedBox(width: 8),
                Text(title, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
                const Spacer(),
                Text('${children.length}', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
          if (isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: Text(emptyMsg, style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
              ),
            )
          else
            ...children,
        ],
      ),
    );
  }

  Widget _buildPendingSection() {
    return FutureBuilder<List<PendingRecord>>(
      future: _db.getPendingRecordsForAnimal(widget.animal.numero),
      builder: (context, snapshot) {
        final pending = snapshot.data ?? [];
        if (pending.isEmpty) return const SizedBox();
        return Card(
          color: Colors.orange.shade50,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Row(
                  children: [
                    const Icon(Icons.cloud_upload_outlined, size: 18, color: Colors.orange),
                    const SizedBox(width: 8),
                    Text(
                      'Registros Pendentes',
                      style: TextStyle(fontWeight: FontWeight.bold, color: Colors.orange.shade800),
                    ),
                    const Spacer(),
                    Text('${pending.length}', style: TextStyle(fontSize: 12, color: Colors.orange.shade600)),
                  ],
                ),
              ),
              ...pending.map((r) {
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
                    detail = 'Cadastro - $date';
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
                        onPressed: () => _editPending(r),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, size: 18),
                        onPressed: () => _deletePending(r),
                      ),
                    ],
                  ),
                );
              }),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  IconData _getIconForType(RecordType tipo) {
    switch (tipo) {
      case RecordType.pesagem: return Icons.monitor_weight_outlined;
      case RecordType.vacina: return Icons.vaccines;
      case RecordType.vermifugo: return Icons.bug_report;
      case RecordType.vitamina: return Icons.medication;
      case RecordType.cadastro: return Icons.pets;
    }
  }

  Future<void> _editPending(PendingRecord record) async {
    if (record.tipo == RecordType.cadastro) {
      // Busca registros vinculados (mesmo batchId)
      final all = await _db.getPendingRecords();
      final linked = all
          .where((r) => r.batchId == record.batchId && r.id != record.id)
          .toList();

      if (mounted) {
        await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) => EditAnimalScreen(
              cadastroRecord: record,
              linkedRecords: linked,
            ),
          ),
        );
        setState(() {});
      }
      return;
    }

    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => EditRecordScreen(record: record),
      ),
    );
    if (changed == true && mounted) {
      setState(() {});
    }
  }

  Future<void> _deletePending(PendingRecord record) async {
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
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registro excluído'), backgroundColor: Colors.orange),
        );
      }
    }
  }

  _ReportData _computeReport(CycleData cycle) {
    final pesos = cycle.pesagens.map((p) => p.pesoKg).toList();
    final pesoInicial = pesos.isNotEmpty ? pesos.first : null;
    final pesoAtual = pesos.isNotEmpty ? pesos.last : null;
    final ganhoKg = (pesoInicial != null && pesoAtual != null)
        ? (pesoAtual - pesoInicial)
        : null;
    final ganhoPercentual = (pesoInicial != null && pesoAtual != null && pesoInicial > 0)
        ? ((pesoAtual - pesoInicial) / pesoInicial * 100)
        : null;

    String interpretacao = 'Dados insuficientes para análise.';
    if (pesoAtual != null && pesoInicial != null) {
      if (ganhoKg! > 0) {
        interpretacao = 'Peso aumentou ${ganhoKg.abs().toStringAsFixed(1)} kg (+${ganhoPercentual!.abs().toStringAsFixed(2)}%) desde a primeira pesagem.';
      } else if (ganhoKg < 0) {
        interpretacao = 'Peso reduziu ${ganhoKg.abs().toStringAsFixed(1)} kg (${ganhoPercentual!.toStringAsFixed(2)}%) desde a primeira pesagem.';
      } else {
        interpretacao = 'Não houve alteração significativa no período.';
      }
    }

    return _ReportData(
      pesoAtual: pesoAtual,
      pesoInicial: pesoInicial,
      ganhoKg: ganhoKg,
      ganhoPercentual: ganhoPercentual,
      interpretacao: interpretacao,
    );
  }
}

class _ReportData {
  final double? pesoAtual;
  final double? pesoInicial;
  final double? ganhoKg;
  final double? ganhoPercentual;
  final String interpretacao;

  _ReportData({
    this.pesoAtual,
    this.pesoInicial,
    this.ganhoKg,
    this.ganhoPercentual,
    required this.interpretacao,
  });
}
