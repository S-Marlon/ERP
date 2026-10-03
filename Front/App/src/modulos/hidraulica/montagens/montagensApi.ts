// API do módulo Hidráulica · Montagens (/api/modulos/hidraulica/montagens)
const API = 'http://localhost:3001/api/modulos/hidraulica/montagens';

export interface FichaMangueira {
  equipamento?: string; posicao?: string; bitola?: string; comprimentoM?: number | null; quantidade?: number;
  terminalA?: string; terminalB?: string; angulo?: string; pressaoTrabalho?: string; observacao?: string;
}

export interface FichaSalva extends FichaMangueira {
  idMangueira: number; idOs: number | null; idVenda: number | null; idCliente: number | null; cliente: string | null; criadoEm: string;
}

const pedir = async <T,>(url: string, init: RequestInit | undefined, erro: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || erro);
  return d as T;
};

export const montagensApi = {
  salvarFichasDaVenda: (idVenda: number, fichas: FichaMangueira[]) => pedir<{ ids: number[] }>(`${API}/fichas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idVenda, fichas }),
  }, 'Erro ao salvar as fichas.'),
  listarFichas: (filtros: { idCliente?: number | null; busca?: string }) =>
    pedir<FichaSalva[]>(`${API}/fichas?${new URLSearchParams(Object.entries(filtros).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))}`, undefined, 'Erro ao listar as fichas.'),
};
