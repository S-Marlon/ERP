// Módulo Mercado Livre (/api/modulos/ecommerce/mercadolivre).
import { API_URL } from '../../../shared/api/config';

const API = `${API_URL}/api/modulos/ecommerce/mercadolivre`;

export interface StatusML {
  configurado: boolean; faltando: string[]; redirectUri: string | null; urlAutorizacao: string | null;
  conectado: boolean; apelido: string | null; mlUserId: number | null; expiraEm: string | null;
}

export interface ContaML {
  id: number; apelido: string; email: string | null; site: string; cidade: string | null; estado: string | null;
  reputacao: string; mercadoLider: string | null; vendasConcluidas: number; anuncios: number; link: string | null;
}

const ler = async <T,>(r: Response, padrao: string): Promise<T> => {
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend.');
  if (r.status === 403 && d?.detalhes?.codigo === 'MODULO_DESATIVADO') throw new Error('Ligue o módulo Mercado Livre em Configurações › Módulos.');
  if (!r.ok) throw new Error(d.error || padrao);
  return d as T;
};
const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export const mercadoLivreApi = {
  status: async () => ler<StatusML>(await fetch(`${API}/status?tenant_id=1`), 'Erro ao ler a conexão.'),
  conectar: async (endereco: string) => ler<{ apelido: string | null }>(await fetch(`${API}/conectar?tenant_id=1`, json('POST', { endereco })), 'Erro ao conectar.'),
  desconectar: async () => ler<{ success: boolean }>(await fetch(`${API}/desconectar?tenant_id=1`, json('POST', {})), 'Erro ao desconectar.'),
  conta: async () => ler<ContaML>(await fetch(`${API}/conta?tenant_id=1`), 'Erro ao consultar a conta.'),
};

// ---------------------------------------------------------------------------
// Central de anúncios
// ---------------------------------------------------------------------------

export type ValorAtributo =
  | { origem: 'erp'; atributoId: number }
  | { origem: 'marca' }
  | { origem: 'fixo'; valor: string; valorId?: string | null; unidade?: string | null };

export interface AtributoML {
  id: string; nome: string; tipo: string; obrigatorio: boolean; permiteVariar: boolean; porVariacao: boolean;
  valores: { id: string; nome: string }[]; unidades: string[]; unidadePadrao: string | null;
}

export interface Pendencia { nivel: 'erro' | 'aviso'; area: 'dados' | 'itens' | 'atributos' | 'cadastro'; texto: string; idItem?: number; idLinha?: number; atributo?: string }

export interface AnuncioResumo {
  id: number; titulo: string | null; idFamilia: number | null; familia: string | null;
  categoriaMl: string | null; categoriaNome: string | null; tipoAnuncio: string;
  situacao: 'RASCUNHO' | 'PUBLICADO' | 'PAUSADO' | 'ENCERRADO'; preparo: 'PENDENTE' | 'PRONTO' | null;
  mlbId: string | null; permalink: string | null; qtdItens: number; publicados: number; aPublicar: number; fotoUrl: string | null; estoque: number;
  precoMin: number | null; precoMax: number | null; erros: number; avisos: number; atualizadoEm: string; ultimoErro: string | null;
  estoqueMl: number; estoqueReserva: number; estoqueMaximo: number | null; ativosMl: number; pausadosMl: number; pausadosPrejuizo?: number; bloqueadosMl?: number; itens: ItemResumo[];
}
export interface ItemResumo {
  idItem: number; idLinha: number; ativo: boolean; sku: string; nome: string; fotoUrl: string | null; mlbId: string | null; status: string | null; permalink: string | null;
  estoque: number; estoqueMl: number; precoMl: number | null; preco: number; unidade: string | null;
  erroMl?: string | null;   // o que o ML devolveu de problema (moderação, trava de prejuízo, envio recusado)
}
/** Você recebe e lucro de um item ao preço de hoje (tarifa e frete grátis do ML). */
export interface FinanceiroItem {
  idItem: number; idLinha: number; preco: number; tarifa: number; frete: number; recebe: number; custo: number; lucro: number;
  lucroSobreCustoPct: number | null; nivel: LucroMl['nivel']; freteGratis: boolean; freteDesconhecido: boolean; alvoPct: number;
  tipo?: string; modoNoMl?: boolean;   // tipo de anúncio e frete grátis lidos do ML (modoNoMl) ou do ERP/padrão da conta
  freteDoMl?: boolean; freteEstimado?: number | null;   // frete lido do anúncio no ML (e o que o ERP estimava)
  precoAlvo: number | null;   // menor preço que dá o alvo sobre o custo (null sem custo)
  alertas: AlertaPreco[];     // degraus de preço (taxa fixa de item barato, frete grátis a partir de R$ 79)
}
/** Degrau de preço do ML: grave = o preço atual está perdendo dinheiro por pouco (com o preço sugerido). */
export interface AlertaPreco { tipo: 'TAXA_FIXA' | 'PERTO_TAXA_FIXA' | 'FRETE_ACIMA_79' | 'PERTO_FRETE_79'; grave: boolean; texto: string; precoSugerido: number | null }
/** Você recebe e lucro a um preço qualquer (simulação enquanto digita). */
export type PrevisaoPreco = Omit<FinanceiroItem, 'idItem' | 'idLinha' | 'freteGratis'>;

