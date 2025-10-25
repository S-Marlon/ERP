// src/modules/Obras/ObrasModule.tsx
import React from "react";
// import { Routes, Route } from 'react-router-dom';
import { Link } from "react-router-dom"; // ESSENCIAL para a navegação dos botões de ação
import "./ObrasModule.css";
import PesquisaRapida from "../../components/forms/PesquisaRapida";
import Button from "../../components/ui/Button";
import SearchDashboard from "./Components/SearchDashboard";
import { ObraDetalhes } from "./Components/ObraDetalhes";
import FlexGridContainer from "../../components/Layout/FlexGridContainer/FlexGridContainer";
import Typography from "../../components/ui/Typography";

export const ObrasModule: React.FC = () => {
  return (
    <div>
      {/* (A) PAGE HEADER */}
      <header className="page-header">
        <div className="title-section">
          <Typography variant="h2Alt">{'Módulo Obras" ou "Gerenciamento de Projetos/Obras'}</Typography>
          <div
            className="action-buttons-global"
            style={{ display: "flex", gap: "10px" }}
          >
            {/* Botões de navegação usando Link e estilizados  */}
            <Link to="/clientes/novo">
              <Button variant='primary'>+ Novo Cliente</Button>
            </Link>
            <Link to="/contratos/novo">
              <Button variant='secondary'>+ Novo Contrato</Button>
            </Link>
            <Link to="/pocos/novo">
              <Button variant='outline'>+ Novo relatorio de Poço</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* (B) PAGE CONTENT */}
      <main className="layout-container">

        <FlexGridContainer 
                layout="grid" 
                gap="5px" 
                template="2.5fr 6fr 8fr"
                mobileTemplate="1fr" // No mobile, força 1 coluna
            >
              <PesquisaRapida />
          <SearchDashboard />
          <ObraDetalhes />


                
            </FlexGridContainer>
      </main>
      {/* (C) PAGE FOOTER (Opcional) */}

      <footer className="page-footer"></footer>
    </div>
  );
};
