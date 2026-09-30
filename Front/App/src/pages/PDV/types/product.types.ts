// types/product.types.ts
export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode?: string;
  pictureUrl?: string;
  category: string;
  brand?: string;
  unitOfMeasure: string;
  costPrice?: number;
  salePrice: number;
  priceMethod?: 'MARKUP' | 'MANUAL';
  markup?: number;
  minStock: number;
  currentStock: number;
  status: 'Ativo' | 'Inativo' | 'Baixo Estoque';
  ncm?: string;
  cest?: string;
  suppliers?: string;
  supplierCode?: string;
  // Modelo novo (itens_core) — vêm de /api/vendas/pdv
  idUnidadeVenda?: number | null;
  fatorConversao?: number;
  estoqueBase?: number;
  unidadeBase?: string;
  origemPreco?: 'FAIXA' | 'CADASTRO' | 'SEM_PRECO';
  temAtacado?: boolean;
  podeVenderSemEstoque?: boolean;
  publicavel?: boolean;
  motivosPublicacao?: string[];
  atacado?: { quantidadeMinima: number; preco: number } | null;
  location?: string;
  categoryId?: number | null;
}

export interface ProductBasic {
  id: number;
  sku: string;
  name: string;
  category: string;
  categoryParentId?: number;
  brand?: string;
  location?: string;
  pictureUrl?: string;
}

export interface CategoryNode {
  id: number;
  name: string;
  parentId?: number;
  children: CategoryNode[];
}