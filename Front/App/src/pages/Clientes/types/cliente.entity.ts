import {
  TipoCliente,
  StatusCliente,
} from './cliente.enums';

export interface ClienteEntity {
  id_cliente: number;

  nome_razao: string;
  nome_fantasia?: string;

  cpf_cnpj?: string;

  inscricao_estadual?: string;
  inscricao_municipal?: string;

  tipo_cliente: TipoCliente;

  segmento?: string;

  status_cliente: StatusCliente;
  motivo_status?: string;

  aceita_marketing: boolean;

  consentimento_dados_em?: string;

  ultima_compra?: string;

  criado_em: string;

  created_at: string;
  updated_at?: string;

  deleted_at?: string;
}

