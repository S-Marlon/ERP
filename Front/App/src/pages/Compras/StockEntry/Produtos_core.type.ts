// types.ts

/* ==========================================================
   CORE
========================================================== */

export type StatusRegistro = "ATIVO" | "INATIVO";

export type TipoProduto =
  | "COMPRADO"
  | "MANUFATURADO"
  | "SERVICO"
  | "KIT";

export interface ProdutoCore {
  id_produto: number;
  tenant_id: number;

  id_grupo?: number | null;

  codigo_interno: string;
  codigo_barras?: string | null;

  descricao: string;
  descricao_curta?: string | null;

  tipo_produto: TipoProduto;
  unidade: string;

  status: StatusRegistro;

  id_categoria?: number | null;

  created_at: string;
  updated_at?: string | null;
}

/* ==========================================================
   CATEGORIAS
========================================================== */

export interface CategoriaProduto {
  id_categoria: number;
  tenant_id: number;

  nome_categoria: string;

  id_categoria_pai?: number | null;

  created_at: string;
}

/* ==========================================================
   MARCAS
========================================================== */

export interface Marca {
  id_marca: number;
  tenant_id: number;

  nome_marca: string;

  apelidos?: string | null;

  created_at: string;
}

/* ==========================================================
   COMERCIAL
========================================================== */

export type MetodoPrecificacao = "MARKUP" | "MANUAL";

export interface ProdutoComercial {
  id_produto: number;

  id_marca?: number | null;

  preco_custo_nf: number;
  preco_custo_oficial: number;

  metodo_precificacao: MetodoPrecificacao;

  markup_praticado?: number | null;

  preco_venda: number;
  preco_venda_manual?: number | null;

  visivel_venda: boolean;
}

/* ==========================================================
   ESTOQUE
========================================================== */

export interface ProdutoEstoque {
  id_produto: number;

  estoque_minimo: number;
  estoque_maximo: number;

  dias_cobertura?: number | null;
}

/* ==========================================================
   FISCAL
========================================================== */

export interface ProdutoFiscal {
  id_produto: number;

  ncm?: string | null;
  cest?: string | null;

  exige_gtin: boolean;

  origem_mercadoria: number;
}

/* ==========================================================
   SUPRIMENTOS
========================================================== */

export interface ProdutoSuprimentos {
  id_produto: number;

  id_fornecedor_homologado?: number | null;

  fator_conversao_compra: number;

  lead_time_entrega_dias: number;
}

/* ==========================================================
   SERVIÇOS
========================================================== */

export interface ProdutoServico {
  id_produto: number;

  tempo_estimado_minutos: number;

  exige_agendamento: boolean;
  exige_tecnico: boolean;

  gera_os: boolean;
}

/* ==========================================================
   MANUFATURA
========================================================== */

export interface ProdutoManufatura {
  id_produto: number;

  tempo_producao_estimado_minutos: number;

  custo_operacional_indireto: number;

  id_linha_producao?: number | null;
}

/* ==========================================================
   FORNECEDORES (DE/PARA)
========================================================== */

export interface ProdutoFornecedor {
  id_relacao: number;

  id_produto: number;
  id_fornecedor: number;

  sku_fornecedor: string;

  ean_fornecedor?: string | null;

  descricao_fornecedor?: string | null;

  fator_conversao: number;

  ativo: boolean;
}

/* ==========================================================
   HISTÓRICO DE PREÇOS
========================================================== */

export interface ProdutoHistoricoPreco {
  id_historico: number;

  tenant_id: number;
  id_produto: number;

  preco_custo_anterior: number;
  preco_custo_novo: number;

  preco_venda_anterior: number;
  preco_venda_novo: number;

  motivo?: string | null;

  created_at: string;
}

/* ==========================================================
   LOJA
========================================================== */

export interface LojaProduto {
  id_produto: number;

  seo_title?: string | null;

  seo_description?: string | null;

  descricao_html?: string | null;

  destaque: boolean;

  sincronizar_ecommerce: boolean;
}

export interface LojaProdutoImagem {
  id_imagem: number;

  id_produto: number;

  url_imagem: string;

  principal: boolean;

  ordem: number;

  created_at: string;
}

/* ==========================================================
   NOVA ESTRUTURA DE VARIAÇÕES
========================================================== */

export interface ProdutoGrupo {
  id_grupo: number;

  tenant_id: number;

  nome_base: string;

  /**
   * Futuramente:
   * "{nome_base} - {diametro}"
   * "{nome_base} - {potencia} - {estagios}"
   */
  formato_nome?: string | null;

  created_at: string;
}

/* ==========================================================
   ATRIBUTOS
========================================================== */

export interface ProdutoAtributo {
  id_atributo: number;

  tenant_id: number;

  nome: string;
}

/* ==========================================================
   VALORES DOS ATRIBUTOS POR SKU
========================================================== */

export interface ProdutoVariacaoValor {
  id: number;

  id_produto: number;

  id_atributo: number;

  valor: string;
}

/* ==========================================================
   CONFIGURAÇÃO DE EXIBIÇÃO
========================================================== */

export interface ProdutoGrupoAtributo {
  id: number;

  id_grupo: number;

  id_atributo: number;

  mostrar_no_nome: boolean;

  ordem_nome?: number | null;
}

/* ==========================================================
   DTO COMPLETO DO PRODUTO
========================================================== */

export interface ProdutoCompleto {
  core: ProdutoCore;

  comercial?: ProdutoComercial;
  estoque?: ProdutoEstoque;
  fiscal?: ProdutoFiscal;
  suprimentos?: ProdutoSuprimentos;
  servico?: ProdutoServico;
  manufatura?: ProdutoManufatura;

  loja?: LojaProduto;

  imagens?: LojaProdutoImagem[];

  grupo?: ProdutoGrupo;

  atributos?: {
    atributo: ProdutoAtributo;
    valor: string;
  }[];

  fornecedores?: ProdutoFornecedor[];
}

/* ==========================================================
   VIEW MODEL PARA FRONT
========================================================== */

export interface ProdutoGrid {
  id_produto: number;

  codigo_interno: string;

  nome_exibicao: string;

  marca?: string;

  categoria?: string;

  preco_venda: number;

  estoque?: number;

  status: StatusRegistro;
}