export interface AtributoHerdável {
  id: string;
  nome: string;
  tipoDado: 'texto' | 'numero' | 'select';
  sufixo?: string;
  obrigatorio: boolean;
  exemplos?: string;
}

export interface Categoria {
  // 📌 Identificação e Estrutura Core
  id: string;
  nome: string;
  codigoTaxonomia: string;
  slug: string;
  descricao?: string;
  parentId: string | null;
  ativa: boolean;

  // 💼 Diretrizes Comerciais e UX
  // Permitir null é crucial para a regra de negócio: "Se null, herda do pai acima"
  percentualMargemSugerida: number | null; 
  modoExibicao: 'grade' | 'lista' | 'carrossel';

  // 🧬 Motor de Características de Produto
  atributosHeranca: AtributoHerdável[];

  // 🚀 Blocos de Futuro Organizados (Evita poluir a raiz do objeto)
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    tags?: string; // Substitui o antigo tagsSeo da raiz
  };

  integracoes?: {
    erpId?: string;
    vtexId?: string;
    mercadolivreId?: string;
  };

  assets?: {
    iconeUrl?: string;
    bannerUrl?: string;
  };
}