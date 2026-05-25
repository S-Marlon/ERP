import React, { useEffect, useMemo, useState, useCallback } from 'react';
// import './Clientes.css';

// import { ClientHeader } from './components/ClientHeader';

// import GeralTab from './components/tabs/GeralTab';
// import FinanceiroTab from './components/tabs/FinanceiroTab';
// import HistoricoTab from './components/tabs/HistoricoTab';
// import PrecosTab from './components/tabs/PrecosTab';


import {
  ClassificacaoCliente,
  PotencialCliente,
  SegmentoCliente,
  StatusCliente,
  StatusCredito,
  TipoCliente,
  type Cliente,
} from '../../types/cliente.types';

type TabType =
  | 'geral'
  | 'financeiro'
  | 'historico'
  | 'precos';

// =========================================================
// MOCK
// =========================================================

const MOCK_CLIENTES: Cliente[] = [
  {
    id_cliente: 1,

    // Tipo
    tipo_cliente: TipoCliente.PESSOA_FISICA,

    // CRM
    segmento: SegmentoCliente.PRESTADOR_SERVICO,
    classificacao: ClassificacaoCliente.B,
    potencial: PotencialCliente.MEDIO,

    // Dados principais
    nome_razao: 'João Carlos da Silva',
    cpf_cnpj: '123.456.789-00',

    // Contato
    telefone_principal: '(11) 99999-1111',
    whatsapp: '(11) 99999-1111',

    // Endereço
    endereco: {
      logradouro: 'Rua das Palmeiras',
      numero: '120',
      complemento: 'Apto 32',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000',
      pais: 'Brasil',
    },

    // Crédito
    limite_credito: 5000,
    dia_vencimento: 10,
    status_credito: StatusCredito.LIBERADO,

    // Financeiro
    saldo_devedor_atual: 1250,
    dias_atraso: 0,
    score_credito: 820,
    score_comercial: 740,

    // Status
    status_cliente: StatusCliente.ATIVO,

    // Compras
    ultima_compra: '2026-05-01T10:30:00Z',

    // Marketing
    aceita_marketing: true,
    consentimento_dados_em: '2025-10-10T09:00:00Z',

    // Auditoria
    criado_em: '2025-01-05T12:00:00Z',
    atualizado_em: '2026-05-01T12:00:00Z',
  },

  {
    id_cliente: 2,

    // Tipo
    tipo_cliente: TipoCliente.PESSOA_JURIDICA,

    // CRM
    segmento: SegmentoCliente.OFICINA,
    classificacao: ClassificacaoCliente.A,
    potencial: PotencialCliente.ESTRATEGICO,

    // Dados principais
    nome_razao: 'Auto Center Prime LTDA',
    nome_fantasia: 'Auto Center Prime',

    cpf_cnpj: '12.345.678/0001-99',

    inscricao_estadual: '123.456.789.000',
    inscricao_municipal: '99887766',

    // Contato
    telefone_principal: '(11) 4002-8922',
    whatsapp: '(11) 98888-2222',

    // Endereço
    endereco: {
      logradouro: 'Avenida dos Mecânicos',
      numero: '1500',
      bairro: 'Distrito Industrial',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01310-200',
      pais: 'Brasil',
    },

    // Crédito
    limite_credito: 30000,
    dia_vencimento: 15,
    status_credito: StatusCredito.LIBERADO,

    // Financeiro
    saldo_devedor_atual: 8400,
    dias_atraso: 2,
    score_credito: 690,
    score_comercial: 920,

    // Status
    status_cliente: StatusCliente.ATIVO,

    // Compras
    ultima_compra: '2026-05-03T15:45:00Z',

    // Marketing
    aceita_marketing: true,
    consentimento_dados_em: '2024-07-15T08:00:00Z',

    // Auditoria
    criado_em: '2024-07-15T08:00:00Z',
    atualizado_em: '2026-05-03T16:00:00Z',
  },
];

// =========================================================

