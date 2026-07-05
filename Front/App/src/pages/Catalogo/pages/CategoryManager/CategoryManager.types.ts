export interface AtributoHerdavel {
  // 📌 Identificação do Atributo Central
  id: string; // ID do atributo_comercial (Ex: 1 para Voltagem)
  nome: string; // Apenas leitura no Front (veio do Atributo Global)
  tipoDado: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista'; // Apenas leitura
  sufixo?: string; // Apenas leitura (Ex: "HP", "BAR")
  exemplos?: string; // Apenas leitura

  // 🧬 Configurações específicas deste VÍNCULO (Colunas de atributos_core_entidades)
  escopoComercial: 'dna' | 'grade' | 'ficha'; // Substitui 'escopo' e 'comportamentoFront'
  obrigatorio: boolean;
  pesquisavel: boolean; // Se entra na busca ativa / filtros laterais
  ordem: number;

  // 🔄 Controle de Herança na Árvore
  herdar: boolean;       // Se TRUE, este nó original transmite para os filhos abaixo
  bloqueado?: boolean;   // Se TRUE, este nó filho rejeitou o atributo vindo do pai (sobrescreve)
  retransmitir?: boolean;// Se TRUE, este nó aceita passar o atributo do pai para os netos
}

export interface Categoria {
  // 📌 Identificação e Estrutura Core
  id: string;
  tenantId: number; // Importante para o seu modelo Multi-tenant
  nome: string;
  slug: string;
  descricao?: string;
  parentId: string | null;
  ativa: boolean;

  // 💼 Diretrizes Comerciais e UX
  percentualMargemSugerida: number | null; // Mapeia para margem_sugerida
  modoExibicao: 'grade' | 'lista' | 'carrossel';

  // 🧬 Motor de Características de Produto
  atributosHeranca: AtributoHerdavel[];

  // 🚀 Blocos de Integração e SEO
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    tags?: string;
  };
  integracoes?: {
    erpId?: string;
    vtexId?: string;
    mercadolivreId?: string;
  };
}

// Define exatamente o que o Back-end precisa salvar na tabela 'atributos_core_entidades'
export interface AtributoVinculoPayload {
  atributoId: number; 
  escopoComercial: 'dna' | 'grade' | 'ficha';
  obrigatorio: boolean;
  pesquisavel: boolean;
  ordem: number;
  herdar: boolean;
  bloqueado?: boolean;
}

// Payloads de Envio para a API
export interface CreateCategoryPayload {
  nome: string;
  parentId: string | null;
  ativa: boolean;
  percentualMargemSugerida: number | null;
  modoExibicao: 'grade' | 'lista' | 'carrossel';
  descricao?: string;
  // Aqui enviamos apenas os dados relacionais puros:
  atributosVinculo: AtributoVinculoPayload[]; 
  seo?: Categoria['seo'];
  integracoes?: Categoria['integracoes'];
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;