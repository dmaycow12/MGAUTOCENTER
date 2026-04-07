import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ClipboardList,
  Users,
  Package,
  FileText,
  DollarSign,
  Settings,
  Wrench,
  BarChart3,
  Box
} from "lucide-react";

const navItems = [
  { name: "DASHBOARD", page: "Dashboard", icon: BarChart3 },
  { name: "VENDAS", page: "Vendas", icon: ClipboardList },
  { name: "CADASTRO", page: "Clientes", icon: Users },
  { name: "PRODUTOS", page: "Estoque", icon: Package },
  { name: "SERVIÇOS", page: "Servicos", icon: Wrench },
  { name: "ATIVOS", page: "Ativos", icon: Box },
  { name: "NOTAS", page: "NotasFiscais", icon: FileText },
  { name: "FINANCEIRO", page: "Financeiro", icon: DollarSign },
  { name: "CONFIGURAÇÕES", page: "Configuracoes", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-gray-100 flex" style={{background:"#000"}}>
      <style>{`
          body { background: #000; }
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: #111; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
          aside { flex-shrink: 0; }
        `}</style>

      <div className="w-full flex flex-col min-w-0">
        {/* Top Bar - Desktop */}
        <header className="hidden md:flex fixed top-4 left-0 right-0 px-6 items-center justify-center z-40">
          <nav className="flex items-center gap-1 w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === `/${item.page}`;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg font-bold transition-all min-w-0 flex-1"
                  style={{
                    background: isActive ? "#062C9B" : "#1f2937",
                    color: "#fff",
                    border: "none",
                    fontSize: "clamp(8px, 1vw, 12px)"
                  }}
                >
                  <Icon style={{width:"clamp(10px,1.2vw,16px)", height:"clamp(10px,1.2vw,16px)", flexShrink:0}} />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 pt-14 md:p-6 md:pt-24" style={{background:"#000"}}>
          {children}
        </main>

        {/* Bottom Menu - Mobile */}
        <div className="md:hidden" style={{
          position:"fixed", top:0, left:0, right:0, height:"56px", zIndex:9999,
          background:"#111", borderBottom:"1px solid #222",
          display:"grid", gridTemplateColumns:`repeat(${navItems.length}, 1fr)`,
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === `/${item.page}`;
            return (
              <button
                key={item.page}
                onClick={() => navigate(`/${item.page}`)}
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background: isActive ? "rgba(6,44,155,0.4)" : "transparent",
                  border:"none", outline:"none", cursor:"pointer",
                  padding:0, margin:0, width:"100%", height:"56px",
                  WebkitTapHighlightColor:"transparent",
                }}
              >
                <Icon style={{width:"24px", height:"24px", color: isActive ? "#4d7fff" : "#9ca3af", pointerEvents:"none"}} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}