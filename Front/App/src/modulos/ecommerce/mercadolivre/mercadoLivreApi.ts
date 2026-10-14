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

export interface Pendencia { nivel: 'erro' | 'aviso'; area: 'dados' | 'itens' | 'atributos' | 'cadastro'; texto: string; idItem?: number; atributo?: string }

export interface AnuncioResumo {
  id: number; titulo: string | null; idFamilia: number | null; familia: string | null;
  categoriaMl: string | null; categoriaNome: string | null; tipoAnuncio: string;
  situacao: 'RASCUNHO' | 'PUBLICADO' | 'PAUSADO' | 'ENCERRADO'; preparo: 'PENDENTE' | 'PRONTO' | null;
  mlbId: string | null; permalink: string | null; qtdItens: number; publicados: number; aPublicar: number; fotoUrl: string | null; estoque: number;
  precoMin: number | null; precoMax: number | null; erros: number; avisos: number; atualizadoEm: string; ultimoErro: string | null;
  estoqueMl: number; estoqueReserva: number; estoqueMaximo: number | null; ativosMl: number; pausadosMl: number; itens: ItemResumo[];
}
export interface ItemResumo {
  idItem: number; sku: string; nome: string; fotoUrl: string | null; mlbId: string | null; status: string | null; permalink: string | null;
  estoque: number; estoqueMl: number; precoMl: number | null; preco: number; unidade: string | null;
}
/** Você recebe e lucro de um item ao preço de hoje (tarifa e frete grátis do ML). */
export interface FinanceiroItem {
  idItem: number; preco: number; tarifa: number; frete: number; recebe: number; custo: number; lucro: number;
  lucroSobreCustoPct: number | null; nivel: LucroMl['nivel']; freteGratis: boolean; freteDesconhecido: boolean; alvoPct: number;
  precoAlvo: number | null;   // menor preço que dá o alvo sobre o custo (null sem custo)
}
/** Você recebe e lucro a um preço qualquer (simulação enquanto digita). */
export type PrevisaoPreco = Omit<FinanceiroItem, 'idItem' | 'freteGratis'>;

/** Preço por quantidade (B2B): a partir de `minimo` unidades, `desconto`% sobre o preço do anúncio. */
export interface FaixaQuantidade { minimo: number; desconto: number }

export interface LucroMl {
  preco: number; tarifa: number; frete: number; liquido: number; custo: number; lucro: number;
  lucroSobreCustoPct: number | null; margemSobrePrecoPct: number | null; nivel: 'PREJUIZO' | 'BAIXO' | 'BOM' | 'ALTO' | 'SEM_CUSTO'; freteDesconhecido?: boolean;
}
export interface EstatisticasMercado { n: number; min: number; p25: number; mediana: number; p75: number; max: number }
export interface AnalisePreco {
  idItem: number; sku: string; titulo: string; marca: string | null; unidades: number; unidadeMl: string | null; custo: number; custoBase: number;
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
    peso: { pesoG: number; fonte: 'ML' | 'ERP' } | null; envio: FreteEnvio | null; acimaDoLimite: FreteEnvio | null; abaixoDoLimite: FreteEnvio | null;
  };
  cenarios: (ResultadoVendaMl & { tipo: 'gold_special' | 'gold_pro'; freteGratis: boolean; atual: boolean; obrigatorio: boolean })[];
  porQuantidade: (ResultadoVendaMl & { desconto: number; faixa: boolean; freteDesconhecido: boolean })[];
  degraus: string[];
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
  idItem: number; sku: string; mlbId: string; elegibilidade: string | null; elegibilidadeTexto: string; podeDisputar: boolean; mlbCatalogo: string | null;
  disputa: { status: string; precoAtual: number | null; precoParaGanhar: number | null; motivos: string[]; oportunidades: string[]; vantagens: string[];
    ganhador: { mlbId: string; preco: number | null } | null; produtoId: string | null } | null;
  candidatos: CandidatoCatalogo[];
}

export interface UnidadeVenda { idUnidade: number; sigla: string; nome: string; fator: number; preco: number | null }

export interface ItemDoAnuncio {
  idItem: number; sku: string; nome: string; ativo: boolean; preco: number; precoMl: number | null; precoAnuncio: number;
  comissao: number | null; percentualComissao: number | null; fotos: number; fotoUrl: string | null;
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

export interface ConferenciaItem { idItem: number; sku: string; ok: boolean; erros: string[] }

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
}
export interface SituacaoSincronizacao {
  ultimaEm: string | null; enviados: number; erros: number; mensagem: string | null; rodando: boolean; intervaloMin: number;
  vendasNovas?: number; pedidosPendentes?: number; erroPedidos?: string | null;
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
  const exemplo = ok[0] ? ` (ex.: ${ok[0].sku}${ok[0].estoquePara !== null ? ` estoque ${ok[0].estoqueDe ?? '?'} → ${ok[0].estoquePara}` : ''}${ok[0].precoPara !== null ? ` preço ${ok[0].precoDe ?? '?'} → ${ok[0].precoPara}` : ''})` : '';
  if (!erros.length) return { tipo: 'success' as const, texto: `${ok.length} item(ns) atualizados no Mercado Livre${exemplo}.` };
  return { tipo: 'warning' as const, texto: `${ok.length} atualizados, ${erros.length} recusados (${erros[0].sku}: ${erros[0].erro}).` };
};

export interface CategoriaNo { id: string | null; nome: string; caminho: string; final: boolean; filhos: { id: string; nome: string }[] }

