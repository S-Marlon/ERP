export interface AtributoConfig {
  // Mantemos string no front por segurança, mas no DB é BigInt
  id: string; 
  nome: string;
  codigo?: string; // Alinhado com `atributos_comercial.codigo`
  
  /** 
   * 'dna' = Fixo/Global (ex: Marca)
   * 'grade' = Multiplicador de SKU (Obrigatório no modal JIT)
   * 'ficha' = Ficha técnica complementar (Opcional no modal JIT)
   * Mapeia diretamente para o enum 'escopo_comercial' de `atributos_core_entidades`
   */
  classificacao: 'dna' | 'grade' | 'ficha'; 
  
  /**
   * Alinhado com o enum `tipo` de `atributos_comercial` no banco
   */
  tipoDado: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data'; 
  
  /** 
   * Valores vindos da tabela `atributos_comercial_opcoes` se tipoDado === 'lista'
   */
  opcoesValidas?: string[]; 
  
  // Regras de Sufixo (Ex: para o número '1.5' virar '1.5HP')
  separadorSufixo?: 'nenhum' | 'espaco' | 'hifen';
  sufixo?: string; // Mapeia para `atributos_comercial.sufixo`
  
  /** Se true, o conferente não consegue fechar a NF sem preencher este campo */
  obrigatorio: boolean; // Mapeia para `atributos_core_entidades.obrigatorio`
  
  /** Se true, este atributo obrigatoriamente gera filhos e dispara o comportamento de grade */
  geraVariacao: boolean;
  
  /** Se true, o valor deste atributo vai para a receita do SKU */
  compoeSku: boolean;
  
  /** Ordem em que o valor entra no SKU. Mapeia para `atributos_core_entidades.ordem` */
  ordemSku: number;
  
  exemplos: string; // Placeholder amigável para a UI. Mapeia para `atributos_core_entidades.exemplos`

  // --- CAMPOS PARA ENGENHARIA DE HERANÇA ---
  /** Se true, herda rigidamente. Mapeia para `atributos_core_entidades.herdar` */
  valorHerdadoDoGrupo: boolean;
  
  /** O valor padrão/estático herdado por todos os SKUs caso 'valorHerdadoDoGrupo' seja true */
  valorPadraoGrupo?: string;

  estaSendoUtilizado?: boolean;
  origem?: 'categoria' | 'global' | 'customizado'; 
}

export interface Grupo {
  id: string; // No DB é bigint, no JS manipulamos como string para evitar perdas de precisão
  nome: string; // `comercial_familias.nome`
  categoriaPai: string; // `comercial_familias.categoria_id` (bigint no DB)
  categoriaPaiNome: string; // Resolvido no JOIN das categorias
  descricao: string; // `comercial_familias.descricao`
  
  /** Alinhado ao enum real do banco: 'ATIVO' | 'INATIVO' */
  status: 'ATIVO' | 'INATIVO'; 
  
  // LOGÍSTICA & ESTOQUE 
  unidadeMedidaBase: string; // `comercial_familias.unidade_base`
  
  tipoItem: 'PA' | 'MP' | 'KT' | 'MR' | 'IN'; 
  ncmPadrao?: string; 
  cestPadrao?: string; 
  
  siglaSku: string; 
  separadorSku: string; // `comercial_familias.separador_sku`
  templateSku: string; 
  
  /** Mapeia para o 'template_nome' físico do DB comercial_familias */
  templateNomeComercial: string; 
  
  descricaoComercialPadrao?: string;
  observacoesPadrao?: string;
  cor?: string; // `comercial_familias.cor`
  imagem?: string; // `comercial_familias.imagem`

  // Coleção de atributos vinculados via tabela core_entidades
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
  id: string; // No DB é bigint
  nome: string; // `comercial_categorias.nome`
  paiId: string | null; // `comercial_categorias.categoria_pai_id`
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

export interface CreateGroupPayload {
  nome: string;
  categoria_id: string | null; // Nome físico esperado pelo DB (comercial_familias.categoria_id)
  descricao?: string;
  unidade_base: string; // Mapeado para o DB real
  template_nome: string; // Mapeado para o DB real
  separador_sku?: string; // Mapeado para o DB real
  cor?: string;
  imagem?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface UpdateGroupPayload extends Partial<CreateGroupPayload> {}

export interface GenericGroupAPIResponse {
  success: boolean;
  message: string;
  id?: string; 
}