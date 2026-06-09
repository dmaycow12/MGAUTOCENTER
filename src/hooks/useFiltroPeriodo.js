import { useState, useRef, useEffect } from "react";

export function useFiltroPeriodo(storagePrefix = "notas") {
  const hoje = new Date();
  const [filtroMes, setFiltroMes] = useState(() => Number(localStorage.getItem(`${storagePrefix}_filtroMes`)) || hoje.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState(() => Number(localStorage.getItem(`${storagePrefix}_filtroAno`)) || hoje.getFullYear());
  const [usandoOutroPeriodo, setUsandoOutroPeriodo] = useState(() => localStorage.getItem(`${storagePrefix}_usandoOutro`) === "true");
  const [customRange, setCustomRange] = useState(() => { try { return JSON.parse(localStorage.getItem(`${storagePrefix}_customRange`)); } catch { return null; } });
  const [periodoDropOpen, setPeriodoDropOpen] = useState(false);
  const [outroPeriodoInicio, setOutroPeriodoInicio] = useState("");
  const [outroPeriodoFim, setOutroPeriodoFim] = useState("");
  const periodoDropRef = useRef(null);

  const salvarCustom = (range) => { 
    setCustomRange(range); 
    localStorage.setItem(`${storagePrefix}_customRange`, JSON.stringify(range)); 
    setUsandoOutroPeriodo(true); 
    localStorage.setItem(`${storagePrefix}_usandoOutro`, "true"); 
  };

  const salvarMes = (m, a) => { 
    setFiltroMes(m); 
    localStorage.setItem(`${storagePrefix}_filtroMes`, m); 
    setFiltroAno(a); 
    localStorage.setItem(`${storagePrefix}_filtroAno`, a); 
    setUsandoOutroPeriodo(false); 
    localStorage.setItem(`${storagePrefix}_usandoOutro`, "false"); 
    setCustomRange(null); 
    localStorage.removeItem(`${storagePrefix}_customRange`); 
  };

  const navegarMes = (dir) => {
    let m = filtroMes + dir, a = filtroAno;
    if (m > 12) { m = 1; a++; } 
    if (m < 1) { m = 12; a--; }
    salvarMes(m, a);
  };

  const aplicarOutroPeriodo = () => {
    if (!outroPeriodoInicio || !outroPeriodoFim) return;
    salvarCustom({ inicio: outroPeriodoInicio, fim: outroPeriodoFim });
    setPeriodoDropOpen(false);
  };

  const pad = n => String(n).padStart(2, "0");
  const periodoRange = usandoOutroPeriodo && customRange
    ? customRange
    : { inicio: `${filtroAno}-${pad(filtroMes)}-01`, fim: `${filtroAno}-${pad(filtroMes)}-31` };

  return {
    filtroMes, setFiltroMes,
    filtroAno, setFiltroAno,
    usandoOutroPeriodo, setUsandoOutroPeriodo,
    customRange, setCustomRange,
    periodoDropOpen, setPeriodoDropOpen,
    outroPeriodoInicio, setOutroPeriodoInicio,
    outroPeriodoFim, setOutroPeriodoFim,
    periodoDropRef,
    salvarMes, salvarCustom, navegarMes, aplicarOutroPeriodo,
    periodoRange
  };
}