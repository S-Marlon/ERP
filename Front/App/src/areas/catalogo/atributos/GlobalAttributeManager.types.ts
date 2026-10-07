// GlobalAttributeManager.types

export type TipoDadoAtributo = 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
export type EscopoComercial = 'dna' | 'grade' | 'ficha';

export interface IAtributoGlobal {
  id: string;
  grupoId: string;
  nome: string;
  codigo: string;
  tipo: TipoDadoAtributo;       // 🔄 Usando o tipo isolado
  escopoPadrao: EscopoComercial; // 🔄 Usando o tipo isolado
  unidadeId?: string;
  sufixo?: string; 
  obrigatorioPadrao: boolean;
  pesquisavel: boolean;
  valoresSugeridos?: string;
  // Ajuda exibida ao operador (coluna descricao)
  ajudaContextual?: string;
  // Uso real (vem do backend): itens com valor e vínculos com família/categoria
  opcoes?: Array<{ id: string; valor: string; codigo: string; emUso: boolean }>;
  qtdItens?: number;
  qtdVinculos?: number;
  emUso?: boolean;
}

export interface CreateAttributePayload extends Omit<IAtributoGlobal, 'id'> {}
export interface UpdateAttributePayload extends Partial<CreateAttributePayload> {}

export interface GenericAttributeAPIResponse {
  success?: boolean;
  message: string;
}

export interface UnidadeAPIResponse {
  id: string;
  nome: string;
  simbolo: string;
  tipo: string;
}

export interface GrupoVisualAPIResponse {
  id: string;
  nome: string;
  descricao?: string;
}