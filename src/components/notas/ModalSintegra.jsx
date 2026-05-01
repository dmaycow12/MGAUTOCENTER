import React, { useState, useMemo } from "react";
import { X, FileDown, RefreshCw, AlertCircle, Eye } from "lucide-react";

// ============================================================
// GERADOR SINTEGRA v5 — embutido para evitar problemas de import
// ============================================================
const rX  = (s, n)  => String(s ?? "").padEnd(n, " ").substring(0, n);
const rZ  = (v, n)  => { const p = parseInt(String(v ?? 0), 10); return String(isNaN(p) ? 0 : Math.abs(p)).padStart(n, "0").slice(-n); };
const rN2 = (v, n)  => String(Math.round(Math.abs(Number(v) || 0) * 100)).padStart(n, "0").slice(-n);
const rN3 = (v, n)  => String(Math.round(Math.abs(Number(v) || 0) * 1000)).padStart(n, "0").slice(-n);
const dt8 = d       => { if (!d) return "00000000"; const c = String(d).substring(0,10).replace(/-/g,""); return c.length===8?c:"00000000"; };
const cnpj14 = c    => (c||"").replace(/\D/g,"").padStart(14,"0").slice(-14);
const ieEmit = ie   => rX((ie||"").replace(/\D/g,""), 14);
const ieDest = ie   => { const s=(ie||"").replace(/[^a-zA-Z0-9]/g,""); return (!s||s.length<5)?rX("ISENTO",14):rX(s,14); };
const cfop4  = (c,p)=> ((c||p||"5405")+"").replace(/\D/g,"").padStart(4,"0").slice(-4);
const cst2   = raw  => { const s=String(raw||"00").replace(/\D/g,""); return (s||"00").slice(-2).padStart(2,"0"); };
const numBase = num => { if (!num) return "0"; return String(num).split("-")[0].replace(/\D/g,"") || "0"; };
const numSuf  = num => { if (!num) return null; const p=String(num).split("-"); if(p.length<2)return null; const s=p[1].replace(/\D/g,""); return s?parseInt(s,10):null; };
const limpaCod = cod => { const s=String(cod||"OUTROS").replace(/[^a-zA-Z0-9\-]/g,"").substring(0,14); return s||"OUTROS"; };

