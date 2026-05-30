import { useState } from "react";

const SENHA_CORRETA = "8407";
const STORAGE_KEY = "mgauto_unlocked";

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);

  if (unlocked) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (senha === SENHA_CORRETA) {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setErro(true);
      setSenha("");
      setTimeout(() => setErro(false), 2000);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#000",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#111", border: "1px solid #222", borderRadius: "16px",
        padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
        width: "100%", maxWidth: "320px",
      }}>
        <div style={{ color: "#fff", fontSize: "22px", fontWeight: "bold", letterSpacing: "2px" }}>
          MG AUTO
        </div>
        <div style={{ color: "#9ca3af", fontSize: "13px" }}>ACESSO RESTRITO</div>

        <input
          type="password"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          placeholder="Senha"
          autoFocus
          style={{
            width: "100%", padding: "12px 16px",
            background: erro ? "rgba(220,38,38,0.1)" : "#1f2937",
            border: `1px solid ${erro ? "#dc2626" : "#374151"}`,
            borderRadius: "10px", color: "#fff", fontSize: "16px",
            outline: "none", textAlign: "center", letterSpacing: "6px",
            transition: "border 0.2s",
          }}
        />

        {erro && (
          <div style={{ color: "#f87171", fontSize: "13px" }}>Senha incorreta</div>
        )}

        <button type="submit" style={{
          width: "100%", padding: "12px",
          background: "#062C9B", color: "#fff",
          border: "none", borderRadius: "10px",
          fontSize: "14px", fontWeight: "bold", cursor: "pointer",
          letterSpacing: "1px",
        }}>
          ENTRAR
        </button>
      </form>
    </div>
  );
}