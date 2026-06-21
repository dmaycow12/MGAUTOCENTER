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

Estas funcoes ainda existem como chamadas compatíveis, mas continuam pendentes:

- `preVisualizarNota`
- `danfeNfce`
- `consultarNotasRecebidas`
- `importarNfseRecebidas`
- `recuperarArquivosAusentes`

Para portar completamente, configurar as chaves e contratos de:

- Focus NFe / provedor fiscal usado.
- Asaas ou provedor de boletos.
- Storage definitivo para XML/PDF.
- Banco persistente definitivo.

## Escolha recomendada de hospedagem

Para a migração completa, a recomendação inicial é **Railway**:

- 1 serviço Node para backend + frontend buildado.
- 1 banco Postgres gerenciado.
- 1 volume persistente para uploads/XML/PDF no começo.
- Menos configuração inicial que separar frontend, backend, banco e storage em quatro provedores.

Quando o volume de XML/PDF crescer, o storage pode ser migrado para S3, Cloudflare R2 ou Supabase Storage sem mudar o frontend.

## Checklist para migrar tudo

Antes de desligar a Base44, separar:

- Backup completo dos dados gerado pelo sistema atual.
- Token Focus NFe de produção.
- Token Focus NFe de homologação.
- CNPJ do emitente.
- Inscrição estadual, se emitir NFe/NFCe.
- Inscrição municipal, se emitir NFSe.
- Código IBGE do município do emitente.
- Séries usadas: NFe, NFCe e NFSe/DPS.
- Token Asaas, se usar boleto.
- Domínio que será apontado para o novo deploy.

O backend novo também lê esses valores da entidade `Configuracao`, mantendo compatibilidade com a tela atual de configurações.

## Integrações já iniciadas no backend novo

- `gerarBoleto`: integração Asaas.
- `emitirNotaFiscal`: envio Focus NFe com payload NFe/NFCe/NFSe básico e anti-duplicata inicial.
- `consultarStatusNotas`: consulta Focus NFe e atualiza status/PDF/XML.
- `cancelarNota`: cancelamento Focus NFe.
- `buscarCnpj`: BrasilAPI.
- `buscarCodigoMunicipio`: IBGE.

As integrações fiscais precisam ser testadas primeiro em homologação, com dados reais da empresa, antes de produção.

## Deploy recomendado

### Opção simples em um serviço Node

1. Configure variaveis do backend a partir de `backend/.env.example`.
2. Configure `DATABASE_URL` apontando para Postgres.
3. Defina no ambiente de build:

```bash
VITE_API_PROVIDER=local
VITE_LOCAL_API_URL=/api
```

4. Rode build:

```bash
npm run build
```

5. Suba o servidor:

```bash
npm start
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
