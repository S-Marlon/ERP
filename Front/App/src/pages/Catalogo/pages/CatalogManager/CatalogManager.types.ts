export interface AtributoConfig {
  id: string;
  nome: string;
  
  /** * 'dna' = Fixo/Global (ex: Marca)
   * 'grade' = Multiplicador de SKU (Obrigatório no modal JIT)
   * 'ficha' = Ficha técnica complementar (Opcional no modal JIT) - Alinhado com o DB Real
   */
  classificacao: 'dna' | 'grade' | 'ficha'; 
  
  tipoDado: 'texto' | 'numero' | 'opcoes'; 
  
  /** * Se tipoDado === 'opcoes', armazena as strings que virarão o select.
   * Ex: ['1HP', '1.5HP', '2HP'] ou ['110V', '220V']
   */
  opcoesValidas?: string[]; 
  
  // Regras de Sufixo (Ex: para o número '1.5' virar '1.5HP')
  separadorSufixo?: 'nenhum' | 'espaco' | 'hifen';
  sufixo?: string; 
  
  /** Se true, o conferente não consegue fechar a NF sem preencher este campo */
  obrigatorio: boolean;
  
  /** Se true, este atributo obrigatoriamente gera filhos e dispara o comportamento de grade */
  geraVariacao: boolean;
  
  /** Se true, o valor deste atributo vai para a receita do SKU (ex: -1HP) */
  compoeSku: boolean;
  
  /** Ordem em que o valor entra no SKU. Ex: 1 = Potência (-1HP), 2 = Voltagem (-220V) */
  ordemSku: number;
  
  exemplos: string; // Placeholder amigável para a UI de configuração

  // --- CAMPOS PARA ENGENHARIA DE HERANÇA ---
  /** Se true, todos os SKUs desta família herdarão rigidamente o mesmo valor definido no grupo */
  valorHerdadoDoGrupo: boolean;
  
  /** O valor padrão/estático herdado por todos os SKUs caso 'valorHerdadoDoGrupo' seja true */
  valorPadraoGrupo?: string;

  estaSendoUtilizado?: boolean;
  origem?: 'categoria' | 'global' | 'customizado'; 
}

export interface Grupo {
  id: string;
  nome: string;
  categoriaPai: string;
  categoriaPaiNome: string;
  descricao: string; // Descrição interna/técnica da família
  status: 'ativo' | 'inativo';
  
  // LOGÍSTICA & ESTOQUE 
  unidadeMedidaBase: string; // Unidade de controle interna/saída (ex: UN, PC)
  
  /** * NOTA: Campos abaixo são lógicos do Front-end (Não persistidos na tabela real comercial_familias do banco)
   */
  tipoItem: 'PA' | 'MP' | 'KT' | 'MR' | 'IN'; 
  ncmPadrao?: string; 
  cestPadrao?: string; 
  siglaSku: string; 
  separadorSku: string; 
  templateSku: string; 
  templateNomeComercial: string; // Mapeia para o 'template_nome' físico do DB
  descricaoComercialPadrao?: string;
  observacoesPadrao?: string;

  // Coleção de atributos vinculados via tabela core_entidades
  atributos: AtributoConfig[];
}

export type TipoAba = 'estrutural' | 'variantes' | 'informativos';

export const ATRIBUTO_INITIAL_STATE: Omit<AtributoConfig, 'id'> = {
  nome: '',
  classificacao: 'ficha', // Corrigido de 'especificacao' para 'ficha'
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
  valor: any;
}

// --- PAYLOADS DE INTEGRAÇÃO COM A API ---

export interface CategoriaAPIResponse {
  id: string;
  nome: string;
  paiId: string | null;
}

export interface CreateGroupPayload {
  nome: string;
  categoriaPai: string;
  categoriaPaiNome: string;
  descricao?: string;
  unidadeMedidaBase: string;
  templateNome: string; // Nome físico esperado pelo backend ('template_nome')
  separadorSku?: string;
  cor?: string;
  imagem?: string;
  atributos?: AtributoConfig[];
}

export interface UpdateGroupPayload extends Partial<CreateGroupPayload> {
  status?: 'ativo' | 'inativo';
}

export interface GenericGroupAPIResponse {
  success: boolean;
  message: string;
  id?: string; 
}