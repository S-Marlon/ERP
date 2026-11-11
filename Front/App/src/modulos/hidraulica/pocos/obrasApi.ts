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
  /** Total se pago parcelado (cartão), ao lado do à vista; vazio = sem condição parcelada. */
  valorParcelado?: number | null;
  /** Sinal combinado; ANTES = só começa com o sinal recebido, NO_ATO = pago no dia da perfuração. */
  valorSinal: number | null; sinalQuando: 'ANTES' | 'NO_ATO';
  /** O que vai no orçamento em PDF. */
  escopo?: string | null; prazoExecucaoDias?: number | null; formaPagamento?: string | null; validadeOrcamentoDias?: number | null;
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
  nome: string; tipoPessoa: 'PF' | 'PJ'; telefone: string | null; telefone2: string | null; documento: string | null; rgIe: string | null;
  estadoCivil: string | null; profissao: string | null; email: string | null; endereco: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null; representante: string | null; representanteDocumento: string | null; observacao: string | null;
}
export interface ClientePoco extends ClientePocoForm {
  idCliente: number; pocos: number; pocosComGps: number; obras: number; obrasAbertas: number; aReceber: number; vencido: number;
}
export type FiltroClientes = 'ABERTA' | 'VENCIDO' | 'SEM_TELEFONE';
export const ESTADOS_CIVIS = ['solteiro(a)', 'casado(a)', 'união estável', 'divorciado(a)', 'viúvo(a)'];

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
  clientes: (busca = '', f: { cidade?: string; filtro?: FiltroClientes | null } = {}) =>
    pedir<ClientePoco[]>(`${API}/clientes?${q({ busca, cidade: f.cidade, filtro: f.filtro })}`, undefined, 'Erro ao listar os clientes de poço.'),
  clienteCompleto: (id: number) => pedir<ClienteCompleto>(`${API}/clientes/${id}/completo?tenant_id=1`, undefined, 'Erro ao abrir a ficha do cliente.'),
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

// ------------------------------------------------------------------ histórico e manutenção do poço (etapa 6)
export type TipoRegistro = 'MEDICAO' | 'VISITA' | 'OBSERVACAO' | 'PROBLEMA';
export type ServicoPlano = 'LIMPEZA' | 'MANUTENCAO' | 'TROCA_BOMBA' | 'TESTE_VAZAO' | 'OUTRO';
export type SituacaoPlano = 'VENCIDA' | 'A_VENCER' | 'EM_DIA' | 'SEM_BASE';
export const TIPOS_REGISTRO: Record<TipoRegistro, { texto: string; cor: string }> = {
  MEDICAO: { texto: 'Medição', cor: 'blue' }, VISITA: { texto: 'Visita', cor: 'cyan' }, OBSERVACAO: { texto: 'Observação', cor: 'default' }, PROBLEMA: { texto: 'Problema', cor: 'red' },
};
export const SITUACOES_PLANO: Record<SituacaoPlano, { texto: string; cor: string }> = {
  VENCIDA: { texto: 'Vencida', cor: 'red' }, A_VENCER: { texto: 'Vence em até 30 dias', cor: 'orange' }, EM_DIA: { texto: 'Em dia', cor: 'green' },
  SEM_BASE: { texto: 'Nunca feita', cor: 'default' },
};
export interface RegistroForm { tipo: TipoRegistro; data: string; descricao: string | null; nivelEstaticoM: number | null; nivelDinamicoM: number | null; vazaoLh: number | null }
export interface RegistroPoco extends RegistroForm { idRegistro: number; operador: string }
export interface PlanoForm { servico: ServicoPlano; descricao: string | null; aCadaMeses: number; ultimaInformada: string | null; ativo: boolean }
export interface PlanoManutencao extends PlanoForm {
  idPlano: number; idPoco: number; ultima: string | null; origemUltima: 'OBRA' | 'INFORMADA' | null; proxima: string | null; situacao: SituacaoPlano;
}
export interface EventoPoco { data: string; tipo: 'OBRA' | 'ALERTA' | TipoRegistro; titulo: string; detalhe: string | null; idObra?: number; idRegistro?: number }
export interface HistoricoPoco {
  linhaDoTempo: EventoPoco[]; registros: RegistroPoco[]; planos: PlanoManutencao[];
  medicoes: { data: string; origem: 'MEDICAO' | 'PERFURACAO' | 'SENSOR'; nivelEstaticoM: number | null; nivelDinamicoM: number | null; vazaoLh: number | null }[];
}
export interface ManutencaoAOferecer extends PlanoManutencao {
  poco: string; cidade: string | null; idCliente: number | null; cliente: string | null; telefone: string | null; obraAberta: { idObra: number; situacao: SituacaoObra } | null;
}
export interface GarantiaVencendo {
  idObra: number; idPoco: number | null; idCliente: number; titulo: string; servicos: Servico[]; dataTermino: string | null; garantiaAte: string | null;
  cliente: string | null; telefone: string | null; poco: string | null;
}
export const manutencaoApi = {
  historico: (idPoco: number) => pedir<HistoricoPoco>(`${API}/pocos/${idPoco}/historico?tenant_id=1`, undefined, 'Erro ao carregar o histórico.'),
  criarRegistro: (idPoco: number, r: RegistroForm) => pedir<{ idRegistro: number }>(`${API}/pocos/${idPoco}/historico?tenant_id=1`, corpo('POST', r), 'Erro ao registrar.'),
  salvarRegistro: (id: number, r: RegistroForm) => pedir<{ ok: boolean }>(`${API}/historico/${id}?tenant_id=1`, corpo('PUT', r), 'Erro ao salvar o registro.'),
  removerRegistro: (id: number) => pedir<{ ok: boolean }>(`${API}/historico/${id}?tenant_id=1`, { method: 'DELETE' }, 'Erro ao apagar.'),
  criarPlano: (idPoco: number, p: PlanoForm) => pedir<{ idPlano: number }>(`${API}/pocos/${idPoco}/planos?tenant_id=1`, corpo('POST', p), 'Erro ao criar o plano.'),
  salvarPlano: (id: number, p: PlanoForm) => pedir<{ ok: boolean }>(`${API}/planos/${id}?tenant_id=1`, corpo('PUT', p), 'Erro ao salvar o plano.'),
  aOferecer: (todas = false) => pedir<{ planos: ManutencaoAOferecer[]; garantias: GarantiaVencendo[] }>(`${API}/manutencoes?${q({ todas: todas ? 1 : null })}`, undefined, 'Erro ao listar as manutenções.'),
};