export const anunciosApi = {
  listar: async () => ler<AnuncioResumo[]>(await fetch(`${API}/anuncios?tenant_id=1`), 'Erro ao listar os anúncios.'),
  simularPreco: async (id: number, idItem: number, preco: number) =>
    ler<PrevisaoPreco>(await fetch(`${API}/anuncios/${id}/itens/${idItem}/simular?tenant_id=1&preco=${preco}`), 'Erro ao simular o preço.'),
  financeiro: async () => ler<{ id: number; itens: FinanceiroItem[] }[]>(await fetch(`${API}/anuncios/financeiro?tenant_id=1`), 'Erro ao calcular o lucro dos anúncios.'),
  detalhe: async (id: number) => ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}?tenant_id=1`), 'Erro ao abrir o anúncio.'),
  candidatos: async (busca: string) => ler<Candidatos>(await fetch(`${API}/candidatos?tenant_id=1&busca=${encodeURIComponent(busca)}`), 'Erro ao buscar no catálogo.'),
  criar: async (corpo: { idFamilia?: number; idItens?: number[]; separados?: boolean }) =>
    ler<{ ids: number[] }>(await fetch(`${API}/anuncios?tenant_id=1`, json('POST', corpo)), 'Erro ao criar o anúncio.'),
  salvar: async (id: number, corpo: Partial<{
    titulo: string; categoriaMl: string | null; tipoAnuncio: string; condicao: string; descricao: string; ajustePreco: number;
    atributos: Record<string, ValorAtributo>; estoqueReserva: number; estoqueMaximo: number | null; estoqueAutomatico: boolean; modeloTitulo: string;
    faixasQuantidade: FaixaQuantidade[];
  }>) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}?tenant_id=1`, json('PUT', corpo)), 'Erro ao salvar o anúncio.'),
  excluir: async (id: number) => ler<{ success: boolean }>(await fetch(`${API}/anuncios/${id}?tenant_id=1`, json('DELETE')), 'Erro ao excluir.'),
  adicionarItens: async (id: number, idItens: number[]) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens?tenant_id=1`, json('POST', { idItens })), 'Erro ao adicionar itens.'),
  removerItem: async (id: number, idItem: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}?tenant_id=1`, json('DELETE')), 'Erro ao tirar o item.'),
  precoItem: async (id: number, idItem: number, preco: number | null) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}?tenant_id=1`, json('PUT', { preco })), 'Erro ao salvar o preço.'),
  /** Grava o item do anúncio: preço só no ML, unidade vendida e a regra de estoque (só os campos enviados). */
  salvarItem: async (id: number, idItem: number, corpo: Record<string, unknown>) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}?tenant_id=1`, json('PUT', corpo)), 'Erro ao salvar o item.'),
  regraItem: async (id: number, idItem: number, regra: { estoqueReserva?: number | null; estoqueMaximo?: number | null; idUnidade?: number | null }) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}?tenant_id=1`, json('PUT', regra)), 'Erro ao salvar o estoque do item.'),
  analisePreco: async (id: number, idItem: number, p: { simular?: number | null; frete?: number | null }) => {
    const q = new URLSearchParams({ tenant_id: '1' });
    if (p.simular) q.set('simular', String(p.simular));
    if (p.frete !== null && p.frete !== undefined) q.set('frete', String(p.frete));
    return ler<AnalisePreco>(await fetch(`${API}/anuncios/${id}/itens/${idItem}/preco?${q}`), 'Erro ao analisar o preço.');
  },
  verificarCatalogo: async (id: number) => ler<{ itens: CatalogoItem[] }>(await fetch(`${API}/anuncios/${id}/catalogo?tenant_id=1`), 'Erro ao verificar o catálogo.'),
  entrarNoCatalogo: async (id: number, idItem: number, produtoId: string) =>
    ler<{ mlbCatalogo: string | null; permalink: string | null }>(await fetch(`${API}/anuncios/${id}/itens/${idItem}/catalogo?tenant_id=1`, json('POST', { produtoId })), 'Erro ao entrar no catálogo.'),
  faixasNoMl: async (id: number, quantidades: string) =>
    ler<{ mlbId: string; sku: string; preco: number; noMl: FaixaQuantidade[]; sugestao: { quantidade: number; desconto: number; preco: number; incoerente: boolean }[] }>(
      await fetch(`${API}/anuncios/${id}/faixas/ml?tenant_id=1&quantidades=${encodeURIComponent(quantidades)}`), 'Erro ao consultar o ML.'),
  atualizarNoMl: async (id: number) =>
    ler<{ itens: ConferenciaItem[]; detalhe: AnuncioDetalhe }>(await fetch(`${API}/anuncios/${id}/atualizar-ml?tenant_id=1`, json('POST', {})), 'Erro ao atualizar no ML.'),
  pausarNoMl: async (id: number, pausar: boolean) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/pausar?tenant_id=1`, json('POST', { pausar })), pausar ? 'Erro ao pausar no ML.' : 'Erro ao reativar no ML.'),
  encerrarNoMl: async (id: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/encerrar?tenant_id=1`, json('POST', {})), 'Erro ao encerrar no ML.'),
  desligarDoMl: async (id: number, idItem: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}/ml?tenant_id=1`, json('DELETE')), 'Erro ao desligar do ML.'),
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
  categoria: async (id?: string | null) => ler<CategoriaNo>(await fetch(`${API}/categorias${id ? `/${id}` : ''}?tenant_id=1`), 'Erro ao ler categorias.'),
};

export const ROTULO_TIPO_ANUNCIO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium' };
export const formatarMoeda = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
