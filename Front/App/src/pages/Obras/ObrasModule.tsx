// src/modules/Obras/ObrasModule.tsx
import React from "react";
// import { Routes, Route } from 'react-router-dom';
import { Link } from "react-router-dom"; // ESSENCIAL para a navegação dos botões de ação
import "./ObrasModule.css";
import PesquisaRapida from "../../components/forms/PesquisaRapida";
import SearchDashboard from "./Components/SearchDashboard";
import { ObraDetalhes } from "./Components/ObraDetalhes";

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
