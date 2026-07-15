// 🧬 INTERFACES ALINHADAS (Front & Banco)

export interface AtributoHerdavel {
  id: string;
  nome: string;
  tipoDado: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
  sufixo?: string;
  
  // Vínculo vindo de 'atributos_core_entidades'
  escopoComercial: 'dna' | 'grade' | 'ficha'; 
  obrigatorio: boolean;
  pesquisavel: boolean; 
  ordem: number;
  herdar: boolean;       
  
  // Controles de ajuste fino locais e herança
  bloqueado?: boolean;   
  retransmitir?: boolean; // Controla se passa para os filhos (ou se morre nesta categoria)
  sobrescreve?: boolean;  // Permite que a categoria filha mude a obrigatoriedade/escopo
  exemplos?: string;
}

export interface Categoria {
  id: string;
  tenantId: number; // Mantido o camelCase do TSX (mapeado para tenant_id no payload/banco)
  parentId: string | null;
  nome: string;
  slug: string;
  ativa: boolean;
  ordem: number;
  percentualMargemSugerida: number | null;
  modoExibicao: 'grade' | 'lista' | 'carrossel';
  descricao: string;
  atributosHeranca: AtributoHerdavel[];
  seo?: {
    tags?: string;
    metaTitle?: string;
    metaDescription?: string;
  };
  integracoes?: {
    erpId?: string;
    vtexId?: string;
    mercadolivreId?: string;
  };
  assets?: any;
}

export interface CreateCategoryPayload {
  nome: string;
  parentId: string | null;
  ativa?: boolean;
  percentualMargemSugerida: number | null;
  modoExibicao: 'grade' | 'lista' | 'carrossel';
  descricao?: string;
  atributosHeranca?: AtributoHerdavel[];
  seo?: Categoria['seo'];
  integracoes?: Categoria['integracoes'];
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export interface CreateAtributoRapidoPayload {
  nome: string;
  tipo: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
  grupo_id?: number; // Associado à tabela atributos_comercial_grupos
  unidade_id?: number; // Associado à tabela atributos_comercial_unidades
}

export interface AtributoGlobalResponse {
  id: string;
  nome: string;
  tipo: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
  grupo_id?: number;
  unidade_id?: number;
  sufixo?: string;
  valores_sugeridos?: string;
}