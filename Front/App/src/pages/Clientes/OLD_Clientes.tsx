import React, { useEffect, useState, useCallback, useMemo } from 'react';
import './Clientes.css';

import { ClientHeader } from './components/ClientHeader';

import GeralTab from './components/tabs/GeralTab';
import FinanceiroTab from './components/tabs/FinanceiroTab';
import HistoricoTab from './components/tabs/HistoricoTab';
import PrecosTab from './components/tabs/PrecosTab';

import type { ClienteAggregate } from './types/cliente.aggregate';
import type { ClienteEntity } from './types/cliente.entity';
import type { ClienteContatoEntity, ClienteEmailEntity } from './types/cliente.entity';

import { getClientes, getClienteById } from './services/ClienteApi';
import { ModalNovoCliente } from './components/ModalNovoCliente';

type TabType = 'geral' | 'financeiro' | 'historico' | 'precos';

const Clientes = () => {
  // =========================
  // STATES
  // =========================
  const [pessoas, setPessoas] = useState<any[]>([]); // Alterado de clientes para pessoas
  const [pessoaAtiva, setPessoaAtiva] = useState<any | null>(null); // Alterado de cliente para pessoaAtiva

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('geral');

  const [ultimaCompra, setUltimaCompra] = useState<Date | undefined>();
  const [ticketMedio, setTicketMedio] = useState<number | undefined>();

  const [contatos, setContatos] = useState<ClienteContatoEntity[]>([]);
  const [emails, setEmails] = useState<ClienteEmailEntity[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // =========================
  // AUXILIAR
  // =========================
  const atualizarPessoaAtivaCompleta = (novaPessoa: any | null) => {
    setPessoaAtiva(novaPessoa);

    if (novaPessoa) {
      setContatos(novaPessoa.contatos || []);
      setEmails(novaPessoa.emails || []);
    } else {
      setContatos([]);
      setEmails([]);
    }
  };

  // =========================
  // CARREGAR PESSOAS
  // =========================
  const carregarPessoas = async () => {
    setLoading(true);
    try {
      const dados = await getClientes(); // Busca a lista do backend
      setPessoas(dados);

      if (dados && dados.length > 0) {
        // CORREÇÃO CRÍTICA: Alterado de id_cliente para id_pessoa
        const idParaBuscar = dados[0].id_pessoa;
        
        if (idParaBuscar && String(idParaBuscar) !== 'undefined') {
          const pessoaCompleta = await getClienteById(idParaBuscar);
          atualizarPessoaAtivaCompleta(pessoaCompleta);
        }
      } else {
        atualizarPessoaAtivaCompleta(null);
      }
    } catch (error) {
      console.error('Erro ao carregar pessoas:', error);
      setPessoas([]);
      atualizarPessoaAtivaCompleta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPessoas();
  }, []);

  // =========================
  // FILTRO
  // =========================
  const pessoasFiltradas = useMemo(() => {
    const termo = searchTerm.toLowerCase();
    return pessoas.filter((p) => {
      return (
        p.nome_razao?.toLowerCase().includes(termo) ||
        p.cpf_cnpj?.includes(termo)
      );
    });
  }, [pessoas, searchTerm]);

  // =========================
  // SELECIONAR PESSOA
  // =========================
  const handleSelecionarPessoa = async (p: any) => {
    // Bloqueio preventivo se o ID for inválido
    if (!p.id_pessoa || String(p.id_pessoa) === 'undefined') {
      console.warn('Tentativa de selecionar uma pessoa com ID inválido.');
      return;
    }

    setLoading(true);
    try {
      const pessoaCompleta = await getClienteById(p.id_pessoa); // CORREÇÃO: Alterado para id_pessoa
      atualizarPessoaAtivaCompleta(pessoaCompleta);
    } catch (error) {
      console.error('Erro ao carregar dados detalhados da pessoa:', error);
      atualizarPessoaAtivaCompleta(p);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // NOVO CADASTRO
  // =========================
  const handleNovoCliente = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // =========================
  // SALVAR NOVO CADASTRO (POST)
  // =========================
  const handleSalvarNovoClienteDoModal = useCallback(
    async (dadosDoFormulario: any) => {
      setLoading(true);
      try {
        // CORREÇÃO: Removendo id_pessoa (antigo id_cliente) auto-incremental antes de enviar
        const { id_pessoa, id_cliente, ...dadosParaEnviar } = dadosDoFormulario;

        const response = await fetch('http://localhost:3001/api/pessoas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dadosParaEnviar),
        });

        if (!response.ok) {
          throw new Error(`Erro ao salvar: ${response.status}`);
        }

        const pessoaSalva: any = await response.json();

        setPessoas((prev) => [pessoaSalva, ...prev]);
        atualizarPessoaAtivaCompleta(pessoaSalva);
        setActiveTab('geral');
        setIsModalOpen(false);
      } catch (error) {
        console.error('Erro ao salvar nova pessoa:', error);
        alert('Não foi possível realizar o cadastro.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // =========================
  // ATUALIZAR CADASTRO (PUT)
  // =========================
  const salvarCliente = useCallback(
    (dados: any) => {
      const pessoaAtualizada = {
        ...dados,
        contatos,
        emails,
      };

      setPessoas((prev) =>
        prev.map((p) =>
          // CORREÇÃO: Comparação usando id_pessoa
          p.id_pessoa === dados.id_pessoa ? pessoaAtualizada : p
        )
      );

      atualizarPessoaAtivaCompleta(pessoaAtualizada);
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
          <h3>Pessoas</h3>
          <button className="btn-novo" onClick={handleNovoCliente}>
            +
          </button>
        </div>

        {/* SEARCH */}
        <div className="search-clientes">
          <input
            placeholder="Buscar por nome ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={carregarPessoas} disabled={loading}>
            {loading ? '...' : 'reload'}
          </button>
        </div>

        {/* LISTA */}
        <ul className="lista-clientes">
          {pessoasFiltradas.length === 0 && !loading ? (
            <li className="sem-resultados">Nenhum registro encontrado</li>
          ) : (
            pessoasFiltradas.map((p) => (
              <li
                key={p.id_pessoa} // CORREÇÃO: key apontando para id_pessoa
                className={pessoaAtiva?.id_pessoa === p.id_pessoa ? 'active' : ''} // CORREÇÃO: classe active verificando id_pessoa
                onClick={() => handleSelecionarPessoa(p)}
              >
                <strong>{p.nome_razao}</strong>
                <div>{p.cpf_cnpj}</div>
                <small>
                  {p.cidade || 'Cidade não informada'}
                  {' - '}
                  {p.estado || 'UF'}
                </small>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* MAIN PANEL */}
      <main className="painel-cliente">
        {pessoaAtiva ? (
          <>
            <ClientHeader
              cliente={pessoaAtiva}
              ultimaCompra={ultimaCompra}
              ticketMedio={ticketMedio}
              onAcao={() => {}}
              loading={loading}
            />

            <div className="client-tabs">
              {/* TABS HEADER */}
              <div className="tabs-header">
                {(['geral', 'financeiro', 'historico', 'precos'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* TABS CONTENT */}
              <div className="tabs-content">
                {activeTab === 'geral' && (
                  <GeralTab
                    cliente={pessoaAtiva}
                    contatos={contatos}
                    emails={emails}
                    setContatos={setContatos}
                    setEmails={setEmails}
                    onSave={salvarCliente}
                  />
                )}

                {activeTab === 'financeiro' && (
                  <FinanceiroTab cliente={pessoaAtiva} />
                )}

                {activeTab === 'historico' && (
                  <HistoricoTab cliente={pessoaAtiva} />
                )}

                {activeTab === 'precos' && (
                  <PrecosTab cliente={pessoaAtiva} />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="empty-container">
            <h2>Selecione um registro para visualizar</h2>
          </div>
        )}
      </main>

      {/* MODAL */}
      <ModalNovoCliente
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSalvarNovoClienteDoModal}
      />
    </div>
  );
};

export default Clientes;