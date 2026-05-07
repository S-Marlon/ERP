/**
 * CLIENTE SERVICE
 * Camada de serviço para operações com clientes
 * Responsável por comunicação com API e tratamento de erros
 */

import type {
  Cliente,
  ClienteContato,
  ClienteEmail,
  ClientePrecoEspecial,
  FinanceiroSummary,
  ResumoVendas,
  Venda,
  ClienteFormData,
} from '../types/cliente.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ClienteServiceClass {
  /**
   * Carrega um cliente pelo ID
   */
  async obter(id: number): Promise<Cliente> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}`);
      if (!response.ok) throw new Error(`Cliente ${id} não encontrado`);
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Erro ao obter cliente:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao carregar cliente');
    }
  }

  /**
   * Lista todos os clientes
   */
  async listarTodos(): Promise<Cliente[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes`);
      if (!response.ok) throw new Error('Erro ao listar clientes');
      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao listar clientes');
    }
  }

  /**
   * Cria um novo cliente
   */
  async criar(dados: ClienteFormData): Promise<Cliente> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      if (!response.ok) throw new Error('Erro ao criar cliente');
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao criar cliente');
    }
  }

  /**
   * Atualiza um cliente existente
   */
  async atualizar(id: number, dados: ClienteFormData): Promise<Cliente> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      if (!response.ok) throw new Error('Erro ao atualizar cliente');
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao atualizar cliente');
    }
  }

  /**
   * Deleta um cliente
   */
  async excluir(id: number): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao deletar cliente');
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao deletar cliente');
    }
  }

  /**
   * Carrega dados financeiros do cliente
   */
  async obterFinanceiro(id: number): Promise<FinanceiroSummary> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}/financeiro`);
      if (!response.ok) throw new Error('Erro ao carregar dados financeiros');
      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Erro ao carregar financeiro:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao carregar financeiro');
    }
  }

  /**
   * Carrega histórico de vendas
   */
  async obterVendas(id: number): Promise<Venda[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}/vendas`);
      if (!response.ok) throw new Error('Erro ao carregar vendas');
      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao carregar vendas');
    }
  }

  /**
   * Carrega contatos do cliente
   */
  async obterContatos(id: number): Promise<ClienteContato[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}/contatos`);
      if (!response.ok) throw new Error('Erro ao carregar contatos');
      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao carregar contatos');
    }
  }

  /**
   * Carrega preços especiais do cliente
   */
  async obterPrecosEspeciais(id: number): Promise<ClientePrecoEspecial[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes/${id}/precos-especiais`);
      if (!response.ok) throw new Error('Erro ao carregar preços especiais');
      const data = await response.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch (error) {
      console.error('Erro ao carregar preços especiais:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao carregar preços especiais');
    }
  }

  /**
   * Registra um pagamento
   */
  async registrarPagamento(idConta: number, valor: number, dataPagamento: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/contas-receber/${idConta}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor, data_pagamento: dataPagamento }),
      });
      if (!response.ok) throw new Error('Erro ao registrar pagamento');
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao registrar pagamento');
    }
  }
}

export const clienteService = new ClienteServiceClass();
