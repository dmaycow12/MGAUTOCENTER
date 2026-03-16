import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { cliente_id, veiculo_placa, veiculo_marca, veiculo_modelo, veiculo_ano } = await req.json();

    if (!cliente_id || !veiculo_placa) {
      return Response.json({ error: 'Dados do veículo incompletos' }, { status: 400 });
    }

    // Não salva veículos do cliente CONSUMIDOR
    const cliente = await base44.entities.Cliente.filter({ id: cliente_id });
    if (cliente?.[0]?.nome?.toUpperCase() === "CONSUMIDOR") {
      return Response.json({ criado: false, motivo: 'consumidor' });
    }

    // Verifica se o veículo já existe
    const veiculos = await base44.entities.Veiculo.list("-created_date", 500);
    const jaCadastrado = veiculos.find(v => v.placa?.toUpperCase() === veiculo_placa.toUpperCase() && v.cliente_id === cliente_id);

    if (jaCadastrado) {
      return Response.json({ veiculo: jaCadastrado, criado: false });
    }

    // Cria novo veículo
    const novoVeiculo = await base44.entities.Veiculo.create({
      cliente_id,
      placa: veiculo_placa?.toUpperCase() || "",
      marca: veiculo_marca || "",
      modelo: veiculo_modelo || "",
      ano: veiculo_ano || "",
    });

    return Response.json({ veiculo: novoVeiculo, criado: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});