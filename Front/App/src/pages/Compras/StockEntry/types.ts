import { ProdutoNF } from '../types/NF-e';

/**
 * ID padronizado de acordo com a estratégia do Backend (BigInt como string ou number)
 */
type ID = number; // Ou string, se o backend serializar BigInt como string.

/**
 * Contrato base para a definição de um atributo no sistema
 */
export interface BaseAttribute {
  idAtributo: ID;
  nome: string;
  tipoDado: 'TEXTO' | 'NUMERO' | 'DECIMAL' | 'BOOLEAN' | 'DATA';
}

/**
 * Comportamento do atributo quando vinculado a um Grupo (Regras da Matriz)
 * Espelha a tabela: produtos_grupo_atributos
 */
export interface GroupAttribute extends BaseAttribute {
  geraVariacao: boolean; // Cria novo SKU físico (ex: Cor)
  compoeNome: boolean;   // Vai para a string do nome do produto
  obrigatorio: boolean;
  ordemNome: number;     // Antigo 'ordem' - garante a sequência visual do nome
  escopo: 'TECNICO' | 'COMERCIAL';
}

/**
 * O valor real que o produto assumiu
 * Espelha a tabela: produtos_atributos_valores + produtos_sku_variacoes
 */
export interface ItemAttribute extends BaseAttribute {
  idValor?: ID;          // Pode não existir se for um valor novo digitado na hora
  valor: string;         // Ex: '220V', '0.50 HP'
}

/**
 * Família/Grupo do Produto (Ficha técnica conceitual)
 */
export interface Group {
  id: ID;
  nome: string;
  idCategoria?: ID | null;
  idMarca?: ID | null;
  atributos: GroupAttribute[]; 
}

/**
 * Item flutuante da NF-e em processo de recebimento/conferência
 */
export interface Item extends ProdutoNF {
  tempId: number;               // ID temporário de tela (controle do React/Vue)
  receivedQuantity: number;     // Qtd física conferida no bipe
  confirmed: boolean;
  mappedId?: ID;                // id_produto real do produtos_core se já existir
  difference: number;           // Qtd Nota vs Qtd Recebida
  grupoId?: ID | null;          // id_grupo associado
  atributosCustomizados?: ItemAttribute[]; // Valores capturados no recebimento para gerar a variação
}

/**
 * Payload para o back-end processar o vínculo ou criação do grupo/SKU
 */
export interface GroupMappingPayload {
  groupId: ID | 'NEW';          // 'NEW' indica intenção de criação
  isNewGroup: boolean;
  // Se for novo, envia os dados do grupo sem o ID numérico do banco
  groupData?: Omit<Group, 'id'> & { id?: ID }; 
  // Atributos escolhidos para ESTE item da NF que vão gerar o hash_variacao do SKU
  itemAttributesOverride?: ItemAttribute[]; 
}

export type GroupMap = Record<string, Group>;

export type FilterType = 'all' | 'pending' | 'confirmed' | 'divergent' | 'unmapped';