import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function formatarTelefone(tel) {
  if (!tel) return tel;
  const nums = tel.replace(/\D/g, '').slice(0, 11);
  if (nums.length === 11) {
    return nums.slice(0, 2) + ' ' + nums.slice(2, 7) + ' ' + nums.slice(7);
  } else if (nums.length === 10) {
    return nums.slice(0, 2) + ' ' + nums.slice(2, 6) + ' ' + nums.slice(6);
  } else if (nums.length > 2) {
    return nums.slice(0, 2) + ' ' + nums.slice(2);
  }
  return nums;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const cadastros = await base44.asServiceRole.entities.Cadastro.list('-created_date', 2000);

  let atualizados = 0;

  for (const c of cadastros) {
    if (!c.telefone) continue;
    const formatado = formatarTelefone(c.telefone);
    if (formatado !== c.telefone) {
      await base44.asServiceRole.entities.Cadastro.update(c.id, { telefone: formatado });
      atualizados++;
    }
  }

  return Response.json({ sucesso: true, atualizados, mensagem: `${atualizados} contato(s) formatado(s).` });
});