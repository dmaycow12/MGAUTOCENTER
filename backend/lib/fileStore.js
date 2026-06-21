import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import pg from 'pg';

const { Pool } = pg;

const safeName = (name) => String(name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');

const contentTypeFor = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.xml') return 'application/xml; charset=utf-8';
  if (ext === '.zip') return 'application/zip';
  if (['.xlsx', '.xls'].includes(ext)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
};

export class FileStore {
  constructor({ uploadsDir, publicBaseUrl = '', databaseUrl = '' }) {
    this.uploadsDir = uploadsDir;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
    this.pool = databaseUrl
      ? new Pool({
        connectionString: databaseUrl,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
      })
      : null;
  }

  async init() {
    await mkdir(this.uploadsDir, { recursive: true });
    if (this.pool) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
          filename TEXT PRIMARY KEY,
          original_name TEXT,
          content_type TEXT NOT NULL,
          data BYTEA NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }
  }

  middleware() {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, this.uploadsDir),
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}-${safeName(file.originalname)}`),
    });

    return multer({ storage });
  }

  buildPublicUrl(req, filename) {
    const baseUrl = this.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/api/files/${encodeURIComponent(filename)}`;
  }

  buildStoredFileUrl(filename) {
    const encoded = encodeURIComponent(filename);
    return this.publicBaseUrl ? `${this.publicBaseUrl}/api/files/${encoded}` : `/api/files/${encoded}`;
  }

  async saveBuffer({ filename, buffer, contentType }) {
    await mkdir(this.uploadsDir, { recursive: true });
    const storedName = `${Date.now()}-${randomUUID()}-${safeName(filename)}`;
    const finalContentType = contentType || contentTypeFor(storedName);
    await writeFile(path.join(this.uploadsDir, storedName), buffer);
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO uploaded_files (filename, original_name, content_type, data, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (filename)
         DO UPDATE SET original_name = EXCLUDED.original_name,
                       content_type = EXCLUDED.content_type,
                       data = EXCLUDED.data,
                       size_bytes = EXCLUDED.size_bytes`,
        [storedName, filename, finalContentType, buffer, buffer.length]
      );
    }
    return this.buildStoredFileUrl(storedName);
  }

  async persistUploadedFile(file) {
    const buffer = await readFile(file.path);
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO uploaded_files (filename, original_name, content_type, data, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (filename)
         DO UPDATE SET original_name = EXCLUDED.original_name,
                       content_type = EXCLUDED.content_type,
                       data = EXCLUDED.data,
                       size_bytes = EXCLUDED.size_bytes`,
        [
          file.filename,
          file.originalname,
          file.mimetype || contentTypeFor(file.originalname || file.filename),
          buffer,
          buffer.length,
        ]
      );
    }
    return {
      file_url: this.buildStoredFileUrl(file.filename),
      file_name: file.originalname,
      size: buffer.length,
    };
  }

  extractFilenameFromUrl(fileUrl) {
    if (!fileUrl) return null;

    try {
      const parsed = new URL(fileUrl);
      const marker = '/api/files/';
      const index = parsed.pathname.indexOf(marker);
      if (index !== -1) {
        return decodeURIComponent(parsed.pathname.slice(index + marker.length));
      }
    } catch (_) {
      // Accept /api/files/name values too.
    }

    if (fileUrl.startsWith('/api/files/')) {
      return decodeURIComponent(fileUrl.replace('/api/files/', ''));
    }

    return null;
  }

  async getDatabaseFile(filename) {
    if (!this.pool || !filename) return null;
    const result = await this.pool.query(
      'SELECT filename, original_name, content_type, data, size_bytes FROM uploaded_files WHERE filename = $1',
      [filename]
    );
    return result.rows[0] || null;
  }

  resolvePathFromUrl(fileUrl) {
    if (!fileUrl) return null;

    try {
      const parsed = new URL(fileUrl);
      const marker = '/api/files/';
      const index = parsed.pathname.indexOf(marker);
      if (index !== -1) {
        return path.join(this.uploadsDir, decodeURIComponent(parsed.pathname.slice(index + marker.length)));
      }
    } catch (_) {
      // Accept raw local paths or /api/files/name values as well.
    }

    if (fileUrl.startsWith('/api/files/')) {
      return path.join(this.uploadsDir, decodeURIComponent(fileUrl.replace('/api/files/', '')));
    }

    return fileUrl.startsWith(this.uploadsDir) ? fileUrl : null;
  }

  async readFromUrl(fileUrl) {
    const filename = this.extractFilenameFromUrl(fileUrl);
    const dbFile = await this.getDatabaseFile(filename);
    if (dbFile) return dbFile.data;

    const filePath = this.resolvePathFromUrl(fileUrl);
    if (!filePath) {
      throw Object.assign(new Error(`Arquivo não encontrado no storage local: ${fileUrl}`), { status: 404 });
    }
    return readFile(filePath);
  }

  async sendFile(req, res) {
    const filename = req.params.filename;
    const dbFile = await this.getDatabaseFile(filename);
    if (dbFile) {
      res.setHeader('Content-Type', dbFile.content_type || contentTypeFor(filename));
      res.setHeader('Content-Length', dbFile.size_bytes);
      res.setHeader('Content-Disposition', `inline; filename="${safeName(dbFile.original_name || filename)}"`);
      res.send(dbFile.data);
      return;
    }

    res.sendFile(path.join(this.uploadsDir, filename), (error) => {
      if (!error) return;
      res.status(error.statusCode || 404).json({
        success: false,
        message: `Arquivo não encontrado: ${filename}`,
      });
    });
  }

  async deleteLocalUpload(file) {
    if (!this.pool) return;
    try {
      await unlink(file.path);
    } catch (_) {
      // Local upload cleanup is best-effort.
    }
  }
}
