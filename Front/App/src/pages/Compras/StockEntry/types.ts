import { ProdutoNF } from '../types/NF-e';

/**
 * ID padronizado de acordo com a estratégia do Backend (BigInt como number ou string)
 */
type ID = number;

/**
 * Contrato base para a definição de um atributo no sistema
 * Espelha a tabela: atributos_comercial
 */
export interface BaseAtributo {
  idAtributo: ID;
  nome: string;
  codigo?: string;
  tipo: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
}

/**
 * Atributo vinculado à Família (Regras do Molde/DNA)
 * Espelha a tabela: atributos_core_entidades
 */
export interface FamiliaAtributo extends BaseAtributo {
  geraVariacao: boolean;      // Se gera variações de grade (gera_variacao)
  compoeSku: boolean;         // Se entra no código SKU (compoe_sku)
  obrigatorio: boolean;       // Se é obrigatório preencher
  pesquisavel: boolean;       // Se entra na busca
  ordem: number;              // Sequência de exibição
  escopoComercial: 'dna' | 'grade' | 'ficha'; // escopo_comercial
}

/**
 * O valor real que o item/produto assumiu
 * Espelha a tabela: atributos_comercial_valores
 */
export interface ItemAtributo extends BaseAtributo {
  idValor?: ID;               // Pode não existir se for um valor novo digitado na hora
  valor: string;              // Valor armazenado convertido para string na interface
}

/**
 * Família de Produtos (Ficha técnica conceitual)
 * Espelha a tabela: comercial_familias
 */
export interface Familia {
  id: ID;
  tenantId: ID;
  nome: string;
  descricao?: string | null;
  categoriaId?: ID | null;
  idMarca?: ID | null;
  templateSku?: string;       // Ex: {SIGLA}-{VARIACAO}
  templateNome?: string;      // Ex: {GRUPO}
  siglaSku?: string;
  unidadeBase?: string;       // Ex: PC, UN, KG
  atributos: FamiliaAtributo[]; 
}

/**
 * Item flutuante da NF-e em processo de recebimento/conferência
 * Relacionado com: compras_core_nota_itens e itens_core
 */
export interface Item extends ProdutoNF {
  tempId: number;               // ID temporário de tela (controle do React/Vue)
  receivedQuantity: number;     // Qtd física conferida no bipe
  confirmed: boolean;
  mappedId?: ID;                // id_item real do itens_core se já existir
  difference: number;           // Qtd Nota vs Qtd Recebida
  familiaId?: ID | null;        // id da comercial_familias associado
  atributosCustomizados?: ItemAtributo[]; // Valores capturados no recebimento para gerar o hash_variacao
}

/**
 * Payload para o back-end processar o vínculo ou criação da Família/SKU
 */
export interface FamiliaMappingPayload {
  familiaId: ID | 'NEW';          // 'NEW' indica intenção de criação
  isNewFamilia: boolean;
  // Se for nova, envia os dados da família sem o ID numérico do banco
  familiaData?: Omit<Familia, 'id'> & { id?: ID }; 
  // Atributos escolhidos para ESTE item da NF que vão gerar o hash_variacao do SKU
  itemAttributesOverride?: ItemAtributo[]; 
}

export type FamiliaMap = Record<string, Familia>;

export type FilterType = 'all' | 'pending' | 'confirmed' | 'divergent' | 'unmapped';