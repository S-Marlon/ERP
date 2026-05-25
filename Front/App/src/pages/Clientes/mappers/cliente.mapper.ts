// cliente.mapper.ts


import { ClienteDTO, Cliente } from '../types/cliente.types';

export const mapCliente = (dto: ClienteDTO): Cliente => {
  const contatosBrutos =
    dto.contatos ||
    dto.cliente_contatos ||
    [];

  const contatos = contatosBrutos.map((c: any) => ({
    id: c.id || c.id_contato,
    nome: c.nome || c.nome_referencia || 'Sem nome',
    telefone: c.telefone || c.numero || '',
    cargo: c.cargo || '',
    tipo: c.tipo || 'GERAL',
  }));

  const emails = dto.emails || dto.cliente_emails || [];

  return {
    id_cliente: dto.id_cliente,
    nome_razao: dto.nome_razao,
    cpf_cnpj: dto.cpf_cnpj,

    cidade: dto.cidade,
    estado: dto.estado,

    telefone: dto.telefone,

    status_cliente: dto.status_cliente,
    status_credito: dto.status_credito,
    tipo_cliente: dto.tipo_cliente,

    limite_credito: dto.limite_credito || 0,
    saldo_devedor_atual: dto.saldo_devedor_atual || 0,

    observacoes: dto.observacoes,

    contatos,
    emails,

    ultima_compra: dto.ultima_compra
      ? new Date(dto.ultima_compra)
      : undefined,
  };
};