/** Preço por quantidade (B2B): a partir de `minimo` unidades, `desconto`% sobre o preço do anúncio. */
export interface FaixaQuantidade { minimo: number; desconto: number }

export interface LucroMl {
  preco: number; tarifa: number; frete: number; liquido: number; custo: number; lucro: number;
  lucroSobreCustoPct: number | null; margemSobrePrecoPct: number | null; nivel: 'PREJUIZO' | 'BAIXO' | 'BOM' | 'ALTO' | 'SEM_CUSTO'; freteDesconhecido?: boolean;
}
export interface EstatisticasMercado { n: number; min: number; p25: number; mediana: number; p75: number; max: number }
export interface AnalisePreco {
  idItem: number; idLinha: number; sku: string; titulo: string; marca: string | null; unidades: number; unidadeMl: string | null; custo: number; custoBase: number;
  alvo: { pct: number; origem: 'FAMILIA' | 'PADRAO' }; tarifa: { comissaoPct: number; fixa: number }; frete: number;
  atual: LucroMl; simulado: LucroMl | null; precoAlvo: number | null; loja: { preco: number; difPct: number | null };
  mercado: {
    produtos: { produtoId: string; nome: string; marca: string | null; unidades: number; preco: number; porUnidade: number; fonte: string }[];
    estatisticas: EstatisticasMercado | null; todos?: EstatisticasMercado | null; mesmaMarca: EstatisticasMercado | null; regua?: 'PACOTE_PARECIDO' | 'TODOS';
    erro: string | null; porUnidade: number; nivel: 'ABAIXO' | 'COMPETITIVO' | 'ACIMA' | 'SEM_REFERENCIA'; difMedianaPct: number | null; precoMercado: number | null;
  };
  faixas: (LucroMl & { minimo: number; desconto: number })[]; conselhos: string[];
  envio: {
    gratis: boolean; obrigatorio: boolean; informado: boolean; logistica: string; noAnuncio: boolean; limite: number;
    peso: { pesoG: number; fonte: 'ML' | 'ERP' } | null; envio: FreteEnvio | null; semGratis?: FreteEnvio | null; acimaDoLimite: FreteEnvio | null; abaixoDoLimite: FreteEnvio | null;
    doMl?: { valor: number | null; estimado: number | null } | null;   // frete lido do anúncio no ML, no preço de lá
  };
  cenarios: (ResultadoVendaMl & { tipo: 'gold_special' | 'gold_pro'; freteGratis: boolean; atual: boolean; obrigatorio: boolean; precoAlvo?: number | null })[];
  porQuantidade: (ResultadoVendaMl & { desconto: number; faixa: boolean; freteDesconhecido: boolean })[];
  degraus: string[]; alertas: AlertaPreco[]; alertasSimulado: AlertaPreco[];
}
export interface FreteEnvio { valor: number; cheio: number | null; descontoPct: number | null; pesoG: number | null }
export interface ResultadoVendaMl {
  quantidade: number; precoUnit: number; receita: number; tarifa: number; frete: number; recebe: number; custo: number; lucro: number;
  lucroPorUnidade: number; lucroSobreCustoPct: number | null; margemSobrePrecoPct: number | null; tarifaPct: number; nivel: LucroMl['nivel'];
}

export interface CandidatoCatalogo {
  produtoId: string; nome: string; marca: string | null; modelo: string | null; unidades: string | null; foto: string | null;
  gtinConfere: boolean; marcaConfere: boolean; podeEntrar: boolean; conferem: string[];
  diferentes: { nome: string; catalogo: string; item: string }[]; conferir: { nome: string; catalogo: string; item: string }[];
}
export interface CatalogoItem {
  idItem: number; idLinha: number; sku: string; mlbId: string; elegibilidade: string | null; elegibilidadeTexto: string; podeDisputar: boolean; mlbCatalogo: string | null;
  disputa: { status: string; precoAtual: number | null; precoParaGanhar: number | null; motivos: string[]; oportunidades: string[]; vantagens: string[];
    ganhador: { mlbId: string; preco: number | null } | null; produtoId: string | null } | null;
  candidatos: CandidatoCatalogo[];
}

/** Uma forma de vender o item no ML: sozinho (1) ou em conjunto (kit c/N), com o lucro a esse preço. */
export interface FormaDeVenda {
  quantidade: number; idLinha: number | null; ativo: boolean | null; sigla: string; sku: string | null; mlbId: string | null; status: string | null;
  simulado: boolean; preco: number; porUnidade: number; tarifa: number; frete: number; freteDesconhecido: boolean; recebe: number; custo: number;
  lucro: number; lucroPorUnidade: number; lucroSobreCustoPct: number | null; nivel: LucroMl['nivel']; precoAlvo: number | null; precoAlvoPorUnidade: number | null;
  estoque: number;
}
export interface FormasDeVenda { idItem: number; sku: string; custoUnidade: number | null; alvoPct: number | null; formas: FormaDeVenda[] }
export interface UnidadeVenda { idUnidade: number; sigla: string; nome: string; fator: number; preco: number | null }

