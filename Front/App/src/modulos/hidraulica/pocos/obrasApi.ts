// API do módulo Obras de poços (/api/modulos/hidraulica/pocos): obras, poços, clientes de poço, o mapa regional e a
// cobrança das obras (sinal, adicionais, parcelas e recebimentos), os materiais (cadastro do módulo e de cada obra) e a
// agenda (equipe e equipamentos do módulo).
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
  /** Sinal combinado; ANTES = só começa com o sinal recebido, NO_ATO = pago no dia da perfuração. */
  valorSinal: number | null; sinalQuando: 'ANTES' | 'NO_ATO';
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
/** De onde vêm as camadas: os GeoJSON do maperf lidos pelo servidor (fora do banco) e os nossos poços (banco). */
export interface ResumoMapa {
  pasta: string; arquivos: { caminho: string; tipo: 'POCOS' | 'POTENCIAL'; regiao: string; quantidade: number }[]; erros: string[];
  referencias: number; potencial: number; nossos: { total: number; comGps: number };
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
};

// ------------------------------------------------------------------ cobrança (etapa 3)
export type TipoAdicional = 'METRO_EXCEDENTE' | 'MATERIAL' | 'SERVICO' | 'OUTRO';
export type SituacaoAdicional = 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'CANCELADO';
export type MeioAprovacao = 'MENSAGEM' | 'ASSINATURA' | 'PRESENCIAL' | 'TELEFONE';
export type FormaRecebimento = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO' | 'TRANSFERENCIA' | 'CHEQUE' | 'BOLETO';
export type SituacaoParcela = 'VENCIDO' | 'VENCE_HOJE' | 'A_VENCER' | 'SEM_PRAZO' | 'PAGO' | 'CANCELADO';

export const TIPOS_ADICIONAL: Record<TipoAdicional, string> = { METRO_EXCEDENTE: 'Metro excedente', MATERIAL: 'Material', SERVICO: 'Serviço', OUTRO: 'Outro' };
export const SITUACOES_ADICIONAL: Record<SituacaoAdicional, { texto: string; cor: string }> = {
  PENDENTE: { texto: 'Aguardando o cliente', cor: 'gold' }, APROVADO: { texto: 'Aprovado', cor: 'green' },
  RECUSADO: { texto: 'Recusado', cor: 'red' }, CANCELADO: { texto: 'Cancelado', cor: 'default' },
};
export const MEIOS_APROVACAO: Record<MeioAprovacao, string> = { MENSAGEM: 'Mensagem (WhatsApp, e-mail)', ASSINATURA: 'Assinatura', PRESENCIAL: 'Presencial', TELEFONE: 'Telefone' };
export const FORMAS_RECEBIMENTO: Record<FormaRecebimento, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Débito', CREDITO: 'Crédito', TRANSFERENCIA: 'Transferência', CHEQUE: 'Cheque', BOLETO: 'Boleto',
};
export const SITUACOES_PARCELA: Record<SituacaoParcela, { texto: string; cor: string }> = {
  VENCIDO: { texto: 'Vencida', cor: 'red' }, VENCE_HOJE: { texto: 'Vence hoje', cor: 'orange' }, A_VENCER: { texto: 'A vencer', cor: 'blue' },
  SEM_PRAZO: { texto: 'Sem prazo', cor: 'purple' }, PAGO: { texto: 'Paga', cor: 'green' }, CANCELADO: { texto: 'Cancelada', cor: 'default' },
};

export interface AdicionalForm { tipo: TipoAdicional; descricao: string; quantidade: number; valorUnitario: number }
export interface Adicional extends AdicionalForm {
  idAdicional: number; valor: number; situacao: SituacaoAdicional; aprovacaoMeio: MeioAprovacao | null; aprovadoEm: string | null;
  aprovacaoObs: string | null; operador: string; criadoEm: string;
}
export interface ParcelaObra {
  idParcela: number; idObra: number; tipo: 'SINAL' | 'SALDO'; parcela: number; totalParcelas: number; descricao: string | null;
  vencimento: string | null; valor: number; valorPago: number; saldo: number; status: 'ABERTO' | 'PAGO' | 'CANCELADO'; situacao: SituacaoParcela; diasAtraso: number;
}
export interface RecebimentoObra {
  idRecebimento: number; idParcela: number; parcela: string | null; forma: FormaRecebimento; valor: number; observacao: string | null;
  operador: string; em: string; estornadoEm: string | null; estornoMotivo: string | null;
}
export interface ResumoCobranca {
  contratado: number; adicionaisAprovados: number; adicionaisPendentes: number; total: number; sinal: number; sinalPago: boolean;
  recebido: number; aReceber: number; parcelado: number; semParcela: number;
}
export interface CobrancaObra {
  resumo: ResumoCobranca; sinalQuando: 'ANTES' | 'NO_ATO'; adicionais: Adicional[]; parcelas: ParcelaObra[]; recebimentos: RecebimentoObra[];
  metrosPerfurados: number | null; sugestao: (AdicionalForm & { valor: number }) | null;
}
export interface AReceberObra extends ParcelaObra { obra: string | null; obraSituacao: SituacaoObra; idCliente: number; cliente: string | null; telefone: string | null }

