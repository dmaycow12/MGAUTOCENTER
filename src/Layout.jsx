import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ClipboardList,
  Users,
  Package,
  FileText,
  DollarSign,
  Settings,
  Wrench,
  LogOut,
  Lock,
  BarChart3,
  Box
} from "lucide-react";

const navItems = [
  { name: "DASHBOARD", page: "Dashboard", icon: BarChart3 },
  { name: "VENDAS", page: "OrdemServico", icon: ClipboardList },
  { name: "CADASTRO", page: "Clientes", icon: Users },
  { name: "PRODUTOS", page: "Estoque", icon: Package },
  { name: "SERVIÇOS", page: "Servicos", icon: Wrench },
  { name: "ATIVOS", page: "Ativos", icon: Box },
  { name: "NOTAS", page: "NotasFiscais", icon: FileText },
  { name: "FINANCEIRO", page: "Financeiro", icon: DollarSign },
  { name: "CONFIGURAÇÕES", page: "Configuracoes", icon: Settings },
];

// Vermelho da logo
const RED = "#cc0000";
const RED_DARK = "#aa0000";

function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    try {
      const response = await base44.functions.invoke("authLogin", { usuario, senha });
      const data = response.data;
      if (data?.sucesso) {
        // Salva token no sessionStorage como fallback (para iframes que bloqueiam cookies)
        sessionStorage.setItem("oficina_ui", JSON.stringify({
          nome: data.nome,
          usuario: data.usuario,
          tipo: data.tipo,
        }));
        if (data.token) {
          sessionStorage.setItem("oficina_token", data.token);
        }
        window.location.reload();
        return;
      }
      setErro(data?.erro || "Usuário ou senha incorretos.");
    } catch (err) {
      setErro("Erro ao verificar: " + (err.response?.data?.erro || err.message));
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:"#000"}}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-32 h-32 flex items-center justify-center mb-4">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png" alt="MG Autocenter" className="w-full h-full object-contain" />
          </div>
        </div>

        <form onSubmit={handleLogin} className="border rounded-2xl p-6 space-y-4" style={{background:"#111", borderColor:"#222"}}>
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Lock className="w-4 h-4" style={{color: RED}} />
            <span>Entre com suas credenciais</span>
          </div>

          {erro && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">Usuário</label>
            <input
              type="text"
              value={usuario}
              onChange={e => setUsuario(e.target.value)}
              className="w-full text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none placeholder-gray-600"
              style={{background:"#1a1a1a", border:"1px solid #333"}}
              placeholder=""
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none placeholder-gray-600"
              style={{background:"#1a1a1a", border:"1px solid #333"}}
              placeholder=""
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{background: RED}}
            onMouseEnter={e => e.currentTarget.style.background = RED_DARK}
            onMouseLeave={e => e.currentTarget.style.background = RED}
          >
            {carregando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const [autenticado, setAutenticado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("Administrador");

  const [tipoUsuario, setTipoUsuario] = useState("gerente");

  useEffect(() => {
    // Verifica token — via cookie httpOnly ou fallback sessionStorage (para iframes)
    const tokenFallback = sessionStorage.getItem("oficina_token");
    base44.functions.invoke("authVerify", tokenFallback ? { token: tokenFallback } : {})
      .then(res => {
        const data = res.data;
        if (data?.valido) {
          setNomeUsuario(data.nome || "Administrador");
          setTipoUsuario(data.tipo || "gerente");
          setAutenticado(true);
          // Atualiza cache de UI
          sessionStorage.setItem("oficina_ui", JSON.stringify({
            nome: data.nome,
            usuario: data.usuario,
            tipo: data.tipo,
          }));
        } else {
          sessionStorage.removeItem("oficina_ui");
          setAutenticado(false);
        }
      })
      .catch(() => {
        sessionStorage.removeItem("oficina_ui");
        setAutenticado(false);
      })
      .finally(() => setVerificando(false));
  }, []);

  const handleLogout = async () => {
    sessionStorage.removeItem("oficina_ui");
    sessionStorage.removeItem("oficina_token");
    await base44.functions.invoke("authLogout", {});
    window.location.reload();
  };

  if (currentPageName === "OrcamentoPublico") return <>{children}</>;

  // Restrição por tipo de usuário
  if (autenticado && tipoUsuario === "gerente" && !["Dashboard"].includes(currentPageName)) {
    window.location.href = "/Dashboard";
    return null;
  }
  if (autenticado && tipoUsuario === "contador" && !["NotasFiscais"].includes(currentPageName)) {
    window.location.href = "/NotasFiscais";
    return null;
  }
  if (autenticado && tipoUsuario === "vendedor" && !["OrdemServico"].includes(currentPageName)) {
    window.location.href = "/OrdemServico";
    return null;
  }

  if (verificando) return (
    <div className="min-h-screen flex items-center justify-center" style={{background:"#000"}}>
      <div className="w-8 h-8 border-t-transparent rounded-full animate-spin" style={{border:`2px solid ${RED}`, borderTopColor:"transparent"}} />
    </div>
  );

  if (!autenticado && currentPageName !== "OrcamentoPublico") return <LoginPage />;

  const isRestrito = tipoUsuario === "contador" || tipoUsuario === "vendedor";
  const tituloRestrito = tipoUsuario === "contador" ? "NOTAS" : tipoUsuario === "vendedor" ? "VENDAS" : "";

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

      {/* Main Content */}
      <div className="w-full flex flex-col min-w-0">

        {isRestrito ? (
          /* Header simplificado para usuários restritos */
          <header className="fixed top-0 left-0 right-0 px-6 py-3 flex items-center justify-between z-40" style={{background:"#111", borderBottom:"1px solid #222"}}>
            <span className="text-white font-bold text-lg tracking-widest">{tituloRestrito}</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm">{nomeUsuario}</span>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500 transition-all">
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </div>
          </header>
        ) : (
          /* Top Bar - Desktop Flutuante para admin */
          <header className="hidden md:flex fixed top-4 left-0 right-0 px-6 items-center justify-center z-40">
            <nav className="flex items-center gap-1 w-full">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
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
        )}

        {/* Page Content */}
        <main className={`flex-1 overflow-auto ${isRestrito ? "p-4 pt-20 md:p-6 md:pt-20" : "p-4 pt-16 md:p-6 md:pt-24"}`} style={{background:"#000"}}>
          {children}
        </main>

        {/* Bottom Menu - Mobile (apenas admin) */}
        {!isRestrito && (
          <nav className="md:hidden fixed top-2 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 px-2 py-2 rounded-2xl z-40" style={{background:"rgba(17,17,17,0.9)", backdropFilter:"blur(10px)", border:"1px solid rgba(34,34,34,0.8)", maxWidth:"calc(100% - 16px)"}}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className="flex items-center justify-center p-1.5 rounded-lg transition-all flex-shrink-0"
                  title={item.name}
                  style={{color: isActive ? "#fff" : "#6b7280"}}
                >
                  <Icon className="w-4 h-4" style={{color: isActive ? "#062C9B" : "#6b7280"}} />
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}