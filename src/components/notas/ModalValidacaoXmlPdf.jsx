import { X } from "lucide-react";

export default function ModalValidacaoXmlPdf({ resultado, onClose }) {
  if (!resultado) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h2 className="text-white font-semibold text-lg">Validação de XML e PDF</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <p className="text-gray-500 text-xs mb-1">Total de Notas Emitidas</p>
              <p className="text-2xl font-bold text-white">{resultado.resumo.totalEmitidas}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <p className="text-gray-500 text-xs mb-1">Total de Notas Importadas</p>
              <p className="text-2xl font-bold text-white">{resultado.resumo.totalImportadas}</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-white font-semibold text-sm">Notas Emitidas</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs mb-1">Sem XML</p>
                <p className="text-2xl font-bold text-red-500">{resultado.resumo.emitidasSemXml}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs mb-1">Sem PDF</p>
                <p className="text-2xl font-bold text-red-500">{resultado.resumo.emitidasSemPdf}</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-orange-400 text-xs mb-1">Sem XML ou PDF</p>
                <p className="text-2xl font-bold text-orange-500">{resultado.resumo.emitidasSemXmlOuPdf}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-white font-semibold text-sm">Notas Importadas</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs mb-1">Sem XML</p>
                <p className="text-2xl font-bold text-red-500">{resultado.resumo.importadasSemXml}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs mb-1">Sem PDF</p>
                <p className="text-2xl font-bold text-red-500">{resultado.resumo.importadasSemPdf}</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-orange-400 text-xs mb-1">Sem XML ou PDF</p>
                <p className="text-2xl font-bold text-orange-500">{resultado.resumo.importadasSemXmlOuPdf}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {resultado.detalhes.emitidasSemXml.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-red-400 font-semibold text-sm">Emitidas sem XML ({resultado.detalhes.emitidasSemXml.length})</h4>
                <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1 border border-gray-700">
                  {resultado.detalhes.emitidasSemXml.map(n => (
                    <div key={n.id} className="text-xs text-gray-300 border-b border-gray-700 pb-1">
                      <div className="font-semibold text-gray-100">{n.tipo} {n.numero}/{n.serie}</div>
                      <div className="text-gray-400">{n.cliente}</div>
                      {n.temPdf && <div className="text-green-400 text-xs">✓ PDF disponível</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.detalhes.emitidasSemPdf.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-red-400 font-semibold text-sm">Emitidas sem PDF ({resultado.detalhes.emitidasSemPdf.length})</h4>
                <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1 border border-gray-700">
                  {resultado.detalhes.emitidasSemPdf.map(n => (
                    <div key={n.id} className="text-xs text-gray-300 border-b border-gray-700 pb-1">
                      <div className="font-semibold text-gray-100">{n.tipo} {n.numero}/{n.serie}</div>
                      <div className="text-gray-400">{n.cliente}</div>
                      {n.temXml && <div className="text-green-400 text-xs">✓ XML disponível</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.detalhes.importadasSemXml.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-red-400 font-semibold text-sm">Importadas sem XML ({resultado.detalhes.importadasSemXml.length})</h4>
                <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1 border border-gray-700">
                  {resultado.detalhes.importadasSemXml.map(n => (
                    <div key={n.id} className="text-xs text-gray-300 border-b border-gray-700 pb-1">
                      <div className="font-semibold text-gray-100">{n.tipo} {n.numero}/{n.serie}</div>
                      <div className="text-gray-400">{n.cliente}</div>
                      {n.temPdf && <div className="text-green-400 text-xs">✓ PDF disponível</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultado.detalhes.importadasSemPdf.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-red-400 font-semibold text-sm">Importadas sem PDF ({resultado.detalhes.importadasSemPdf.length})</h4>
                <div className="bg-gray-800 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1 border border-gray-700">
                  {resultado.detalhes.importadasSemPdf.map(n => (
                    <div key={n.id} className="text-xs text-gray-300 border-b border-gray-700 pb-1">
                      <div className="font-semibold text-gray-100">{n.tipo} {n.numero}/{n.serie}</div>
                      <div className="text-gray-400">{n.cliente}</div>
                      {n.temXml && <div className="text-green-400 text-xs">✓ XML disponível</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {resultado.detalhes.emitidasSemXml.length === 0 && resultado.detalhes.emitidasSemPdf.length === 0 && resultado.detalhes.importadasSemXml.length === 0 && resultado.detalhes.importadasSemPdf.length === 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-green-400 font-semibold">✓ Todas as notas estão com XML e PDF!</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white rounded-lg font-medium bg-gray-700 hover:bg-gray-600 transition-all">Fechar</button>
        </div>
      </div>
    </div>
  );
}