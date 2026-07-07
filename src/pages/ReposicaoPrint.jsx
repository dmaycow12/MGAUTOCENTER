import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function ReposicaoPrint() {
  const [baixo, setBaixo] = useState([]);

  useEffect(() => {
    base44.entities.Configuracao.list("-created_date", 100).then(async (configs) => {
      const excludedCfg = configs.find(c => c.chave === "reposicao_excluded_ids");
      const excluded = new Set();
      if (excludedCfg) {
        try { JSON.parse(excludedCfg.valor || "[]").forEach(id => excluded.add(id)); } catch {}
      }
      const data = await base44.entities.Estoque.list("-created_date", 500);
      setBaixo(data.filter(i =>
        Number(i.quantidade || 0) < Number(i.estoque_minimo || 0) && !excluded.has(i.id)
      ));
    });
  }, []);

  return (
    <div style={{ background: "#fff", color: "#000", minHeight: "100vh", padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media print {
          body { background: #fff !important; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #999; padding: 6px 10px; text-align: center; font-size: 13px; }
        th { background: #e5e7eb; font-weight: bold; }
        .sel-hint { background: #fef9c3; border: 1px solid #facc15; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; font-size: 13px; }
      `}</style>

      <h2 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>REPOSIÇÃO DE ESTOQUE</h2>
      <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>{baixo.length} produto(s) com estoque baixo — {new Date().toLocaleDateString("pt-BR")}</p>

      <div className="sel-hint">
        💡 Selecione a tabela abaixo (clique e arraste ou Ctrl+A) e use <strong>Ctrl+C</strong> para copiar, depois cole no Excel com <strong>Ctrl+V</strong>.
      </div>

      <table>
        <thead>
          <tr>
            <th>Quantidade Faltante</th>
            <th>Código do Produto</th>
          </tr>
        </thead>
        <tbody>
          {baixo.map(i => {
            const falta = Number(i.estoque_minimo || 0) - Number(i.quantidade || 0);
            return (
              <tr key={i.id}>
                <td>{falta}</td>
                <td style={{ textAlign: "left" }}>{i.codigo || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}