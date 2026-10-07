// Adiantamentos (sinais) de clientes (/api/vendas/adiantamentos)
import { useEffect, useState } from 'react';
import { operadorAtual } from '../../caixa/caixaApi';
import { API_URL } from '../../../../shared/api/config';

const API = `${API_URL}/api/vendas/adiantamentos`;

export interface Adiantamento {
  idAdiantamento: number; idCliente: number | null; cliente: string; valor: number; valorUsado: number; saldo: number;
  status: 'ABERTO' | 'USADO' | 'DEVOLVIDO'; forma: string; idCaixa: number | null; origem: string | null; idOrigem: number | null;
  operador: string; observacao: string | null; criadoEm: string;
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || erro);
  return d as T;
};

export const adiantamentosApi = {
  listar: (filtros: { idCliente?: number | null; status?: string; origem?: string; idOrigem?: number }) =>
    pedir<Adiantamento[]>(`${API}?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]))}`,
      undefined, 'Erro ao listar os adiantamentos.'),
  criar: (dados: { idCliente?: number | null; clienteNome?: string; valor: number; forma: string; observacao?: string; origem?: string; idOrigem?: number }) =>
    pedir<{ idAdiantamento: number }>(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, operador: operadorAtual() }),
    }, 'Erro ao registrar o adiantamento.'),
  devolver: (id: number, motivo: string) => pedir<{ valorDevolvido: number }>(`${API}/${id}/devolver`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo, operador: operadorAtual() }),
  }, 'Erro ao devolver.'),
};

/** Sinais em aberto do cliente e, opcionalmente, os de uma origem (ex.: a OS que está sendo entregue). */
export const useAdiantamentosAbertos = (idCliente: number | null | undefined, origem?: { origem: string; idOrigem: number } | null) => {
  const [lista, setLista] = useState<Adiantamento[]>([]);
  const chaveOrigem = origem ? `${origem.origem}:${origem.idOrigem}` : '';
  useEffect(() => {
    let ativo = true;
    const buscas: Promise<Adiantamento[]>[] = [];
    if (idCliente) buscas.push(adiantamentosApi.listar({ idCliente, status: 'ABERTO' }));
    if (origem) buscas.push(adiantamentosApi.listar({ origem: origem.origem, idOrigem: origem.idOrigem, status: 'ABERTO' }));
    if (buscas.length === 0) { setLista([]); return; }
    Promise.all(buscas)
      .then(rs => { if (ativo) setLista([...new Map(rs.flat().map(a => [a.idAdiantamento, a])).values()].filter(a => a.saldo > 0.004)); })
      .catch(() => { if (ativo) setLista([]); });
    return () => { ativo = false; };
  }, [idCliente, chaveOrigem]); // eslint-disable-line react-hooks/exhaustive-deps
  return lista;
};