export interface ItemDoAnuncio {
  idItem: number;
  idLinha: number;            // linha do anúncio: o mesmo item pode estar em mais de uma unidade (ex.: UN e kit c/10)
  linhaAtiva?: boolean;       // false = desativada (não publica; no ML fica pausada)
  sku: string; nome: string; ativo: boolean; preco: number; precoMl: number | null; precoAnuncio: number;
  comissao: number | null; percentualComissao: number | null; fotos: number; fotoUrl: string | null;
  fotoBase?: string | null;   // 1ª foto sem medidas desenhadas (as geradas pelo editor não servem de base)
  estoque: number;          // saldo do ERP (kit: quantos dá para montar)
  estoqueMl: number;        // o que vai para o ML (saldo − reserva, até o teto)
  kit?: boolean;
  siglaBase?: string | null;          // unidade em que o ERP controla o saldo (ex.: PC)
  estoqueBase?: number;               // saldo na unidade base quando o ML vende outra unidade
  unidadeMl?: UnidadeVenda | null;    // unidade vendida no ML (ex.: pacote c/12)
  unidades: UnidadeVenda[];           // unidades derivadas que dá para vender no ML
  gtin: string | null; pesoKg: number | null; medidasCm: { altura: number; largura: number; comprimento: number } | null;
  marca: string | null; valoresErp: Record<string, string | null>; motivosCadastro: string[];
  valores: Record<string, { valor: string; valorId: string | null; unidade: string | null } | null>;
  tituloMl?: string; tituloCortado?: boolean;   // título deste item no ML
  faixasProprias?: FaixaQuantidade[] | null;    // escada só desta forma (null = unidade segue o anúncio, kit sem escada)
  ml: {
    mlbId: string | null; status: string | null; permalink: string | null; erro: string | null;
    estoqueEnviado: number | null; precoEnviado: number | null; sincronizadoEm: string | null;
    regra: { reserva: number | null; maximo: number | null };   // exceção do item (vazio = regra do anúncio)
  };
}

export interface AnuncioDetalhe extends Omit<AnuncioResumo, 'itens'> {
  condicao: 'new' | 'used'; descricao: string; ajustePreco: number; atributos: Record<string, ValorAtributo>;
  fotoFamilia: string | null;   // vale para os itens sem foto própria
  modo: 'FAMILIA' | 'SEPARADO';  // página única com opções ou um anúncio por item
  faixasQuantidade: FaixaQuantidade[]; faixasGerenciadas: boolean; faixasAtacado: FaixaQuantidade[]; contaB2B: boolean;
  vendaMl?: VendaMl | null;   // tipo e frete grátis como estão no ML (null: nada publicado)
  modeloTitulo: string;
  estoqueReserva: number; estoqueMaximo: number | null; estoqueAutomatico: boolean; sincronizadoEm: string | null;
  categoria: { id: string; nome: string; caminho: string; final: boolean; maxTitulo: number; maxFotos: number; filhos: { id: string; nome: string }[] } | null;
  atributosCategoria: AtributoML[]; atributosErp: { id: number; nome: string }[]; eixos: string[];
  itens: ItemDoAnuncio[]; pendencias: Pendencia[];
}

export interface Candidatos {
  familias: { id: number; nome: string; itens: number; anunciados: number; comFoto: number; comEstoque: number }[];
  itens: { idItem: number; sku: string; nome: string; preco: number; estoque: number; familia: string | null; idAnuncio: number | null; fotoUrl: string | null }[];
}

/** Modo de venda do anúncio publicado: tipo, frete grátis e o que o ML deixa trocar. */
export interface VendaMl {
  tipo: string | null; tiposPermitidos: string[]; podeMudarFrete: boolean; misturado: boolean;
  freteGratis: boolean | null;   // null: itens diferentes no ML (cada um mostra o seu); escolher um vale para todos
}
/** Foto no ML (do anúncio, de outro anúncio ou do catálogo). */
export interface FotoMl { id: string; url: string; tamanho: string | null; noErp?: boolean }
/** Fotos de um item: as do cadastro do ERP e as do anúncio dele no ML. */
export interface FotosItemMl { idItem: number; idLinha: number; sku: string; nome: string; mlbId: string | null; erp: { idAnexo: number; url: string; principal: boolean }[]; ml: FotoMl[] }
export interface BuscaFotosMl { origem: 'ANUNCIO' | 'CATALOGO'; id: string; titulo: string; proprio: boolean; catalogo?: string | null; fotos: FotoMl[] }
export interface ConferenciaItem { idItem: number; idLinha: number; sku: string; ok: boolean; erros: string[] }

export interface AnuncioNoMl {
  mlbId: string; titulo: string; familia: string | null; status: string; preco: number; estoque: number; vendidos: number;
  permalink: string; fotoUrl: string | null; sku: string | null; catalogo: boolean; tipoAnuncio: string;
  sugestao: { idItem: number; sku: string; nome: string; idAnuncio: number | null } | null;
}
export interface PreviaImportacao { jaLigados: number; itens: AnuncioNoMl[] }

