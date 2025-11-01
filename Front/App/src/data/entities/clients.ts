// Mock centralizado: Clientes, Contratos e Poços

export interface ClienteMock {
  id: string;
  nome: string;
  documento?: string;
  tipo?: 'PF' | 'PJ' | 'CPF' | 'CNPJ';
  telefone?: string;
  email?: string;
  cep?: string;
  endereco?: string;
  criadoEm?: string;
}

export interface ContratoMock {
  id: string;
  titulo: string;
  clienteId?: string;
  valorTotal?: number;
  dataAssinatura?: string;
  prazoDias?: number;
  status?: 'Ativo' | 'Concluido' | 'Cancelado' | 'Pendente';
}

export interface PocoMock {
  id: string;
  nomeIdentificacao: string;
  contratoId?: string;
  clienteId?: string;
  profundidadeTotalMetros?: number;
  vazao?: number;
  latitude?: number;
  longitude?: number;
  criadoEm?: string;
}

export const CLIENTES_MOCK: ClienteMock[] = [
  {
    id: 'cli-001',
    nome: 'João da Silva',
    documento: '111.222.333-44',
    tipo: 'PF',
    telefone: '11988887777',
    email: 'joao.silva@exemplo.com',
    cep: '01000-000',
    endereco: 'Rua A, 123, São Paulo - SP',
    criadoEm: '2024-01-10T09:00:00.000Z',
  },
  {
    id: 'cli-002',
    nome: 'Maria Oliveira',
    documento: '55.666.777/0001-88',
    tipo: 'PJ',
    telefone: '21977776666',
    email: 'contato@empresaexemplo.com',
    cep: '20000-000',
    endereco: 'Av. B, 456, Rio de Janeiro - RJ',
    criadoEm: '2024-02-15T10:30:00.000Z',
  },
  {
    id: 'cli-003',
    nome: 'Ana Costa',
    documento: '999.888.777-66',
    tipo: 'PF',
    telefone: '31966665555',
    email: 'ana.costa@exemplo.com',
    cep: '30000-000',
    endereco: 'Praça C, 78, Belo Horizonte - MG',
    criadoEm: '2024-03-05T14:20:00.000Z',
  },
];

export const CONTRATOS_MOCK: ContratoMock[] = [
  {
    id: 'cont-001',
    titulo: 'Contrato - Poço Fazenda Esperança',
    clienteId: 'cli-001',
    valorTotal: 48000,
    dataAssinatura: '2024-04-01',
    prazoDias: 60,
    status: 'Ativo',
  },
  {
    id: 'cont-002',
    titulo: 'Manutenção Preventiva - Cliente Maria',
    clienteId: 'cli-002',
    valorTotal: 8000,
    dataAssinatura: '2024-05-10',
    prazoDias: 30,
    status: 'Pendente',
  },
];

export const POCOS_MOCK: PocoMock[] = [
  {
    id: 'poco-001',
    nomeIdentificacao: 'Poço Principal - Fazenda Esperança',
    contratoId: 'cont-001',
    clienteId: 'cli-001',
    profundidadeTotalMetros: 120,
    vazao: 5.8,
    latitude: -23.12345,
    longitude: -46.54321,
    criadoEm: '2024-04-15T08:00:00.000Z',
  },
  {
    id: 'poco-002',
    nomeIdentificacao: 'Poço Secundário - Sítio Azul',
    contratoId: undefined,
    clienteId: 'cli-003',
    profundidadeTotalMetros: 85,
    vazao: 3.2,
    latitude: -19.87654,
    longitude: -43.21098,
    criadoEm: '2024-06-20T11:10:00.000Z',
  },
];

export default {
  CLIENTES_MOCK,
  CONTRATOS_MOCK,
  POCOS_MOCK,
};