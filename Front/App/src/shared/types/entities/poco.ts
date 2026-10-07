export interface Poco {
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