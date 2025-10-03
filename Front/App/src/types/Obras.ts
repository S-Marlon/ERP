// src/types/Obras.ts

/**
 * Tipagem para o Cliente
 */
export interface Cliente {
  id: string;
  nome: string;
}

/**
 * Tipagem para o Status da Obra
 */
export type StatusObra = 'Em Andamento' | 'Concluída' | 'Pendente' | 'Cancelada';

/**
 * Tipagem para a Obra (Projeto)
 */
export interface Obra {
  id: string;
  titulo: string;
  clienteId: string; // Referência ao Cliente
  status: StatusObra;
  dataInicio: string; // Ex: 'YYYY-MM-DD'
  dataFimPrevista: string; // Ex: 'YYYY-MM-DD'
  endereco: string;
  latitude: number;
  longitude: number;
}

/**
 * Tipagem para Atividades/Tarefas
 */
export interface Atividade {
  id: string;
  obraId: string;
  descricao: string;
  concluida: boolean;
}

/**
 * Tipagem para Registros de Tempo
 */
export interface RegistroTempo {
  id: string;
  obraId: string;
  data: string; // Ex: 'YYYY-MM-DD'
  horas: number;
  descricao: string;
}

// Mock de dados para simulação
export const mockClientes: Cliente[] = [
  { id: 'cli-1', nome: 'Cliente Alpha' },
  { id: 'cli-2', nome: 'Cliente Beta' },
  { id: 'cli-3', nome: 'Cliente Gamma' },
];

export const mockObras: Obra[] = [
  { id: 'obra-1', titulo: 'Projeto Novo Escritório', clienteId: 'cli-1', status: 'Em Andamento', dataInicio: '2024-01-15', dataFimPrevista: '2024-12-31', endereco: 'Rua das Flores, 100', latitude: -23.5505, longitude: -46.6333 },
  { id: 'obra-2', titulo: 'Reforma Casa de Praia', clienteId: 'cli-2', status: 'Concluída', dataInicio: '2023-05-20', dataFimPrevista: '2023-10-30', endereco: 'Av. Litoral, 50', latitude: -23.9608, longitude: -46.3333 },
  { id: 'obra-3', titulo: 'Manutenção Predial', clienteId: 'cli-1', status: 'Pendente', dataInicio: '2025-02-01', dataFimPrevista: '2025-05-15', endereco: 'Av. Paulista, 1000', latitude: -23.5613, longitude: -46.6562 },
];

export const mockAtividades: Atividade[] = [
    { id: 'atv-1', obraId: 'obra-1', descricao: 'Comprar materiais de construção', concluida: true },
    { id: 'atv-2', obraId: 'obra-1', descricao: 'Instalar rede elétrica', concluida: false },
    { id: 'atv-3', obraId: 'obra-2', descricao: 'Pintura externa', concluida: true },
];

export const mockRegistrosTempo: RegistroTempo[] = [
    { id: 'reg-1', obraId: 'obra-1', data: '2024-09-20', horas: 8, descricao: 'Trabalho de campo' },
    { id: 'reg-2', obraId: 'obra-1', data: '2024-09-21', horas: 4.5, descricao: 'Reunião com cliente' },
    { id: 'reg-3', obraId: 'obra-2', data: '2023-09-01', horas: 7, descricao: 'Preparação do local' },
];