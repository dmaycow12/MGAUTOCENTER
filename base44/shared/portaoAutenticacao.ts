// Portão de autenticação compartilhado entre funções backend.
// auth.me() tem falhado no site publicado ("Authentication required to view users"),
// então, como alternativa, valida com uma leitura leve no próprio Financeiro
// (chamadas de entidade sem token válido falham).
export async function autenticarRequisicao(base44) {
  let authErro = "";
  try {
    await base44.auth.me();
    return { autenticado: true, authErro: "" };
  } catch (e) {
    authErro = e?.message || String(e);
  }
  try {
    await base44.entities.Financeiro.list("-created_date", 1);
    return { autenticado: true, authErro: "" };
  } catch (e) {}
  return { autenticado: false, authErro };
}