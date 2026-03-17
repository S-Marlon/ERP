// src/services/clienteService.ts
const API_URL = 'http://localhost:3000/api'; // Ajuste para sua porta

export const clienteService = {
  listarTodos: async () => {
    const res = await fetch(`${API_URL}/clientes`);
    return res.json();
  },
  
  salvar: async (cliente: any) => {
    const method = cliente.id_cliente ? 'PUT' : 'POST';
    const url = cliente.id_cliente ? `${API_URL}/clientes/${cliente.id_cliente}` : `${API_URL}/clientes`;
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cliente)
    });
    return res.json();
  },

  excluir: async (id: number) => {
    await fetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
  }
};