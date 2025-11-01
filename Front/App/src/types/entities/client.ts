export type PessoaTipo = 'PF' | 'PJ';

export interface Cliente {
  id: string;
  nome: string;
  documento?: string; // CPF ou CNPJ
  tipo?: PessoaTipo;
  email?: string;
  telefone?: string;
  endereco?: string;
  // meta/opcionais
  criadoEm?: string; // ISO date string
  atualizadoEm?: string;
}