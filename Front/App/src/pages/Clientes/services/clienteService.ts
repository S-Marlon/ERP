/**
 * SERVIÇO DE CLIENTES
 * Mock profissional com persistência local
 * Preparado para futura troca por API real
 */

import type {
  Cliente,
  ClienteInput,
  ClienteUpdate,
  ClienteContato,
  ClienteContatoInput,
  ClienteEmail,
  ClienteEmailInput,
  ClientePrecoEspecial,
  ClientePrecoEspecialInput,
  ContaReceber,
  Venda,
  VendaItem,
  ResumoFinanceiro,
  ResumoVendas,
} from '../types/cliente.types';

import { clientesMock } from '../database/clientes.mock';

// ======================================================================
// STORAGE
// ======================================================================

const STORAGE_KEY = 'mock_clientes';

// ======================================================================
// MOCK BASE
// ======================================================================

// ======================================================================
// DELAY MOCK
// ======================================================================

const delay = (ms = 400) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

// ======================================================================
// SERVICE
// ======================================================================

class ClienteServiceClass {
  private clientes: Cliente[] = [];

  constructor() {
    this.loadStorage();
  }

  // ====================================================================
  // STORAGE
  // ====================================================================

  private loadStorage() {
    const data = localStorage.getItem(
      STORAGE_KEY
    );

    if (data) {
      this.clientes = JSON.parse(data);
    } else {
      this.clientes = clientesMock; // Usa os dados mockados importados

      this.saveStorage();
    }
  }

