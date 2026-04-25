/**
 * TÉCNICO (TECHNICIAN)
 * Profissional responsável pela execução da OS
 */

export type TechnicianRole = 'technician' | 'supervisor' | 'apprentice';

export interface Technician {
  // Identificadores
  id: string;
  
  // Dados pessoais
  name: string;
  email: string;
  phone: string;
  document: string;  // CPF
  
  // Função
  role: TechnicianRole;
  specialties: string[];  // Ex: ["mangueiras", "prensagem", "montagem"]
  
  // Status
  active: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
  
  // Auditoria
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTechnicianInput {
  name: string;
  email: string;
  phone: string;
  document: string;
  role: TechnicianRole;
  specialties: string[];
}

export interface UpdateTechnicianInput {
  name?: string;
  email?: string;
  phone?: string;
  role?: TechnicianRole;
  specialties?: string[];
  active?: boolean;
  availableFrom?: Date;
  availableUntil?: Date;
}
