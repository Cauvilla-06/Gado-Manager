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

  PendingRecord({
    required this.id,
    required this.tipo,
    required this.payload,
    required this.criadoEm,
  });
}
