export interface FornecedorProduto {
  id_fornecedor: number;
  nome_fantasia: string;

  sku_fornecedor: string;
  fator_conversao: number;

  chave_acesso?: string;
  ultima_data_compra?: string | null;
  ultimo_preco?: number | null;
  ultima_quantidade?: number;
}

export async function getFornecedoresByProduto(idProduto: number): Promise<FornecedorProduto[]> {
  console.log(`FETCHING FORNECEDORES PARA PRODUTO ID: ${idProduto}`);
  try {
    // Coloque a URL completa para teste
    const response = await fetch(`http://localhost:3001/api/products/${idProduto}/fornecedores`);

    console.log('RESPONSE STATUS:', response.status);

    if (!response.ok) {
      throw new Error(`Erro ao buscar fornecedores: ${response.status}`);
    }

    const data = await response.json(); // Aqui deve vir JSON
    console.log('FORNECEDORES RECEBIDOS:', data);
    return data;

  } catch (error) {
    console.error('Erro no service de fornecedores:', error);
    return [];
  }
}