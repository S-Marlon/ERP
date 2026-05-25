import { TipoEndereco } from './cliente.enums';

export interface ClienteEnderecoEntity {
  id_endereco: number;

  id_cliente: number;

  tipo: TipoEndereco;

  principal: boolean;

  logradouro?: string;
  numero?: string;
  complemento?: string;

  bairro?: string;
  cidade?: string;
  estado?: string;

  cep?: string;

  pais?: string;

  referencia?: string;

  created_at: string;
  updated_at?: string;

  deleted_at?: string;
}