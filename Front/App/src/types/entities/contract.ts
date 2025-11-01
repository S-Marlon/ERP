export interface Contrato {
  id: string;
  titulo: string;
  clienteId?: string;
  valorTotal?: number;
  dataAssinatura?: string; // ISO date
  prazoDias?: number;
  status?: 'Ativo' | 'Concluido' | 'Cancelado' | 'Pendente';
}