export const ROTULO_STATUS_ML: Record<string, { texto: string; cor: string }> = {
  active: { texto: 'Ativo no ML', cor: 'green' }, paused: { texto: 'Pausado no ML', cor: 'orange' },
  closed: { texto: 'Encerrado no ML', cor: 'default' }, under_review: { texto: 'Em revisão no ML', cor: 'gold' },
  inactive: { texto: 'Inativo no ML', cor: 'default' }, deleted: { texto: 'Excluído no ML', cor: 'red' },
};

/** Item encerrado ou excluído no ML: não recebe mais estoque/preço e pode ser desligado. */
export const foraDoMl = (status: string | null | undefined) => status === 'closed' || status === 'deleted';

export interface ResultadoSincronizacao {
  idAnuncio: number; idItem: number; sku: string; mlbId: string;
  estoqueDe: number | null; estoquePara: number | null; precoDe: number | null; precoPara: number | null; erro: string | null;
  trava?: 'PAUSADO' | 'REATIVADO' | null; motivo?: string | null;   // trava de prejuízo
  desligadoNoErp?: boolean;   // pausado no ML porque está desligado no ERP
}
export interface SituacaoSincronizacao {
  ultimaEm: string | null; enviados: number; erros: number; mensagem: string | null; rodando: boolean; intervaloMin: number;
  vendasNovas?: number; pedidosPendentes?: number; erroPedidos?: string | null;
  pausadosPrejuizo?: number; reativadosPrejuizo?: number; pausadosDesligados?: number;
}

export type SituacaoPedido = 'VENDA' | 'VENDA_CANCELADA' | 'CANCELADO_NO_ML' | 'CANCELADO' | 'PENDENTE' | 'AGUARDANDO';
export interface PedidoMl {
  id: number; mlOrderId: string; idVenda: number | null; statusMl: string; comprador: string;
  total: number; comissao: number; frete: number; liquido: number; data: string | null; erro: string | null; situacao: SituacaoPedido;
  custo: number | null; lucro: number | null;   // custo do ERP gravado na venda e o lucro real (sem venda: null)
  documentoTipo: string | null; exigeNota: boolean; liberacaoEm: string | null;
  titulo: { status: string; vencimento: string } | null;   // título a receber da venda (Financeiro)
  itens: { mlbId: string; titulo: string; sku: string | null; quantidade: number; precoUnitario: number }[];
}

export interface ConfigMl { idClienteRecebiveis: number | null; clienteNome: string | null; pedidosDesde: string | null }

export interface ResultadoAnuncioMl {
  mlbId: string; titulo: string; pedidos: number; unidades: number; receita: number; comissao: number; frete: number;
  custo: number; recebido: number; lucro: number; lucroSobreCustoPct: number | null; fretePorPedido: number;
}
export interface ResultadoVendasMl {
  dias: number; pedidos: number; anuncios: ResultadoAnuncioMl[];
  total: { receita: number; comissao: number; frete: number; recebido: number; custo: number; lucro: number; lucroSobreCustoPct: number | null };
}

export const pedidosApi = {
  resultado: async (dias: number) => ler<ResultadoVendasMl>(await fetch(`${API}/pedidos/resultado?tenant_id=1&dias=${dias}`), 'Erro ao calcular o resultado das vendas.'),
  config: async () => ler<ConfigMl>(await fetch(`${API}/config?tenant_id=1`), 'Erro ao ler a configuração.'),
  salvarConfig: async (idClienteRecebiveis: number | null) =>
    ler<ConfigMl & { titulosCriados: number }>(await fetch(`${API}/config?tenant_id=1`, json('PUT', { idClienteRecebiveis })), 'Erro ao salvar a configuração.'),
  clientes: async (busca: string) =>
    ler<{ id: number; nome: string; fantasia: string | null; documento: string | null }[]>(await fetch(`${API}/clientes?tenant_id=1&busca=${encodeURIComponent(busca)}`), 'Erro ao buscar clientes.'),
  listar: async () => ler<PedidoMl[]>(await fetch(`${API}/pedidos?tenant_id=1`), 'Erro ao listar os pedidos.'),
  buscar: async () =>
    ler<{ vendas: number; pendentes: number; canceladosNoMl: number; lidos: number }>(await fetch(`${API}/pedidos/buscar?tenant_id=1`, json('POST', {})), 'Erro ao buscar os pedidos no ML.'),
  reprocessar: async (id: number) =>
    ler<{ acao: string; idVenda: number | null; erro: string | null }>(await fetch(`${API}/pedidos/${id}/processar?tenant_id=1`, json('POST', {})), 'Erro ao processar o pedido.'),
  /** Cancela a venda do ERP (a mesma ação de Vendas): devolve o estoque. */
  cancelarVenda: async (idVenda: number, motivo: string) =>
    ler<{ success: boolean }>(await fetch(`${API_URL}/api/vendas/pdv/vendas/${idVenda}/cancelar?tenant_id=1`, json('POST', { motivo })), 'Erro ao cancelar a venda.'),
};