const Fornecedores = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('geral');

  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ultimaCompra, setUltimaCompra] = useState<Date | undefined>();
  const [ticketMedio, setTicketMedio] = useState<number | undefined>();

  const [contatos, setContatos] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);

  useEffect(() => {
    setClientes(MOCK_CLIENTES);
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return clientes.filter((c) =>
      c.nome_razao.toLowerCase().includes(q) ||
      c.cpf_cnpj.toLowerCase().includes(q) ||
      (c.endereco?.cidade || '').toLowerCase().includes(q)
    );
  }, [clientes, searchTerm]);

  const handleSelecionarCliente = useCallback((c: Cliente) => {
    setCliente(c);
    setActiveTab('geral');

    setUltimaCompra(new Date());
    setTicketMedio(320);
  }, []);

 const handleNovoCliente = useCallback(() => {
  const novo: Cliente = {
    id_cliente: Date.now(),

    tipo_cliente: TipoCliente.PESSOA_FISICA,

    segmento: SegmentoCliente.CONSUMIDOR_FINAL,

    classificacao: ClassificacaoCliente.C,
    potencial: PotencialCliente.BAIXO,

    nome_razao: 'Novo Cliente',
    cpf_cnpj: '',

    telefone_principal: '',
    whatsapp: '',

    endereco: {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      pais: 'Brasil',
    },

    limite_credito: 0,
    dia_vencimento: 10,

    status_credito: StatusCredito.LIBERADO,
    status_cliente: StatusCliente.ATIVO,

    saldo_devedor_atual: 0,

    score_credito: 0,
    score_comercial: 0,

    aceita_marketing: false,

    criado_em: new Date().toISOString(),
  };

  setClientes((prev) => [novo, ...prev]);
  setCliente(novo);

  setActiveTab('geral');
}, []);

  const salvarCliente = useCallback((dados: Cliente) => {
    setClientes((prev) =>
      prev.map((c) =>
        c.id_cliente === dados.id_cliente ? dados : c
      )
    );
    setCliente(dados);
  }, []);

  return (
    <div className="container-clientes">

      {/* SIDEBAR */}
      <aside className="sidebar-clientes">
        <div className="sidebar-header">
          <h3>Clientes</h3>
          <button className="btn-novo" onClick={handleNovoCliente}>+</button>
        </div>

        <div className="search-clientes">
          <input
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <ul className="lista-clientes">
          {clientesFiltrados.map((c) => (
            <li
              key={c.id_cliente}
              className={cliente?.id_cliente === c.id_cliente ? 'active' : ''}
              onClick={() => handleSelecionarCliente(c)}
            >
              <strong>{c.nome_razao}</strong>
              <div>{c.cpf_cnpj}</div>
              <small>
  {c.endereco.cidade} - {c.endereco.estado}
</small>
            </li>
          ))}
        </ul>
      </aside>

      {/* MAIN */}
      <main className="painel-cliente">

        {cliente ? (
          <>
            {/* <ClientHeader
              cliente={cliente}
              ultimaCompra={ultimaCompra}
              ticketMedio={ticketMedio}
              onAcao={() => {}}
              loading={loading}
            /> */}

            <div className="client-tabs">

              {/* TABS */}
              <div className="tabs-header">
                {(['geral','financeiro','historico','precos'] as TabType[]).map(tab => (
                  <button
                    key={tab}
                    className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* CONTENT */}
              <div className="tabs-content">

                {/* {activeTab === 'geral' && (
                  <GeralTab
                    cliente={cliente}
                    contatos={contatos}
                    emails={emails}
                    setContatos={setContatos}
                    setEmails={setEmails}
                    onSave={salvarCliente}
                  />
                )}

                {activeTab === 'financeiro' && (
                  <FinanceiroTab cliente={cliente} />
                )}

                {activeTab === 'historico' && (
                  <HistoricoTab cliente={cliente} />
                )}

                {activeTab === 'precos' && (
                  <PrecosTab cliente={cliente} />
                )} */}

              </div>
            </div>
          </>
        ) : (
          <div className="empty-container">
            <h2>Selecione um cliente</h2>
          </div>
        )}

      </main>
    </div>
  );
};

export default Fornecedores;  