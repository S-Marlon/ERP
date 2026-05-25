import {
  TipoCliente,
} from './cliente.enums';

export interface CreateClienteDTO {
  nome_razao: string;

  tipo_cliente: TipoCliente;

  cpf_cnpj?: string;

  telefone_principal?: string;

  email_principal?: string;
}

export interface UpdateClienteDTO {
  nome_razao?: string;

  nome_fantasia?: string;

  status_cliente?: StatusCliente;

  aceita_marketing?: boolean;
}