export const cobrancaApi = {
  daObra: (id: number) => pedir<CobrancaObra>(`${API}/obras/${id}/cobranca?tenant_id=1`, undefined, 'Erro ao carregar a cobrança.'),
  criarAdicional: (idObra: number, a: AdicionalForm) => pedir<{ idAdicional: number }>(`${API}/obras/${idObra}/adicionais?tenant_id=1`, corpo('POST', a), 'Erro ao lançar o adicional.'),
  salvarAdicional: (id: number, a: AdicionalForm) => pedir<{ ok: boolean }>(`${API}/adicionais/${id}?tenant_id=1`, corpo('PUT', a), 'Erro ao salvar o adicional.'),
  mudarAdicional: (id: number, situacao: SituacaoAdicional, aprovacao?: { meio: MeioAprovacao; observacao?: string | null }) =>
    pedir<{ ok: boolean }>(`${API}/adicionais/${id}/situacao?tenant_id=1`, corpo('POST', { situacao, ...aprovacao }), 'Erro ao mudar o adicional.'),
  lancarParcelas: (idObra: number, p: { valor?: number | null; quantidade?: number; primeiroVencimento?: string | null; intervaloDias?: number; semPrazo?: boolean }) =>
    pedir<{ parcelas: number }>(`${API}/obras/${idObra}/parcelas?tenant_id=1`, corpo('POST', p), 'Erro ao lançar as parcelas.'),
  cancelarParcela: (id: number) => pedir<{ ok: boolean }>(`${API}/parcelas/${id}/cancelar?tenant_id=1`, corpo('POST', {}), 'Erro ao cancelar a parcela.'),
  receber: (id: number, r: { forma: FormaRecebimento; valor: number; observacao?: string | null }) =>
    pedir<{ idRecebimento: number; status: string }>(`${API}/parcelas/${id}/receber?tenant_id=1`, corpo('POST', r), 'Erro ao registrar o recebimento.'),
  estornar: (id: number, motivo: string) => pedir<{ status: string }>(`${API}/recebimentos/${id}/estornar?tenant_id=1`, corpo('POST', { motivo }), 'Erro ao estornar.'),
  aReceber: () => pedir<AReceberObra[]>(`${API}/receber?tenant_id=1`, undefined, 'Erro ao listar o a receber das obras.'),
};

// ------------------------------------------------------------------ materiais (etapa 4)
export type CategoriaMaterial = 'TUBO' | 'FILTRO' | 'BOMBA' | 'CABO' | 'CONEXAO' | 'PRE_FILTRO' | 'QUIMICO' | 'OUTRO';
export const CATEGORIAS_MATERIAL: Record<CategoriaMaterial, string> = {
  TUBO: 'Tubo', FILTRO: 'Filtro', BOMBA: 'Bomba', CABO: 'Cabo / corda', CONEXAO: 'Conexão / tampa', PRE_FILTRO: 'Pré-filtro / brita', QUIMICO: 'Químico', OUTRO: 'Outro',
};
export const UNIDADES_MATERIAL = ['m', 'un', 'kg', 'sc', 'L'] as const;

export interface MaterialForm {
  nome: string; categoria: CategoriaMaterial; unidade: string; custo: number; precoVenda: number | null; observacao: string | null; ativo: boolean;
}
export interface MaterialPoco extends MaterialForm { idMaterial: number; usos: number }
export interface LinhaMaterialObra {
  idLinha: number; idObra: number; idMaterial: number | null; descricao: string; unidade: string; categoria: CategoriaMaterial | null;
  qtdPrevista: number; qtdUsada: number | null; custoUnitario: number; totalPrevisto: number; totalReal: number | null; precoVenda: number | null;
  idAdicional: number | null; adicionalSituacao: SituacaoAdicional | null; adicionalValor: number | null; observacao: string | null;
}
export interface ResumoMateriais { linhas: number; conferidas: number; custoPrevisto: number; custoReal: number; completo: boolean; diferenca: number | null }
export interface LinhaMaterialForm {
  idMaterial?: number | null; descricao?: string | null; unidade?: string | null; qtdPrevista: number; qtdUsada?: number | null; custoUnitario?: number | null; observacao?: string | null;
}

