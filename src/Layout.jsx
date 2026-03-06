import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  FileText,
  DollarSign,
  Settings,
  Menu,
  X,
  Wrench,
  ChevronRight,
  LogOut,
  Lock
} from "lucide-react";

const navItems = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Ordens de Serviço", page: "OrdemServico", icon: ClipboardList },
  { name: "Cadastro", page: "Clientes", icon: Users },
  { name: "Produtos", page: "Estoque", icon: Package },
  { name: "Serviços", page: "Servicos", icon: Wrench },
  { name: "Notas Fiscais", page: "NotasFiscais", icon: FileText },
  { name: "Financeiro", page: "Financeiro", icon: DollarSign },
  { name: "Configurações", page: "Configuracoes", icon: Settings },
];

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
      // Busca configurações do banco para pegar senha do admin e usuários extras
      const configs = await fetch ? 
        await (async () => {
          const { base44 } = await import("@/api/base44Client");
          return base44.entities.Configuracao.list("-created_date", 200);
        })() : [];

      // Senha do admin (pode ter sido alterada)
      const senhaAdminConfig = configs.find(c => c.chave === "admin_senha")?.valor;
      const senhaAdminValida = senhaAdminConfig || "admin123";

      if (usuario === "admin" && senha === senhaAdminValida) {
        sessionStorage.setItem("oficina_auth", JSON.stringify({ usuario: "admin", nome: "Administrador", role: "admin" }));
        window.location.reload();
        return;
      }

      // Verifica usuários extras
      const usuariosExtras = configs
        .filter(c => c.chave === "usuario_extra")
        .map(c => { try { return JSON.parse(c.valor); } catch { return null; } })
        .filter(Boolean);

      const encontrado = usuariosExtras.find(u => u.usuario === usuario && u.senha === senha);
      if (encontrado) {
        sessionStorage.setItem("oficina_auth", JSON.stringify({ usuario: encontrado.usuario, nome: encontrado.nome, role: "user" }));
        window.location.reload();
        return;
      }

      setErro("Usuário ou senha incorretos.");
    } catch (err) {
      // fallback se o banco falhar
      if (usuario === "admin" && senha === "admin123") {
        sessionStorage.setItem("oficina_auth", JSON.stringify({ usuario: "admin", nome: "Administrador", role: "admin" }));
        window.location.reload();
        return;
      }
      setErro("Erro ao verificar credenciais. Tente novamente.");
    }
    setCarregando(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center mb-4">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png" alt="MG Autocenter" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-bold text-2xl uppercase" style={{color:"#c00"}}>MG AUTOCENTER</h1>
          <p className="text-gray-500 text-sm mt-1">ERP Automotivo — Acesso Restrito</p>
        </div>

        <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Lock className="w-4 h-4 text-orange-400" />
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
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600"
              placeholder="admin"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-orange-500 placeholder-gray-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [autenticado, setAutenticado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("Administrador");

  useEffect(() => {
    const auth = sessionStorage.getItem("oficina_auth");
    if (auth) {
      const parsed = JSON.parse(auth);
      setNomeUsuario(parsed.nome || "Administrador");
    }
    setAutenticado(!!auth);
    setVerificando(false);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("oficina_auth");
    window.location.reload();
  };

  if (verificando) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!autenticado) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <style>{`
          :root {
            --orange: #f97316;
            --orange-dark: #ea6c0a;
            --bg-dark: #030712;
            --bg-card: #111827;
            --bg-hover: #1f2937;
            --border: #1f2937;
            --text-muted: #6b7280;
          }
          body { background: #030712; }
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: #111827; }
          ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
          .nav-active { background: linear-gradient(90deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%); border-left: 3px solid #f97316; }
          .btn-orange { background: #f97316; color: #fff; transition: all 0.2s; }
          .btn-orange:hover { background: #ea6c0a; }
          aside { flex-shrink: 0; }
        `}</style>

      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300 ${sidebarOpen ? "w-60" : "w-16"}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-800 h-[64px]">
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png" alt="MG Autocenter" className="w-full h-full object-contain" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="font-bold text-sm leading-tight uppercase" style={{color:"#c00"}}>MG AUTOCENTER</p>
              <p className="text-gray-400 text-xs">ERP Automotivo</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? "bg-orange-500/10 text-orange-400 border-l-2 border-orange-500 pl-[10px]"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-orange-400" : "text-gray-500 group-hover:text-white"}`} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Toggle Sidebar */}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-all text-sm"
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
            {sidebarOpen && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6997c92e6dd9fc3c5e8a6579/3fff287a0_LOGO.png" alt="MG Autocenter" className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase" style={{color:"#c00"}}>MG AUTOCENTER</p>
                  <p className="text-gray-400 text-xs">ERP Automotivo</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-orange-500/10 text-orange-400 border-l-2 border-orange-500 pl-[10px]"
                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 md:px-6 flex items-center justify-between h-[64px] flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-white font-semibold text-base md:text-lg">
                {navItems.find((n) => n.page === currentPageName)?.name || currentPageName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-full px-3 py-1.5">
              <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{nomeUsuario.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-gray-300 text-xs font-medium hidden sm:block max-w-[120px] truncate">{nomeUsuario}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-950 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}