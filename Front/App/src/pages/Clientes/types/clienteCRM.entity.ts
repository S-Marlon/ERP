import {
  PotencialCliente,
} from './cliente.enums';

export interface ClienteCRMEntity {
  id: number;

  id_cliente: number;

  classificacao?: 'A' | 'B' | 'C';

  potencial?: PotencialCliente;

  score_comercial?: number;

  segmento?: string;

  created_at: string;
  updated_at?: string;
}