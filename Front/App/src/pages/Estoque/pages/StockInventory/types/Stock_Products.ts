// export interface Product {
//   // Identificação
//   id_produto: number;
//   codigo_interno: string;
//   codigo_barras: string;
//   descricao: string;
  
//   // Classificação
//   tipo_produto: 'COMERCIAL' | 'GENERICO' | 'KIT' | 'SERVICO';
//   unidade: string;
//   id_marca?: number;
//   id_categoria?: number;
  
//   // Estoque
//   estoque_minimo: number;
//   quantidade_atual?: number; // Vem de um JOIN com a tabela de estoque/movimentação
  
//   // Financeiro e Precificação
//   preco_venda: number;
//   metodo_precificacao: 'MARKUP' | 'MANUAL';
//   markup_praticado: number;
//   preco_venda_manual: number;
  
//   // Fiscal
//   ncm: string;
//   cest: string;
//   exige_gtin: boolean;
  
//   // Status e Metadados
//   status: 'Ativo' | 'Inativo'; // No SQL é Enum
//   criado_em?: string;
  
//   // Campos de JOIN (Fornecedores)
//   suppliers?: string;
//   supplierCodes?: string;
// }

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
    supplierProductCode?: string;

    // extras usados pela UI
    maxStock?: number;
    cfop_padrao?: string;
    percentual_margem_sugerida?: number;

    // ecommerce/logistics
    weight?: number;
    length?: number;
    height?: number;
    width?: number;
    seoTitle?: string;
    descriptionHtml?: string;
    syncEcommerce?: boolean;
}