  private saveStorage() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.clientes)
    );
  }

  // ====================================================================
  // CLIENTES
  // ====================================================================

  async listar(): Promise<Cliente[]> {
    await delay();

    return [...this.clientes];
  }

  async listarTodos(): Promise<Cliente[]> {
    return this.listar();
  }

  async obter(id: number): Promise<Cliente> {
    await delay();

    const cliente = this.clientes.find(
      (c) => c.id_cliente === id
    );

    if (!cliente) {
      throw new Error(
        'Cliente não encontrado'
      );
    }

    return cliente;
  }

  async criar(
    dados: ClienteInput
  ): Promise<Cliente> {
    await delay();

    const novoCliente: Cliente = {
      id_cliente: Date.now(),

      status_cliente: 'ATIVO',

      ...dados,
    };

    this.clientes.unshift(novoCliente);

    this.saveStorage();

    return novoCliente;
  }

  async atualizar(
    id: number,
    dados: ClienteUpdate
  ): Promise<Cliente> {
    await delay();

    const index = this.clientes.findIndex(
      (c) => c.id_cliente === id
    );

    if (index === -1) {
      throw new Error(
        'Cliente não encontrado'
      );
    }

    this.clientes[index] = {
      ...this.clientes[index],
      ...dados,
    };

    this.saveStorage();

    return this.clientes[index];
  }

  async deletar(id: number): Promise<void> {
    await delay();

    this.clientes = this.clientes.filter(
      (c) => c.id_cliente !== id
    );

    this.saveStorage();
  }

  async salvar(
    cliente: Partial<Cliente>
  ): Promise<Cliente> {
    if (cliente.id_cliente) {
      return this.atualizar(
        cliente.id_cliente,
        cliente as ClienteUpdate
      );
    }

    return this.criar(
      cliente as ClienteInput
    );
  }

  async excluir(id: number): Promise<void> {
    return this.deletar(id);
  }

  // ====================================================================
  // CONTATOS
  // ====================================================================

  async obterContatos(
    id_cliente: number
  ): Promise<ClienteContato[]> {
    await delay();

    return [
      {
        id_contato: 1,
        nome: 'Carlos Silva',
        telefone: '(11) 99999-9999',
        cargo: 'Comprador',
      },
    ] as ClienteContato[];
  }

  async adicionarContato(
    id_cliente: number,
    dados: ClienteContatoInput
  ): Promise<ClienteContato> {
    await delay();

    return {
      id_contato: Date.now(),
      ...dados,
    } as ClienteContato;
  }

  async atualizarContato(
    id_cliente: number,
    id_contato: number,
    dados: Partial<ClienteContatoInput>
  ): Promise<ClienteContato> {
    await delay();

    return {
      id_contato,
      ...dados,
    } as ClienteContato;
  }

  async removerContato(
    id_cliente: number,
    id_contato: number
  ): Promise<void> {
    await delay();
  }

  // ====================================================================
  // EMAILS
  // ====================================================================

  async obterEmails(
    id_cliente: number
  ): Promise<ClienteEmail[]> {
    await delay();

    return [
      {
        id_email: 1,
        email: 'financeiro@empresa.com',
      },
    ] as ClienteEmail[];
  }

  async adicionarEmail(
    id_cliente: number,
    dados: ClienteEmailInput
  ): Promise<ClienteEmail> {
    await delay();

    return {
      id_email: Date.now(),
      ...dados,
    } as ClienteEmail;
  }

  async atualizarEmail(
    id_cliente: number,
    id_email: number,
    dados: Partial<ClienteEmailInput>
  ): Promise<ClienteEmail> {
    await delay();

    return {
      id_email,
      ...dados,
    } as ClienteEmail;
  }

  async removerEmail(
    id_cliente: number,
    id_email: number
  ): Promise<void> {
    await delay();
  }

  // ====================================================================
  // PREÇOS ESPECIAIS
  // ====================================================================

  async obterPrecosEspeciais(
    id_cliente: number
  ): Promise<ClientePrecoEspecial[]> {
    await delay();

    return [
      {
        id_regra: 1,
        produto: 'Cimento CP2',
        preco_especial: 39.9,
      },
    ] as ClientePrecoEspecial[];
  }

  async adicionarPrecoEspecial(
    id_cliente: number,
    dados: ClientePrecoEspecialInput
  ): Promise<ClientePrecoEspecial> {
    await delay();

    return {
      id_regra: Date.now(),
      ...dados,
    } as ClientePrecoEspecial;
  }

  async atualizarPrecoEspecial(
    id_cliente: number,
    id_regra: number,
    dados: Partial<ClientePrecoEspecialInput>
  ): Promise<ClientePrecoEspecial> {
    await delay();

    return {
      id_regra,
      ...dados,
    } as ClientePrecoEspecial;
  }

  async removerPrecoEspecial(
    id_cliente: number,
    id_regra: number
  ): Promise<void> {
    await delay();
  }

  // ====================================================================
  // FINANCEIRO
  // ====================================================================

  async obterFinanceiro(
    id_cliente: number
  ): Promise<ResumoFinanceiro> {
    await delay();

    return {
      total_aberto: 3500,
      total_pago: 12000,
      total_vencido: 800,
    } as ResumoFinanceiro;
  }

  async obterContas(
    id_cliente: number
  ): Promise<ContaReceber[]> {
    await delay();

    return [
      {
        id_conta: 1,
        valor: 1250,
        status: 'PENDENTE',
      },
    ] as ContaReceber[];
  }

  async registrarPagamento(
    id_cliente: number,
    id_conta: number,
    data_pagamento: Date
  ): Promise<ContaReceber> {
    await delay();

    return {
      id_conta,
      status: 'PAGO',
    } as ContaReceber;
  }

  // ====================================================================
  // VENDAS
  // ====================================================================

  async obterResumoVendas(
    id_cliente: number
  ): Promise<ResumoVendas> {
    await delay();

    return {
      total_vendas: 15,
      valor_total: 25000,
      ticket_medio: 1666,
      ultima_venda: new Date().toISOString(), // Garante que seja uma string no formato ISO
    };
  }

  async obterVendas(
    id_cliente: number
  ): Promise<Venda[]> {
    await delay();

    return [
      {
        id_venda: 1,
        valor_total: 1200,
        data: '2026-05-01',
      },

      {
        id_venda: 2,
        valor_total: 850,
        data: '2026-04-15',
      },
    ] as Venda[];
  }

  async obterVenda(
    id_cliente: number,
    id_venda: number
  ): Promise<Venda> {
    await delay();

    return {
      id_venda,
      valor_total: 1200,
      data: '2026-05-01',
    } as Venda;
  }

  async obterItensVenda(
    id_cliente: number,
    id_venda: number
  ): Promise<VendaItem[]> {
    await delay();

    return [
      {
        id_item: 1,
        descricao: 'Cimento CP2',
        quantidade: 20,
        valor_unitario: 39.9,
      },
    ] as VendaItem[];
  }
}

// ======================================================================
// EXPORT
// ======================================================================

export const clienteService =
  new ClienteServiceClass();