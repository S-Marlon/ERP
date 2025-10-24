// src/modules/Obras/ObrasModule.tsx
import React from "react";
// import { Routes, Route } from 'react-router-dom';
import { Link } from "react-router-dom"; // ESSENCIAL para a navegação dos botões de ação
import "./ObrasModule.css";
import PesquisaRapida from "../../components/forms/PesquisaRapida";
import SearchDashboard from "./Components/SearchDashboard";
import { ObraDetalhes } from "./Components/ObraDetalhes";
import FlexGridContainer from "../../components/Layout/FlexGridContainer/FlexGridContainer";

export const ObrasModule: React.FC = () => {
  return (
    <div>
      {/* (A) PAGE HEADER */}
      <header className="page-header">
        <div className="title-section">
          <h2>{'Módulo Obras" ou "Gerenciamento de Projetos/Obras'}</h2>
          <div
            className="action-buttons-global"
            style={{ display: "flex", gap: "10px" }}
          >
            {/* Botões de navegação usando Link e estilizados  */}
            <Link to="/clientes/novo">
              <button>+ Novo Cliente</button>
            </Link>
            <Link to="/contratos/novo">
              <button>+ Novo Contrato</button>
            </Link>
            <Link to="/pocos/novo">
              <button>+ Novo relatorio de Poço</button>
            </Link>
          </div>
        </div>
      </header>

      {/* (B) PAGE CONTENT */}
      <main className="layout-container">

        <FlexGridContainer 
                layout="grid" 
                gap="20px" 
                template="1fr 2fr 1fr"
                mobileTemplate="1fr" // No mobile, força 1 coluna
            >
                <div style={{ backgroundColor: '#f0f0f0', padding: '10px' }}>Item A</div>
                <div style={{ backgroundColor: '#e0e0e0', padding: '10px' }}>Item B (Maior)</div>
                <div style={{ backgroundColor: '#d0d0d0', padding: '10px' }}>Item C</div>
            </FlexGridContainer>
        {/* <PainelDetalhePoco pocoId={''} /> */}
        {/* <ObraFormulario /> */}

        <aside className="sidebar-fixa">
          <PesquisaRapida />

          {/* Filtros Laterais (Intuitivos) */}
        </aside>

        <main className="conteudo-principal">
          <SearchDashboard />

          {/* <ObrasLista /> */}
        </main>

        <div>
          <ObraDetalhes />
        </div>
      </main>
      {/* (C) PAGE FOOTER (Opcional) */}

      <footer className="page-footer"></footer>
    </div>
  );
};
