// Endereço do backend, num lugar só. Para rodar em outro computador ou servidor, defina VITE_API_URL no arquivo
// .env do front (ex.: VITE_API_URL=http://192.168.0.10:3001). Sem ela, usa o backend local.
// `env?.` porque os testes rodam no Node (tsx), onde import.meta.env não existe.
export const API_URL = String(import.meta.env?.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '');
