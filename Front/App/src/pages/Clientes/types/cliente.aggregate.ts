import {
  Cliente,
} from './cliente.domain';

import {
  ClienteContatoEntity,
  ClienteEnderecoEntity,
  ClienteEmailEntity,
  ClienteCreditoEntity,
  ClienteCRMEntity,
} from './cliente.entity';

export interface ClienteAggregate extends Cliente {
  credito?: ClienteCreditoEntity;

  crm?: ClienteCRMEntity;

  enderecos?: ClienteEnderecoEntity[];

  contatos?: ClienteContatoEntity[];

  emails?: ClienteEmailEntity[];

  financeiro?: ClienteFinanceiroResumo;

  analytics?: ClienteAnalytics;
}