import React, { useState, useEffect } from "react";
import { Printer } from "lucide-react";

const COLUNAS = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição" },
  { key: "marca", label: "Marca" },
  { key: "faltante", label: "Faltante" },
  { key: "quantidade", label: "Qtd Atual" },
  { key: "estoque_minimo", label: "Estoque Mín." },
];

const COLUNAS_DEFAULT = { codigo: true, descricao: true, marca: true, faltante: true, quantidade: true, estoque_minimo: true };

export default function ReposicaoPrint() {
  const [baixo, setBaixo] = useState([]);
  const [colunas, setColunas] = useState(COLUNAS_DEFAULT);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deveImprimir = params.get("print") === "1";

    const colunasCfg = sessionStorage.getItem("reposicao_print_colunas");
    if (colunasCfg) {
      try { setColunas({ ...COLUNAS_DEFAULT, ...JSON.parse(colunasCfg) }); } catch {}
      sessionStorage.removeItem("reposicao_print_colunas");
    }

    const cached = sessionStorage.getItem("reposicao_print_dados");
    if (cached) {
      try {
        setBaixo(JSON.parse(cached));
        sessionStorage.removeItem("reposicao_print_dados");
        if (deveImprimir) setTimeout(() => window.print(), 500);
        return;
      } catch {}
    }
  }, []);

  const colunasAtivas = COLUNAS.filter(c => colunas[c.key]);

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #999; padding: 6px 10px; text-align: center; font-size: 13px; }
        th { background: #e5e7eb; font-weight: bold; }
        .sel-hint { background: #fef9c3; border: 1px solid #facc15; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; font-size: 13px; }
        .btn-imprimir { background: #062C9B; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .btn-imprimir:hover { background: #05247d; }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button className="btn-imprimir" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </button>
      </div>

      <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>REPOSIÇÃO DE ESTOQUE</h2>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>{baixo.length} produto(s) com estoque baixo — {new Date().toLocaleDateString("pt-BR")}</p>

      <div className="sel-hint no-print">
        💡 Selecione a tabela abaixo (clique e arraste ou Ctrl+A) e use <strong>Ctrl+C</strong> para copiar, depois cole no Excel com <strong>Ctrl+V</strong>.
      </div>

      <table>
        <thead>
          <tr>
            {colunasAtivas.map(c => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baixo.map(i => {
            const falta = Number(i.estoque_minimo || 0) - Number(i.quantidade || 0);
            const celulas = {
              codigo: i.codigo || "",
              descricao: i.descricao || "",
              marca: i.marca || "",
              faltante: falta,
              quantidade: i.quantidade,
              estoque_minimo: i.estoque_minimo,
            };
            return (
              <tr key={i.id}>
                {colunasAtivas.map(c => (
                  <td key={c.key} style={["codigo", "descricao", "marca"].includes(c.key) ? { textAlign: "left" } : undefined}>
                    {celulas[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}