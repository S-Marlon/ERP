const apiBase = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001/api';

export const getProductById = async (id: number) => {
  const response = await fetch(`${apiBase}/produtos/${id}`); // ⚠️ "produtos"
  if (!response.ok) throw new Error('Erro ao buscar produto');
  return response.json();
};

export const updateProduct = async (id: number, changes: any) => {
  const response = await fetch(`${apiBase}/produtos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw new Error('Erro ao atualizar produto');
  return response.json();
};