// Quais módulos plugáveis estão ligados nesta loja (GET /api/sistema/modulos). Carregado uma vez e
// recarregado ao ligar/desligar em Configurações › Módulos.
import { useEffect, useSyncExternalStore } from 'react';
import { API_URL } from '../shared/api/config';

const API = `${API_URL}/api/sistema/modulos`;

export interface ModuloInfo { codigo: string; nome: string; area: string; descricao: string; ativo: boolean }

let estado: { carregado: boolean; lista: ModuloInfo[]; ativos: Set<string> } = { carregado: false, lista: [], ativos: new Set() };
const ouvintes = new Set<() => void>();
let carregando: Promise<void> | null = null;

const definir = (lista: ModuloInfo[]) => {
  estado = { carregado: true, lista, ativos: new Set(lista.filter(m => m.ativo).map(m => m.codigo)) };
  ouvintes.forEach(o => o());
};

export const recarregarModulos = () => {
  carregando = fetch(API)
    .then(r => (r.ok ? r.json() : []))
    .then((lista: ModuloInfo[]) => definir(Array.isArray(lista) ? lista : []))
    .catch(() => definir([]));
  return carregando;
};

export const salvarModulo = async (codigo: string, ativo: boolean) => {
  const r = await fetch(`${API}/${codigo}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'Rota não encontrada: reinicie o backend.' : 'Erro ao salvar o módulo.'));
  await recarregarModulos();
};

export const useModulos = () => {
  const atual = useSyncExternalStore((o) => { ouvintes.add(o); return () => { ouvintes.delete(o); }; }, () => estado);
  useEffect(() => { if (!atual.carregado && !carregando) recarregarModulos(); }, [atual.carregado]);
  return atual;
};
