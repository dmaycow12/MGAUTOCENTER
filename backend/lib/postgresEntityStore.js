import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { ENTITY_NAMES, resolveEntityName, isKnownEntity } from '../config/entities.js';

const { Pool } = pg;

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeLimit = (limit) => {
  const parsed = Number(limit);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const getComparableValue = (item, field) => {
  const value = item?.[field];
  if (typeof value === 'string') return value.toLocaleLowerCase('pt-BR');
  return value ?? '';
};

const sortItems = (items, sort) => {
  if (!sort) return items;
  const descending = String(sort).startsWith('-');
  const field = descending ? String(sort).slice(1) : String(sort);

  return [...items].sort((a, b) => {
    const left = getComparableValue(a, field);
    const right = getComparableValue(b, field);
    if (left < right) return descending ? 1 : -1;
    if (left > right) return descending ? -1 : 1;
    return 0;
  });
};

const matchesFilter = (item, criteria = {}, requestedEntityName) => {
  const normalizedCriteria = { ...criteria };

  if (requestedEntityName === 'Cliente' && normalizedCriteria.categoria === undefined) {
    normalizedCriteria.categoria = 'Cliente';
  }

  return Object.entries(normalizedCriteria).every(([key, expected]) => {
    if (expected === undefined || expected === null || expected === '') return true;
    const actual = item?.[key];
    if (Array.isArray(expected)) return expected.includes(actual);
    return String(actual ?? '') === String(expected);
  });
};

export class PostgresEntityStore {
  constructor({ connectionString }) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS entity_records (
        entity_name TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (entity_name, id)
      )
    `);
    await this.pool.query('CREATE INDEX IF NOT EXISTS entity_records_entity_idx ON entity_records(entity_name)');
  }

  assertEntity(entityName) {
    const resolved = resolveEntityName(entityName);
    if (!isKnownEntity(resolved)) {
      throw Object.assign(new Error(`Entidade desconhecida: ${entityName}`), { status: 404 });
    }
    return resolved;
  }

  async readAll(entityName) {
    const resolved = this.assertEntity(entityName);
    const result = await this.pool.query(
      'SELECT data FROM entity_records WHERE entity_name = $1',
      [resolved]
    );
    return result.rows.map((row) => row.data);
  }

  async list(entityName, { sort, limit } = {}) {
    const items = await this.readAll(entityName);
    return clone(sortItems(items, sort).slice(0, normalizeLimit(limit)));
  }

  async filter(entityName, criteria = {}, { sort, limit } = {}) {
    const items = await this.readAll(entityName);
    const filtered = items.filter((item) => matchesFilter(item, criteria, entityName));
    return clone(sortItems(filtered, sort).slice(0, normalizeLimit(limit)));
  }

  async create(entityName, data) {
    const resolved = this.assertEntity(entityName);
    const now = new Date().toISOString();
    const record = {
      id: data?.id || randomUUID(),
      created_date: data?.created_date || now,
      updated_date: now,
      ...data,
    };

    await this.pool.query(
      `INSERT INTO entity_records (entity_name, id, data, created_date, updated_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (entity_name, id)
       DO UPDATE SET data = EXCLUDED.data, updated_date = EXCLUDED.updated_date`,
      [resolved, record.id, record, record.created_date, record.updated_date]
    );
    return clone(record);
  }

  async update(entityName, id, data) {
    const resolved = this.assertEntity(entityName);
    const current = await this.pool.query(
      'SELECT data FROM entity_records WHERE entity_name = $1 AND id = $2',
      [resolved, String(id)]
    );
    if (current.rowCount === 0) {
      throw Object.assign(new Error(`Registro não encontrado em ${entityName}: ${id}`), { status: 404 });
    }

    const updated = {
      ...current.rows[0].data,
      ...data,
      id: current.rows[0].data.id,
      updated_date: new Date().toISOString(),
    };

    await this.pool.query(
      'UPDATE entity_records SET data = $3, updated_date = $4 WHERE entity_name = $1 AND id = $2',
      [resolved, String(id), updated, updated.updated_date]
    );
    return clone(updated);
  }

  async delete(entityName, id) {
    const resolved = this.assertEntity(entityName);
    const result = await this.pool.query(
      'DELETE FROM entity_records WHERE entity_name = $1 AND id = $2',
      [resolved, String(id)]
    );
    return { id, deleted: result.rowCount > 0 };
  }

  async replaceAll(entityName, records) {
    const resolved = this.assertEntity(entityName);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM entity_records WHERE entity_name = $1', [resolved]);
      const normalized = records.map((record) => ({
        id: record?.id || randomUUID(),
        created_date: record?.created_date || new Date().toISOString(),
        updated_date: record?.updated_date || new Date().toISOString(),
        ...record,
      }));

      for (const record of normalized) {
        await client.query(
          `INSERT INTO entity_records (entity_name, id, data, created_date, updated_date)
           VALUES ($1, $2, $3, $4, $5)`,
          [resolved, record.id, record, record.created_date, record.updated_date]
        );
      }
      await client.query('COMMIT');
      return clone(normalized);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async exportBackup() {
    const backup = {};
    for (const entityName of ENTITY_NAMES) {
      backup[entityName] = await this.list(entityName);
    }
    return backup;
  }
}
