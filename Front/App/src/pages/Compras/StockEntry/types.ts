import { ProdutoNF } from '../types/NF-e';

/**
 * ID padronizado de acordo com a estratégia do Backend
 */
type ID = number;

/**
 * Interface para Fornecedores (para usar no SupplierModal e no Hook)
 */
export interface Supplier {
  id: ID;
  tenantId: ID;
  name: string;
  fantasyName: string;
  cnpj: string;
  stateRegistration?: string; // IE Capturada
  address?: string;          // Endereço completo
  cityStateZip?: string;     // Cidade/UF/CEP
  phone?: string;            // Telefone
  email?:string;
}

/**
 * Contrato base para a definição de um atributo
 */
export interface BaseAtributo {
  idAtributo: ID;
  nome: string;
  codigo?: string;
  tipo: 'texto' | 'numero' | 'decimal' | 'boolean' | 'lista' | 'data';
}

export interface FamiliaAtributo extends BaseAtributo {
  geraVariacao: boolean;
  compoeSku: boolean;
  obrigatorio: boolean;
  pesquisavel: boolean;
  ordem: number;
  escopoComercial: 'dna' | 'grade' | 'ficha';
}

export interface ItemAtributo extends BaseAtributo {
  idValor?: ID;
  valor: string;
}

export interface Familia {
  id: ID;
  tenantId: ID;
  nome: string;
  descricao?: string | null;
  categoriaId?: ID | null;
  idMarca?: ID | null;
  templateSku?: string;
  templateNome?: string;
  siglaSku?: string;
  unidadeBase?: string;
  atributos: FamiliaAtributo[];
}

/**
 * Item da NF-e em conferência
 */
export interface Item extends ProdutoNF {
  tempId: number;
  receivedQuantity: number;
  isConfirmed: boolean; // Renomeado de 'confirmed' para manter consistência com o hook
  isMapped?: boolean;   // Adicionado para controle visual de status
  mappingStatus?: 'PRODUTO_INEDITO' | 'VINCULO_DIRETO_ENCONTRADO' | 'ERRO_PROCESSAMENTO' | string;
  mappedId?: ID | null;
  difference: number;
  familiaId?: ID | null;
  grupo?: string | null; // Adicionado para suporte ao handleAssignGroupToItems
  grupoVariacao?: string | null;
  atributosCustomizados?: ItemAtributo[];
}

/**
 * Payload para o mapeamento de produtos e criação de novas famílias
 */
export interface MappingPayload {
  internalCode: ID;
  categoryName: string;
  familyId?: ID;
  attributes: ItemAtributo[];
}

export interface FamiliaMappingPayload {
  familiaId: ID | 'NEW';
  isNewFamilia: boolean;
  familiaData?: Omit<Familia, 'id'> & { id?: ID };
  itemAttributesOverride?: ItemAtributo[];
}

export type FamiliaMap = Record<string, Familia>;

export type FilterType = 'all' | 'pending' | 'confirmed' | 'divergent' | 'unmapped';