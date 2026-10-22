// API do módulo Obras de poços (/api/modulos/hidraulica/pocos): obras e poços.
import { API_URL } from '../../../shared/api/config';
import type { Dados } from './relatorioPoco';

const API = `${API_URL}/api/modulos/hidraulica/pocos`;

export type Servico = 'PERFURACAO' | 'INSTALACAO' | 'LIMPEZA' | 'MANUTENCAO' | 'TROCA_BOMBA' | 'TESTE_VAZAO' | 'OUTRO';
export type SituacaoObra = 'ORCAMENTO' | 'AGUARDANDO_SINAL' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'CANCELADA';

export const SERVICOS: Record<Servico, string> = {
  PERFURACAO: 'Perfuração', INSTALACAO: 'Instalação da bomba', LIMPEZA: 'Limpeza', MANUTENCAO: 'Manutenção',
  TROCA_BOMBA: 'Troca de bomba', TESTE_VAZAO: 'Teste de vazão', OUTRO: 'Outro',
};
export const SITUACOES_OBRA: Record<SituacaoObra, { texto: string; cor: string; acao: string }> = {
  ORCAMENTO: { texto: 'Orçamento', cor: 'default', acao: 'Voltar para orçamento' },
  AGUARDANDO_SINAL: { texto: 'Aguardando sinal', cor: 'gold', acao: 'Aguardar o sinal' },
  EM_EXECUCAO: { texto: 'Em execução', cor: 'processing', acao: 'Iniciar a obra' },
  CONCLUIDA: { texto: 'Concluída', cor: 'success', acao: 'Concluir a obra' },
  CANCELADA: { texto: 'Cancelada', cor: 'default', acao: 'Cancelar a obra' },
};

export interface ObraForm {
  idCliente: number | null; idPoco: number | null; servicos: Servico[]; titulo: string | null; dataPrevisao: string | null;
  garantiaMeses: number | null; metrosPrevistos: number | null; valorContratado: number | null; valorMetroExcedente: number | null; observacao: string | null;
}
export interface Obra extends Omit<ObraForm, 'idCliente'> {
  idObra: number; idCliente: number; cliente: string; telefone: string | null; poco: string | null; cidade: string | null;
  situacao: SituacaoObra; proximas: SituacaoObra[]; dataInicio: string | null; dataTermino: string | null; garantiaAte: string | null;
  criadaEm: string; relatorio?: Dados;
}
export interface PocoForm {
  identificacao: string; idProprietario: number | null; endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  cep: string | null; gps: string | null; profundidadeM: number | null; diametro: string | null; vazaoLh: number | null;
  nivelEstaticoM: number | null; nivelDinamicoM: number | null; tipoSolo: string | null; dataPerfuracao: string | null;
  perfuradoPor: 'NOS' | 'TERCEIRO' | 'DESCONHECIDO'; perfuradoPorNome: string | null; situacao: 'ATIVO' | 'SECO' | 'DESATIVADO'; observacao: string | null;
}
export interface Poco extends Omit<PocoForm, 'gps'> { idPoco: number; proprietario: string | null; latitude: number | null; longitude: number | null; obras: number }

const pedir = async <T,>(url: string, init: RequestInit | undefined, padrao: string): Promise<T> => {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const corpo = (method: string, dados: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
const q = (f: Record<string, string | number | null | undefined>) => {
  const s = new URLSearchParams({ tenant_id: '1' });
  for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && String(v).trim() !== '') s.set(k, String(v));
  return s.toString();
};

export const obrasApi = {
  obras: (f: { situacao?: string; busca?: string } = {}) => pedir<Obra[]>(`${API}/obras?${q(f)}`, undefined, 'Erro ao listar as obras.'),
  obra: (id: number) => pedir<Obra>(`${API}/obras/${id}?tenant_id=1`, undefined, 'Erro ao abrir a obra.'),
  criarObra: (o: ObraForm & { novoPoco?: Partial<PocoForm> }) => pedir<Obra>(`${API}/obras?tenant_id=1`, corpo('POST', o), 'Erro ao criar a obra.'),
  salvarObra: (id: number, o: ObraForm) => pedir<Obra>(`${API}/obras/${id}?tenant_id=1`, corpo('PUT', o), 'Erro ao salvar a obra.'),
  salvarRelatorio: (id: number, dados: Dados) => pedir<{ salvoEm: string }>(`${API}/obras/${id}/relatorio?tenant_id=1`, corpo('PUT', { dados }), 'Erro ao salvar o relatório.'),
  mudarSituacao: (id: number, situacao: SituacaoObra) =>
    pedir<Obra & { pocoAtualizado: boolean }>(`${API}/obras/${id}/situacao?tenant_id=1`, corpo('POST', { situacao }), 'Erro ao mudar a situação.'),
  pocos: (f: { busca?: string; idProprietario?: number | null } = {}) => pedir<Poco[]>(`${API}/pocos?${q(f)}`, undefined, 'Erro ao listar os poços.'),
  criarPoco: (p: PocoForm) => pedir<Poco>(`${API}/pocos?tenant_id=1`, corpo('POST', p), 'Erro ao cadastrar o poço.'),
  salvarPoco: (id: number, p: PocoForm) => pedir<Poco>(`${API}/pocos/${id}?tenant_id=1`, corpo('PUT', p), 'Erro ao salvar o poço.'),
};

/** Quantas obras em cada situação (para os cartões). */
export const contarObras = (lista: Obra[]) => {
  const c = { ORCAMENTO: 0, AGUARDANDO_SINAL: 0, EM_EXECUCAO: 0, CONCLUIDA: 0, CANCELADA: 0 } as Record<SituacaoObra, number>;
  for (const o of lista) c[o.situacao]++;
  return c;
};
export const dataBr = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