export const materiaisApi = {
  cadastro: (f: { busca?: string; todos?: boolean } = {}) =>
    pedir<MaterialPoco[]>(`${API}/materiais?${q({ busca: f.busca, todos: f.todos ? 1 : null })}`, undefined, 'Erro ao listar os materiais.'),
  criar: (m: MaterialForm) => pedir<MaterialPoco>(`${API}/materiais?tenant_id=1`, corpo('POST', m), 'Erro ao cadastrar o material.'),
  salvar: (id: number, m: MaterialForm) => pedir<MaterialPoco>(`${API}/materiais/${id}?tenant_id=1`, corpo('PUT', m), 'Erro ao salvar o material.'),
  daObra: (idObra: number) => pedir<{ linhas: LinhaMaterialObra[]; resumo: ResumoMateriais }>(`${API}/obras/${idObra}/materiais?tenant_id=1`, undefined, 'Erro ao carregar os materiais.'),
  adicionar: (idObra: number, l: LinhaMaterialForm) => pedir<{ idLinha: number }>(`${API}/obras/${idObra}/materiais?tenant_id=1`, corpo('POST', l), 'Erro ao lançar o material.'),
  salvarLinha: (idLinha: number, l: LinhaMaterialForm) => pedir<{ ok: boolean }>(`${API}/obra-materiais/${idLinha}?tenant_id=1`, corpo('PUT', l), 'Erro ao salvar o material.'),
  removerLinha: (idLinha: number) => pedir<{ ok: boolean }>(`${API}/obra-materiais/${idLinha}?tenant_id=1`, { method: 'DELETE' }, 'Erro ao tirar o material.'),
  copiar: (idObra: number, deObra: number) => pedir<{ copiados: number }>(`${API}/obras/${idObra}/materiais/copiar?tenant_id=1`, corpo('POST', { deObra }), 'Erro ao copiar.'),
  cobrar: (idLinha: number, valorUnitario: number | null) =>
    pedir<{ idAdicional: number; valor: number }>(`${API}/obra-materiais/${idLinha}/cobrar?tenant_id=1`, corpo('POST', { valorUnitario }), 'Erro ao cobrar o material.'),
};

// ------------------------------------------------------------------ agenda, equipe e equipamentos (etapa 5)
export type FuncaoEquipe = 'PERFURADOR' | 'AJUDANTE' | 'MOTORISTA' | 'ELETRICISTA' | 'OUTRO';
export type TipoEquipamento = 'SONDA' | 'CAMINHAO' | 'COMPRESSOR' | 'BOMBA_TESTE' | 'GERADOR' | 'OUTRO';
export type SituacaoEquipamento = 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
export type TipoAgenda = 'OBRA' | 'VISITA_ORCAMENTO' | 'MANUTENCAO' | 'OUTRO';
export type SituacaoAgenda = 'AGENDADO' | 'REALIZADO' | 'CANCELADO';
export const FUNCOES_EQUIPE: Record<FuncaoEquipe, string> = { PERFURADOR: 'Perfurador', AJUDANTE: 'Ajudante', MOTORISTA: 'Motorista', ELETRICISTA: 'Eletricista', OUTRO: 'Outro' };
export const TIPOS_EQUIPAMENTO: Record<TipoEquipamento, string> = {
  SONDA: 'Sonda', CAMINHAO: 'Caminhão', COMPRESSOR: 'Compressor', BOMBA_TESTE: 'Bomba de teste', GERADOR: 'Gerador', OUTRO: 'Outro',
};
export const SITUACOES_EQUIPAMENTO: Record<SituacaoEquipamento, { texto: string; cor: string }> = {
  ATIVO: { texto: 'Ativo', cor: 'green' }, MANUTENCAO: { texto: 'Em manutenção', cor: 'orange' }, INATIVO: { texto: 'Inativo', cor: 'default' },
};
export const TIPOS_AGENDA: Record<TipoAgenda, { texto: string; cor: string }> = {
  OBRA: { texto: 'Obra', cor: '#1677ff' }, VISITA_ORCAMENTO: { texto: 'Visita de orçamento', cor: '#722ed1' },
  MANUTENCAO: { texto: 'Manutenção', cor: '#13a8a8' }, OUTRO: { texto: 'Outro', cor: '#8c8c8c' },
};
export const SITUACOES_AGENDA: Record<SituacaoAgenda, { texto: string; cor: string }> = {
  AGENDADO: { texto: 'Agendado', cor: 'blue' }, REALIZADO: { texto: 'Realizado', cor: 'green' }, CANCELADO: { texto: 'Cancelado', cor: 'default' },
};

