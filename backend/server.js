import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { EntityStore } from './lib/entityStore.js';
import { PostgresEntityStore } from './lib/postgresEntityStore.js';
import { FileStore } from './lib/fileStore.js';
import { createFunctionHandlers, extractDataFromUploadedFile } from './lib/functions.js';
import { ENTITY_NAMES, isKnownEntity } from './config/entities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 4000);
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');

const app = express();
const store = process.env.DATABASE_URL
  ? new PostgresEntityStore({ connectionString: process.env.DATABASE_URL })
  : new EntityStore({ dataDir });
const fileStore = new FileStore({
  uploadsDir,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  databaseUrl: process.env.DATABASE_URL || '',
});
const functionHandlers = createFunctionHandlers({ store, fileStore });

await store.init();
await fileStore.init();

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));

const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mg-autocenter-backend',
    entities: ENTITY_NAMES,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/apps/public/prod/public-settings/by-id/:appId', (req, res) => {
  res.json({
    id: req.params.appId,
    public_settings: {
      auth_required: false,
      provider: 'local',
    },
  });
});

app.get('/api/auth/me', (_req, res) => {
  res.json({
    id: 'local-admin',
    full_name: process.env.LOCAL_USER_NAME || 'MG Auto',
    email: process.env.LOCAL_USER_EMAIL || 'local@mgauto.local',
    role: 'admin',
  });
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/entities/:entityName', asyncRoute(async (req, res) => {
  const { entityName } = req.params;
  if (!isKnownEntity(entityName)) {
    res.status(404).json({ message: `Entidade desconhecida: ${entityName}` });
    return;
  }
  const data = await store.list(entityName, {
    sort: req.query.sort,
    limit: req.query.limit,
  });
  res.json(data);
}));

app.post('/api/entities/:entityName/filter', asyncRoute(async (req, res) => {
  const { entityName } = req.params;
  if (!isKnownEntity(entityName)) {
    res.status(404).json({ message: `Entidade desconhecida: ${entityName}` });
    return;
  }
  const data = await store.filter(entityName, req.body?.criteria || {}, {
    sort: req.body?.sort,
    limit: req.body?.limit,
  });
  res.json(data);
}));

app.post('/api/entities/:entityName', asyncRoute(async (req, res) => {
  const { entityName } = req.params;
  if (!isKnownEntity(entityName)) {
    res.status(404).json({ message: `Entidade desconhecida: ${entityName}` });
    return;
  }
  res.status(201).json(await store.create(entityName, req.body || {}));
}));

app.patch('/api/entities/:entityName/:id', asyncRoute(async (req, res) => {
  res.json(await store.update(req.params.entityName, req.params.id, req.body || {}));
}));

app.delete('/api/entities/:entityName/:id', asyncRoute(async (req, res) => {
  res.json(await store.delete(req.params.entityName, req.params.id));
}));

app.post('/api/functions/:functionName', asyncRoute(async (req, res) => {
  const handler = functionHandlers[req.params.functionName];
  if (!handler) {
    res.status(501).json({
      success: false,
      message: `Função ainda não portada: ${req.params.functionName}`,
    });
    return;
  }

  const data = await handler(req.body || {});
  res.json({ data });
}));

const upload = fileStore.middleware();

app.post('/api/files', upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'Arquivo não enviado.' });
    return;
  }

  const result = await fileStore.persistUploadedFile(req.file);
  await fileStore.deleteLocalUpload(req.file);
  res.status(201).json({
    ...result,
    file_url: fileStore.buildPublicUrl(req, req.file.filename),
  });
}));

app.get('/api/files/:filename', asyncRoute(async (req, res) => {
  await fileStore.sendFile(req, res);
}));

app.post('/api/integrations/core/extract-data', asyncRoute(async (req, res) => {
  res.json(await extractDataFromUploadedFile({ fileStore, payload: req.body || {} }));
}));

const distDir = path.join(rootDir, 'dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || error.statusCode || 500;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({
    success: false,
    message: error.message || 'Erro interno no backend.',
  });
});

app.listen(PORT, () => {
  console.log(`MG Autocenter backend running on http://localhost:${PORT}`);
});