// ------------------------------------------------------------------ monitoramento remoto (etapa 7)
export type ConexaoIot = 'WIFI' | 'GSM_4G' | 'LORA' | 'OFFLINE' | 'OUTRO';
export type AlimentacaoIot = 'MONOFASICO' | 'BIFASICO' | 'TRIFASICO';
export type TipoAlertaIot = 'NIVEL_BAIXO' | 'A_SECO' | 'SOBRECORRENTE' | 'VAZAO_BAIXA' | 'TENSAO' | 'SEM_SINAL'
  | 'FALTA_FASE' | 'SEM_ENERGIA' | 'NAO_PARTE' | 'SEM_FUNCIONAMENTO' | 'TERMICO' | 'PRESSAO_BAIXA' | 'LIGADA_DEMAIS' | 'PARTIDAS_DEMAIS';
export type StatusIot = 'ONLINE' | 'ATRASADO' | 'SEM_SINAL' | 'NUNCA' | 'OFFLINE' | 'INATIVO';
export type ComandoIot = 'BLOQUEAR' | 'LIBERAR' | 'RECONHECER';
export const CONEXOES_IOT: Record<ConexaoIot, string> = { WIFI: 'Wi-Fi', GSM_4G: '4G (chip)', LORA: 'LoRa', OFFLINE: 'Sem internet (arquivo)', OUTRO: 'Outro' };
export const ALIMENTACOES_IOT: Record<AlimentacaoIot, string> = { MONOFASICO: 'Monofásico', BIFASICO: 'Bifásico', TRIFASICO: 'Trifásico' };
export const TIPOS_ALERTA_IOT: Record<TipoAlertaIot, { texto: string; cor: string }> = {
  NIVEL_BAIXO: { texto: 'Nível baixo', cor: 'orange' }, A_SECO: { texto: 'Bomba a seco', cor: 'red' }, SOBRECORRENTE: { texto: 'Sobrecorrente', cor: 'red' },
  VAZAO_BAIXA: { texto: 'Vazão baixa', cor: 'orange' }, TENSAO: { texto: 'Tensão', cor: 'gold' }, SEM_SINAL: { texto: 'Sem sinal', cor: 'default' },
  FALTA_FASE: { texto: 'Falta de fase', cor: 'red' }, SEM_ENERGIA: { texto: 'Sem energia', cor: 'volcano' }, NAO_PARTE: { texto: 'Não parte', cor: 'red' },
  SEM_FUNCIONAMENTO: { texto: 'Sem funcionamento', cor: 'red' }, TERMICO: { texto: 'Térmico desarmado', cor: 'red' },
  PRESSAO_BAIXA: { texto: 'Pressão baixa', cor: 'magenta' }, LIGADA_DEMAIS: { texto: 'Ligada demais', cor: 'orange' }, PARTIDAS_DEMAIS: { texto: 'Partidas demais', cor: 'orange' },
};
export const STATUS_IOT: Record<StatusIot, { texto: string; cor: string }> = {
  ONLINE: { texto: 'Online', cor: 'green' }, ATRASADO: { texto: 'Atrasado', cor: 'orange' }, SEM_SINAL: { texto: 'Sem sinal', cor: 'red' },
  NUNCA: { texto: 'Nunca enviou', cor: 'default' }, OFFLINE: { texto: 'Sem internet', cor: 'purple' }, INATIVO: { texto: 'Inativo', cor: 'default' },
};
export const COMANDOS_IOT: Record<ComandoIot, string> = { BLOQUEAR: 'Bloquear a bomba', LIBERAR: 'Liberar (automático)', RECONHECER: 'Reconhecer alarme' };
export interface DispositivoForm {
  idPoco: number | null; nome: string; identificador: string; conexao: ConexaoIot; alimentacao: AlimentacaoIot; intervaloMin: number; profundidadeSensorM: number | null;
  nivelAlertaM: number | null; correnteMinA: number | null; correnteMaxA: number | null; vazaoMinLh: number | null; tensaoMinV: number | null; tensaoMaxV: number | null;
  pressaoMinBar: number | null; horasMaxLigada: number | null; partidasMaxHora: number | null; tarifaKwh: number | null; aceitaComandos: boolean;
  situacao: 'ATIVO' | 'INATIVO'; observacao: string | null;
}
export interface Dispositivo extends DispositivoForm {
  idDispositivo: number; idPoco: number; poco: string | null; cidade: string | null; cliente: string | null; telefone: string | null; ultimaLeituraEm: string | null;
}
export interface LeituraIot {
  em: string; nivelM: number | null; vazaoLh: number | null; pressaoBar: number | null; correnteA: number | null; tensaoV: number | null;
  faseAV: number | null; faseBV: number | null; faseCV: number | null; bombaLigada: boolean | null; comandoLigado: boolean | null; termicoOk: boolean | null;
  boiaPedindo: boolean | null; modo: 'AUTO' | 'MANUAL' | 'DESLIGADO' | null; horimetroH: number | null; energiaKwh: number | null; partidas: number | null;
  temperaturaC: number | null; sinalDbm: number | null; bateriaV: number | null;
}
export interface ResumoDiaIot {
  dia: string; leituras: number; nivelEstaticoM: number | null; nivelDinamicoM: number | null; vazaoMediaLh: number | null; pressaoMediaBar: number | null;
  horasBomba: number; volumeM3: number; partidas: number; energiaKwh: number | null;
}
export interface RelatorioIot {
  mes: string; dias: ResumoDiaIot[]; dispositivo: Dispositivo; alertas: AlertaIot[]; alertasPorTipo: Partial<Record<TipoAlertaIot, number>>;
  totais: { horasBomba: number; volumeM3: number; partidas: number; energiaKwh: number | null; custoEnergia: number | null; m3PorKwh: number | null;
    nivelEstaticoMedioM: number | null; nivelDinamicoMedioM: number | null; disponibilidade: number | null; leituras: number };
}
export interface ComandoRegistro {
  idComando: number; comando: ComandoIot; situacao: 'PENDENTE' | 'ENVIADO' | 'EXECUTADO' | 'FALHOU' | 'EXPIRADO' | 'CANCELADO'; motivo: string | null; operador: string;
  criadoEm: string; expiraEm: string; enviadoEm: string | null; respondidoEm: string | null; resposta: string | null;
}
export interface DispositivoNoPainel extends Dispositivo { status: StatusIot; ultima: LeituraIot | null; hoje: ResumoDiaIot | null; alertasAbertos: number }
export interface AlertaIot {
  idAlerta: number; idDispositivo: number; dispositivo: string | null; idPoco: number | null; poco: string | null; cliente: string | null; telefone: string | null;
  tipo: TipoAlertaIot; mensagem: string; valor: number | null; inicio: string; fim: string | null; vistoEm: string | null; vistoPor: string | null;
}
/** Leitura no formato que o aparelho envia (o mesmo do simulador). */
export interface LeituraEnvio {
  em?: string; nivel_m?: number | null; coluna_m?: number | null; vazao_lh?: number | null; pressao_bar?: number | null; corrente_a?: number | null; tensao_v?: number | null;
  fase_a_v?: number | null; fase_b_v?: number | null; fase_c_v?: number | null; bomba?: boolean | null; comando?: boolean | null; termico_ok?: boolean | null;
  boia?: boolean | null; modo?: 'AUTO' | 'MANUAL' | 'DESLIGADO' | null; horimetro_h?: number | null; energia_kwh?: number | null; partidas?: number | null;
  temp_c?: number | null; sinal_dbm?: number | null; bateria_v?: number | null;
}
export const URL_LEITURAS = `${API}/iot/leituras`;
export const iotApi = {
  painel: () => pedir<{ dispositivos: DispositivoNoPainel[]; alertas: AlertaIot[]; chaveConfigurada: boolean }>(`${API}/iot/painel?tenant_id=1`, undefined, 'Erro ao montar o painel.'),
  alertas: (dias = 30) => pedir<AlertaIot[]>(`${API}/iot/alertas?${q({ dias })}`, undefined, 'Erro ao listar os alertas.'),
  visto: (id: number) => pedir<{ ok: boolean }>(`${API}/iot/alertas/${id}/visto?tenant_id=1`, corpo('POST', {}), 'Erro ao marcar.'),
  dispositivos: () => pedir<Dispositivo[]>(`${API}/iot/dispositivos?tenant_id=1`, undefined, 'Erro ao listar os aparelhos.'),
  criar: (d: DispositivoForm) => pedir<Dispositivo>(`${API}/iot/dispositivos?tenant_id=1`, corpo('POST', d), 'Erro ao cadastrar o aparelho.'),
  salvar: (id: number, d: DispositivoForm) => pedir<Dispositivo>(`${API}/iot/dispositivos/${id}?tenant_id=1`, corpo('PUT', d), 'Erro ao salvar o aparelho.'),
  chave: (id: number) => pedir<{ identificador: string; chave: string }>(`${API}/iot/dispositivos/${id}/chave?tenant_id=1`, undefined, 'Erro ao gerar a chave.'),
  leituras: (id: number, horas: number) =>
    pedir<{ dispositivo: Dispositivo; horas: number; total: number; leituras: LeituraIot[]; dias: ResumoDiaIot[] }>(`${API}/iot/dispositivos/${id}/leituras?${q({ horas })}`, undefined, 'Erro ao carregar as leituras.'),
  simular: (id: number, l: LeituraEnvio) =>
    pedir<{ recebidas: number; gravadas: number; alertasAbertos: number; alertasFechados: number }>(`${API}/iot/dispositivos/${id}/simular?tenant_id=1`, corpo('POST', l), 'Erro ao simular.'),
  importar: (id: number, conteudo: string) =>
    pedir<{ recebidas: number; gravadas: number; alertasAbertos: number; alertasFechados: number }>(`${API}/iot/dispositivos/${id}/importar?tenant_id=1`, corpo('POST', { conteudo }), 'Erro ao importar.'),
  relatorio: (id: number, mes: string) => pedir<RelatorioIot>(`${API}/iot/dispositivos/${id}/relatorio?${q({ mes })}`, undefined, 'Erro ao montar o relatório.'),
  comandos: (id: number) => pedir<ComandoRegistro[]>(`${API}/iot/dispositivos/${id}/comandos?tenant_id=1`, undefined, 'Erro ao listar os comandos.'),
  enviarComando: (id: number, comando: ComandoIot, motivo: string | null) =>
    pedir<{ idComando: number }>(`${API}/iot/dispositivos/${id}/comandos?tenant_id=1`, corpo('POST', { comando, motivo }), 'Erro ao enviar o comando.'),
  cancelarComando: (idComando: number) => pedir<{ ok: boolean }>(`${API}/iot/comandos/${idComando}/cancelar?tenant_id=1`, corpo('POST', {}), 'Erro ao cancelar.'),
};

