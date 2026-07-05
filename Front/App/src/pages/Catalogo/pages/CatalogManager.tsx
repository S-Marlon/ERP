import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FolderOutlined, 
  ClusterOutlined, 
  SettingOutlined, 
  ArrowRightOutlined,
  AppstoreOutlined,
  LockOutlined,
  BarChartOutlined,
  BarcodeOutlined,
  SyncOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import './CatalogManager.css';

export const CatalogManager: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isRootPath = location.pathname === '/catalogo';

  // ⚡ Módulos Ativos do Sistema
  const modulosOperacionais = [
    {
      titulo: 'Famílias de Itens',
      descricao: 'Estruturas de engenharia mestre, herança de atributos e templates de SKU por tipo de item.',
      rota: '/catalogo/familias',
      icone: <ClusterOutlined />,
      status: 'PRONTO',
      detalhes: 'Tabelas: comercial_familias'
    },
    {
      titulo: 'Árvore de Categorias',
      descricao: 'Taxonomia mercadológica do ERP, regras de margem sugerida e herança de subníveis.',
      rota: '/catalogo/categorias',
      icone: <FolderOutlined />,
      status: 'PRONTO',
      detalhes: 'Tabelas: comercial_categorias'
    },
    {
      titulo: 'Pool de Atributos Globais',
      descricao: 'Dicionário central de especificações técnicas, escopos (DNA, Grade, Ficha) e unidades.',
      rota: '/catalogo/atributos',
      icone: <SettingOutlined />,
      status: 'PRONTO',
      detalhes: 'Tabelas: atributos_comercial'
    }
  ];

  // 🔒 Funcionalidades Futuras Bloqueadas (Roadmap da Engenharia do ERP)
  const modulosFuturos = [
    {
      titulo: 'Gerador de Grade & Matriz de Variantes',
      descricao: 'Criação automatizada e em lote de SKUs baseada nos cruzamentos das especificações de Grade.',
      icone: <BarcodeOutlined />,
      tag: 'BACKLOG V3'
    },
    {
      titulo: 'Motor de Sincronização Omnichannel',
      descricao: 'Esteira de publicação e mapeamento automático de atributos para e-commerces (VTEX, Mercado Livre, Shopify).',
      icone: <SyncOutlined />,
      tag: 'PLANEJADO'
    },
    {
      titulo: 'Ficha de Homologação & Qualidade',
      descricao: 'Workflow de aprovação técnica de novos itens cadastrados antes da liberação para vendas.',
      icone: <SafetyCertificateOutlined />,
      tag: 'ESTUDO'
    },
    {
      titulo: 'BI de Curva ABC por Atributos',
      descricao: 'Inteligência de dados mapeando qual variação de cor, tamanho ou potência gera mais receita.',
      icone: <BarChartOutlined />,
      tag: 'REQUISITO'
    }
  ];

  if (!isRootPath) {
    return (
      <div className="catalog-internal-wrapper">
        <h2>Gerenciador Ativo</h2>
        <button onClick={() => navigate('/catalogo')}>← Voltar para o Painel Central</button>
      </div>
    );
  }

  return (
    <div className="catalog-erp-dashboard">
      
      {/* 🖥️ Topbar Técnico */}
      <header className="erp-topbar">
        <div className="topbar-left">
          <AppstoreOutlined className="topbar-main-icon" />
          <div>
            <h1>Módulo de Engenharia e Catálogo</h1>
            <span className="erp-subtext">Console de Configuração e Governança de Dados Mestres</span>
          </div>
        </div>
        <div className="topbar-right">
          <div className="sys-status">
            <span className="status-indicator online"></span>
            <span className="status-text">AMBIENTE: PRODUÇÃO / TENANT_ID: MUTÁVEL</span>
          </div>
        </div>
      </header>

      <div className="erp-dashboard-layout">
        
        {/* 📊 LADO ESQUERDO: Painel Operacional Principal */}
        <section className="erp-main-panel">
          <div className="panel-header">
            <h2>Módulos de Configuração Ativa</h2>
            <p>Selecione uma partição do banco de dados para manutenção de regras.</p>
          </div>

          <div className="erp-table-list">
            {modulosOperacionais.map((mod, i) => (
              <div key={i} className="erp-row-card" onClick={() => navigate(mod.rota)}>
                <div className="row-icon-box">{mod.icone}</div>
                <div className="row-info">
                  <div className="row-title-line">
                    <h3>{mod.titulo}</h3>
                    <span className="badge-status-pronto">{mod.status}</span>
                  </div>
                  <p className="row-desc">{mod.descricao}</p>
                  <span className="row-tech-details">{mod.detalhes}</span>
                </div>
                <div className="row-action">
                  <ArrowRightOutlined />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 🚧 LADO DIREITO: Barramento de Funcionalidades Futuras (Pipeline) */}
        <aside className="erp-roadmap-sidebar">
          <div className="panel-header">
            <h2>Roadmap do Catálogo (Pipeline)</h2>
            <p>Funcionalidades estruturais em fase de desenho técnico.</p>
          </div>

          <div className="roadmap-grid">
            {modulosFuturos.map((fut, i) => (
              <div key={i} className="roadmap-card-locked">
                <div className="locked-overlay">
                  <LockOutlined className="lock-icon" />
                  <span className="lock-text">Módulo Travado</span>
                </div>
                <div className="roadmap-header">
                  <span className="roadmap-icon">{fut.icone}</span>
                  <span className="roadmap-tag">{fut.tag}</span>
                </div>
                <h3>{fut.titulo}</h3>
                <p>{fut.descricao}</p>
              </div>
            ))}
          </div>
        </aside>

      </div>
    </div>
  );
};

export default CatalogManager;