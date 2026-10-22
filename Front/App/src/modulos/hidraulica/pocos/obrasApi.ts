// API do módulo Obras de poços (/api/modulos/hidraulica/pocos): obras, poços, clientes de poço e o mapa regional.
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
  latitude: number | null; longitude: number | null;
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

/** Cliente de poço: cadastro do módulo, separado do cadastro geral do ERP por enquanto. */
export interface ClientePocoForm {
  nome: string; telefone: string | null; documento: string | null; email: string | null; endereco: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; observacao: string | null;
}
export interface ClientePoco extends ClientePocoForm { idCliente: number; pocos: number; pocosComGps: number; obras: number; obrasAbertas: number }

export interface PocoNoMapa {
  idPoco: number; identificacao: string; latitude: number; longitude: number; profundidadeM: number | null; vazaoLh: number | null;
  nivelEstaticoM: number | null; situacao: Poco['situacao']; cidade: string | null; perfuradoPor: Poco['perfuradoPor'];
  idProprietario: number | null; proprietario: string | null; telefone: string | null; obras: number;
  ultimaObra: { idObra: number; situacao: SituacaoObra; servicos: Servico[] } | null;
}
/** [id, lat, lon, profundidade m, vazão m³/h, município] */
export type ReferenciaNoMapa = [number, number, number, number | null, number | null, string | null];
/** [latMin, latMax, lonMin, lonMax, valor] */
export type CelulaPotencial = [number, number, number, number, number];
export interface ResumoMapa {
  referencias: { regiao: string; quantidade: number }[]; potencial: { regiao: string; quantidade: number }[]; nossos: { total: number; comGps: number };
}
export interface AnaliseRegiao {
  latitude: number; longitude: number; raioM: number; quantidade: number; nossos: number; profundidadeMedia: number | null; profundidadeMediana: number | null;
  profundidadeMin: number | null; profundidadeMax: number | null; vazaoMediaM3h: number | null; metrosSugeridos: number | null; potencial: number | null;
}

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
  obrasDe: (f: { idCliente?: number; idPoco?: number }) => pedir<Obra[]>(`${API}/obras?${q(f)}`, undefined, 'Erro ao listar as obras.'),
  clientes: (busca = '') => pedir<ClientePoco[]>(`${API}/clientes?${q({ busca })}`, undefined, 'Erro ao listar os clientes de poço.'),
  cliente: (id: number) => pedir<ClientePoco>(`${API}/clientes/${id}?tenant_id=1`, undefined, 'Erro ao abrir o cliente.'),
  criarCliente: (c: Partial<ClientePocoForm>) => pedir<ClientePoco>(`${API}/clientes?tenant_id=1`, corpo('POST', c), 'Erro ao cadastrar o cliente.'),
  salvarCliente: (id: number, c: ClientePocoForm) => pedir<ClientePoco>(`${API}/clientes/${id}?tenant_id=1`, corpo('PUT', c), 'Erro ao salvar o cliente.'),
  mapaResumo: () => pedir<ResumoMapa>(`${API}/mapa/resumo?tenant_id=1`, undefined, 'Erro ao ler o resumo do mapa.'),
  mapaPocos: () => pedir<PocoNoMapa[]>(`${API}/mapa/pocos?tenant_id=1`, undefined, 'Erro ao carregar os poços do mapa.'),
  mapaReferencias: () => pedir<ReferenciaNoMapa[]>(`${API}/mapa/referencias?tenant_id=1`, undefined, 'Erro ao carregar os poços de referência.'),
  mapaPotencial: () => pedir<CelulaPotencial[]>(`${API}/mapa/potencial?tenant_id=1`, undefined, 'Erro ao carregar o potencial hídrico.'),
  analisar: (latitude: number, longitude: number, raio: number) =>
    pedir<AnaliseRegiao>(`${API}/mapa/analise?${q({ lat: latitude, lon: longitude, raio })}`, undefined, 'Erro ao analisar a região.'),
  importar: (arquivo: string, geojson: unknown) =>
    pedir<{ tipo: 'POCOS' | 'POTENCIAL'; regiao: string; gravados: number }>(`${API}/mapa/importar?tenant_id=1`, corpo('POST', { arquivo, geojson }), 'Erro ao importar o arquivo.'),
  removerImportacao: (tipo: 'POCOS' | 'POTENCIAL', regiao: string) =>
    pedir<{ removidos: number }>(`${API}/mapa/importacoes?${q({ tipo, regiao })}`, { method: 'DELETE' }, 'Erro ao remover a região.'),
};

/** Telefone guardado só com dígitos → "(11) 99876-5432". */
export const foneBr = (s: string | null | undefined) => {
  const d = String(s ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d || '';
};

/** Quantas obras em cada situação (para os cartões). */
export const contarObras = (lista: Obra[]) => {
  const c = { ORCAMENTO: 0, AGUARDANDO_SINAL: 0, EM_EXECUCAO: 0, CONCLUIDA: 0, CANCELADA: 0 } as Record<SituacaoObra, number>;
  for (const o of lista) c[o.situacao]++;
  return c;
};
export const dataBr = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
