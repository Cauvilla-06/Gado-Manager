import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../models.dart';

/// Banco local (SQLite) para uso 100% offline.
class DatabaseHelper {
  DatabaseHelper._();
  static final DatabaseHelper instance = DatabaseHelper._();

  static const _dbName = 'gado_manager.db';
  static const _dbVersion = 1;

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
            criado_em TEXT NOT NULL
          )
        ''');
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
      );
    }).toList();
  }

  Future<int> countPendingRecords() async {
    final db = await database;
    final result = await db.rawQuery('SELECT COUNT(*) AS n FROM pending_records');
    return (result.first['n'] as int?) ?? 0;
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
}
