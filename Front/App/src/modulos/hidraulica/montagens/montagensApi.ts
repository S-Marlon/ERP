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

// ---------------------------------------------------------------------------------------------
// OS de montagem
// ---------------------------------------------------------------------------------------------
export const ORIGEM_SINAL_OS = 'HIDRAULICA_MONTAGENS_OS';
export type EtapaOs = 'ABERTA' | 'AGUARDANDO_MATERIAL' | 'EM_MONTAGEM' | 'PRONTA' | 'ENTREGUE' | 'CANCELADA';

export interface ItemOs {
  idOsItem?: number; idItem: number; idUnidade: number | null; descricao: string; quantidade: number; unidade?: string;
  precoUnitario: number; total?: number; servico?: boolean; estoque?: number; faltaMaterial?: boolean;
}
export interface MangueiraOs extends FichaMangueira { idMangueira?: number; itens: ItemOs[] }

export interface OsResumo {
  idOs: number; status: EtapaOs; idCliente: number | null; cliente: string; contato: string | null; equipamento: string | null;
  previsao: string | null; observacao: string | null; operador: string; idVenda: number | null; total: number; sinal: number;
  qtdMangueiras: number; criadoEm: string; entregueEm: string | null;
}

export interface OsDetalhe extends Omit<OsResumo, 'sinal' | 'qtdMangueiras'> {
  mangueiras: MangueiraOs[]; itensAvulsos: ItemOs[];
  sinais: Array<{ idAdiantamento: number; valor: number; saldo: number; status: string; forma: string; criadoEm: string }>;
  sinalAberto: number; saldoAPagar: number; faltaMaterial: boolean; canceladoEm: string | null; motivoCancelamento: string | null;
}

export interface OsEntrada {
  idCliente?: number | null; clienteNome?: string; contato?: string; equipamento?: string; previsao?: string | null; observacao?: string;
  mangueiras: Array<FichaMangueira & { itens: Array<{ idItem: number; idUnidade?: number | null; quantidade: number; precoUnitario?: number; unidadeBase?: boolean }> }>;
  itensAvulsos: Array<{ idItem: number; idUnidade?: number | null; quantidade: number; precoUnitario?: number }>;
}

const enviar = (metodo: 'POST' | 'PUT', corpo: unknown): RequestInit => ({ method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });

export const osApi = {
  listar: (status: string, busca = '') => pedir<OsResumo[]>(`${API}/os?${new URLSearchParams({ status, busca })}`, undefined, 'Erro ao listar as OS.'),
  detalhe: (id: number) => pedir<OsDetalhe>(`${API}/os/${id}`, undefined, 'Erro ao carregar a OS.'),
  criar: (dados: OsEntrada) => pedir<{ idOs: number }>(`${API}/os`, enviar('POST', dados), 'Erro ao abrir a OS.'),
  salvar: (id: number, dados: OsEntrada) => pedir<{ idOs: number }>(`${API}/os/${id}`, enviar('PUT', dados), 'Erro ao salvar a OS.'),
  etapa: (id: number, status: EtapaOs) => pedir<{ status: EtapaOs }>(`${API}/os/${id}/status`, enviar('POST', { status }), 'Erro ao mudar a etapa.'),
  sinal: (id: number, valor: number, forma: string, operador: string) =>
    pedir<{ idAdiantamento: number }>(`${API}/os/${id}/sinal`, enviar('POST', { valor, forma, operador }), 'Erro ao receber o sinal.'),
  cancelar: (id: number, motivo: string, devolverSinal: boolean, operador: string) =>
    pedir<{ devolvido: number }>(`${API}/os/${id}/cancelar`, enviar('POST', { motivo, devolverSinal, operador }), 'Erro ao cancelar a OS.'),
  entregar: (id: number, idVenda: number) => pedir<{ success: boolean }>(`${API}/os/${id}/entregar`, enviar('POST', { idVenda }), 'Erro ao registrar a entrega.'),
};

export const ETAPAS_OS: Record<EtapaOs, { label: string; color: string }> = {
  ABERTA: { label: 'Aberta', color: 'blue' },
  AGUARDANDO_MATERIAL: { label: 'Aguardando material', color: 'orange' },
  EM_MONTAGEM: { label: 'Em montagem', color: 'purple' },
  PRONTA: { label: 'Pronta', color: 'green' },
  ENTREGUE: { label: 'Entregue', color: 'default' },
  CANCELADA: { label: 'Cancelada', color: 'red' },
};
