import {
  TipoCliente,
  StatusCliente,
} from './cliente.enums';

export interface ClienteEntity {
  id_cliente: number;

  tipo_cliente:
    | 'PESSOA_FISICA'
    | 'PESSOA_JURIDICA';

  nome_razao: string;

  nome_fantasia?: string | null;

  cpf_cnpj: string;

  status_cliente: string;

  cidade?: string | null;
  estado?: string | null;

  email?: string | null;
  telefone?: string | null;
}

