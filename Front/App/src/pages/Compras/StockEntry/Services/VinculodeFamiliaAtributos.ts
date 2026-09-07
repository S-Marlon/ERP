// VínculodeFamíliaAtributos.ts


/*
|--------------------------------------------------------------------------
| SERVIÇO DE PRODUTOS COMERCIAIS (Vínculo de Família e Atributos)
|--------------------------------------------------------------------------
*/
const API_PRODUTO_COMERCIAL_URL = 'http://localhost:3001/api/catalogo/cadastros/produtos/familia';

export interface SalvarFamiliaAtributosPayload {
  isBatch: boolean;
  selectedRowKeys?: string[];
  id_item?: string | number;
  sku?: string; // 👈 Adicione esta linha
  familiaId: string;
  itemAttributesOverride?: Array<{ nome: string; valor: string }>;
  batchItemOverrides?: Record<string, Array<{ nome: string; valor: string }>>;
}



export const updateProdutoFamiliaEAtributos = async (
  payload: SalvarFamiliaAtributosPayload
): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(API_PRODUTO_COMERCIAL_URL, {
    method: 'PUT', // ou POST dependendo de como preferir mapear na sua rota
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ao salvar vínculo da família (${response.status})`);
  }

  return response.json();
};