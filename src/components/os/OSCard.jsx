import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { ChevronDown, Pencil, Printer, Trash2, FileText, MoreVertical, AlertTriangle } from "lucide-react";

function WhatsAppIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const STATUS_OPTIONS = ["Aberto", "Orçamento", "Concluído"];

const STATUS_STYLE = {
  "Aberto":     { badge: "text-white", style: { background: "#062C9B", color: "#fff" } },
  "Orçamento":  { badge: "text-white", style: { background: "#FFCC00", color: "#fff" } },
  "Concluído":  { badge: "text-white", style: { background: "#00C957", color: "#fff" } },
};

function fmtData(d) {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return parts[2] + "/" + parts[1] + "/" + String(parts[0]).slice(2);
}

function fmtValor(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function gerarHTMLImpressao(os) {
  const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  function fmtD(d) {
    if (!d) return "—";
    const parts = d.split("-");
    if (parts.length !== 3) return d;
    return parts[2] + "/" + parts[1] + "/" + String(parts[0]).slice(2);
  }

  const servicosRows = (os.servicos || []).map((s, i) =>
    "<tr><td style='text-align:center'>" + (i+1) + "</td><td>" + (s.descricao||"") + "</td><td style='text-align:right'>R$ " + fmt(s.valor) + "</td><td style='text-align:right'>R$ " + fmt(Number(s.valor||0)*Number(s.quantidade||1)) + "</td></tr>"
  ).join("");

  const pecasRows = (os.pecas || []).map((p, i) =>
    "<tr><td style='text-align:center'>" + (i+1) + "</td><td>" + (p.descricao||"") + "</td><td style='text-align:center'>" + (p.quantidade||1) + "</td><td style='text-align:right'>R$ " + fmt(p.valor_unitario) + "</td><td style='text-align:right'>R$ " + fmt(p.valor_total) + "</td></tr>"
  ).join("");

  const totalProdutos = Number(os.valor_pecas || 0);
  const totalServicos = Number(os.valor_servicos || 0);
  const desconto = Number(os.desconto || 0);
  const totalGeral = Number(os.valor_total || 0);

  const parcelas = os.parcelas_detalhes && os.parcelas_detalhes.length > 0
    ? os.parcelas_detalhes
    : [{ numero: 1, vencimento: os.data_entrada, valor: totalGeral, forma_pagamento: os.forma_pagamento || "Dinheiro" }];

  const parcelasRows = parcelas.map(p =>
    "<tr><td style='text-align:center'>" + p.numero + "/" + parcelas.length + "</td><td>" + fmtD(p.vencimento) + "</td><td>R$ " + fmt(p.valor) + "</td><td>" + (p.forma_pagamento || os.forma_pagamento || "—") + "</td></tr>"
  ).join("");

  const enderecoRow = (os.cliente_endereco || os.cliente_bairro || os.cliente_cidade)
    ? "<div class='info-row'><div class='info-cell' style='flex:1'><div class='label'>Endereço</div><div class='value'>" + [os.cliente_endereco, os.cliente_bairro, os.cliente_cidade, os.cliente_estado].filter(Boolean).join(" — ") + "</div></div></div>"
    : "";

  const obsSection = os.observacoes
    ? "<div class='section' style='margin-top:8px'><div class='section-title'>Observações</div><div class='info-grid'><div class='info-row'><div class='info-cell' style='min-height:50px'><div class='value' style='font-weight:normal;font-size:9pt;white-space:pre-wrap'>" + os.observacoes + "</div></div></div></div></div>"
    : "";

  const tecSection = (os.defeito_relatado || os.diagnostico)
    ? "<div class='section'><div class='section-title'>Observações Técnicas</div><div class='info-grid'>" +
      (os.defeito_relatado ? "<div class='info-row'><div class='info-cell'><div class='label'>Defeito Relatado</div><div class='value'>" + os.defeito_relatado + "</div></div></div>" : "") +
      (os.diagnostico ? "<div class='info-row'><div class='info-cell'><div class='label'>Diagnóstico</div><div class='value'>" + os.diagnostico + "</div></div></div>" : "") +
      "</div></div>"
    : "";

  const descontoDiv = desconto > 0
    ? "<div class='total-item'><div class='tl'>Desconto</div><div class='tv'>- R$ " + fmt(desconto) + "</div></div>"
    : "";

  const css = [
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; background: #fff; padding-top: 56px; }",
    ".page { max-width: 210mm; margin: 0 auto; padding: 10mm 12mm; }",
    ".header { text-align: center; border-bottom: 2px solid #c00; padding-bottom: 10px; margin-bottom: 8px; }",
    ".company-info { font-size: 8.5pt; color: #444; line-height: 1.7; }",
    ".os-title { display: flex; justify-content: space-between; align-items: center; background: #222; color: #fff; padding: 5px 10px; margin: 8px 0; border-radius: 2px; }",
    ".os-title .title { font-size: 11pt; font-weight: bold; letter-spacing: 1px; }",
    ".periodo { display: flex; gap: 20px; font-size: 8pt; padding: 4px 0 8px; border-bottom: 1px solid #ddd; margin-bottom: 6px; }",
    ".periodo span { color: #555; } .periodo b { color: #111; }",
    ".section { margin-bottom: 8px; }",
    ".section-title { background: #555; color: #fff; padding: 3px 8px; font-size: 8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0; }",
    ".info-grid { display: grid; border: 1px solid #ddd; border-top: none; }",
    ".info-row { display: flex; border-bottom: 1px solid #ddd; } .info-row:last-child { border-bottom: none; }",
    ".info-cell { flex: 1; padding: 3px 6px; border-right: 1px solid #ddd; } .info-cell:last-child { border-right: none; }",
    ".info-cell .label { font-size: 7pt; color: #888; text-transform: uppercase; }",
    ".info-cell .value { font-size: 8.5pt; font-weight: bold; color: #111; min-height: 14px; }",
    "table { width: 100%; border-collapse: collapse; font-size: 8pt; }",
    "table th { background: #f0f0f0; border: 1px solid #ccc; padding: 3px 6px; text-align: left; font-size: 7.5pt; font-weight: bold; text-transform: uppercase; }",
    "table td { border: 1px solid #ddd; padding: 3px 6px; }",
    "table tr:nth-child(even) td { background: #fafafa; }",
    ".col-num { width: 30px; text-align: center; } .col-qty { width: 40px; text-align: center; } .col-val { width: 80px; text-align: right; } .col-sub { width: 80px; text-align: right; }",
    ".totals-row { display: flex; justify-content: flex-end; gap: 0; margin-top: 4px; }",
    ".total-item { border: 1px solid #ddd; padding: 4px 10px; text-align: right; min-width: 160px; }",
    ".total-item .tl { font-size: 7.5pt; color: #666; } .total-item .tv { font-size: 9pt; font-weight: bold; }",
    ".total-geral { background: #222; color: #fff; border-color: #222; } .total-geral .tl { color: #ccc; } .total-geral .tv { font-size: 11pt; color: #fff; }",
    ".pag-table th, .pag-table td { font-size: 8pt; }",
    ".assinaturas { display: flex; justify-content: space-between; margin-top: 16px; gap: 20px; }",
    ".assinatura { flex: 1; text-align: center; } .assinatura .linha { border-top: 1px solid #999; margin-bottom: 4px; } .assinatura .nome { font-size: 10pt; color: #111; font-weight: bold; }",
    ".toolbar { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: #1e1e1e; color: #fff; display: flex; align-items: center; padding: 0 16px; gap: 12px; z-index: 999; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }",
    ".tb-title { font-size: 13pt; font-weight: bold; letter-spacing: 1px; margin-right: 24px; }",
    ".tb-sep { width: 1px; height: 24px; background: #444; }",
    ".tb-btn { background: none; border: none; color: #ccc; cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 10pt; display: flex; align-items: center; gap: 6px; transition: background 0.15s; font-family: Arial, sans-serif; }",
    ".tb-btn:hover { background: #333; color: #fff; }",
    ".tb-zoom { display: flex; align-items: center; gap: 4px; }",
    ".tb-zoom span { font-size: 10pt; color: #ccc; min-width: 42px; text-align: center; }",
    ".tb-spacer { flex: 1; }",
    "@media print { @page { size: A4; margin: 8mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding-top: 0; } .toolbar { display: none; } }",
  ].join(" ");

  return "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'/><title>OS #" + (os.numero||"") + "</title><style>" + css + "</style></head><body>" +
    "<div class='toolbar'>" +
    "<span class='tb-title'>IMPRESSAO</span>" +
    "<div class='tb-sep'></div>" +
    "<div class='tb-zoom'>" +
    "<button class='tb-btn' onclick='zoomOut()'>- Zoom</button>" +
    "<span id='zoom-label'>100%</span>" +
    "<button class='tb-btn' onclick='zoomIn()'>+ Zoom</button>" +
    "</div>" +
    "<div class='tb-sep'></div><div class='tb-spacer'></div>" +
    "<button class='tb-btn' onclick='window.print()'>Imprimir</button>" +
    "<button class='tb-btn' onclick='window.print()'>Salvar</button>" +
    "<button class='tb-btn' onclick='window.close()'>Fechar</button>" +
    "</div>" +
    "<script>var z=1;function applyZoom(){document.querySelector('.page').style.transform='scale('+z+')';document.querySelector('.page').style.transformOrigin='top center';document.getElementById('zoom-label').textContent=Math.round(z*100)+'%';}function zoomIn(){if(z<2){z=Math.round((z+0.1)*10)/10;applyZoom();}}function zoomOut(){if(z>0.5){z=Math.round((z-0.1)*10)/10;applyZoom();}}<\/script>" +
    "<div class='page'>" +
    "<div class='header'><img src='https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png' style='width:120px;height:120px;object-fit:contain;' alt='MG Autocenter'/>" +
    "<div class='company-info' style='margin-top:6px;'>Rua Rui Barbosa, 1355 — Santa Terezinha — Patos de Minas/MG<br>CNPJ: 54.043.647/0001-20 | (34) 99879-1260</div></div>" +
    "<div class='os-title'><span class='title'>ORDEM DE SERVICO N " + (os.numero||"—") + "</span></div>" +
    "<div class='periodo'><span>Entrada: <b>" + fmtD(os.data_entrada) + "</b></span><span>Status: <b>" + (os.status||"—") + "</b></span></div>" +
    "<div class='section'><div class='section-title'>Dados do Cliente</div><div class='info-grid'>" +
    "<div class='info-row'><div class='info-cell' style='flex:3'><div class='label'>Cliente</div><div class='value'>" + (os.cliente_nome||"—") + "</div></div><div class='info-cell' style='flex:2'><div class='label'>CPF/CNPJ</div><div class='value'>" + (os.cliente_cpf_cnpj||"") + "</div></div></div>" +
    enderecoRow +
    "<div class='info-row'><div class='info-cell' style='flex:2'><div class='label'>Telefone</div><div class='value'>" + (os.cliente_telefone||"—") + "</div></div><div class='info-cell' style='flex:3'><div class='label'>E-mail</div><div class='value'>" + (os.cliente_email||"") + "</div></div></div>" +
    "</div></div>" +
    "<div class='section'><div class='section-title'>Veiculo</div><div class='info-grid'><div class='info-row'>" +
    "<div class='info-cell' style='flex:3'><div class='label'>Veiculo</div><div class='value'>" + (os.veiculo_modelo||"—") + "</div></div>" +
    "<div class='info-cell' style='flex:2'><div class='label'>Placa</div><div class='value'>" + (os.veiculo_placa||"—") + "</div></div>" +
    "<div class='info-cell' style='flex:2'><div class='label'>Quilometragem</div><div class='value'>" + (os.quilometragem ? Number(os.quilometragem).toLocaleString("pt-BR") + " km" : "—") + "</div></div>" +
    "</div></div></div>" +
    tecSection +
    "<div class='section'><div class='section-title'>Servicos</div><table><thead><tr><th class='col-num'>Item</th><th>Nome</th><th class='col-val'>Vl. Unit.</th><th class='col-sub'>Subtotal</th></tr></thead><tbody>" +
    (servicosRows || "<tr><td colspan='4' style='text-align:center;color:#999'>Nenhum servico</td></tr>") +
    "<tr style='font-weight:bold;background:#f0f0f0'><td colspan='3' style='text-align:right'>TOTAL</td><td style='text-align:right'>R$ " + fmt(os.valor_servicos) + "</td></tr></tbody></table></div>" +
    "<div class='section'><div class='section-title'>Pecas / Produtos</div><table><thead><tr><th class='col-num'>Item</th><th>Nome</th><th class='col-qty'>Qtd.</th><th class='col-val'>Vl. Unit.</th><th class='col-sub'>Subtotal</th></tr></thead><tbody>" +
    (pecasRows || "<tr><td colspan='5' style='text-align:center;color:#999'>Nenhuma peca</td></tr>") +
    "<tr style='font-weight:bold;background:#f0f0f0'><td colspan='4' style='text-align:right'>TOTAL</td><td style='text-align:right'>R$ " + fmt(os.valor_pecas) + "</td></tr></tbody></table></div>" +
    "<div class='totals-row'>" +
    "<div class='total-item'><div class='tl'>Produtos</div><div class='tv'>R$ " + fmt(totalProdutos) + "</div></div>" +
    "<div class='total-item'><div class='tl'>Servicos</div><div class='tv'>R$ " + fmt(totalServicos) + "</div></div>" +
    descontoDiv +
    "<div class='total-item total-geral'><div class='tl'>TOTAL GERAL</div><div class='tv'>R$ " + fmt(totalGeral) + "</div></div></div>" +
    "<div class='section' style='margin-top:10px'><div class='section-title'>Dados do Pagamento</div><table class='pag-table'><thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Forma de Pagamento</th></tr></thead><tbody>" +
    parcelasRows +
    "</tbody></table></div>" +
    obsSection +
    "<div class='assinaturas' style='margin-top:40px'>" +
    "<div class='assinatura'><div class='linha'></div><div class='nome'>Assinatura do cliente</div></div>" +
    "<div class='assinatura'><div class='linha'></div><div class='nome'>Assinatura do tecnico</div></div>" +
    "</div></div></body></html>";
}

export default function OSCard({ os, onEdit, onDelete, onRefresh }) {
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAvisoStatus, setShowAvisoStatus] = useState(false);
  const [statusPendenteCard, setStatusPendenteCard] = useState(null);

  const statusRef = useRef(null);
  const statusBtnRef = useRef(null);
  const menuRef = useRef(null);
  const menuBtnRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target) && statusBtnRef.current && !statusBtnRef.current.contains(e.target)) setStatusOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target) && menuBtnRef.current && !menuBtnRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const gerarLancamentosFinanceiros = async (osData) => {
    const gerarParcelas = (total, qtd, formaPagamento, dataBase) => {
      const valorParcela = total / Math.max(1, qtd);
      const base = dataBase ? new Date(dataBase + "T00:00:00") : new Date();
      return Array.from({ length: qtd }, (_, i) => {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        return {
          numero: i + 1,
          valor: parseFloat(valorParcela.toFixed(2)),
          vencimento: d.toISOString().split("T")[0],
          forma_pagamento: formaPagamento || "Dinheiro",
        };
      });
    };
    const parcelas = osData.parcelas_detalhes && osData.parcelas_detalhes.length > 0
      ? osData.parcelas_detalhes
      : gerarParcelas(osData.valor_total, Number(osData.parcelas) || 1, osData.forma_pagamento, osData.data_entrada);
    for (const p of parcelas) {
      await base44.entities.Financeiro.create({
        tipo: "Receita",
        categoria: "Ordem de Serviço",
        descricao: "OS #" + osData.numero + " — " + (osData.cliente_nome || "") + " — Parcela " + p.numero + "/" + parcelas.length,
        valor: p.valor,
        data_vencimento: p.vencimento,
        status: "Pendente",
        forma_pagamento: p.forma_pagamento || osData.forma_pagamento || "Dinheiro",
        ordem_servico_id: osData.id || "",
        cliente_id: osData.cliente_id || "",
      });
    }
  };

  const excluirLancamentos = async () => {
    const financeiros = await base44.entities.Financeiro.list("-created_date", 500);
    const vinculados = financeiros.filter(f => f.ordem_servico_id === os.id);
    for (const f of vinculados) {
      await base44.entities.Financeiro.delete(f.id);
    }
  };

  const alterarStatus = async (novoStatus) => {
    setStatusOpen(false);
    const eraConcluida = os.status === "Concluída";
    const ficaConcluida = novoStatus === "Concluída";

    if (eraConcluida && !ficaConcluida) {
      setStatusPendenteCard(novoStatus);
      setShowAvisoStatus(true);
      return;
    }

    await base44.entities.OrdemServico.update(os.id, { status: novoStatus });

    if (!eraConcluida && ficaConcluida) {
      await gerarLancamentosFinanceiros(os);
    }

    onRefresh?.();
  };

  const confirmarMudancaStatus = async () => {
    await excluirLancamentos();
    await base44.entities.OrdemServico.update(os.id, { status: statusPendenteCard });
    setShowAvisoStatus(false);
    setStatusPendenteCard(null);
    onRefresh?.();
  };

  const enviarOrcamento = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");

    const servicosList = (os.servicos || []).map((s, i) =>
      `  ${i+1}. ${s.descricao || "Serviço"} — ${fmtValor(s.valor)}`
    ).join("\n");

    const pecasList = (os.pecas || []).map((p, i) =>
      `  ${i+1}. ${p.descricao || "Peça"} (x${p.quantidade || 1}) — ${fmtValor(p.valor_total)}`
    ).join("\n");

    let texto = `Olá ${os.cliente_nome || ""}! Segue o orçamento da OS #${os.numero}:\n`;
    texto += `Veículo: ${os.veiculo_modelo || ""}\n`;
    texto += `Placa: ${os.veiculo_placa || ""}\n\n`;

    if (pecasList) {
      texto += `🔩 *Peças:*\n${pecasList}\nSubtotal: ${fmtValor(os.valor_pecas)}\n\n`;
    }

    if (servicosList) {
      texto += `🔧 *Serviços:*\n${servicosList}\nSubtotal: ${fmtValor(os.valor_servicos)}\n\n`;
    }

    if (os.desconto > 0) {
      texto += `Desconto: -${fmtValor(os.desconto)}\n`;
    }

    texto += `💰 *Total: ${fmtValor(os.valor_total)}*`;

    if (os.observacoes) {
      texto += `\n\n📋 *Observações:*\n${os.observacoes}`;
    }

    const fone = telefone.startsWith("55") ? telefone : "55" + telefone;
    window.open("https://wa.me/" + fone + "?text=" + encodeURIComponent(texto), "_blank");
  };

  const chamarWhatsApp = () => {
    setMenuOpen(false);
    const telefone = os.cliente_telefone?.replace(/\D/g, "");
    if (!telefone) return alert("Telefone do cliente não cadastrado.");
    const fone = telefone.startsWith("55") ? telefone : "55" + telefone;
    window.open("https://wa.me/" + fone, "_blank");
  };

  const emitirNF = (tipo) => {
    setMenuOpen(false);
    const params = new URLSearchParams({
      emitir: "1", tipo, os_id: os.id, os_numero: os.numero || "",
      cliente_id: os.cliente_id || "",
      cliente_nome: encodeURIComponent(os.cliente_nome || ""),
      valor: String(os.valor_total || 0),
    });
    navigate(createPageUrl("NotasFiscais") + "?" + params.toString());
  };

  const imprimir = () => {
    setMenuOpen(false);
    const html = gerarHTMLImpressao(os);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  const style = STATUS_STYLE[os.status] || { badge: "bg-gray-600 text-white" };
  const veiculoNome = os.veiculo_modelo || "—";
  const veiculoPlaca = os.veiculo_placa?.toUpperCase() || "—";

  const menuItems = [
    { label: "Enviar orçamento", icon: WhatsAppIcon, action: enviarOrcamento },
    { label: "Chamar no WhatsApp", icon: WhatsAppIcon, action: chamarWhatsApp },
    { label: "Emitir NFe", icon: FileText, action: () => emitirNF("NFe") },
    { label: "Emitir NFSe", icon: FileText, action: () => emitirNF("NFSe") },
    { label: "Emitir NFCe", icon: FileText, action: () => emitirNF("NFCe") },
  ];

  return (
    <>
      {showAvisoStatus && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-7 h-7 flex-shrink-0" />
              <h3 className="text-lg font-bold">Atenção!</h3>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">
              Ao alterar o status desta OS, <strong className="text-red-400">todos os lançamentos financeiros</strong> gerados serão <strong className="text-red-400">excluídos automaticamente</strong>.
            </p>
            <p className="text-gray-400 text-sm">Deseja continuar?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowAvisoStatus(false); setStatusPendenteCard(null); }}
                className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
                Cancelar
              </button>
              <button onClick={confirmarMudancaStatus}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all">
                Sim, confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-all">
        {/* Linha 1: # + status + ícones */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="text-white font-bold text-sm tracking-wide flex-shrink-0">#{os.numero || "—"}</span>

          {/* Status dropdown */}
          <div className="relative">
            <button
              ref={statusBtnRef}
              onClick={() => { setMenuOpen(false); setStatusOpen(v => !v); }}
              className={"flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-semibold hover:opacity-90 transition-all " + style.badge}
              style={style.style}
            >
              {os.status || "—"}
              <ChevronDown className="w-3 h-3 flex-shrink-0" />
            </button>
            {statusOpen && (
              <div ref={statusRef} className="absolute left-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-40 py-1 z-50">
                {STATUS_OPTIONS.map(s => {
                  const statusStyle = STATUS_STYLE[s];
                  return (
                    <button key={s} onClick={() => alterarStatus(s)}
                      className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-700 transition-all"
                      style={{ color: statusStyle.style.color || statusStyle.style.background }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button onClick={() => onEdit?.()} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all" title="Editar">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={imprimir} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all" title="Imprimir">
            <Printer className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete?.()} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-all" title="Excluir">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button ref={menuBtnRef} onClick={() => { setStatusOpen(false); setMenuOpen(v => !v); }}
              className="p-1.5 text-gray-500 hover:text-white transition-all rounded-lg hover:bg-gray-800">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div ref={menuRef} className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-52 py-1 z-50">
                {menuItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <button key={i} onClick={item.action}
                      className="w-full text-left flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 transition-all">
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Grade */}
        <div className="grid grid-cols-2 border-t border-gray-800">
          <div className="col-span-2 px-3 py-2.5 border-b border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Cliente</p>
            <p className="text-white text-sm font-medium truncate">{os.cliente_nome || "—"}</p>
          </div>
          <div className="px-3 py-2.5 border-r border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Veículo</p>
            <p className="text-white text-sm font-medium truncate">{veiculoNome}</p>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Placa</p>
            <p className="text-white text-sm font-medium">{veiculoPlaca}</p>
          </div>
          <div className="px-3 py-2.5 border-t border-r border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Data</p>
            <p className="text-white text-sm font-medium">{fmtData(os.data_entrada)}</p>
          </div>
          <div className="px-3 py-2.5 border-t border-gray-800">
            <p className="text-white text-xs font-bold uppercase tracking-wider mb-1">Valor</p>
            <p className="text-white text-sm font-bold">{fmtValor(os.valor_total)}</p>
          </div>
        </div>
      </div>
    </>
  );
}