/** Resumo de uma sincronização para mensagem: "3 itens atualizados (estoque 0 → 5...)". */
export const resumoSincronizacao = (r: ResultadoSincronizacao[]) => {
  const ok = r.filter(x => !x.erro);
  const erros = r.filter(x => x.erro);
  if (!r.length) return { tipo: 'info' as const, texto: 'Nada para mandar: o ML já está igual ao ERP.' };
  const pausados = ok.filter(x => x.trava === 'PAUSADO');
  const reativados = ok.filter(x => x.trava === 'REATIVADO');
  const trava = [
    pausados.length ? `${pausados.length} pausado(s) por prejuízo (${pausados.map(x => x.sku).slice(0, 3).join(', ')})` : '',
    reativados.length ? `${reativados.length} reativado(s): voltaram a dar lucro` : '',
  ].filter(Boolean).join(' · ');
  const desligados = ok.filter(x => x.desligadoNoErp);
  if (desligados.length && !trava) {
    return { tipo: 'warning' as const, texto: `${desligados.length} pausado(s) no ML porque estão desligados no ERP (${desligados.map(x => x.sku).slice(0, 3).join(', ')}).${erros.length ? ` ${erros.length} recusados (${erros[0].sku}: ${erros[0].erro}).` : ''}` };
  }
  if (trava) return { tipo: pausados.length || erros.length ? 'warning' as const : 'success' as const, texto: `${ok.length} item(ns) atualizados no ML. Trava de prejuízo: ${trava}.${erros.length ? ` ${erros.length} recusados (${erros[0].sku}: ${erros[0].erro}).` : ''}` };
  const exemplo = ok[0] ? ` (ex.: ${ok[0].sku}${ok[0].estoquePara !== null ? ` estoque ${ok[0].estoqueDe ?? '?'} → ${ok[0].estoquePara}` : ''}${ok[0].precoPara !== null ? ` preço ${ok[0].precoDe ?? '?'} → ${ok[0].precoPara}` : ''})` : '';
  if (!erros.length) return { tipo: 'success' as const, texto: `${ok.length} item(ns) atualizados no Mercado Livre${exemplo}.` };
  return { tipo: 'warning' as const, texto: `${ok.length} atualizados, ${erros.length} recusados (${erros[0].sku}: ${erros[0].erro}).` };
};

export interface CategoriaNo { id: string | null; nome: string; caminho: string; final: boolean; filhos: { id: string; nome: string }[] }

/** Garante a lista de alertas (backend de versão anterior não manda). */
const comAlertas = <T extends { alertas?: AlertaPreco[]; precoAlvo?: number | null }>(x: T): T => ({ ...x, alertas: x.alertas ?? [], precoAlvo: x.precoAlvo ?? null });

export type TipoSugestao = 'FRETE_GRATIS' | 'CAIXA' | 'PESO' | 'KIT' | 'PRECO' | 'CADASTRO' | 'FRETE_19';
export type SecaoPreco = 'formas' | 'cenarios' | 'mercado' | 'quantidade' | 'conta';
export interface SugestaoMl {
  tipo: TipoSugestao; idAnuncio: number; idLinha: number; sku: string; titulo: string; texto: string;
  economia: number | null;                                   // R$ a mais por venda; null = sem valor (cadastro)
  acao: { aba: 'preco' | 'itens'; secao?: SecaoPreco };
}
export interface NumerosDesempenho { visitas: number; vendas: number; unidades: number; conversao: number | null }
export interface DesempenhoPeriodos { atual: { de: string; ate: string }; anterior: { de: string; ate: string } }
export interface DesempenhoAnuncio {
  id: number; atual: NumerosDesempenho; anterior: NumerosDesempenho; semVisitas: boolean; coberturaDias: number | null;
  linhas: { idLinha: number; atual: NumerosDesempenho; anterior: NumerosDesempenho; coberturaDias: number | null }[];
}
export interface Desempenho { dias: number; periodo: DesempenhoPeriodos; anuncios: DesempenhoAnuncio[] }
/** O que está diferente entre o ERP e o anúncio no ML (o "Enviar atributos, fotos e descrição" resolve os enviáveis). */
export interface DivergenciaMl { campo: 'ATRIBUTOS' | 'FOTOS' | 'DESCRICAO' | 'TITULO'; texto: string; enviavel: boolean }
export interface PacoteMl { pesoG: number; alturaCm: number; larguraCm: number; comprimentoCm: number }
export interface DivergenciasLinha { idLinha: number; idItem: number; sku: string; diferencas: DivergenciaMl[]; pacoteMl?: PacoteMl | null }
export interface DivergenciasResumo { paraEnviar: number; soPainel: number; resumo: string[] }
/** A escada de uma forma de venda, com cada degrau calculado (quantidade na unidade do anúncio: kits no kit). */
export interface DegrauEscada {
  quantidade: number; pecas: number; desconto: number; precoUnit: number; precoPorPeca: number; receita: number;
  tarifa: number; frete: number; recebe: number; custo: number; lucro: number; lucroPorUnidade: number; lucroSobreCustoPct: number | null; nivel: string;
}
export interface EscadaLinha {
  idLinha: number; fator: number; siglaBase: string; preco: number; alvoPct: number;
  propria: FaixaQuantidade[] | null; doAnuncio: FaixaQuantidade[] | null; faixas: FaixaQuantidade[];
  degraus: DegrauEscada[]; freteDesconhecido: boolean; erros: string[]; avisos: string[];
}
/** Ficha de uma forma de venda: cada atributo com a origem, o que o ERP manda e o que está no ML. */
export interface LinhaFicha {
  id: string; nome: string; obrigatorio: boolean; origem: 'cadastro' | 'marca' | 'fixo' | 'automatico' | 'nenhuma';
  erp: string | null; ml: string | null; situacao: 'IGUAL' | 'DIFERENTE' | 'FALTA' | 'SO_ML' | 'A_PUBLICAR' | 'SEM_VALOR';
}
export interface FichaForma { publicado: boolean; mlbId: string | null; linhas: LinhaFicha[]; pacoteMl: PacoteMl | null }
/** Lucro por venda em função do preço, com os degraus do ML (gráfico "Onde o preço está"). */
export interface CurvaPrecoMl {
  atual: number; alvo: number | null; alvoPct: number; custo: number; limiteTaxaFixa: number | null; limiteFrete: number;
  limiteFreteComprador?: number | null;   // R$ 19: frete grátis ao comprador (com o frete grátis desligado)
  freteDesconhecido: boolean; pontos: { preco: number; lucro: number; pct: number | null; nivel: string }[];
}
export interface FaixasFrete {
  logistica: string | null;
  linhas: { ateG: number; gratisAbaixo79: number | null; compradorPaga20: number | null; compradorPaga50: number | null; acima79: number | null }[];
}

