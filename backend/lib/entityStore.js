import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ENTITY_NAMES, resolveEntityName, isKnownEntity } from '../config/entities.js';

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

export class EntityStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true });
    await Promise.all(ENTITY_NAMES.map((entityName) => this.ensureEntityFile(entityName)));
  }

  entityFile(entityName) {
    const resolved = resolveEntityName(entityName);
    if (!isKnownEntity(resolved)) {
      throw Object.assign(new Error(`Entidade desconhecida: ${entityName}`), { status: 404 });
    }
    return path.join(this.dataDir, `${resolved}.json`);
  }

  async ensureEntityFile(entityName) {
    const filePath = this.entityFile(entityName);
    try {
      await readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await writeFile(filePath, '[]\n', 'utf8');
    }
  }

  async readAll(entityName) {
    const filePath = this.entityFile(entityName);
    await this.ensureEntityFile(entityName);
    const content = await readFile(filePath, 'utf8');
    const parsed = content.trim() ? JSON.parse(content) : [];
    return Array.isArray(parsed) ? parsed : [];
  }

  async writeAll(entityName, items) {
    const filePath = this.entityFile(entityName);
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
    await rename(tmpPath, filePath);
  }

  async list(entityName, { sort, limit } = {}) {
    const items = await this.readAll(entityName);
    const limited = sortItems(items, sort).slice(0, normalizeLimit(limit));
    return clone(limited);
  }

  async filter(entityName, criteria = {}, { sort, limit } = {}) {
    const resolved = resolveEntityName(entityName);
    const items = await this.readAll(resolved);
    const filtered = items.filter((item) => matchesFilter(item, criteria, entityName));
    return clone(sortItems(filtered, sort).slice(0, normalizeLimit(limit)));
  }

  async create(entityName, data) {
    const resolved = resolveEntityName(entityName);
    const items = await this.readAll(resolved);
    const now = new Date().toISOString();
    const record = {
      id: data?.id || randomUUID(),
      created_date: data?.created_date || now,
      updated_date: now,
      ...data,
    };
    items.push(record);
    await this.writeAll(resolved, items);
    return clone(record);
  }

  async update(entityName, id, data) {
    const resolved = resolveEntityName(entityName);
    const items = await this.readAll(resolved);
    const index = items.findIndex((item) => String(item.id) === String(id));
    if (index === -1) {
      throw Object.assign(new Error(`Registro não encontrado em ${entityName}: ${id}`), { status: 404 });
    }

    const updated = {
      ...items[index],
      ...data,
      id: items[index].id,
      updated_date: new Date().toISOString(),
    };
    items[index] = updated;
    await this.writeAll(resolved, items);
    return clone(updated);
  }

  async delete(entityName, id) {
    const resolved = resolveEntityName(entityName);
    const items = await this.readAll(resolved);
    const nextItems = items.filter((item) => String(item.id) !== String(id));
    await this.writeAll(resolved, nextItems);
    return { id, deleted: nextItems.length !== items.length };
  }

  async replaceAll(entityName, records) {
    const normalized = records.map((record) => ({
      id: record?.id || randomUUID(),
      created_date: record?.created_date || new Date().toISOString(),
      updated_date: record?.updated_date || new Date().toISOString(),
      ...record,
    }));
    await this.writeAll(resolveEntityName(entityName), normalized);
    return clone(normalized);
  }

  async exportBackup() {
    const backup = {};
    for (const entityName of ENTITY_NAMES) {
      backup[entityName] = await this.list(entityName);
    }
    return backup;
  }
}
