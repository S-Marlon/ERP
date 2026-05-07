/**
 * SERVIÇO DE CLIENTES
 * API client com tratamento robusto de erros e tipagem forte
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
  ApiResponse,
  ApiListResponse,
} from '../types/cliente.types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const CLIENTES_ENDPOINT = `${API_URL}/clientes`;

/**
 * Classe para centralizar requisições de cliente
 */
class ClienteServiceClass {
  /**
   * Trata erros de rede e API
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(
        errorData?.message || errorData?.error || `Erro ${response.status}: ${response.statusText}`
      );
    }

    try {
      const data = await response.json();
      return data.data || data;
    } catch {
      throw new Error('Resposta do servidor inválida');
    }
  }

  /**
   * Faz requisição GET
   */
  private async get<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`GET ${url}:`, error);
      throw error;
    }
  }

  /**
   * Faz requisição POST
   */
  private async post<T>(url: string, body: unknown): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`POST ${url}:`, error);
      throw error;
    }
  }

  /**
   * Faz requisição PUT
   */
  private async put<T>(url: string, body: unknown): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`PUT ${url}:`, error);
      throw error;
    }
  }

  /**
   * Faz requisição DELETE
   */
  private async delete<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      console.error(`DELETE ${url}:`, error);
      throw error;
    }
  }

  // =========================================================================
  // CLIENTE - OPERAÇÕES BÁSICAS
  // =========================================================================

  /**
   * Lista todos os clientes
   */
  async listarTodos(): Promise<Cliente[]> {
    return this.get<Cliente[]>(CLIENTES_ENDPOINT);
  }

  /**
   * Obtém um cliente específico
   */
  async obter(id: number): Promise<Cliente> {
    return this.get<Cliente>(`${CLIENTES_ENDPOINT}/${id}`);
  }

  /**
   * Cria um novo cliente
   */
  async criar(dados: ClienteInput): Promise<Cliente> {
    return this.post<Cliente>(CLIENTES_ENDPOINT, dados);
  }

  /**
   * Atualiza um cliente (PUT completo)
   */
  async atualizar(id: number, dados: ClienteUpdate): Promise<Cliente> {
    return this.put<Cliente>(`${CLIENTES_ENDPOINT}/${id}`, dados);
  }

  /**
   * Deleta um cliente
   */
  async deletar(id: number): Promise<void> {
    await this.delete<void>(`${CLIENTES_ENDPOINT}/${id}`);
  }

  /**
   * Salva cliente (cria ou atualiza automaticamente)
   * Método legado para compatibilidade
   */
  async salvar(cliente: Partial<Cliente>): Promise<Cliente> {
    if (cliente.id_cliente) {
      return this.atualizar(cliente.id_cliente, cliente as ClienteUpdate);
    } else {
      return this.criar(cliente as ClienteInput);
    }
  }

  /**
   * Excluir cliente (alias para compatibilidade)
   */
  async excluir(id: number): Promise<void> {
    return this.deletar(id);
  }

  // =========================================================================
  // CONTATOS
  // =========================================================================

  /**
   * Lista contatos de um cliente
   */
  async obterContatos(id_cliente: number): Promise<ClienteContato[]> {
    return this.get<ClienteContato[]>(`${CLIENTES_ENDPOINT}/${id_cliente}/contatos`);
  }

  /**
   * Adiciona contato
   */
  async adicionarContato(id_cliente: number, dados: ClienteContatoInput): Promise<ClienteContato> {
    return this.post<ClienteContato>(`${CLIENTES_ENDPOINT}/${id_cliente}/contatos`, dados);
  }

  /**
   * Atualiza contato
   */
  async atualizarContato(
    id_cliente: number,
    id_contato: number,
    dados: Partial<ClienteContatoInput>
  ): Promise<ClienteContato> {
    return this.put<ClienteContato>(
      `${CLIENTES_ENDPOINT}/${id_cliente}/contatos/${id_contato}`,
      dados
    );
  }

  /**
   * Remove contato
   */
  async removerContato(id_cliente: number, id_contato: number): Promise<void> {
    await this.delete<void>(`${CLIENTES_ENDPOINT}/${id_cliente}/contatos/${id_contato}`);
  }

  // =========================================================================
  // EMAILS
  // =========================================================================

  /**
   * Lista emails de um cliente
   */
  async obterEmails(id_cliente: number): Promise<ClienteEmail[]> {
    return this.get<ClienteEmail[]>(`${CLIENTES_ENDPOINT}/${id_cliente}/emails`);
  }

  /**
   * Adiciona email
   */
  async adicionarEmail(id_cliente: number, dados: ClienteEmailInput): Promise<ClienteEmail> {
    return this.post<ClienteEmail>(`${CLIENTES_ENDPOINT}/${id_cliente}/emails`, dados);
  }

  /**
   * Atualiza email
   */
  async atualizarEmail(
    id_cliente: number,
    id_email: number,
    dados: Partial<ClienteEmailInput>
  ): Promise<ClienteEmail> {
    return this.put<ClienteEmail>(`${CLIENTES_ENDPOINT}/${id_cliente}/emails/${id_email}`, dados);
  }

  /**
   * Remove email
   */
  async removerEmail(id_cliente: number, id_email: number): Promise<void> {
    await this.delete<void>(`${CLIENTES_ENDPOINT}/${id_cliente}/emails/${id_email}`);
  }

  // =========================================================================
  // PREÇOS ESPECIAIS
  // =========================================================================

  /**
   * Lista preços especiais de um cliente
   */
  async obterPrecosEspeciais(id_cliente: number): Promise<ClientePrecoEspecial[]> {
    return this.get<ClientePrecoEspecial[]>(`${CLIENTES_ENDPOINT}/${id_cliente}/precos-especiais`);
  }

  /**
   * Adiciona preço especial
   */
  async adicionarPrecoEspecial(
    id_cliente: number,
    dados: ClientePrecoEspecialInput
  ): Promise<ClientePrecoEspecial> {
    return this.post<ClientePrecoEspecial>(
      `${CLIENTES_ENDPOINT}/${id_cliente}/precos-especiais`,
      dados
    );
  }

  /**
   * Atualiza preço especial
   */
  async atualizarPrecoEspecial(
    id_cliente: number,
    id_regra: number,
    dados: Partial<ClientePrecoEspecialInput>
  ): Promise<ClientePrecoEspecial> {
    return this.put<ClientePrecoEspecial>(
      `${CLIENTES_ENDPOINT}/${id_cliente}/precos-especiais/${id_regra}`,
      dados
    );
  }

  /**
   * Remove preço especial
   */
  async removerPrecoEspecial(id_cliente: number, id_regra: number): Promise<void> {
    await this.delete<void>(
      `${CLIENTES_ENDPOINT}/${id_cliente}/precos-especiais/${id_regra}`
    );
  }

  // =========================================================================
  // FINANCEIRO
  // =========================================================================

  /**
   * Obtém resumo financeiro do cliente
   */
  async obterFinanceiro(id_cliente: number): Promise<ResumoFinanceiro> {
    return this.get<ResumoFinanceiro>(`${CLIENTES_ENDPOINT}/${id_cliente}/financeiro`);
  }

  /**
   * Lista contas a receber do cliente
   */
  async obterContas(id_cliente: number): Promise<ContaReceber[]> {
    return this.get<ContaReceber[]>(`${CLIENTES_ENDPOINT}/${id_cliente}/contas-receber`);
  }

  /**
   * Registra pagamento de conta
   */
  async registrarPagamento(
    id_cliente: number,
    id_conta: number,
    data_pagamento: Date
  ): Promise<ContaReceber> {
    return this.post<ContaReceber>(
      `${CLIENTES_ENDPOINT}/${id_cliente}/contas-receber/${id_conta}/pagamento`,
      { data_pagamento }
    );
  }

  // =========================================================================
  // HISTÓRICO DE VENDAS
  // =========================================================================

  /**
   * Obtém resumo de vendas do cliente
   */
  async obterResumoVendas(id_cliente: number): Promise<ResumoVendas> {
    return this.get<ResumoVendas>(`${CLIENTES_ENDPOINT}/${id_cliente}/vendas/resumo`);
  }

  /**
   * Lista vendas do cliente
   */
  async obterVendas(id_cliente: number): Promise<Venda[]> {
    return this.get<Venda[]>(`${CLIENTES_ENDPOINT}/${id_cliente}/vendas`);
  }

  /**
   * Obtém detalhes de uma venda específica
   */
  async obterVenda(id_cliente: number, id_venda: number): Promise<Venda> {
    return this.get<Venda>(`${CLIENTES_ENDPOINT}/${id_cliente}/vendas/${id_venda}`);
  }

  /**
   * Obtém itens de uma venda
   */
  async obterItensVenda(id_cliente: number, id_venda: number): Promise<VendaItem[]> {
    return this.get<VendaItem[]>(`${CLIENTES_ENDPOINT}/${id_cliente}/vendas/${id_venda}/itens`);
  }
}

// Singleton
export const clienteService = new ClienteServiceClass();
