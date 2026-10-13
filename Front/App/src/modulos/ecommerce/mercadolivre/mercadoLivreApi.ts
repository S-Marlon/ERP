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
}

export interface ItemDoAnuncio {
  idItem: number; sku: string; nome: string; ativo: boolean; preco: number; precoMl: number | null; precoAnuncio: number;
  comissao: number | null; percentualComissao: number | null; estoque: number; fotos: number; fotoUrl: string | null;
  gtin: string | null; pesoKg: number | null; medidasCm: { altura: number; largura: number; comprimento: number } | null;
  marca: string | null; valoresErp: Record<string, string | null>; motivosCadastro: string[];
  valores: Record<string, { valor: string; valorId: string | null; unidade: string | null } | null>;
  ml: { mlbId: string | null; status: string | null; permalink: string | null; erro: string | null };
}

export interface AnuncioDetalhe extends AnuncioResumo {
  condicao: 'new' | 'used'; descricao: string; ajustePreco: number; atributos: Record<string, ValorAtributo>;
  fotoFamilia: string | null;   // vale para os itens sem foto própria
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
  inactive: { texto: 'Inativo no ML', cor: 'default' },
};

export interface CategoriaNo { id: string | null; nome: string; caminho: string; final: boolean; filhos: { id: string; nome: string }[] }

export const anunciosApi = {
  listar: async () => ler<AnuncioResumo[]>(await fetch(`${API}/anuncios?tenant_id=1`), 'Erro ao listar os anúncios.'),
  detalhe: async (id: number) => ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}?tenant_id=1`), 'Erro ao abrir o anúncio.'),
  candidatos: async (busca: string) => ler<Candidatos>(await fetch(`${API}/candidatos?tenant_id=1&busca=${encodeURIComponent(busca)}`), 'Erro ao buscar no catálogo.'),
  criar: async (corpo: { idFamilia?: number; idItens?: number[]; separados?: boolean }) =>
    ler<{ ids: number[] }>(await fetch(`${API}/anuncios?tenant_id=1`, json('POST', corpo)), 'Erro ao criar o anúncio.'),
  salvar: async (id: number, corpo: Partial<{ titulo: string; categoriaMl: string | null; tipoAnuncio: string; condicao: string; descricao: string; ajustePreco: number; atributos: Record<string, ValorAtributo> }>) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}?tenant_id=1`, json('PUT', corpo)), 'Erro ao salvar o anúncio.'),
  excluir: async (id: number) => ler<{ success: boolean }>(await fetch(`${API}/anuncios/${id}?tenant_id=1`, json('DELETE')), 'Erro ao excluir.'),
  adicionarItens: async (id: number, idItens: number[]) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens?tenant_id=1`, json('POST', { idItens })), 'Erro ao adicionar itens.'),
  removerItem: async (id: number, idItem: number) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}?tenant_id=1`, json('DELETE')), 'Erro ao tirar o item.'),
  precoItem: async (id: number, idItem: number, preco: number | null) =>
    ler<AnuncioDetalhe>(await fetch(`${API}/anuncios/${id}/itens/${idItem}?tenant_id=1`, json('PUT', { preco })), 'Erro ao salvar o preço.'),
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
