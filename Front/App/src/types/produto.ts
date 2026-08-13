// --- Enumerações do Banco ---
export type TipoAtributo = 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
export type EscopoComercial = 'ficha' | 'grade' | 'dna';
export type TipoEntidadeValores = 'produto' | 'cliente' | 'fornecedor' | 'pedido' | 'categoria' | 'familia';

// --- Opção de Atributo (para inputs do tipo 'lista') ---
export interface AtributoOpcao {
  id: number;
  tenant_id: number;
  atributo_id: number;
  valor: string;
  codigo?: string;
  ordem: number;
  ativo: boolean;
}

// --- Definição do Atributo (`atributos_comercial`) ---
export interface AtributoComercial {
  id: number;
  tenant_id: number;
  grupo_id?: number;
  nome: string;
  codigo: string;
  tipo: TipoAtributo;
  escopo_padrao: EscopoComercial;
  unidade_id?: number;
  sufixo?: string; // Ex: 'HP', 'RPM', 'BAR'
  obrigatorio_padrao: boolean;
  pesquisavel: boolean;
  ativo: boolean;
  opcoes?: AtributoOpcao[]; // Populado quando tipo === 'lista'
}

// --- Regra de Atributo por Categoria/Família (`atributos_core_entidades`) ---
export interface AtributoEntidadeRegra {
  id: number;
  atributo_id: number;
  tipo_entidade: 'categoria' | 'familia' | 'produto';
  id_entidade: number;
  obrigatorio: boolean;
  pesquisavel: boolean;
  compoe_sku: boolean;
  gera_variacao: boolean;
  atributo?: AtributoComercial; // Join com atributos_comercial
}

// --- Valor Salvo do Atributo (`atributos_comercial_valores`) ---
export interface AtributoValor {
  id?: number;
  tenant_id: number;
  atributo_id: number;
  tipo_entidade: TipoEntidadeValores;
  id_entidade: number;
  valor_texto?: string;
  valor_numero?: number;
  valor_decimal?: number;
  valor_data?: string;
  valor_boolean?: boolean;
  opcao_id?: number;
}