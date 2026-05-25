import { StatusCredito } from './cliente.enums';

export interface ClienteCreditoEntity {
  id: number;

  id_cliente: number;

  limite_credito: number;

  dia_vencimento: number;

  status_credito: StatusCredito;

  score_credito?: number;

  vigente: boolean;

  created_by?: number;
  updated_by?: number;

  created_at: string;
  updated_at?: string;
}