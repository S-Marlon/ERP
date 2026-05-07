/**
 * PÁGINA CLIENTES
 * Orquestrador principal do módulo de gestão de clientes
 * Refatorado com arquitetura profissional em camadas
 */

import React, { useState, useEffect } from 'react';
import './Clientes.css';
import { clienteService } from '../../services/clienteService';
import { useCliente } from '../../hooks/useCliente';
import { ClientHeader } from './components/ClientHeader';
import CadastroTab from './components/tabs/CadastroTab';
import ContatosTab from './components/tabs/ContatosTab';
import FinanceiroTab from './components/tabs/FinanceiroTab';
import HistoricoTab from './components/tabs/HistoricoTab';
import PrecosTab from './components/tabs/PrecosTab';
import type { Cliente, ResumoVendas } from '../../types/cliente.types';

const Clientes = () => {
  // =========================================================================
  // STATE
  // =========================================================================

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [activeTab, setActiveTab] = useState<'cadastro' | 'contatos' | 'financeiro' | 'historico' | 'precos'>('cadastro');
  const [usuarioLoading, setUsuarioLoading] = useState(false);
  const [ultimaCompra, setUltimaCompra] = useState<Date | undefined>();
  const [ticketMedio, setTicketMedio] = useState<number | undefined>();

  // Hook principal
  const {
    state,
    cliente,
    loading,
    error,
    carregarCliente,
    atualizarCliente,
    salvarCliente,
    novoCliente,
    limparErro,
    carregarVendas,
  } = useCliente();

  // =========================================================================
  // EFEITOS
  // =========================================================================

  // Carrega lista de clientes ao montar
  useEffect(() => {
    carregarListaClientes();
  }, []);

  // Carrega resumo de vendas quando cliente muda
  useEffect(() => {
    if (cliente?.id_cliente) {
      carregarResumoVendas();
    }
  }, [cliente?.id_cliente]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const carregarListaClientes = async () => {
    try {
      setUsuarioLoading(true);
      const dados = await clienteService.listarTodos();
      setClientes(dados);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setUsuarioLoading(false);
    }
  };

  const carregarResumoVendas = async () => {
    const resumo = await carregarVendas();
    if (resumo) {
      setUltimaCompra(resumo.ultima_venda);
      setTicketMedio(resumo.ticket_medio);
    }
  };

  const handleSelecionarCliente = async (c: Cliente) => {
    await carregarCliente(c.id_cliente);
    setActiveTab('cadastro');
  };

  const handleNovoCliente = () => {
    novoCliente();
    setActiveTab('cadastro');
    setUltimaCompra(undefined);
    setTicketMedio(undefined);
  };

  const handleAcaoBotao = (acao: 'pagar' | 'bloquear' | 'desbloquear' | 'novo') => {
    switch (acao) {
      case 'pagar':
        setActiveTab('financeiro');
        break;
      case 'bloquear':
        if (cliente) {
          atualizarCliente({ status_cliente: 'BLOQUEADO' });
        }
        break;
      case 'desbloquear':
        if (cliente) {
          atualizarCliente({ status_cliente: 'ATIVO' });
        }
        break;
      case 'novo':
        handleNovoCliente();
        break;
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="container-clientes">
      {/* SIDEBAR: LISTA DE CLIENTES */}
      <aside className="sidebar-clientes">
        <div className="sidebar-header">
          <h3>Clientes</h3>
          <button className="btn-novo" onClick={handleNovoCliente} title="Criar novo cliente">
            ➕
          </button>
        </div>

        <div className="search-clientes">
          <input
            type="text"
            placeholder="🔍 Buscar cliente..."
            disabled
            title="Busca será implementada em versão posterior"
          />
        </div>

        <ul className="lista-clientes">
          {clientes.map((c) => (
            <li
              key={c.id_cliente}
              className={cliente?.id_cliente === c.id_cliente ? 'active' : ''}
              onClick={() => handleSelecionarCliente(c)}
              role="button"
              tabIndex={0}
            >
              <div className="cliente-item-info">
                <strong>{c.nome_razao}</strong>
                <span className="cliente-doc">{c.cpf_cnpj}</span>
                {c.cidade && <span className="cliente-local">{c.cidade}</span>}
              </div>
            </li>
          ))}
        </ul>

        {usuarioLoading && <div className="loading-indicator">Carregando...</div>}
        {clientes.length === 0 && !usuarioLoading && (
          <div className="empty-state">Nenhum cliente cadastrado</div>
        )}
      </aside>

      {/* MAIN: PAINEL DE CLIENTE */}
      <main className="painel-cliente">
        {/* ERROR DISPLAY */}
        {error && (
          <div className="error-banner">
            <div className="error-content">
              <span className="error-icon">❌</span>
              <span>{error}</span>
              <button className="error-close" onClick={limparErro}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* CLIENTE HEADER */}
        {cliente ? (
          <>
            <ClientHeader
              cliente={cliente}
              ultimaCompra={ultimaCompra}
              ticketMedio={ticketMedio}
              onAcao={handleAcaoBotao}
              loading={loading}
            />

            {/* ABAS */}
            <div className="client-tabs">
              <div className="tabs-header">
                <button
                  className={`tab-button ${activeTab === 'cadastro' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cadastro')}
                >
                  📋 Cadastro
                </button>
                <button
                  className={`tab-button ${activeTab === 'contatos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('contatos')}
                >
                  📞 Contatos
                </button>
                <button
                  className={`tab-button ${activeTab === 'financeiro' ? 'active' : ''}`}
                  onClick={() => setActiveTab('financeiro')}
                >
                  💰 Financeiro
                </button>
                <button
                  className={`tab-button ${activeTab === 'historico' ? 'active' : ''}`}
                  onClick={() => setActiveTab('historico')}
                >
                  📊 Histórico
                </button>
                <button
                  className={`tab-button ${activeTab === 'precos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('precos')}
                >
                  🏷️ Preços
                </button>
              </div>

              <div className="tabs-content">
                {activeTab === 'cadastro' && (
                  <CadastroTab cliente={cliente} onSave={salvarCliente} />
                )}

                {activeTab === 'contatos' && (
                  <ContatosTab cliente={cliente} />
                )}

                {activeTab === 'financeiro' && (
                  <FinanceiroTab cliente={cliente} />
                )}

                {activeTab === 'historico' && (
                  <HistoricoTab cliente={cliente} />
                )}

                {activeTab === 'precos' && (
                  <PrecosTab cliente={cliente} />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-container">
            <div className="empty-state-large">
              <h2>👋 Bem-vindo ao Módulo de Clientes</h2>
              <p>Selecione um cliente na lista ou crie um novo para começar</p>
              <button className="btn-primary-large" onClick={handleNovoCliente}>
                ➕ Novo Cliente
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Clientes;