export const anunciosApi = {
  listar: async () => ler<AnuncioResumo[]>(await fetch(`${API}/anuncios?tenant_id=1`), 'Erro ao listar os anúncios.'),
  fotos: async (id: number) => ler<FotosItemMl[]>(await fetch(`${API}/anuncios/${id}/fotos?tenant_id=1`), 'Erro ao ler as fotos do anúncio.'),
  buscarFotos: async (ref: string) => ler<BuscaFotosMl>(await fetch(`${API}/fotos-ml/buscar?tenant_id=1&ref=${encodeURIComponent(ref)}`), 'Erro ao buscar as fotos no ML.'),
  importarFotos: async (id: number, itens: { idItem: number; idLinha?: number; fotos: { url: string; idMl?: string }[] }[]) =>
    ler<{ importadas: number }>(await fetch(`${API}/anuncios/${id}/fotos/importar?tenant_id=1`, json('POST', { itens })), 'Erro ao trazer as fotos para o ERP.'),
  financeiroAnuncio: async (id: number) => {
    const r = await ler<{ id: number; itens: FinanceiroItem[] }>(await fetch(`${API}/anuncios/${id}/financeiro?tenant_id=1`), 'Erro ao calcular o lucro do anúncio.');
    return { ...r, itens: r.itens.map(comAlertas) };
  },
  simularPreco: async (id: number, idLinha: number, preco: number) =>
    comAlertas(await ler<PrevisaoPreco>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/simular?tenant_id=1&preco=${preco}`), 'Erro ao simular o preço.')),
  financeiro: async () => (await ler<{ id: number; itens: FinanceiroItem[] }[]>(await fetch(`${API}/anuncios/financeiro?tenant_id=1`), 'Erro ao calcular o lucro dos anúncios.'))
    .map(a => ({ ...a, itens: a.itens.map(comAlertas) })),
  detalhe: async (id: number) => ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}?tenant_id=1`), 'Erro ao abrir o anúncio.'),
  candidatos: async (busca: string) => ler<Candidatos>(await fetch(`${API}/candidatos?tenant_id=1&busca=${encodeURIComponent(busca)}`), 'Erro ao buscar no catálogo.'),
  criar: async (corpo: { idFamilia?: number; idItens?: number[]; separados?: boolean }) =>
    ler<{ ids: number[] }>(await fetch(`${API}/anuncios?tenant_id=1`, json('POST', corpo)), 'Erro ao criar o anúncio.'),
  salvar: async (id: number, corpo: Partial<{
    titulo: string; categoriaMl: string | null; tipoAnuncio: string; condicao: string; descricao: string; ajustePreco: number;
    atributos: Record<string, ValorAtributo>; estoqueReserva: number; estoqueMaximo: number | null; estoqueAutomatico: boolean; modeloTitulo: string;
    faixasQuantidade: FaixaQuantidade[]; freteGratis: boolean;
  }>) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}?tenant_id=1`, json('PUT', corpo)), 'Erro ao salvar o anúncio.'),
  excluir: async (id: number) => ler<{ success: boolean }>(await fetch(`${API}/anuncios/${id}?tenant_id=1`, json('DELETE')), 'Erro ao excluir.'),
  adicionarItens: async (id: number, idItens: number[]) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens?tenant_id=1`, json('POST', { idItens })), 'Erro ao adicionar itens.'),
  removerItem: async (id: number, idLinha: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}?tenant_id=1`, json('DELETE')), 'Erro ao tirar o item.'),
  /** Vende o mesmo item também em outra unidade (nova linha); idUnidade null = a unidade base. */
  adicionarUnidade: async (id: number, idLinha: number, idUnidade: number | null) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/unidade?tenant_id=1`, json('POST', { idUnidade })), 'Erro ao adicionar a unidade.'),
  /** O anúncio publicado vende N unidades por venda: troca a unidade da linha mantendo o MLB e o preço de lá. */
  corrigirUnidade: async (id: number, idLinha: number, quantidade: number) =>
    ler<AnuncioDetalhe & { mensagem?: string }>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/corrigir-unidade?tenant_id=1`, json('POST', { quantidade })), 'Erro ao corrigir a unidade.'),
  /** Troca o tipo e/ou o frete grátis de um item já publicado, só nele (direto no ML). */
  modoDaLinha: async (id: number, idLinha: number, corpo: { tipo?: string; freteGratis?: boolean }) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/modo?tenant_id=1`, json('POST', corpo)), 'Erro ao mudar o modo de venda do item.'),
  /** A escada da forma calculada degrau a degrau (faixas = simular outra; sem = a que vale hoje). */
  escada: async (id: number, idLinha: number, faixas?: FaixaQuantidade[]) =>
    ler<EscadaLinha>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/escada?tenant_id=1${faixas ? `&faixas=${faixas.map(f => `${f.minimo}:${f.desconto}`).join(',')}` : ''}`), 'Erro ao calcular a escada.'),
  /** Grava a escada só desta forma (null = volta à regra do anúncio; [] = sem escada); publicada, vai ao ML na hora. */
  salvarEscada: async (id: number, idLinha: number, faixas: FaixaQuantidade[] | null) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}?tenant_id=1`, json('PUT', { faixas })), 'Erro ao salvar a escada.'),
  /** Lucro em função do preço (com tarifa e frete do ML em cada preço) e os degraus do ML. */
  curva: async (id: number, idLinha: number) =>
    ler<CurvaPrecoMl>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/curva?tenant_id=1`), 'Erro ao calcular a curva de preço.'),
  /** A ficha da forma: atributo, de onde vem, ERP × ML. */
  ficha: async (id: number, idLinha: number) =>
    ler<FichaForma>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/ficha?tenant_id=1`), 'Erro ao montar a ficha.'),
  /** Liga ou desliga a linha: desligada não publica e, se já está no ML, fica pausada. */
  ativarLinha: async (id: number, idLinha: number, ativo: boolean) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}?tenant_id=1`, json('PUT', { ativo })), ativo ? 'Erro ao ativar.' : 'Erro ao desativar.'),
  /** Vende o item também em conjunto (kit c/N): cria a unidade e a conversão no cadastro se faltar, e a linha. */
  criarKit: async (id: number, idLinha: number, quantidade: number) =>
    ler<AnuncioDetalhe & { mensagem?: string }>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/kit?tenant_id=1`, json('POST', { quantidade })), 'Erro ao criar o conjunto.'),
  /** O item sozinho e em conjuntos: lucro de cada forma (a que não existe é simulada). precos: quantidade -> preço. */
  formasDeVenda: async (id: number, idLinha: number, quantidades: number[], precos: Record<number, number>) => {
    const p = Object.entries(precos).map(([q, v]) => `${q}:${v}`).join(',');
    return ler<FormasDeVenda>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/formas?tenant_id=1&quantidades=${quantidades.join(',')}${p ? `&precos=${p}` : ''}`), 'Erro ao calcular as formas de venda.');
  },
  precoItem: async (id: number, idLinha: number, preco: number | null) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}?tenant_id=1`, json('PUT', { preco })), 'Erro ao salvar o preço.'),
  /** Grava o item do anúncio: preço só no ML, unidade vendida e a regra de estoque (só os campos enviados). */
  salvarItem: async (id: number, idLinha: number, corpo: Record<string, unknown>) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}?tenant_id=1`, json('PUT', corpo)), 'Erro ao salvar o item.'),
  regraItem: async (id: number, idLinha: number, regra: { estoqueReserva?: number | null; estoqueMaximo?: number | null; idUnidade?: number | null }) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}?tenant_id=1`, json('PUT', regra)), 'Erro ao salvar o estoque do item.'),
  analisePreco: async (id: number, idLinha: number, p: { simular?: number | null; frete?: number | null; preco?: number | null }) => {
    const q = new URLSearchParams({ tenant_id: '1' });
    if (p.simular) q.set('simular', String(p.simular));
    if (p.preco) q.set('preco', String(p.preco));
    if (p.frete !== null && p.frete !== undefined) q.set('frete', String(p.frete));
    const r = await ler<AnalisePreco>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/preco?${q}`), 'Erro ao analisar o preço.');
    // backend de versão anterior não manda os campos novos: a tela não pode quebrar
    return { ...r, alertas: r.alertas ?? [], alertasSimulado: r.alertasSimulado ?? [], degraus: r.degraus ?? [], cenarios: r.cenarios ?? [], porQuantidade: r.porQuantidade ?? [] };
  },
  verificarCatalogo: async (id: number) => ler<{ itens: CatalogoItem[] }>(await fetch(`${API}/anuncios/${id}/catalogo?tenant_id=1`), 'Erro ao verificar o catálogo.'),
  entrarNoCatalogo: async (id: number, idLinha: number, produtoId: string) =>
    ler<{ mlbCatalogo: string | null; permalink: string | null }>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/catalogo?tenant_id=1`, json('POST', { produtoId })), 'Erro ao entrar no catálogo.'),
  faixasNoMl: async (id: number, quantidades: string) =>
    ler<{ mlbId: string; sku: string; preco: number; noMl: FaixaQuantidade[]; sugestao: { quantidade: number; desconto: number; preco: number; incoerente: boolean }[] }>(
      await fetch(`${API}/anuncios/${id}/faixas/ml?tenant_id=1&quantidades=${encodeURIComponent(quantidades)}`), 'Erro ao consultar o ML.'),
  /** Compara cada item publicado com o ML (recalcular: ignora o que o servidor guardou). */
  divergencias: async (id: number, recalcular = false) =>
    ler<{ linhas: DivergenciasLinha[] }>(await fetch(`${API}/anuncios/${id}/divergencias?tenant_id=1${recalcular ? '&recalcular=1' : ''}`), 'Erro ao comparar com o ML.'),
  /** Por anúncio: quantos itens têm algo para enviar ao ML (só os que têm). */
  divergenciasTodas: async () => ler<Record<number, DivergenciasResumo>>(await fetch(`${API}/anuncios/divergencias?tenant_id=1`), 'Erro ao comparar com o ML.'),
  atualizarNoMl: async (id: number) =>
    ler<{ itens: ConferenciaItem[]; detalhe: AnuncioDetalhe }>(await fetch(`${API}/anuncios/${id}/atualizar-ml?tenant_id=1`, json('POST', {})), 'Erro ao atualizar no ML.'),
  pausarNoMl: async (id: number, pausar: boolean) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/pausar?tenant_id=1`, json('POST', { pausar })), pausar ? 'Erro ao pausar no ML.' : 'Erro ao reativar no ML.'),
  encerrarNoMl: async (id: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/encerrar?tenant_id=1`, json('POST', {})), 'Erro ao encerrar no ML.'),
  desligarDoMl: async (id: number, idLinha: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idLinha}/ml?tenant_id=1`, json('DELETE')), 'Erro ao desligar do ML.'),
  sincronizarAnuncio: async (id: number, forcar = false) =>
    ler<{ enviados: ResultadoSincronizacao[]; detalhe: AnuncioDetalhe }>(await fetch(`${API}/anuncios/${id}/sincronizar?tenant_id=1`, json('POST', { forcar })), 'Erro ao atualizar no ML.'),
  sincronizarTodos: async () =>
    ler<{ enviados: ResultadoSincronizacao[] }>(await fetch(`${API}/sincronizar?tenant_id=1`, json('POST', {})), 'Erro ao atualizar no ML.'),
  situacaoSincronizacao: async () => ler<SituacaoSincronizacao>(await fetch(`${API}/sincronizar?tenant_id=1`), 'Erro ao ler a sincronização.'),
  sugerirCategorias: async (q: string) =>
    ler<{ id: string; nome: string; dominio: string }[]>(await fetch(`${API}/categorias/sugerir?tenant_id=1&q=${encodeURIComponent(q)}`), 'Erro ao sugerir categorias.'),
  validar: async (id: number) =>
    ler<{ itens: ConferenciaItem[]; detalhe: AnuncioDetalhe }>(await fetch(`${API}/anuncios/${id}/validar?tenant_id=1`, json('POST', {})), 'Erro ao conferir no ML.'),
  publicar: async (id: number) =>
    ler<{ publicados: { sku: string; mlbId: string }[]; falhas: { sku: string; erro: string }[]; detalhe: AnuncioDetalhe }>(
      await fetch(`${API}/anuncios/${id}/publicar?tenant_id=1`, json('POST', {})), 'Erro ao publicar.'),
  previaImportacao: async () => ler<PreviaImportacao>(await fetch(`${API}/importar?tenant_id=1`), 'Erro ao ler os anúncios do ML.'),
  importar: async (ligacoes: { mlbId: string; idItem: number }[]) =>
    ler<{ ids: number[]; ligados: number }>(await fetch(`${API}/importar?tenant_id=1`, json('POST', { ligacoes })), 'Erro ao importar.'),
  /** Central de sugestões: o que mudar em cada linha para custar menos ou lucrar mais (de todos os anúncios ou de um). */
  sugestoes: async (id?: number) =>
    ler<{ sugestoes: SugestaoMl[]; titulos: Record<number, string> }>(await fetch(`${API}/anuncios/sugestoes?tenant_id=1${id ? `&id=${id}` : ''}`), 'Erro ao montar as sugestões.'),
  /** Visitas, vendas e conversão (30 dias × 30 anteriores) e cobertura do estoque, por anúncio e por linha. */
  desempenho: async () => ler<Desempenho>(await fetch(`${API}/anuncios/desempenho?tenant_id=1`), 'Erro ao ler o desempenho dos anúncios.'),
  /** Quanto o ML cobra do vendedor por faixa de peso hoje (guia de frete). */
  faixasFrete: async () => ler<FaixasFrete>(await fetch(`${API}/frete/faixas?tenant_id=1`), 'Erro ao ler as faixas de frete.'),
  categoria: async (id?: string | null) => ler<CategoriaNo>(await fetch(`${API}/categorias${id ? `/${id}` : ''}?tenant_id=1`), 'Erro ao ler categorias.'),
};

export const ROTULO_TIPO_ANUNCIO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium' };
export const formatarMoeda = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
