# Migração paralela para fora da Base44

Este branch cria uma base para rodar o sistema da MG Autocenter fora da Base44 sem alterar o fluxo atual publicado.

## Segurança da migração

- O site atual continua usando Base44 por padrão.
- O frontend só usa o backend novo quando `VITE_API_PROVIDER=local`.
- Dados gerados pelo backend local ficam em `backend/data` e não são versionados.
- Uploads locais ficam em `backend/uploads` e não são versionados.

## Rodar localmente com backend novo

Em um terminal:

```bash
npm run backend:dev
```

Em outro terminal:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` e habilite:

```bash
VITE_API_PROVIDER=local
VITE_LOCAL_API_URL=http://localhost:4000/api
```

Depois rode:

```bash
npm run dev:local
```

## Rodar mantendo Base44

Nao defina `VITE_API_PROVIDER=local`.

```bash
npm run dev
```

## O que ja foi criado

- API HTTP em `backend/server.js`.
- CRUD local para entidades:
  - `Ativo`
  - `Cadastro`
  - `Configuracao`
  - `Estoque`
  - `Financeiro`
  - `NotaFiscal`
  - `Servico`
  - `Vendas`
- Alias `Cliente -> Cadastro` para compatibilidade com uma tela antiga.
- Upload local de arquivos.
- Extracao basica de planilhas via `xlsx`.
- Backup/restauracao basicos.
- Consultas publicas iniciais:
  - CNPJ via BrasilAPI.
  - Codigo de municipio via IBGE.
- Reajuste de estoque no backend novo.

## Funcoes que ainda dependem de credenciais externas

Estas funcoes existem como chamadas compatíveis, mas ainda retornam aviso de configuracao pendente:

- `emitirNotaFiscal`
- `consultarStatusNotas`
- `cancelarNota`
- `preVisualizarNota`
- `danfeNfce`
- `consultarNotasRecebidas`
- `importarNfseRecebidas`
- `recuperarArquivosAusentes`
- `gerarBoleto`

Para portar completamente, configurar as chaves e contratos de:

- Focus NFe / provedor fiscal usado.
- Asaas ou provedor de boletos.
- Storage definitivo para XML/PDF.
- Banco persistente definitivo.

## Deploy recomendado

### Opção simples em um serviço Node

1. Configure variaveis do backend a partir de `backend/.env.example`.
2. Rode build:

```bash
npm run build
```

3. Suba o servidor:

```bash
npm run backend
```

Quando `dist` existir, o backend tambem serve o frontend buildado.

### Opção separada

- Frontend: Vercel, Netlify ou Cloudflare Pages.
- Backend: Render, Railway, Fly.io, VPS ou container.
- Banco: Supabase/Neon/Postgres.
- Storage: S3, Cloudflare R2 ou Supabase Storage.

Nesse caso, definir no frontend:

```bash
VITE_API_PROVIDER=local
VITE_LOCAL_API_URL=https://url-do-backend/api
```
