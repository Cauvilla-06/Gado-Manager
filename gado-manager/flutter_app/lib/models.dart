/// Modelos de dados do app.
library;

class Farm {
  final String id;
  final String name;
  final String code;
  final String role;
  final int animalCount;
  final int memberCount;

  Farm({
    required this.id,
    required this.name,
    required this.code,
    this.role = 'MEMBER',
    this.animalCount = 0,
    this.memberCount = 0,
  });

  factory Farm.fromJson(Map<String, dynamic> json) => Farm(
        id: json['id'] as String,
        name: json['name'] as String,
        code: (json['code'] as String?) ?? '',
        role: (json['role'] as String?) ?? 'MEMBER',
        animalCount: (json['animalCount'] as num?)?.toInt() ?? 0,
        memberCount: (json['memberCount'] as num?)?.toInt() ?? 0,
      );
}

class Animal {
  final String id;
  final String numero;
  final String status;
  final String? farmId;

  Animal({required this.id, required this.numero, required this.status, this.farmId});

  factory Animal.fromJson(Map<String, dynamic> json) => Animal(
        id: json['id'] as String,
        numero: json['numeroIdentificacao'] as String,
        status: (json['status'] as String?) ?? 'ATIVO',
        farmId: json['farmId'] as String?,
      );

  Map<String, dynamic> toMap() => {'id': id, 'numero': numero, 'status': status};

  factory Animal.fromMap(Map<String, dynamic> map) => Animal(
        id: map['id'] as String,
        numero: map['numero'] as String,
        status: (map['status'] as String?) ?? 'ATIVO',
      );
}

/// Dados detalhados do animal vindos do servidor (com ciclos e registros).
class AnimalDetail {
  final String id;
  final String numeroIdentificacao;
  final String status;
  final List<CycleData> ciclos;

  AnimalDetail({
    required this.id,
    required this.numeroIdentificacao,
    required this.status,
    required this.ciclos,
  });

  factory AnimalDetail.fromJson(Map<String, dynamic> json) => AnimalDetail(
        id: json['id'] as String,
        numeroIdentificacao: json['numeroIdentificacao'] as String,
        status: (json['status'] as String?) ?? 'ATIVO',
        ciclos: (json['ciclos'] as List?)
                ?.map((c) => CycleData.fromJson(c as Map<String, dynamic>))
                .toList() ?? [],
      );

  CycleData? get activeCycle {
    try {
      return ciclos.firstWhere((c) => c.status == 'ATIVO');
    } catch (_) {
      return ciclos.isNotEmpty ? ciclos.first : null;
    }
  }
}

class CycleData {
  final String id;
  final int numeroCiclo;
  final String status;
  final String dataInicio;
  final String? dataFim;
  final List<WeightData> pesagens;
  final List<VaccineData> vacinas;
  final List<VermifugeData> vermifugos;
  final List<VitaminData> vitaminas;

  CycleData({
    required this.id,
    required this.numeroCiclo,
    required this.status,
    required this.dataInicio,
    this.dataFim,
    required this.pesagens,
    required this.vacinas,
    required this.vermifugos,
    required this.vitaminas,
  });

  factory CycleData.fromJson(Map<String, dynamic> json) => CycleData(
        id: json['id'] as String,
        numeroCiclo: (json['numeroCiclo'] as num?)?.toInt() ?? 0,
        status: (json['status'] as String?) ?? 'ATIVO',
        dataInicio: json['dataInicio'] as String,
        dataFim: json['dataFim'] as String?,
        pesagens: (json['pesagens'] as List?)
                ?.map((p) => WeightData.fromJson(p as Map<String, dynamic>))
                .toList() ?? [],
        vacinas: (json['vacinas'] as List?)
                ?.map((v) => VaccineData.fromJson(v as Map<String, dynamic>))
                .toList() ?? [],
        vermifugos: (json['vermifugos'] as List?)
                ?.map((v) => VermifugeData.fromJson(v as Map<String, dynamic>))
                .toList() ?? [],
        vitaminas: (json['vitaminas'] as List?)
                ?.map((v) => VitaminData.fromJson(v as Map<String, dynamic>))
                .toList() ?? [],
      );
}