/** CSV do relatório do mês (separado por ";", vírgula decimal, para abrir no Excel). */
export const csvDoRelatorio = (r: Pick<RelatorioIot, 'dias'>) => {
  const n = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  return ['dia;horas_bomba;partidas;volume_m3;energia_kwh;nivel_estatico_m;nivel_dinamico_m;vazao_media_lh;pressao_media_bar;leituras',
    ...r.dias.map(d => [d.dia, n(d.horasBomba), d.partidas, n(d.volumeM3), n(d.energiaKwh), n(d.nivelEstaticoM), n(d.nivelDinamicoM), n(d.vazaoMediaLh),
      n(d.pressaoMediaBar), d.leituras].join(';'))].join('\r\n');
};

/** "há 5 min", "há 3 h", "há 2 dias" (para a última leitura). */
export const haQuanto = (s: string | null, agora: Date) => {
  if (!s) return 'nunca';
  const min = Math.max(0, Math.round((agora.getTime() - new Date(s.replace(' ', 'T')).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 48 * 60) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} dias`;
};

// ------------------------------------------------------------------ processo (atendimento, orçamento, obra, entrega, pós-venda)
export type OrigemLead = 'GOOGLE' | 'INDICACAO' | 'PLACA' | 'INSTAGRAM' | 'FACEBOOK' | 'SITE' | 'WHATSAPP' | 'OUTRO';
export type SituacaoLead = 'NOVO' | 'EM_CONTATO' | 'VISITA_AGENDADA' | 'ORCAMENTO_ENVIADO' | 'CONVERTIDO' | 'PERDIDO';
export type EstadoPrazo = 'NO_PRAZO' | 'FORA_DO_PRAZO' | 'CORRENDO' | 'ATRASADO';
export type EstadoEtapa = 'FEITO' | 'NAO_SE_APLICA' | 'PENDENTE' | 'ATRASADO' | 'AINDA_NAO' | 'OPCIONAL';
export type EtapaFoto = 'ANTES' | 'DURANTE' | 'DEPOIS';
export const ORIGENS_LEAD: Record<OrigemLead, string> = {
  GOOGLE: 'Google', INDICACAO: 'Indicação', PLACA: 'Placa', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook', SITE: 'Site', WHATSAPP: 'WhatsApp', OUTRO: 'Outro',
};
export const SITUACOES_LEAD: Record<SituacaoLead, { texto: string; cor: string }> = {
  NOVO: { texto: 'Novo', cor: 'blue' }, EM_CONTATO: { texto: 'Em contato', cor: 'cyan' }, VISITA_AGENDADA: { texto: 'Visita / orçamento', cor: 'geekblue' },
  ORCAMENTO_ENVIADO: { texto: 'Orçamento enviado', cor: 'purple' }, CONVERTIDO: { texto: 'Convertido', cor: 'green' }, PERDIDO: { texto: 'Perdido', cor: 'default' },
};
export const ESTADOS_PRAZO: Record<EstadoPrazo, { texto: string; cor: string }> = {
  NO_PRAZO: { texto: 'no prazo', cor: 'green' }, FORA_DO_PRAZO: { texto: 'fora do prazo', cor: 'orange' }, CORRENDO: { texto: 'aguardando', cor: 'blue' },
  ATRASADO: { texto: 'atrasado', cor: 'red' },
};
export const ESTADOS_ETAPA: Record<EstadoEtapa, { texto: string; cor: string }> = {
  FEITO: { texto: 'feito', cor: 'green' }, NAO_SE_APLICA: { texto: 'não se aplica', cor: 'default' }, PENDENTE: { texto: 'pendente', cor: 'gold' },
  ATRASADO: { texto: 'atrasado', cor: 'red' }, AINDA_NAO: { texto: 'ainda não', cor: 'default' }, OPCIONAL: { texto: 'opcional', cor: 'default' },
};
export const ETAPAS_FOTO: Record<EtapaFoto, string> = { ANTES: 'Antes', DURANTE: 'Durante', DEPOIS: 'Depois' };

export interface ConfigProcesso {
  empresaNome: string | null; empresaDocumento: string | null; empresaTelefone: string | null; empresaWhatsapp: string | null; empresaEmail: string | null;
  empresaEndereco: string | null; logo: string | null; textoGarantia: string | null; formaPagamentoPadrao: string | null; validadeOrcamentoDias: number;
  linkAvaliacao: string | null; msgAvaliacao: string; msgRevisao: string; respostaLeadMin: number; orcamentoHoras: number; avaliacaoDias: number;
  revisaoMeses: number; horaAbre: string; horaFecha: string; sabadoFecha: string | null; configurado: boolean;
  /** Contrato e aditivo: modelos com {campos} (vazio = modelo padrão), foro e responsável técnico. */
  modeloContrato: string | null; modeloAditivo: string | null; foroCidade: string | null; responsavelTecnico: string | null; registroTecnico: string | null;
  /** Representante legal da empresa (qualificação da CONTRATADA). */
  empresaRepresentante: string | null; empresaRepresentanteCpf: string | null;
  /** Telas que só aparecem quando ligadas. */
  usaMonitoramento: boolean; usaMapa: boolean;
}
export interface LeadForm { nome: string; telefone: string | null; origem: OrigemLead; indicadoPor: string | null; cidade: string | null; necessidade: string | null; recebidoEm: string | null; observacao: string | null }
export interface Lead extends LeadForm {
  idLead: number; recebidoEm: string; respondidoEm: string | null; prazoResposta: string; estadoResposta: EstadoPrazo; situacao: SituacaoLead;
  situacaoGravada: SituacaoLead; motivoPerda: string | null; idCliente: number | null; cliente: string | null; idObra: number | null; obra: string | null;
  obraSituacao: SituacaoObra | null; valorContratado: number | null; whatsapp: string | null; operador: string;
}
export interface ItemChecklist {
  etapa: string; titulo: string; grupo: 'ORCAMENTO' | 'OBRA' | 'ENTREGA' | 'POS_VENDA'; estado: EstadoEtapa; prazo: string | null; feitoEm: string | null;
  observacao: string | null; manual: boolean; noPrazo: boolean | null;
}
export interface FotoObra { idFoto: number; idObra: number; etapa: EtapaFoto; url: string; legenda: string | null; podeDivulgar: boolean; criadaEm: string; operador: string }
export interface ProcessoObra {
  checklist: ItemChecklist[]; resumo: { pendentes: number; atrasadas: number; feitas: number; emDia: boolean }; fotos: FotoObra[];
  whatsapp: string | null; whatsappAvaliacao: string | null; whatsappRevisao: string | null; lead: { idLead: number; origem: OrigemLead } | null;
}
export interface PendenciaObra extends ItemChecklist { idObra: number; obra: string; cliente: string | null; telefone: string | null; situacaoObra: SituacaoObra; whatsapp: string | null }
export interface IndicadoresProcesso {
  de: string; ate: string; leads: number; respostaNoPrazo: number | null; respostaMedidos: number; orcamentoNoPrazo: number | null; orcamentos: number;
  fotosCompletas: number | null; concluidas: number; avaliacoesPedidas: number; avaliacoesRecebidas: number;
  porOrigem: { origem: OrigemLead; leads: number; convertidos: number; perdidos: number; conversao: number | null; valorFechado: number }[];
}
export interface DocumentoObra {
  empresa: ConfigProcesso;
  obra: {
    idObra: number; titulo: string | null; servicos: Servico[]; situacao: SituacaoObra; criadaEm: string; dataInicio: string | null; dataTermino: string | null;
    dataPrevisao?: string | null; valorParcelado?: number | null;
    metrosPrevistos: number | null; valorContratado: number | null; valorMetroExcedente: number | null; valorSinal: number | null; sinalQuando: 'ANTES' | 'NO_ATO';
    garantiaMeses: number | null; garantiaAte: string | null; escopo: string | null; prazoExecucaoDias: number | null; formaPagamento: string | null;
    validadeOrcamentoDias: number; adicionais: { descricao: string; valor: number }[];
    itens: ItemOrcamentoForm[]; contratoAssinadoEm: string | null;
  };
  cliente: (Omit<ClientePocoForm, 'telefone2' | 'observacao'>) | null;
  poco: {
    idPoco: number; identificacao: string; endereco: string | null; cidade: string | null; uf: string | null; latitude: number | null; longitude: number | null;
    profundidadeM: number | null; diametro: string | null; vazaoLh: number | null; nivelEstaticoM: number | null; nivelDinamicoM: number | null;
    tipoSolo: string | null; dataPerfuracao: string | null;
  } | null;
  medido: { profundidadeM: number | null; vazaoLh: number | null; nivelEstaticoM: number | null; nivelDinamicoM: number | null; diametro: string | null; tipoSolo: string | null; bomba: string | null };
}

export const processoApi = {
  config: () => pedir<ConfigProcesso>(`${API}/processo/config?tenant_id=1`, undefined, 'Erro ao ler a configuração.'),
  salvarConfig: (c: Partial<ConfigProcesso> & { logoNovo?: string; tirarLogo?: boolean }) =>
    pedir<ConfigProcesso>(`${API}/processo/config?tenant_id=1`, corpo('PUT', c), 'Erro ao salvar a configuração.'),
  leads: (f: { busca?: string; todos?: boolean } = {}) => pedir<Lead[]>(`${API}/leads?${q({ busca: f.busca, todos: f.todos ? 1 : null })}`, undefined, 'Erro ao listar os leads.'),
  criarLead: (l: LeadForm) => pedir<Lead>(`${API}/leads?tenant_id=1`, corpo('POST', l), 'Erro ao registrar o lead.'),
  salvarLead: (id: number, l: LeadForm) => pedir<Lead>(`${API}/leads/${id}?tenant_id=1`, corpo('PUT', l), 'Erro ao salvar o lead.'),
  respondido: (id: number) => pedir<Lead>(`${API}/leads/${id}/respondido?tenant_id=1`, corpo('POST', {}), 'Erro ao marcar a resposta.'),
  mudarLead: (id: number, situacao: SituacaoLead, motivo?: string) => pedir<Lead>(`${API}/leads/${id}/situacao?tenant_id=1`, corpo('POST', { situacao, motivo }), 'Erro ao mudar o lead.'),
  obraDoLead: (id: number, d: { idCliente?: number | null; servicos: Servico[]; titulo?: string | null }) =>
    pedir<{ idObra: number; idCliente: number }>(`${API}/leads/${id}/obra?tenant_id=1`, corpo('POST', d), 'Erro ao criar a obra.'),
  daObra: (idObra: number) => pedir<ProcessoObra>(`${API}/obras/${idObra}/processo?tenant_id=1`, undefined, 'Erro ao carregar o processo.'),
  marcar: (idObra: number, etapa: string, d: { situacao?: 'FEITO' | 'NAO_SE_APLICA'; feitoEm?: string | null; observacao?: string | null } = {}) =>
    pedir<{ ok: boolean }>(`${API}/obras/${idObra}/processo/${etapa}?tenant_id=1`, corpo('POST', d), 'Erro ao registrar a etapa.'),
  desfazer: (idObra: number, etapa: string) => pedir<{ ok: boolean }>(`${API}/obras/${idObra}/processo/${etapa}?tenant_id=1`, { method: 'DELETE' }, 'Erro ao desfazer.'),
  enviarFoto: (idObra: number, f: { etapa: EtapaFoto; conteudo: string; nome: string; legenda?: string | null; podeDivulgar?: boolean }) =>
    pedir<{ idFoto: number; url: string }>(`${API}/obras/${idObra}/fotos?tenant_id=1`, corpo('POST', f), 'Erro ao enviar a foto.'),
  salvarFoto: (id: number, f: { etapa: EtapaFoto; legenda: string | null; podeDivulgar: boolean }) => pedir<{ ok: boolean }>(`${API}/fotos/${id}?tenant_id=1`, corpo('PUT', f), 'Erro ao salvar a foto.'),
  apagarFoto: (id: number) => pedir<{ ok: boolean }>(`${API}/fotos/${id}?tenant_id=1`, { method: 'DELETE' }, 'Erro ao apagar a foto.'),
  galeria: () => pedir<(FotoObra & { obra: string; cidade: string | null; cliente: string | null })[]>(`${API}/processo/galeria?tenant_id=1`, undefined, 'Erro ao montar a galeria.'),
  pendencias: () => pedir<{ leads: Lead[]; itens: PendenciaObra[] }>(`${API}/processo/pendencias?tenant_id=1`, undefined, 'Erro ao montar as pendências.'),
  indicadores: (de?: string, ate?: string) => pedir<IndicadoresProcesso>(`${API}/processo/indicadores?${q({ de, ate })}`, undefined, 'Erro ao calcular os indicadores.'),
  documento: (idObra: number) => pedir<DocumentoObra>(`${API}/obras/${idObra}/documento?tenant_id=1`, undefined, 'Erro ao montar o documento.'),
};
/** Endereço completo de um arquivo do servidor (/uploads/...). */
export const urlArquivo = (caminho: string | null) => (!caminho ? null : /^https?:/.test(caminho) ? caminho : `${API_URL}${caminho}`);

// ------------------------------------------------------------------ orçamento rápido, termos aditivos e ficha do cliente
export type GrupoItem = 'PERFURACAO' | 'REVESTIMENTO' | 'BOMBA' | 'INSTALACAO' | 'MATERIAL' | 'SERVICO' | 'OUTRO';
export const GRUPOS_ITEM: Record<GrupoItem, string> = {
  PERFURACAO: 'Perfuração', REVESTIMENTO: 'Revestimento', BOMBA: 'Bomba', INSTALACAO: 'Instalação', MATERIAL: 'Material', SERVICO: 'Serviço', OUTRO: 'Outro',
};
export const UNIDADES_ITEM = ['m', 'un', 'h', 'sc', 'kg', 'L', 'vb'] as const;
export interface ItemOrcamentoForm {
  grupo: GrupoItem; descricao: string; quantidade: number; unidade: string; valorUnitario: number; valorTotal: number;
  /** "Se necessário": não entra no total (ex.: metro excedente). */
  opcional: boolean;
  /** Incluso no pacote: mostra o valor de referência, não entra no total (ex.: transporte, bomba). */
  incluso?: boolean;
}
export interface ResumoItens { total: number; opcionais: number; metrosPrevistos: number | null; valorMetro: number | null; valorMetroExcedente: number | null }
export interface AdicionalDoAditivo { idAdicional: number; tipo: TipoAdicional; descricao: string; quantidade: number; valorUnitario: number; valor: number; situacao: SituacaoAdicional; aprovadoEm: string | null; idAditivo: number | null }
export interface Aditivo { idAditivo: number; numero: number; valor: number; observacao: string | null; emitidoEm: string; assinadoEm: string | null; operador: string; adicionais: AdicionalDoAditivo[] }
export interface NovoOrcamento extends Partial<Omit<ObraForm, 'idCliente' | 'idPoco'>> {
  idCliente?: number | null; novoCliente?: Partial<ClientePocoForm>; idLead?: number | null; idPoco?: number | null;
  local?: { identificacao?: string | null; endereco?: string | null; cidade?: string | null; uf?: string | null; gps?: string | null } | null;
  itens: ItemOrcamentoForm[];
}
export interface ClienteCompleto {
  cliente: ClientePocoForm & { idCliente: number };
  resumo: { contratos: number; abertos: number; valorTotal: number; recebido: number; aReceber: number; vencido: number; pocos: number };
  contratos: { idObra: number; titulo: string; servicos: Servico[]; situacao: SituacaoObra; poco: string | null; idPoco: number | null; criadaEm: string;
    dataInicio: string | null; dataTermino: string | null; total: number; recebido: number; aReceber: number; vencido: number; aditivos: number;
    contratoAssinado: boolean; garantiaAte: string | null }[];
  pocos: { idPoco: number; identificacao: string; endereco: string | null; cidade: string | null; latitude: number | null; longitude: number | null;
    profundidadeM: number | null; diametro: string | null; vazaoLh: number | null; nivelEstaticoM: number | null; nivelDinamicoM: number | null;
    dataPerfuracao: string | null; perfuradoPor: Poco['perfuradoPor']; situacao: Poco['situacao']; obras: number; iot: boolean; planos: number }[];
  parcelas: { idParcela: number; idObra: number; descricao: string; vencimento: string | null; saldo: number; vencida: boolean }[];
  recebimentos: { idObra: number; descricao: string; forma: FormaRecebimento; valor: number; em: string }[];
  linhaDoTempo: { data: string; tipo: 'CONTATO' | 'OBRA' | 'PROCESSO' | 'ALERTA'; titulo: string; detalhe: string | null; idObra: number | null }[];
  plano: ClientePlano | null;
}
export const orcamentoApi = {
  criar: (o: NovoOrcamento) => pedir<{ idObra: number; idCliente: number; idPoco: number | null; total: number }>(`${API}/orcamentos?tenant_id=1`, corpo('POST', o), 'Erro ao criar o orçamento.'),
  itens: (idObra: number) => pedir<{ itens: ItemOrcamentoForm[]; resumo: ResumoItens }>(`${API}/obras/${idObra}/itens?tenant_id=1`, undefined, 'Erro ao carregar os itens.'),
  salvarItens: (idObra: number, itens: ItemOrcamentoForm[]) =>
    pedir<{ itens: ItemOrcamentoForm[]; resumo: ResumoItens | null }>(`${API}/obras/${idObra}/itens?tenant_id=1`, corpo('PUT', { itens }), 'Erro ao salvar os itens.'),
  duplicar: (idObra: number, idCliente?: number | null) => pedir<{ idObra: number }>(`${API}/obras/${idObra}/duplicar?tenant_id=1`, corpo('POST', { idCliente }), 'Erro ao duplicar o orçamento.'),
  aditivos: (idObra: number) => pedir<{ aditivos: Aditivo[]; semAditivo: AdicionalDoAditivo[] }>(`${API}/obras/${idObra}/aditivos?tenant_id=1`, undefined, 'Erro ao listar os aditivos.'),
  emitirAditivo: (idObra: number, d: { idsAdicionais?: number[]; observacao?: string | null }) =>
    pedir<{ idAditivo: number; numero: number; valor: number }>(`${API}/obras/${idObra}/aditivos?tenant_id=1`, corpo('POST', d), 'Erro ao emitir o aditivo.'),
  assinado: (idAditivo: number, assinadoEm: string | null) =>
    pedir<{ ok: boolean }>(`${API}/aditivos/${idAditivo}/assinado?tenant_id=1`, corpo('POST', { assinadoEm }), 'Erro ao marcar a assinatura.'),
  apagarAditivo: (idAditivo: number) => pedir<{ ok: boolean }>(`${API}/aditivos/${idAditivo}?tenant_id=1`, { method: 'DELETE' }, 'Erro ao apagar o aditivo.'),
};

/** Linha do orçamento com o total arredondado (quantidade × valor unitário). */
export const linhaItem = (i: Omit<ItemOrcamentoForm, 'valorTotal'>): ItemOrcamentoForm =>
  ({ ...i, valorTotal: Math.round((Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0) * 100) / 100 });
/**
 * Mesmo cálculo do servidor: total sem os opcionais nem os inclusos; perfuração por faixas (0–10 m, 10–30 m...) soma os
 * metros previstos e o valor do metro é o da última faixa; metro excedente pela linha opcional de perfuração em metros.
 */
export const resumoItens = (itens: ItemOrcamentoForm[]): ResumoItens => {
  const c = (v: number) => Math.round(v * 100);
  const somam = itens.filter(i => !i.opcional && !i.incluso);
  const faixas = somam.filter(i => i.grupo === 'PERFURACAO' && i.unidade === 'm');
  const perf = faixas.length ? { quantidade: faixas.reduce((s, i) => s + i.quantidade, 0), valorUnitario: faixas[faixas.length - 1].valorUnitario } : null;
  const exc = itens.find(i => i.grupo === 'PERFURACAO' && i.unidade === 'm' && i.opcional);
  return {
    total: somam.reduce((s, i) => s + c(i.valorTotal), 0) / 100,
    opcionais: itens.filter(i => i.opcional).reduce((s, i) => s + c(i.valorTotal), 0) / 100,
    metrosPrevistos: perf ? perf.quantidade : null, valorMetro: perf ? perf.valorUnitario : null,
    valorMetroExcedente: exc ? exc.valorUnitario : perf ? perf.valorUnitario : null,
  };
};
type LinhaPronta = { rotulo: string; item: Omit<ItemOrcamentoForm, 'valorTotal'> };
const pronta = (rotulo: string, grupo: GrupoItem, descricao: string, quantidade: number, unidade: string, valorUnitario: number,
  tipo: 'SOMA' | 'INCLUSO' | 'SE_NECESSARIO' = 'SOMA'): LinhaPronta =>
  ({ rotulo, item: { grupo, descricao, quantidade, unidade, valorUnitario, opcional: tipo === 'SE_NECESSARIO', incluso: tipo === 'INCLUSO' } });

/**
 * Linhas prontas do orçamento, com os valores de referência da planilha da empresa (perfuração 6" até 60 m por faixa de
 * solo, metro excedente a R$ 280, o que vai incluso e o que é "se necessário"). São só o ponto de partida: quantidade e
 * valor mudam em cada orçamento (cliente, cidade, solo).
 */
export const ITENS_PRONTOS: LinhaPronta[] = [
  pronta('Transporte e montagem', 'SERVICO', 'Transporte e montagem do equipamento', 1, 'vb', 0, 'INCLUSO'),
  pronta('Alimentação e hospedagem', 'SERVICO', 'Alimentação e hospedagem da equipe', 1, 'vb', 0, 'INCLUSO'),
  pronta('Gerador (se nec.)', 'SERVICO', 'Uso de gerador de energia (se necessário)', 1, 'vb', 320, 'SE_NECESSARIO'),
  pronta('Água (se nec.)', 'SERVICO', 'Água para a perfuração (se necessário)', 1, 'vb', 300, 'SE_NECESSARIO'),
  pronta('Perfuração 0–10 m', 'PERFURACAO', 'Perfuração diâm. 6" · sedimento superficial (0 a 10 m)', 10, 'm', 300),
  pronta('Perfuração 10–30 m', 'PERFURACAO', 'Perfuração diâm. 6" · sedimento (10 a 30 m)', 20, 'm', 290),
  pronta('Perfuração 30–40 m', 'PERFURACAO', 'Perfuração diâm. 6" · rocha sã (30 a 40 m)', 10, 'm', 280),
  pronta('Perfuração 40–60 m', 'PERFURACAO', 'Perfuração diâm. 6" · rocha consolidada (40 a 60 m)', 20, 'm', 270),
  pronta('Metro excedente', 'PERFURACAO', 'Metro excedente (acima do previsto, se necessário)', 1, 'm', 280, 'SE_NECESSARIO'),
  pronta('Revestimento 5"', 'REVESTIMENTO', 'Revestimento · tubo liso 5"', 6, 'un', 260, 'INCLUSO'),
  pronta('Corda de segurança', 'MATERIAL', 'Corda de segurança', 60, 'm', 0, 'INCLUSO'),
  pronta('Fiação elétrica', 'MATERIAL', 'Fiação elétrica', 60, 'm', 3.8, 'INCLUSO'),
  pronta('Encanamento 1"', 'MATERIAL', 'Encanamento 1"', 10, 'un', 150, 'INCLUSO'),
  pronta('Bomba submersa', 'BOMBA', 'Bomba submersa', 1, 'un', 1800, 'INCLUSO'),
  pronta('Ensaio de vazão', 'SERVICO', 'Ensaio de vazão', 1, 'un', 0, 'INCLUSO'),
  pronta('Cimentação (se nec.)', 'SERVICO', 'Cimentação do espaço anular (se necessário)', 1, 'vb', 0, 'SE_NECESSARIO'),
  pronta('Tampa do poço', 'MATERIAL', 'Tampa do poço', 1, 'un', 100, 'INCLUSO'),
  pronta('Painel elétrico', 'INSTALACAO', 'Painel elétrico', 1, 'un', 700, 'INCLUSO'),
  pronta('Limpeza do local', 'SERVICO', 'Limpeza do local', 1, 'vb', 0, 'INCLUSO'),
];

// ------------------------------------------------------------------ central (painel principal)
export type FaseContrato = 'NEGOCIACAO' | 'SINAL' | 'EXECUCAO' | 'FECHAMENTO';
export type Gravidade = 'ALTA' | 'MEDIA' | 'BAIXA';
export type AcaoPendencia = 'PROCESSO' | 'COBRANCA' | 'MATERIAIS' | 'DADOS_OBRA' | 'POCO' | 'CLIENTE';
export const FASES_CONTRATO: Record<FaseContrato, { texto: string; dica: string }> = {
  NEGOCIACAO: { texto: 'Negociação', dica: 'orçamento' }, SINAL: { texto: 'Aguardando sinal', dica: 'aprovado, falta o sinal' },
  EXECUCAO: { texto: 'Em execução', dica: 'obra em andamento' }, FECHAMENTO: { texto: 'Fechamento', dica: 'concluída com algo pendente' },
};
export const GRAVIDADES: Record<Gravidade, string> = { ALTA: 'red', MEDIA: 'orange', BAIXA: 'default' };
export interface ContratoCentral {
  idObra: number; titulo: string; cliente: string | null; telefone: string | null; idCliente: number; idPoco: number | null; poco: string | null; servicos: Servico[];
  situacao: SituacaoObra; fase: FaseContrato; total: number; recebido: number; aReceber: number; desde: string; gravidade: Gravidade;
  pendencias: { texto: string; gravidade: Gravidade; acao: AcaoPendencia }[];
}
export interface ClientePlano {
  idCliente: number; nome: string; telefone: string | null; cidade: string | null; pocos: number; pocosNossos: number; idadeMaisVelhoAnos: number | null;
  profundidadeMaxM: number | null; obrasConcluidas: number; obrasManutencao: number; valorGasto: number; mesesDesdeUltimaObra: number | null;
  mesesDesdeUltimaManutencao: number | null; garantiaVencida: boolean; garantiaVencendoMeses: number | null; avaliou: boolean; temIot: boolean;
  temPlanoManutencao: boolean; parcelasVencidas: number; temTelefone: boolean; obraAberta: boolean;
  pontos: number; faixa: Gravidade; motivos: { texto: string; pontos: number }[];
  estimativa: { valorMensal: number; minimo: number; maximo: number; base: string };
}
export interface Central {
  hoje: { agenda: number; agendaTitulos: string[]; contatosSemResposta: number; alertasIot: number; aReceber: number; vencido: number };
  contratos: ContratoCentral[];
  completar: {
    pct: number; totalClientes: number; totalPocos: number;
    clientes: { idCliente: number; nome: string; pct: number; faltando: string[] }[];
    pocos: { idPoco: number; identificacao: string; proprietario: string | null; pct: number; faltando: string[] }[];
  };
  plano: { clientes: ClientePlano[]; potencialAlta: number; potencialMedia: number; visitaEmpresa: number | null; alta: number; media: number };
}
export const centralApi = { carregar: () => pedir<Central>(`${API}/central?tenant_id=1`, undefined, 'Erro ao montar a central.') };

// ------------------------------------------------------------------ painel e resultado (etapa 8)
export interface LucroObra {
  idObra: number; titulo: string; cliente: string | null; situacao: SituacaoObra; servicos: Servico[]; inicio: string | null; termino: string | null;
  concluidaNoPeriodo: boolean; total: number; recebido: number; aReceber: number; custo: number; lucro: number; margem: number | null;
  custoEstimado: boolean; semMateriais: boolean;
}
export interface PainelPocos {
  periodo: { de: string; ate: string };
  contagem: Record<SituacaoObra, number>;
  aReceber: { total: number; vencido: number };
  periodoResumo: { recebido: number; recebimentos: number; concluidas: number; faturado: number; custo: number; lucro: number; metrosPerfurados: number; perfuracoes: number };
  serie: { chave: string; rotulo: string; recebido: number; faturado: number }[];
  obras: LucroObra[];
  alertas: { idObra: number; titulo: string; tipo: 'ORCAMENTO_PARADO' | 'INICIO_ATRASADO' | 'EXECUCAO_LONGA' | 'SALDO_NAO_LANCADO'; texto: string }[];
}
export const painelApi = {
  carregar: (de: string, ate: string) => pedir<PainelPocos>(`${API}/painel?${q({ de, ate })}`, undefined, 'Erro ao montar o painel.'),
};

/** Períodos rápidos do painel: este mês, mês passado, este ano (datas AAAA-MM-DD). */
export const periodoRapido = (qual: 'MES' | 'MES_ANTERIOR' | 'ANO', hoje: Date) => {
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const a = hoje.getFullYear(), m = hoje.getMonth();
  if (qual === 'MES_ANTERIOR') return { de: f(new Date(a, m - 1, 1)), ate: f(new Date(a, m, 0)) };
  if (qual === 'ANO') return { de: `${a}-01-01`, ate: f(hoje) };
  return { de: f(new Date(a, m, 1)), ate: f(hoje) };
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
