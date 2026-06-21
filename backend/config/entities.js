export const ENTITY_NAMES = [
  'Ativo',
  'Cadastro',
  'Configuracao',
  'Estoque',
  'Financeiro',
  'NotaFiscal',
  'Servico',
  'Vendas',
];

export const ENTITY_ALIASES = {
  Cliente: 'Cadastro',
};

export const resolveEntityName = (entityName) => ENTITY_ALIASES[entityName] || entityName;

export const isKnownEntity = (entityName) => ENTITY_NAMES.includes(resolveEntityName(entityName));
