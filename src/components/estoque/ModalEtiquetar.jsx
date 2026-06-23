import React from "react";
import { X, Printer, Tag } from "lucide-react";

export default function ModalEtiquetar({ items, onClose }) {
  const imprimirEtiquetas = () => {
    const win = window.open("", "_blank", "width=800,height=600");
    const labels = items.map(item => {
      const codigo = (item.codigo || "").toUpperCase();
      const descricao = (item.descricao || "").toUpperCase();
      const valor = (item.valor_venda || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return `
        <div class="etiqueta">
          <div class="etiqueta-codigo">${codigo}</div>
          <div class="etiqueta-descricao">${descricao}</div>
          <div class="etiqueta-valor">${valor}</div>
        </div>`;
    }).join("");

    win.document.write(`
      <html>
      <head>
        <title>Etiquetas</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 10mm; }
          .etiquetas { display: flex; flex-wrap: wrap; gap: 5mm; }
          .etiqueta {
            width: 70mm; height: 40mm;
            border: 1px dashed #999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 3mm; text-align: center; page-break-inside: avoid;
          }
          .etiqueta-codigo { font-size: 11px; font-weight: bold; color: #333; margin-bottom: 2mm; }
          .etiqueta-descricao { font-size: 9px; color: #555; margin-bottom: 2mm; line-height: 1.2; max-height: 10mm; overflow: hidden; }
          .etiqueta-valor { font-size: 16px; font-weight: bold; color: #000; }
          @media print { body { padding: 0; } .etiqueta { border: 1px dashed #ccc; } }
        </style>
      </head>
      <body>
        <div class="etiquetas">${labels}</div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-green-400" /> Etiquetar Produtos
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <p className="text-sm text-gray-400">
            {items.length} produto(s) selecionado(s) para etiquetagem. Clique em imprimir para gerar as etiquetas.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 px-3">Código</th>
                  <th className="text-left py-2 px-3">Descrição</th>
                  <th className="text-right py-2 px-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-800">
                    <td className="py-2 px-3 text-gray-400 font-mono">{item.codigo || "—"}</td>
                    <td className="py-2 px-3 text-white font-medium">{item.descricao}</td>
                    <td className="py-2 px-3 text-right text-green-400 font-medium">
                      R$ {(item.valor_venda || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:text-white transition-all">Cancelar</button>
          <button
            onClick={imprimirEtiquetas}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all"
            style={{ background: "#00ff00", color: "#000" }}
          >
            <Printer className="w-4 h-4" /> Imprimir Etiquetas
          </button>
        </div>
      </div>
    </div>
  );
}