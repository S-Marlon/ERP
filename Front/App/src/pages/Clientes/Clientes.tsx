import React, { useEffect, useState, useCallback, useMemo } from 'react';
import './Clientes.css';

import { ClientHeader } from './components/ClientHeader';

import GeralTab from './components/tabs/GeralTab';
import FinanceiroTab from './components/tabs/FinanceiroTab';
import HistoricoTab from './components/tabs/HistoricoTab';
import PrecosTab from './components/tabs/PrecosTab';

import type {
  ClienteAggregate,
} from './types/cliente.aggregate';

import type {
  ClienteEntity,
} from './types/cliente.entity';

import type {
  ClienteContatoEntity,
  ClienteEmailEntity,
} from './types/cliente.entity';

import {
  getClientes,
  getClienteById,
} from './services/ClienteApi';

import { ModalNovoCliente } from './components/ModalNovoCliente';

type TabType = 'geral' | 'financeiro' | 'historico' | 'precos';



const Clientes = () => {
  // =========================
  // STATES
  // =========================

  const [clientes, setClientes] =
  useState<ClienteEntity[]>([]);

const [cliente, setCliente] =
  useState<ClienteAggregate | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<TabType>('geral');

  const [ultimaCompra, setUltimaCompra] = useState<Date | undefined>();
  const [ticketMedio, setTicketMedio] = useState<number | undefined>();

  const [contatos, setContatos] =
  useState<ClienteContatoEntity[]>([]);

const [emails, setEmails] =
  useState<ClienteEmailEntity[]>([]);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // =========================
  // AUXILIAR
  // =========================

  const atualizarClienteAtivoCompleto = (
  novoCliente: ClienteAggregate | null
) => {
  setCliente(novoCliente);

  if (novoCliente) {
    setContatos(
      novoCliente.contatos || []
    );

    setEmails(
      novoCliente.emails || []
    );
  } else {
    setContatos([]);
    setEmails([]);
  }
};

const getEnderecoPrincipal = (
  cliente: ClienteAggregate | ClienteEntity
) => {
  return cliente.enderecos?.find(
    (e) => e.principal
  );
};


  // =========================
  // CARREGAR CLIENTES
  // =========================

  const carregarClientes = async () => {
    setLoading(true);

    try {
      const dados = await getClientes();

      setClientes(dados);

    if (dados.length > 0) {
  const clienteCompleto = await getClienteById(
    dados[0].id_cliente
  );

  atualizarClienteAtivoCompleto(clienteCompleto);
} else {
        atualizarClienteAtivoCompleto(null);
      }
    } catch (error) {
      console.error(
        'Erro ao carregar clientes:',
        error
      );

      setClientes([]);
      atualizarClienteAtivoCompleto(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarClientes();
  }, []);

  // =========================
  // FILTRO
  // =========================

  const clientesFiltrados = useMemo(() => {
    const termo = searchTerm.toLowerCase();

    return clientes.filter((c) => {
      return (
        c.nome_razao?.toLowerCase().includes(termo) ||
        c.cpf_cnpj?.includes(termo)
      );
    });
  }, [clientes, searchTerm]);

  // =========================
  // SELECIONAR CLIENTE
  // =========================

  const handleSelecionarCliente = async (
  c: ClienteEntity
  ) => {
    setLoading(true);

    try {
      const clienteCompleto =
        await getClienteById(c.id_cliente);

      atualizarClienteAtivoCompleto(
        clienteCompleto
      );
    } catch (error) {
      console.error(
        'Erro ao carregar cliente:',
        error
      );

      atualizarClienteAtivoCompleto(c);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // NOVO CLIENTE
  // =========================

  const handleNovoCliente = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // =========================
  // SALVAR NOVO CLIENTE
  // =========================

  const handleSalvarNovoClienteDoModal =
    useCallback(
      async (dadosDoFormulario: Cliente) => {
        setLoading(true);

        try {
          const { id_cliente, ...clienteParaEnviar } =
            dadosDoFormulario;

          const response = await fetch(
            'http://localhost:3001/api/clientes',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify(
                clienteParaEnviar
              ),
            }
          );

          if (!response.ok) {
            throw new Error(
              `Erro ao salvar cliente: ${response.status}`
            );
          }

          const clienteSalvoNoBanco: Cliente =
            await response.json();

          setClientes((prev) => [
            clienteSalvoNoBanco,
            ...prev,
          ]);

          atualizarClienteAtivoCompleto(
            clienteSalvoNoBanco
          );

          setActiveTab('geral');

          setIsModalOpen(false);
        } catch (error) {
          console.error(
            'Erro ao salvar cliente:',
            error
          );

          alert(
            'Não foi possível salvar o cliente.'
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  // =========================
  // SALVAR CLIENTE
  // =========================

  const salvarCliente = useCallback(
  (
    dados: ClienteAggregate
  ) => {
     const clienteAtualizado: ClienteAggregate = {
  ...dados,
  contatos,
  emails,
};

      setClientes((prev) =>
        prev.map((c) =>
          c.id_cliente === dados.id_cliente
            ? clienteAtualizado
            : c
        )
      );

      atualizarClienteAtivoCompleto(
        clienteAtualizado as Cliente
      );
    },
    [contatos, emails]
  );

  // =========================
  // RENDER
  // =========================

  return (
    <div className="container-clientes">
      {/* SIDEBAR */}
      <aside className="sidebar-clientes">
        <div className="sidebar-header">
          <h3>Clientes</h3>

          <button
            className="btn-novo"
            onClick={handleNovoCliente}
          >
            +
          </button>
        </div>

        {/* SEARCH */}
        <div className="search-clientes">
          <input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(e.target.value)
            }
          />

          <button
            onClick={carregarClientes}
            disabled={loading}
          >
            {loading ? '...' : 'reload'}
          </button>
        </div>

        {/* LISTA */}
        <ul className="lista-clientes">
          {clientesFiltrados.length === 0 &&
          !loading ? (
            <li className="sem-resultados">
              Nenhum cliente encontrado
            </li>
          ) : (
            clientesFiltrados.map((c) => (
              <li
                key={c.id_cliente}
                className={
                  cliente?.id_cliente ===
                  c.id_cliente
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  handleSelecionarCliente(c)
                }
              >
                <strong>
                  {c.nome_razao}
                </strong>

                <div>{c.cpf_cnpj}</div>
<small>
  {getEnderecoPrincipal(c)?.cidade ||
    'Cidade não informadas'}
  {' - '}
  {getEnderecoPrincipal(c)?.estado ||
    'UF'}
</small>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* MAIN */}
      <main className="painel-cliente">
        {cliente ? (
          <>
            <ClientHeader
              cliente={cliente}
              ultimaCompra={ultimaCompra}
              ticketMedio={ticketMedio}
              onAcao={() => {}}
              loading={loading}
            />

            <div className="client-tabs">
              {/* TABS */}
              <div className="tabs-header">
                {(
                  [
                    'geral',
                    'financeiro',
                    'historico',
                    'precos',
                  ] as TabType[]
                ).map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${
                      activeTab === tab
                        ? 'active'
                        : ''
                    }`}
                    onClick={() =>
                      setActiveTab(tab)
                    }
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* CONTEÚDO */}
              <div className="tabs-content">
                {activeTab === 'geral' && (
                  <GeralTab
                    cliente={cliente}
                    contatos={contatos}
                    emails={emails}
                    setContatos={setContatos}
                    setEmails={setEmails}
                    onSave={salvarCliente}
                  />
                )}

                {activeTab ===
                  'financeiro' && (
                  <FinanceiroTab
                    cliente={cliente}
                  />
                )}

                {activeTab ===
                  'historico' && (
                  <HistoricoTab
                    cliente={cliente}
                  />
                )}

                {activeTab === 'precos' && (
                  <PrecosTab
                    cliente={cliente}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-container">
            <h2>
              Selecione um cliente
            </h2>
          </div>
        )}
      </main>

      {/* MODAL */}
      <ModalNovoCliente
        isOpen={isModalOpen}
        onClose={() =>
          setIsModalOpen(false)
        }
        onSave={
          handleSalvarNovoClienteDoModal
        }
      />
    </div>
  );
};

export default Clientes;