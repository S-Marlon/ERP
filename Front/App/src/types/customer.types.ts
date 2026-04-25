/**
 * CLIENTE (CUSTOMER)
 * Informações de clientes/empresas
 */

export type CustomerType = 'individual' | 'company';

export interface Address {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Contact {
  type: 'email' | 'phone' | 'whatsapp';
  value: string;
  primary?: boolean;
}

export interface Customer {
  // Identificadores
  id: string;
  
  // Dados pessoais/empresa
  type: CustomerType;
  name: string;
  document: string;         // CPF ou CNPJ
  
  // Contato
  email: string;
  contacts: Contact[];
  
  // Endereço
  address: Address;
  
  // Informações bancárias (opcional, para pagamentos)
  bankAccount?: {
    bank: string;
    agency: string;
    account: string;
    accountType: 'checking' | 'savings';
  };
  
  // Status e auditoria
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastOrderAt?: Date;
}

export interface CreateCustomerInput {
  type: CustomerType;
  name: string;
  document: string;
  email: string;
  contacts: Contact[];
  address: Address;
  bankAccount?: Customer['bankAccount'];
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  contacts?: Contact[];
  address?: Partial<Address>;
  active?: boolean;
  bankAccount?: Customer['bankAccount'];
}
