// Global modal store - singleton pattern
let listeners = [];
let state = { isOpen: false, tipo: 'alerta', mensagem: '', titulo: '', onConfirm: null };

function notify() {
  listeners.forEach(l => l(state));
}

function close() {
  state = { isOpen: false, tipo: 'alerta', mensagem: '', titulo: '', onConfirm: null };
  notify();
}

export function mostrarAlerta(mensagem, titulo) {
  state = {
    isOpen: true,
    tipo: 'alerta',
    mensagem,
    titulo: titulo || 'Aviso',
    onConfirm: () => { close(); }
  };
  notify();
}

export function mostrarConfirm(mensagem, onConfirm, titulo) {
  state = {
    isOpen: true,
    tipo: 'confirm',
    mensagem,
    titulo: titulo || 'Confirmar Ação',
    onConfirm: () => { close(); if (onConfirm) onConfirm(); }
  };
  notify();
}

export function fecharAviso() { close(); }
export function getEstado() { return state; }
export function subscribe(l) {
  listeners.push(l);
  return () => { listeners = listeners.filter(x => x !== l); };
}