class WeightData {
  final String id;
  final double pesoKg;
  final String dataPesagem;
  final String? observacao;

  WeightData({
    required this.id,
    required this.pesoKg,
    required this.dataPesagem,
    this.observacao,
  });

  factory WeightData.fromJson(Map<String, dynamic> json) => WeightData(
        id: json['id'] as String,
        pesoKg: (json['pesoKg'] as num).toDouble(),
        dataPesagem: json['dataPesagem'] as String,
        observacao: json['observacao'] as String?,
      );
}

class VaccineData {
  final String id;
  final String nomeVacina;
  final String dataAplicacao;
  final String? dataProximaDose;
  final String? lote;
  final String? observacao;

  VaccineData({
    required this.id,
    required this.nomeVacina,
    required this.dataAplicacao,
    this.dataProximaDose,
    this.lote,
    this.observacao,
  });

  factory VaccineData.fromJson(Map<String, dynamic> json) => VaccineData(
        id: json['id'] as String,
        nomeVacina: json['nomeVacina'] as String,
        dataAplicacao: json['dataAplicacao'] as String,
        dataProximaDose: json['dataProximaDose'] as String?,
        lote: json['lote'] as String?,
        observacao: json['observacao'] as String?,
      );
}

class VermifugeData {
  final String id;
  final String nomeVermifugo;
  final String? dose;
  final String dataAplicacao;
  final String? dataProximaDose;
  final String? observacao;

  VermifugeData({
    required this.id,
    required this.nomeVermifugo,
    this.dose,
    required this.dataAplicacao,
    this.dataProximaDose,
    this.observacao,
  });

  factory VermifugeData.fromJson(Map<String, dynamic> json) => VermifugeData(
        id: json['id'] as String,
        nomeVermifugo: json['nomeVermifugo'] as String,
        dose: json['dose'] as String?,
        dataAplicacao: json['dataAplicacao'] as String,
        dataProximaDose: json['dataProximaDose'] as String?,
        observacao: json['observacao'] as String?,
      );
}

class VitaminData {
  final String id;
  final String nomeVitamina;
  final String? dose;
  final String dataAplicacao;
  final String? dataProximaDose;
  final String? observacao;

  VitaminData({
    required this.id,
    required this.nomeVitamina,
    this.dose,
    required this.dataAplicacao,
    this.dataProximaDose,
    this.observacao,
  });

  factory VitaminData.fromJson(Map<String, dynamic> json) => VitaminData(
        id: json['id'] as String,
        nomeVitamina: json['nomeVitamina'] as String,
        dose: json['dose'] as String?,
        dataAplicacao: json['dataAplicacao'] as String,
        dataProximaDose: json['dataProximaDose'] as String?,
        observacao: json['observacao'] as String?,
      );
}

/// Tipos de registro suportados offline.
enum RecordType { pesagem, vacina, vermifugo, vitamina, cadastro }

extension RecordTypeX on RecordType {
  String get key {
    switch (this) {
      case RecordType.pesagem:
        return 'PESAGEM';
      case RecordType.vacina:
        return 'VACINA';
      case RecordType.vermifugo:
        return 'VERMIFUGO';
      case RecordType.vitamina:
        return 'VITAMINA';
      case RecordType.cadastro:
        return 'CADASTRO';
    }
  }

  String get label {
    switch (this) {
      case RecordType.pesagem:
        return 'Pesagem';
      case RecordType.vacina:
        return 'Vacina';
      case RecordType.vermifugo:
        return 'Vermífugo';
      case RecordType.vitamina:
        return 'Vitamina';
      case RecordType.cadastro:
        return 'Cadastro de Animal';
    }
  }
}

class PendingRecord {
  final String id;
  final RecordType tipo;
  final Map<String, dynamic> payload;
  final DateTime criadoEm;
  final String? batchId;

  PendingRecord({
    required this.id,
    required this.tipo,
    required this.payload,
    required this.criadoEm,
    this.batchId,
  });
}
