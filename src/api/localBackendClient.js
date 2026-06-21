const API_BASE_URL = (import.meta.env.VITE_LOCAL_API_URL || '/api').replace(/\/$/, '');

const ENTITY_NAMES = [
  'Ativo',
  'Cadastro',
  'Cliente',
  'Configuracao',
  'Estoque',
  'Financeiro',
  'NotaFiscal',
  'Servico',
  'Vendas',
];

const buildQuery = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const request = async (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  const hasFormData = options.body instanceof FormData;

  if (!hasFormData && options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: hasFormData || typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' ? payload.message : payload;
    const error = new Error(message || `Erro HTTP ${response.status}`);
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload;
};

const createEntityClient = (entityName) => ({
  list: (sort, limit) => request(`/entities/${entityName}${buildQuery({ sort, limit })}`),
  filter: (criteria = {}, sort, limit) => request(`/entities/${entityName}/filter`, {
    method: 'POST',
    body: { criteria, sort, limit },
  }),
  create: (data) => request(`/entities/${entityName}`, {
    method: 'POST',
    body: data,
  }),
  update: (id, data) => request(`/entities/${entityName}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: data,
  }),
  delete: (id) => request(`/entities/${entityName}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }),
});

const entities = Object.fromEntries(
  ENTITY_NAMES.map((entityName) => [entityName, createEntityClient(entityName)])
);

export const localBackendClient = {
  entities,
  functions: {
    invoke: (functionName, payload = {}) => request(`/functions/${functionName}`, {
      method: 'POST',
      body: payload,
    }),
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return request('/files', {
          method: 'POST',
          body: formData,
        });
      },
      ExtractDataFromUploadedFile: (payload = {}) => request('/integrations/core/extract-data', {
        method: 'POST',
        body: payload,
      }),
    },
  },
  apps: {
    publicSettings: () => request('/apps/public/prod/public-settings/by-id/local'),
  },
  auth: {
    me: () => request('/auth/me'),
    logout: () => {
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
    },
    redirectToLogin: () => {},
  },
};
