import {
  ClienteEntity,
} from './cliente.entity';

export interface Cliente extends ClienteEntity {
  telefone_principal?: string;

  email_principal?: string;

  saldo_devedor_atual?: number;

  limite_credito?: number;

  score_credito?: number;

  score_comercial?: number;
}