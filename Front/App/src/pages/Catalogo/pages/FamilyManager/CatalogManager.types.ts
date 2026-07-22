// ==========================================
// CATALOG MANAGER - DEFINIÇÃO DE TIPOS
// ==========================================

export interface OpcaoAtributo {
  id: string;
  valor: string;
  codigo?: string;
}

export interface AtributoConfig {
  id: string; 
  nome: string;
  codigo?: string;
  
  classificacao: 'dna' | 'grade' | 'ficha'; 
  tipoDado: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data'; 
  
  /** Lista de opções vindas de `atributos_comercial_opcoes` */
  opcoesValidas?: string[] | OpcaoAtributo[]; 
  
  separadorSufixo?: 'nenhum' | 'espaco' | 'hifen';
  sufixo?: string;
  
  obrigatorio: boolean;
  geraVariacao: boolean;
  compoeSku: boolean;
  ordemSku: number;
  exemplos: string;

  valorHerdadoDoGrupo: boolean;
  valorPadraoGrupo?: string;

  pesquisavel?: boolean;
  bloqueado?: boolean;
  retransmitir?: boolean;

  estaSendoUtilizado?: boolean;
  origem?: 'categoria' | 'global' | 'customizado' | 'herdados' | 'locais'; 
}

export interface Grupo {
  id: string;
  nome: string;
  categoriaPai: string;
  categoriaPaiNome: string;
  descricao: string;
  
  status: 'ATIVO' | 'INATIVO'; 
  
  unidadeMedidaBase: string;
  
  tipoItem: 'PA' | 'MP' | 'KT' | 'MR' | 'IN'; 
  ncmPadrao?: string; 
  cestPadrao?: string; 
  
  siglaSku: string; 
  separadorSku: string;
  templateSku: string; 
  
  templateNomeComercial: string; 
  
  descricaoComercialPadrao?: string;
  observacoesPadrao?: string;
  cor?: string;
  imagem?: string;

  atributos: AtributoConfig[];
}

export type TipoAba = 'estrutural' | 'variantes' | 'informativos';

export const ATRIBUTO_INITIAL_STATE: Omit<AtributoConfig, 'id'> = {
  nome: '',
  classificacao: 'ficha', 
  tipoDado: 'texto',
  sufixo: '',
  separadorSufixo: 'nenhum',
  obrigatorio: false,
  geraVariacao: false,
  compoeSku: false,
  ordemSku: 0,
  exemplos: '',
  opcoesValidas: [],
  valorHerdadoDoGrupo: false,
  valorPadraoGrupo: ''
};

export interface Categoria {
  id: string;
  nome: string;
  paiId: string | null;
}

export interface AtributoPendente {
  atributoId: string;
  campo: string;
  valor: unknown;
}

export type ModalDestino = 'dna' | 'grade' | 'ficha';

// --- PAYLOADS DE INTEGRAÇÃO COM A API ---

export interface CategoriaAPIResponse {
  id: string;
  nome: string;
  paiId: string | null;
}

export interface CreateFamiliaPayload {
  nome: string;
  categoriaPai?: string | number | null;
  descricao?: string;
  status?: 'ATIVO' | 'INATIVO';
  tipoItem?: 'PA' | 'MP' | 'KT' | 'MR' | 'IN';
  ncmPadrao?: string;
  cestPadrao?: string;
  unidadeMedidaBase?: string;
  templateNomeComercial?: string;
  separadorSku?: string;
  siglaSku?: string;
  templateSku?: string;
  descricaoComercialPadrao?: string;
  observacoesPadrao?: string;
  cor?: string;
  imagem?: string;
  atributos?: AtributoConfig[];
}

export interface UpdateFamiliaPayload extends Partial<CreateFamiliaPayload> {}

export interface GenericFamiliaAPIResponse {
  success: boolean;
  message: string;
  id?: string;
}

// Aliases mantidos para retrocompatibilidade
export type CreateGroupPayload = CreateFamiliaPayload;
export type UpdateGroupPayload = UpdateFamiliaPayload;
export type GenericGroupAPIResponse = GenericFamiliaAPIResponse;

export type CategoriaTreeNode = {
  value: string;
  title: string;
  children?: CategoriaTreeNode[];
};

export interface ItemAssociado {
  id: string;
  sku: string;
  nome: string;
  ativo: boolean;
}