function _reg10(emp, ini, fim) {
  const fax=(emp.fax||emp.fone||"").replace(/\D/g,"").padStart(10,"0").slice(-10);
  return "10"+cnpj14(emp.cnpj)+ieEmit(emp.ie)+rX(emp.nome,35)+rX(emp.municipio,30)+rX(emp.uf||"MG",2)+fax+dt8(ini)+dt8(fim)+"331";
}
function _reg11(emp) {
  const num=(emp.numero||"1").replace(/\D/g,"").padStart(5,"0").slice(-5);
  const cep=(emp.cep||"38700000").replace(/\D/g,"").padStart(8,"0").slice(-8);
  const fone=(emp.fone||"34000000000").replace(/\D/g,"").padStart(12,"0").slice(-12);
  return "11"+rX(emp.logradouro||"SEM ENDERECO",34)+num+rX(emp.complemento||"",22)+rX(emp.bairro||"",15)+cep+rX(emp.responsavel||emp.nome,28)+fone;
}
function _reg50(nota, emp) {
  const ent=nota.status==="Importada"||nota.status==="Lançada";
  const vT=Number(nota.valor_total)||0;
  return "50"+cnpj14(nota.cliente_cpf_cnpj)+ieDest(nota.cliente_ie)+dt8(nota.data_emissao)
    +rX(nota.cliente_estado||emp.uf||"MG",2)+"01"
    +rX(String(nota.serie||"1").replace(/\D/g,"")||"1",3)
    +rZ(numBase(nota.numero),6)+cfop4(nota.cfop,ent?"1403":"5405")+(ent?"T":"P")
    +rN2(vT,13)+rN2(0,13)+rN2(0,13)+rN2(vT,13)+rN2(0,13)+"0000N";
}
function _reg54(nota, item, idx) {
  const ent=nota.status==="Importada"||nota.status==="Lançada";
  const qtd=Number(item.quantidade)||1;
  const vBr=(qtd*(Number(item.valor_unitario)||0))||Number(item.valor_total)||0;
  return "54"+cnpj14(nota.cliente_cpf_cnpj)+"01"
    +rX(String(nota.serie||"1").replace(/\D/g,"")||"1",3)
    +rZ(numBase(nota.numero),6)+cfop4(item.cfop||nota.cfop,ent?"1403":"5405")
    +cst2(item.cst||"00")+rZ(idx+1,3)+rX(limpaCod(item.codigo||"OUTROS"),14)
    +rN3(qtd,12)+rN2(vBr,12)+rN2(0,12)+rN2(0,12)+rN2(0,12)+rN2(0,12)+"0000";
}
function _reg61(g) {
  return "61"+rX("",14)+rX("",14)+dt8(g.data)+"65"
    +rX(String(g.serie||"1"),3)+"  "+rZ(g.numInicial||1,6)+rZ(g.numFinal||1,6)
    +rN2(g.valorTotal,13)+rN2(0,13)+"0000N"+rX("",38);
}
function _reg75(prod, ini, fim) {
  const ncm=(prod.ncm||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8);
  return "75"+dt8(ini)+dt8(fim)+rX(limpaCod(prod.codigo||"OUTROS"),14)+rX(ncm,8)
    +rX(prod.descricao||"PRODUTO",53)+rX(prod.unidade||"UN",6)+"000000000000000"+rN2(0,13);
}
function _reg90(emp, totais, totalAntes) {
  const CNPJ=cnpj14(emp.cnpj), IE=ieEmit(emp.ie), BR=rX("",85);
  const tipos=["50","54","61","75"].filter(t=>(totais[t]||0)>0);
  const qtd90=tipos.length+1, total=totalAntes+qtd90;
  return [...tipos.map(t=>"90"+CNPJ+IE+t+rZ(totais[t],8)+BR+String(qtd90)),
    "90"+CNPJ+IE+"99"+rZ(total,8)+BR+String(qtd90)];
}
function _parseXml(xml) {
  const itens=[], dets=xml.match(/<(?:\w+:)?det[\s\S]*?<\/(?:\w+:)?det>/gi)||[];
  for (const det of dets) {
    const g=tag=>{const m=det.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]+)<\\/(?:\\w+:)?${tag}>`,"i"));return m?m[1].trim():"";};
    const qCom=parseFloat(g("qCom")||"1")||1, vProd=parseFloat(g("vProd")||"0");
    itens.push({codigo:limpaCod(g("cProd")||"OUTROS"),descricao:(g("xProd")||"PRODUTO").substring(0,53),
      ncm:(g("NCM")||g("ncm")||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8),
      unidade:(g("uCom")||"UN").substring(0,6),quantidade:qCom,
      valor_unitario:parseFloat(g("vUnCom")||"0")||(vProd/qCom),valor_total:vProd,
      cfop:(g("CFOP")||"").replace(/\D/g,""),cst:cst2(g("CSOSN")||g("CST")||"00")});
  }
  return itens;
}
function _coletarItens(rep, irmas) {
  if (irmas && irmas.length > 0) {
    return irmas.map(irma => {
      for (const campo of [irma.xml_original, irma.xml_content]) {
        if (!campo||typeof campo!=="string") continue;
        try {
          const arr=JSON.parse(campo);
          if (Array.isArray(arr)&&arr.length>0&&(arr[0].descricao||arr[0].codigo)) {
            const p=arr[0];
            return {codigo:limpaCod(p.codigo||p.estoque_id||"OUTROS"),descricao:String(p.descricao||"PRODUTO").substring(0,53),
              ncm:(p.ncm||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8),unidade:String(p.unidade||"UN").substring(0,6),
              quantidade:Number(p.quantidade)||1,valor_unitario:Number(p.valor_unitario||p.valor||0),
              valor_total:Number(p.valor_total)||Number(irma.valor_total)||0,cfop:(p.cfop||"").replace(/\D/g,""),cst:cst2(p.cst||"00")};
          }
        } catch { /**/ }
      }
      return {codigo:"OUTROS",descricao:"MERCADORIA",ncm:"87089990",unidade:"UN",
        quantidade:1,valor_unitario:Number(irma.valor_total)||0,valor_total:Number(irma.valor_total)||0,cfop:"",cst:"00"};
    });
  }
  for (const campo of [rep.xml_original, rep.xml_content]) {
    if (!campo||typeof campo!=="string") continue;
    try {
      const arr=JSON.parse(campo);
      if (Array.isArray(arr)&&arr.length>0&&(arr[0].descricao||arr[0].codigo)) {
        return arr.map(p=>({codigo:limpaCod(p.codigo||p.estoque_id||"OUTROS"),descricao:String(p.descricao||"PRODUTO").substring(0,53),
          ncm:(p.ncm||"87089990").replace(/\D/g,"").padEnd(8,"0").substring(0,8),unidade:String(p.unidade||"UN").substring(0,6),
          quantidade:Number(p.quantidade)||1,valor_unitario:Number(p.valor_unitario||p.valor||0),
          valor_total:Number(p.valor_total)||0,cfop:(p.cfop||"").replace(/\D/g,""),cst:cst2(p.cst||"00")}));
      }
    } catch { /**/ }
    if (campo.includes("<det")||campo.includes("<nfeProc")) { const it=_parseXml(campo); if(it.length>0) return it; }
  }
  return [{codigo:"OUTROS",descricao:"MERCADORIA DIVERSA",ncm:"87089990",unidade:"UN",
    quantidade:1,valor_unitario:Number(rep.valor_total)||0,valor_total:Number(rep.valor_total)||0,cfop:"",cst:"00"}];
}

function gerarArquivoSintegra({ notas, estoque, configs, periodoInicio, periodoFim }) {
  const cfg=k=>(configs||[]).find(c=>c.chave===k)?.valor||"";
  const emp={cnpj:cfg("cnpj")||"54043647000120",ie:cfg("inscricao_estadual")||"0048295510070",
    nome:cfg("razao_social")||"MG AUTOCENTER LTDA",municipio:cfg("municipio")||"Patos de Minas",
    uf:cfg("uf")||"MG",logradouro:cfg("endereco")||"RUA SEM NOME",numero:cfg("numero")||"1",
    complemento:cfg("complemento")||"",bairro:cfg("bairro")||"",cep:cfg("cep")||"38700000",
    fone:cfg("telefone")||"34000000000",fax:cfg("fax")||"",
    responsavel:cfg("responsavel")||cfg("razao_social")||"RESPONSAVEL"};

  const linhas=[], totais={};
  const add=(tipo,linha)=>{linhas.push(linha);totais[tipo]=(totais[tipo]||0)+1;};

  add("10",_reg10(emp,periodoInicio,periodoFim));
  add("11",_reg11(emp));

  const notasPeriodo=notas.filter(n=>{
    const d=(n.data_emissao||"").substring(0,10);
    return d>=periodoInicio&&d<=periodoFim&&n.status!=="Rascunho"&&n.status!=="Cancelada"&&n.tipo!=="NFSe";
  });

  // Agrupa NFe: chave = série + número-base
  const grupos=new Map();
  for (const n of notasPeriodo) {
    if (n.tipo!=="NFe") continue;
    const nb=numBase(n.numero), serie=String(n.serie||"1").replace(/\D/g,"")||"1";
    const chave=`${serie}_${nb}`;
    if (!grupos.has(chave)) grupos.set(chave,{rep:null,irmas:[]});
    const g=grupos.get(chave);
    if (String(n.numero).includes("-")) g.irmas.push(n); else g.rep=n;
  }
  for (const g of grupos.values()) {
    if (g.irmas.length>0) g.irmas.sort((a,b)=>(numSuf(a.numero)||0)-(numSuf(b.numero)||0));
    if (!g.rep&&g.irmas.length>0) { g.rep=g.irmas[0]; g.irmas=g.irmas.slice(1); }
  }
  const nfeGrupos=[...grupos.values()].filter(g=>g.rep)
    .sort((a,b)=>(a.rep.data_emissao||"").localeCompare(b.rep.data_emissao||""));

  for (const g of nfeGrupos) add("50",_reg50(g.rep,emp));

  const prodMap=new Map();
  for (const g of nfeGrupos) {
    const itens=_coletarItens(g.rep,g.irmas);
    itens.forEach((item,idx)=>{
      add("54",_reg54(g.rep,item,idx));
      const codKey=limpaCod(item.codigo||"OUTROS");
      if (!prodMap.has(codKey)) {
        const estoq=(estoque||[]).find(e=>(e.codigo||"").trim()===codKey);
        prodMap.set(codKey,{codigo:codKey,descricao:estoq?.descricao||item.descricao||"PRODUTO",
          ncm:estoq?.ncm||item.ncm||"87089990",unidade:estoq?.unidade||item.unidade||"UN"});
      }
    });
  }

  // NFCe agrupadas por dia/série
  const grp61=new Map();
  for (const nfce of notasPeriodo.filter(n=>n.tipo==="NFCe")) {
    const ser=String(nfce.serie||"1"), ck=`${dt8(nfce.data_emissao)}_${ser}`;
    const num=parseInt(numBase(nfce.numero),10)||1;
    if (!grp61.has(ck)) grp61.set(ck,{data:nfce.data_emissao,serie:ser,numInicial:num,numFinal:num,valorTotal:0});
    const g=grp61.get(ck);
    if(num<g.numInicial)g.numInicial=num; if(num>g.numFinal)g.numFinal=num;
    g.valorTotal+=Number(nfce.valor_total||0);
  }
  for (const g of [...grp61.values()].sort((a,b)=>dt8(a.data).localeCompare(dt8(b.data)))) add("61",_reg61(g));

  for (const p of prodMap.values()) add("75",_reg75(p,periodoInicio,periodoFim));

  const r90=_reg90(emp,totais,linhas.length);
  return { conteudo:[...linhas,...r90].join("\r\n"), totalNotas:notasPeriodo.length };
}

// ============================================================
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function ModalSintegra({ notas, estoque, configs, onClose }) {
  const hoje = new Date();
  const [modo, setModo] = useState("mes");
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [showConferencia, setShowConferencia] = useState(false);

  const pad = n => String(n).padStart(2, "0");
  const ultimoDiaMes = (m, a) => new Date(a, m, 0).getDate();

  const getPeriodo = () => {
    if (modo === "mes") {
      const ult = ultimoDiaMes(mes, ano);
      return { inicio: `${ano}-${pad(mes)}-01`, fim: `${ano}-${pad(mes)}-${pad(ult)}`, label: `${MESES[mes-1]}/${ano}` };
    }
    return { inicio: dataInicio, fim: dataFim, label: `${dataInicio} a ${dataFim}` };
  };

  const gerar = () => {
    const periodo = getPeriodo();
    if (!periodo.inicio || !periodo.fim) return alert("Informe o período.");
    setGerando(true);
    setResultado(null);
    setTimeout(() => {
      try {
        const { conteudo, totalNotas } = gerarArquivoSintegra({
          notas, estoque, configs, periodoInicio: periodo.inicio, periodoFim: periodo.fim,
        });
        const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = modo === "mes"
          ? `SINTEGRA_${periodo.inicio.substring(0,4)}${periodo.inicio.substring(5,7)}.txt`
          : `SINTEGRA_${periodo.inicio}_${periodo.fim}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        const linhas54 = conteudo.split("\r\n").filter(l => l.startsWith("54")).slice(0, 5);
        setResultado({ sucesso: true, totalNotas, periodo: periodo.label, debug54: linhas54 });
      } catch (e) {
        setResultado({ sucesso: false, erro: e.message });
      }
      setGerando(false);
    }, 100);
  };

  const conferencia = useMemo(() => {
    const periodo = getPeriodo();
    const todasNoPeriodo = notas.filter(n => {
      const d = (n.data_emissao || "").substring(0, 10);
      return d >= periodo.inicio && d <= periodo.fim && n.status !== "Rascunho" && n.status !== "Cancelada";
    });
    const totalNFe = todasNoPeriodo.filter(n=>n.tipo==="NFe").reduce((s,n)=>s+Number(n.valor_total||0),0);
    const totalNFCe = todasNoPeriodo.filter(n=>n.tipo==="NFCe").reduce((s,n)=>s+Number(n.valor_total||0),0);
    const totalNFSe = todasNoPeriodo.filter(n=>n.tipo==="NFSe").reduce((s,n)=>s+Number(n.valor_total||0),0);
    return {
      periodo: periodo.label, totalNotas: todasNoPeriodo.length,
      noSintegraCount: todasNoPeriodo.filter(n=>n.tipo==="NFe"||n.tipo==="NFCe").length,
      totalNoSintegra: totalNFe+totalNFCe, totalNFe, totalNFCe, totalNFSe,
      totalGeral: todasNoPeriodo.reduce((s,n)=>s+Number(n.valor_total||0),0),
      foraDosintegra: todasNoPeriodo.filter(n=>n.tipo==="NFSe"),
    };
  }, [mes, ano, modo, dataInicio, dataFim, notas]);

  const fmt = v => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const anos = [];
  for (let y = hoje.getFullYear(); y >= hoje.getFullYear() - 5; y--) anos.push(y);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold">Gerar SINTEGRA</h2>
            <p className="text-gray-500 text-xs mt-0.5">Arquivo fiscal estruturado para SEFAZ/MG</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setModo("mes")} className="flex-1 py-2 text-sm font-medium transition-all"
              style={{ background: modo==="mes" ? "#062C9B" : "#1f2937", color: "#fff" }}>Por Mês</button>
            <button onClick={() => setModo("periodo")} className="flex-1 py-2 text-sm font-medium transition-all"
              style={{ background: modo==="periodo" ? "#062C9B" : "#1f2937", color: "#fff" }}>Período Livre</button>
          </div>

          {modo === "mes" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Mês</label>
                <select value={mes} onChange={e => setMes(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ano</label>
                <select value={ano} onChange={e => setAno(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {anos.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data Início</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Data Fim</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-300 space-y-1">
            <p className="font-semibold">Registros incluídos:</p>
            <p>• Reg. 10 — Identificação da empresa</p>
            <p>• Reg. 11 — Endereço do estabelecimento</p>
            <p>• Reg. 50 — NFe modelo 55 (individual por nota)</p>
            <p>• Reg. 54 — Itens das NFe (itens sequenciais 001,002...)</p>
            <p>• Reg. 61 — NFCe modelo 65 (totais diários)</p>
            <p>• Reg. 75 — Cadastro de produtos (NFe)</p>
            <p>• Reg. 90 — Encerramento/totalizadores</p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-xs text-yellow-300">
            <div className="flex gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>Configure os dados da empresa em <strong>Configurações</strong> (CNPJ, IE, endereço) para geração correta.</span>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <button onClick={() => setShowConferencia(!showConferencia)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700 transition-all">
              <span className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-400" /> Conferir faturamento do período</span>
              <span className="text-gray-400 text-xs">{showConferencia ? "▲ fechar" : "▼ abrir"}</span>
            </button>
            {showConferencia && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-900 rounded-lg p-3">
                    <p className="text-gray-500 mb-1">Total emitido (período)</p>
                    <p className="text-white font-bold text-sm">{fmt(conferencia.totalGeral)}</p>
                    <p className="text-gray-600 mt-1">{conferencia.totalNotas} nota(s)</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3">
                    <p className="text-gray-500 mb-1">No SINTEGRA (NFe + NFCe)</p>
                    <p className="text-green-400 font-bold text-sm">{fmt(conferencia.totalNoSintegra)}</p>
                    <p className="text-gray-600 mt-1">{conferencia.noSintegraCount} nota(s)</p>
                  </div>
                  {conferencia.totalNFSe > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                      <p className="text-orange-400 mb-1">NFSe — NÃO entra no SINTEGRA</p>
                      <p className="text-orange-300 font-bold text-sm">{fmt(conferencia.totalNFSe)}</p>
                    </div>
                  )}
                </div>
                {conferencia.foraDosintegra.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 font-semibold">Notas fora do SINTEGRA ({conferencia.foraDosintegra.length}):</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {conferencia.foraDosintegra.map(n => (
                        <div key={n.id} className="flex justify-between text-xs bg-gray-900 rounded px-3 py-1.5">
                          <span className="text-gray-400">{n.tipo} nº {n.numero||"—"} — {n.cliente_nome||"—"}</span>
                          <span className="text-white font-medium">{fmt(n.valor_total||0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {conferencia.foraDosintegra.length === 0 && conferencia.totalNotas > 0 && (
                  <p className="text-xs text-green-400">✓ Todo o faturamento do período está coberto pelo SINTEGRA.</p>
                )}
              </div>
            )}
          </div>

          {resultado && (
            <div className={`rounded-lg p-3 text-xs ${resultado.sucesso ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
              {resultado.sucesso ? (
                <>
                  <p className="font-semibold mb-2">✓ Gerado: {resultado.totalNotas} nota(s) — {resultado.periodo}</p>
                  {resultado.debug54 && resultado.debug54.length > 0 && (
                    <div className="mt-2">
                      <p className="text-yellow-400 font-bold mb-1">Diagnóstico Reg.54 (NF | ITEM | COD):</p>
                      {resultado.debug54.map((l, i) => (
                        <div key={i} className="font-mono text-green-300 text-xs break-all">
                          NF={l.substring(24,30)} ITEM={l.substring(30,33)} COD={l.substring(33,47).trim()}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : `Erro: ${resultado.erro}`}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">
            Fechar
          </button>
          <button onClick={gerar} disabled={gerando || (modo==="periodo" && (!dataInicio||!dataFim))}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-50 transition-all"
            style={{ background: "#00ff00", color: "#000" }}
            onMouseEnter={e => { if(!gerando) e.currentTarget.style.background="#00dd00"; }}
            onMouseLeave={e => e.currentTarget.style.background="#00ff00"}>
            {gerando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {gerando ? "Gerando..." : "Baixar SINTEGRA"}
          </button>
        </div>
      </div>
    </div>
  );
}