import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function formatCpfCnpj(val) {
    if (!val) return val;
    const digits = val.replace(/\D/g, '');
    if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (digits.length === 14) {
        return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return val;
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cadastros = await base44.asServiceRole.entities.Cadastro.list('-created_date', 2000);
    let atualizados = 0;

    for (const c of cadastros) {
        if (!c.cpf_cnpj) continue;
        const formatted = formatCpfCnpj(c.cpf_cnpj);
        if (formatted !== c.cpf_cnpj) {
            await base44.asServiceRole.entities.Cadastro.update(c.id, { cpf_cnpj: formatted });
            atualizados++;
        }
    }

    return Response.json({ sucesso: true, atualizados, total: cadastros.length });
});