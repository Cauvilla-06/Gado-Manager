import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../models.dart';

/// Banco local (SQLite) para uso 100% offline.
class DatabaseHelper {
  DatabaseHelper._();
  static final DatabaseHelper instance = DatabaseHelper._();

  static const _dbName = 'gado_manager.db';
  static const _dbVersion = 3;

  Database? _db;

  Future<Database> get database async {
    _db ??= await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, _dbName),
      version: _dbVersion,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE animals (
            id TEXT PRIMARY KEY,
            numero TEXT NOT NULL,
            status TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE pending_records (
            id TEXT PRIMARY KEY,
            tipo TEXT NOT NULL,
            animal_numero TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            criado_em TEXT NOT NULL,
            batch_id TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE animal_cache (
            animal_id TEXT PRIMARY KEY,
            detail_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          try {
            await db.execute('ALTER TABLE pending_records ADD COLUMN batch_id TEXT');
          } catch (_) {}
        }
        if (oldVersion < 3) {
          try {
            await db.execute('''
              CREATE TABLE IF NOT EXISTS animal_cache (
                animal_id TEXT PRIMARY KEY,
                detail_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
              )
            ''');
          } catch (_) {}
        }
      },
    );
  }

  // ---------- Animais (cache offline) ----------

  Future<void> replaceAnimals(List<Animal> animals) async {
    final db = await database;
    final batch = db.batch();
    batch.delete('animals');
    for (final a in animals) {
      batch.insert('animals', a.toMap());
    }
    await batch.commit(noResult: true);
  }

  Future<List<Animal>> getAnimals() async {
    final db = await database;
    final rows = await db.query('animals', orderBy: 'numero ASC');
    return rows.map(Animal.fromMap).toList();
  }

  // ---------- Registros pendentes ----------

  Future<void> insertPendingRecord(PendingRecord record) async {
    final db = await database;
    await db.insert('pending_records', {
      'id': record.id,
      'tipo': record.tipo.key,
      'animal_numero': record.payload['animalNumero'] as String,
      'payload_json': jsonEncode(record.payload),
      'criado_em': record.criadoEm.toIso8601String(),
      'batch_id': record.batchId,
    });
  }

  Future<List<PendingRecord>> getPendingRecords() async {
    final db = await database;
    final rows = await db.query('pending_records', orderBy: 'criado_em ASC');
    return rows.map((row) {
      return PendingRecord(
        id: row['id'] as String,
        tipo: RecordType.values.firstWhere(
          (t) => t.key == row['tipo'],
          orElse: () => RecordType.pesagem,
        ),
        payload:
            (jsonDecode(row['payload_json'] as String) as Map).cast<String, dynamic>(),
        criadoEm: DateTime.parse(row['criado_em'] as String),
        batchId: row['batch_id'] as String?,
      );
    }).toList();
  }

  /// Get pending records grouped by batchId.
  /// Records without a batchId are in their own 'solo' group.
  Map<String, List<PendingRecord>> getPendingRecordsGrouped() {
    final grouped = <String, List<PendingRecord>>{};
    for (final record in _cachedPendingRecords) {
      final batchKey = record.batchId ?? record.id;
      grouped.putIfAbsent(batchKey, () => []).add(record);
    }
    return grouped;
  }

  List<PendingRecord> _cachedPendingRecords = [];

  Future<Map<String, List<PendingRecord>>> getPendingRecordsGroupedAsync() async {
    final records = await getPendingRecords();
    _cachedPendingRecords = records;
    return getPendingRecordsGrouped();
  }

  Future<int> countPendingRecords() async {
    final db = await database;
    final result = await db.rawQuery('SELECT COUNT(*) AS n FROM pending_records');
    return (result.first['n'] as int?) ?? 0;
  }

  /// Get distinct animal numbers from pending records
  Future<List<String>> getPendingAnimalNumbers() async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT DISTINCT animal_numero FROM pending_records'
    );
    return result.map((r) => r['animal_numero'] as String).toList();
  }

  /// Get all pending records for a specific animal numero
  Future<List<PendingRecord>> getPendingRecordsForAnimal(String numero) async {
    final db = await database;
    final rows = await db.query(
      'pending_records',
      where: 'animal_numero = ?',
      whereArgs: [numero],
      orderBy: 'criado_em ASC',
    );
    return rows.map((row) {
      return PendingRecord(
        id: row['id'] as String,
        tipo: RecordType.values.firstWhere(
          (t) => t.key == row['tipo'],
          orElse: () => RecordType.pesagem,
        ),
        payload:
            (jsonDecode(row['payload_json'] as String) as Map).cast<String, dynamic>(),
        criadoEm: DateTime.parse(row['criado_em'] as String),
        batchId: row['batch_id'] as String?,
      );
    }).toList();
  }

  /// Remove do banco local os registros que foram confirmados pelo servidor.
  Future<void> deleteSyncedRecords(Set<String> syncedIds) async {
    if (syncedIds.isEmpty) return;
    final db = await database;
    await db.delete(
      'pending_records',
      where: 'id IN (${List.filled(syncedIds.length, '?').join(',')})',
      whereArgs: syncedIds.toList(),
    );
  }

  Future<void> deletePendingRecord(String id) async {
    final db = await database;
    await db.delete('pending_records', where: 'id = ?', whereArgs: [id]);
  }

  /// Atualiza um registro pendente existente (para edição offline).
  Future<void> updatePendingRecord(PendingRecord record) async {
    final db = await database;
    await db.update(
      'pending_records',
      {
        'tipo': record.tipo.key,
        'animal_numero': record.payload['animalNumero'] as String,
        'payload_json': jsonEncode(record.payload),
        'criado_em': record.criadoEm.toIso8601String(),
        'batch_id': record.batchId,
      },
      where: 'id = ?',
      whereArgs: [record.id],
    );
  }

  // ---------- Cache de dados do servidor (offline) ----------

  /// Salva o AnimalDetail no cache local para uso offline.
  Future<void> cacheAnimalDetail(String animalId, AnimalDetail detail) async {
    final db = await database;
    await db.insert(
      'animal_cache',
      {
        'animal_id': animalId,
        'detail_json': jsonEncode({
          'id': detail.id,
          'numeroIdentificacao': detail.numeroIdentificacao,
          'status': detail.status,
          'ciclos': detail.ciclos.map((c) => {
            'id': c.id,
            'numeroCiclo': c.numeroCiclo,
            'status': c.status,
            'dataInicio': c.dataInicio,
            'dataFim': c.dataFim,
            'pesagens': c.pesagens.map((p) => {
              'id': p.id, 'pesoKg': p.pesoKg,
              'dataPesagem': p.dataPesagem, 'observacao': p.observacao,
            }).toList(),
            'vacinas': c.vacinas.map((v) => {
              'id': v.id, 'nomeVacina': v.nomeVacina,
              'dataAplicacao': v.dataAplicacao, 'dataProximaDose': v.dataProximaDose,
              'lote': v.lote, 'observacao': v.observacao,
            }).toList(),
            'vermifugos': c.vermifugos.map((v) => {
              'id': v.id, 'nomeVermifugo': v.nomeVermifugo,
              'dose': v.dose, 'dataAplicacao': v.dataAplicacao,
              'dataProximaDose': v.dataProximaDose, 'observacao': v.observacao,
            }).toList(),
            'vitaminas': c.vitaminas.map((v) => {
              'id': v.id, 'nomeVitamina': v.nomeVitamina,
              'dose': v.dose, 'dataAplicacao': v.dataAplicacao,
              'dataProximaDose': v.dataProximaDose, 'observacao': v.observacao,
            }).toList(),
          }).toList(),
        }),
        'updated_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Busca o AnimalDetail do cache local.
  Future<AnimalDetail?> getCachedAnimalDetail(String animalId) async {
    final db = await database;
    final rows = await db.query(
      'animal_cache',
      where: 'animal_id = ?',
      whereArgs: [animalId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    try {
      final json = jsonDecode(rows.first['detail_json'] as String) as Map<String, dynamic>;
      return AnimalDetail.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  /// Salva múltiplos AnimalDetail de uma vez (batch cache).
  Future<void> cacheAnimalDetailsBatch(List<MapEntry<String, AnimalDetail>> entries) async {
    final db = await database;
    final batch = db.batch();
    for (final entry in entries) {
      final animalId = entry.key;
      final detail = entry.value;
      batch.insert(
        'animal_cache',
        {
          'animal_id': animalId,
          'detail_json': jsonEncode({
            'id': detail.id,
            'numeroIdentificacao': detail.numeroIdentificacao,
            'status': detail.status,
            'ciclos': detail.ciclos.map((c) => {
              'id': c.id,
              'numeroCiclo': c.numeroCiclo,
              'status': c.status,
              'dataInicio': c.dataInicio,
              'dataFim': c.dataFim,
              'pesagens': c.pesagens.map((p) => {
                'id': p.id, 'pesoKg': p.pesoKg,
                'dataPesagem': p.dataPesagem, 'observacao': p.observacao,
              }).toList(),
              'vacinas': c.vacinas.map((v) => {
                'id': v.id, 'nomeVacina': v.nomeVacina,
                'dataAplicacao': v.dataAplicacao, 'dataProximaDose': v.dataProximaDose,
                'lote': v.lote, 'observacao': v.observacao,
              }).toList(),
              'vermifugos': c.vermifugos.map((v) => {
                'id': v.id, 'nomeVermifugo': v.nomeVermifugo,
                'dose': v.dose, 'dataAplicacao': v.dataAplicacao,
                'dataProximaDose': v.dataProximaDose, 'observacao': v.observacao,
              }).toList(),
              'vitaminas': c.vitaminas.map((v) => {
                'id': v.id, 'nomeVitamina': v.nomeVitamina,
                'dose': v.dose, 'dataAplicacao': v.dataAplicacao,
                'dataProximaDose': v.dataProximaDose, 'observacao': v.observacao,
              }).toList(),
            }).toList(),
          }),
          'updated_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }
}
