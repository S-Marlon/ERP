export interface AtributoConfig {
  id: string;
  nome: string;
  
  /** * 'dna' = Fixo/Global (ex: Marca)
   * 'grade' = Multiplicador de SKU (Obrigatório no modal JIT)
   * 'especificacao' = Ficha técnica complementar (Opcional no modal JIT)
   */
  classificacao: 'dna' | 'grade' | 'especificacao'; 
  
  tipoDado: 'texto' | 'numero' | 'opcoes'; 
  
  /** * Se tipoDado === 'opcoes', armazena as strings que virarão o select na NF.
   * Ex: ['1HP', '1.5HP', '2HP'] ou ['110V', '220V']
   */
  opcoesValidas?: string[]; 
  
  // Regras de Sufixo (Ex: para o número '1.5' virar '1.5HP' ou '1.5-HP' ou  '1.5 HP')
  separadorSufixo?: 'nenhum' | 'espaco' | 'hifen';
  sufixo?: string; 
  
  /** Se true, o conferente não consegue fechar a NF sem preencher este campo */
  obrigatorio: boolean;
  
  /** Se true, este atributo obrigatoriamente gera filhos e dispara o comportamento de grade */
  geraVariacao: boolean;
  
  /** Se true, o valor deste atributo vai para a receita do SKU (ex: -1HP) */
  compoeSku: boolean;
  
  /** Ordem em que o valor entra no SKU. Ex: 1 = Potência (-1HP), 2 = Voltagem (-220V) -> BOMBA-1HP-220V */
  ordemSku: number;
  
  exemplos: string; // Placeholder amigável para o usuário que está configurando o grupo

  // --- NOVOS CAMPOS PARA ENGENHARIA DE HERANÇA ---
  /** Se true, todos os SKUs deste grupo herdarão rigidamente o mesmo valor definido no grupo */
  valorHerdadoDoGrupo: boolean;
  
  /** O valor padrão/estático herdado por todos os SKUs caso 'valorHerdadoDoGrupo' seja true */
  valorPadraoGrupo?: string;

  estaSendoUtilizado?: boolean;

  origem?: 'categoria' | 'global' | 'customizado'; 
  tipo?: 'dna' | 'grade' | 'livre'; // Armazena dinamicamente onde ele está alocado
}

export interface Grupo {
  id: string;
  nome: string;
  categoriaPai: string;
  descricao: string; // Descrição interna/técnica do grupo
  status: 'ativo' | 'inativo';
  
  // LOGÍSTICA & ESTOQUE (Entrada e Saída)
  unidadeMedidaBase: string; // Unidade de controle interna/saída (ex: UN, PC)
  
  /** * Expandido para cobrir fluxos fiscais de Entrada e Saída:
   * PA = Prod. Acabado | MP = Matéria-Prima | KT = Kit | MR = Mercadoria para Revenda | IN = Insumo
   */
  tipoItem: 'PA' | 'MP' | 'KT' | 'MR' | 'IN'; 
  
  // FISCAL (Indiferente para NFs)
  ncmPadrao?: string; 
  cestPadrao?: string; // Importante para saídas com Substituição Tributária (ST)
  
  // INTERFACE & IDENTIDADE
  cor?: string;
  imagem?: string;
  
  // ENGENHARIA DE SKU & MOTORES DE RENDERIZAÇÃO
  siglaSku: string; 
  separadorSku: string; 
  templateSku: string; 
  templateNomeComercial: string; 
  
  atributos: AtributoConfig[];

  // --- NOVOS CAMPOS DE TEXTO PADRÃO HERDÁVEIS ---
  /** Descrição padrão/comercial que será injetada em todos os produtos gerados por este grupo */
  descricaoComercialPadrao?: string;
  
  /** Texto complementar de garantia, observações ou cuidados de manuseio comuns ao grupo */
  observacoesPadrao?: string;
}

export type TipoAba = 'estrutural' | 'variantes' | 'informativos';

// Atualizado o estado inicial com os novos campos de herança
export const ATRIBUTO_INITIAL_STATE: Omit<AtributoConfig, 'id'> = {
  nome: '',
  classificacao: 'especificacao',
  tipoDado: 'texto',
  sufixo: '',
  separadorSufixo: 'nenhum',
  obrigatorio: false,
  geraVariacao: false,
  compoeSku: false,
  ordemSku: 0,
  exemplos: '',
  opcoesValidas: [],
  // Defaults para herança
  valorHerdadoDoGrupo: false,
  valorPadraoGrupo: ''
};