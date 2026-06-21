import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';

const safeName = (name) => String(name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');

export class FileStore {
  constructor({ uploadsDir, publicBaseUrl = '' }) {
    this.uploadsDir = uploadsDir;
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
  }

  async init() {
    await mkdir(this.uploadsDir, { recursive: true });
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
    const filePath = this.resolvePathFromUrl(fileUrl);
    if (!filePath) {
      throw Object.assign(new Error(`Arquivo não encontrado no storage local: ${fileUrl}`), { status: 404 });
    }
    return readFile(filePath);
  }
}