export interface MembroForm { nome: string; funcao: FuncaoEquipe; telefone: string | null; observacao: string | null; ativo: boolean }
export interface Membro extends MembroForm { idMembro: number }
export interface EquipamentoForm { nome: string; tipo: TipoEquipamento; identificacao: string | null; situacao: SituacaoEquipamento; observacao: string | null }
export interface Equipamento extends EquipamentoForm { idEquipamento: number }
export interface CompromissoForm {
  idObra: number | null; tipo: TipoAgenda; titulo: string; local: string | null; dataInicio: string; dataFim: string; horaInicio: string | null;
  situacao: SituacaoAgenda; observacao: string | null; equipe: number[]; equipamentos: number[];
}
export interface Compromisso extends Omit<CompromissoForm, 'equipe' | 'equipamentos'> {
  idAgenda: number; obra: string | null; obraSituacao: SituacaoObra | null; cliente: string | null; clienteTelefone: string | null;
  equipe: { id: number; nome: string; funcao: FuncaoEquipe }[]; equipamentos: { id: number; nome: string; tipo: TipoEquipamento; situacao: SituacaoEquipamento }[];
  avisos: { tipo: 'PESSOA' | 'EQUIPAMENTO' | 'INDISPONIVEL'; texto: string }[];
}

export const agendaApi = {
  equipe: (todos = false) => pedir<Membro[]>(`${API}/equipe?${q({ todos: todos ? 1 : null })}`, undefined, 'Erro ao listar a equipe.'),
  criarMembro: (m: MembroForm) => pedir<Membro>(`${API}/equipe?tenant_id=1`, corpo('POST', m), 'Erro ao cadastrar.'),
  salvarMembro: (id: number, m: MembroForm) => pedir<Membro>(`${API}/equipe/${id}?tenant_id=1`, corpo('PUT', m), 'Erro ao salvar.'),
  equipamentos: (todos = false) => pedir<Equipamento[]>(`${API}/equipamentos?${q({ todos: todos ? 1 : null })}`, undefined, 'Erro ao listar os equipamentos.'),
  criarEquipamento: (e: EquipamentoForm) => pedir<Equipamento>(`${API}/equipamentos?tenant_id=1`, corpo('POST', e), 'Erro ao cadastrar.'),
  salvarEquipamento: (id: number, e: EquipamentoForm) => pedir<Equipamento>(`${API}/equipamentos/${id}?tenant_id=1`, corpo('PUT', e), 'Erro ao salvar.'),
  periodo: (de: string, ate: string) => pedir<Compromisso[]>(`${API}/agenda?${q({ de, ate })}`, undefined, 'Erro ao carregar a agenda.'),
  daObra: (idObra: number) => pedir<Compromisso[]>(`${API}/agenda?${q({ idObra })}`, undefined, 'Erro ao carregar a agenda da obra.'),
  criar: (c: CompromissoForm) => pedir<Compromisso>(`${API}/agenda?tenant_id=1`, corpo('POST', c), 'Erro ao agendar.'),
  salvar: (id: number, c: CompromissoForm) => pedir<Compromisso>(`${API}/agenda/${id}?tenant_id=1`, corpo('PUT', c), 'Erro ao salvar o compromisso.'),
  mudar: (id: number, situacao: SituacaoAgenda) => pedir<{ ok: boolean }>(`${API}/agenda/${id}/situacao?tenant_id=1`, corpo('POST', { situacao }), 'Erro ao mudar.'),
  remover: (id: number) => pedir<{ ok: boolean }>(`${API}/agenda/${id}?tenant_id=1`, { method: 'DELETE' }, 'Erro ao apagar.'),
};

/** Os dias (AAAA-MM-DD) de um compromisso, do início ao fim. */
export const diasDoCompromisso = (c: { dataInicio: string; dataFim: string }) => {
  const dias: string[] = [];
  const d = new Date(`${c.dataInicio}T12:00:00`);
  const fim = new Date(`${c.dataFim}T12:00:00`);
  while (d <= fim && dias.length < 120) { dias.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
  return dias;
};

/** Totais do "a receber de obras" por situação (vencido, vence hoje, a vencer, sem prazo). */
export const totaisAReceber = (lista: Pick<AReceberObra, 'situacao' | 'saldo'>[]) => {
  const t = { VENCIDO: 0, VENCE_HOJE: 0, A_VENCER: 0, SEM_PRAZO: 0, total: 0 };
  for (const p of lista) {
    const v = Math.round(p.saldo * 100);
    if (p.situacao in t) (t as Record<string, number>)[p.situacao] += v;
    t.total += v;
  }
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 100])) as typeof t;
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
