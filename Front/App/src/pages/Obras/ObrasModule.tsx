// src/modules/Obras/ObrasModule.tsx
import React, { useState } from "react";
// import { Routes, Route } from 'react-router-dom';
import { Link } from "react-router-dom"; // ESSENCIAL para a navegação dos botões de ação
import "./ObrasModule.css";
import PesquisaRapida from "../../components/forms/PesquisaRapida";
import Button from "../../components/ui/Button";
import SearchDashboard from "./Components/SearchDashboard";
import { ObraDetalhes } from "./Components/ObraDetalhes";
import FlexGridContainer from "../../components/Layout/FlexGridContainer/FlexGridContainer";
import Typography from "../../components/ui/Typography";
import BuscaCliente from "../../components/forms/CadastroContrato/BuscaCliente";
import ClienteSelect, { Cliente } from '../../components/forms/CadastroContrato/BuscaCliente';


export const ObrasModule: React.FC = () => {
    const [filterType, setFilterType] = useState<'Todos' | 'Cliente' | 'Contrato' | 'Poço'>('Todos');
  
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
      // Você pode usar este estado para simular um loading externo se precisar
      const [isSaving, setIsSaving] = useState(false); 
  
      const handleClienteChange = (cliente: Cliente | null) => {
          setClienteSelecionado(cliente);
          console.log('Cliente selecionado mudou:', cliente);
      };

  const handleFilterChange = (tipo: 'Todos' | 'Cliente' | 'Contrato' | 'Poço') => setFilterType(tipo);
type FiltroTipo = 'Todos' | 'Cliente' | 'Contrato' | 'Poço';

  return (
    <div>
      {/* (A) PAGE HEADER */}
      <header className="page-header">
        <div className="title-section">
          <Typography variant="h1">{'Módulo Obras" ou "Gerenciamento de Projetos/Obras'}</Typography>
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
                template="3fr 3fr 8fr 2fr"
                mobileTemplate="1fr" // No mobile, força 1 coluna
            >
              <div>
                {['Todos', 'Cliente', 'Contrato', 'Poço'].map((tipo) => (
                 <Button
                  key={tipo}
                  // TypeScript: Forçamos o tipo para garantir que a comparação funcione
                  variant={filterType === tipo ? "primary" : "outline"}
                  style={{ marginLeft: 8 }}
                  onClick={() => handleFilterChange(tipo as FiltroTipo)}
                >
                  {tipo}
                </Button>

              ))}


              <ClienteSelect
                clienteSelecionado={clienteSelecionado}
                onClienteSelecionadoChange={handleClienteChange}
                // Passando o estado de loading externo
                isLoading={isSaving} 
            />
              </div>
          <SearchDashboard />
          <ObraDetalhes />

          <div>
            <Button variant="outline">➕ Novo Registro de Tempo</Button>

                            {/* AÇÕES DE EDIÇÃO/REGISTRO */}
                            <Button type="button" variant="outline" >
                                📝 Editar Dados Gerais do Poço {/* Mantém a edição de dados gerais acessível */}
                            </Button>
                            <Button type="button" variant="primary">
                                📋 Gerar Relatório Completo (PDF) {/* Destaque o botão principal de saída */}
                            </Button>
                            <Button type="button" variant="outline">
                                🖨️ Imprimir Relatório do Poço
                            </Button>
                            <Button type="button" variant="outline">
                                📤 Compartilhar Relatório do Poço
                            </Button>
                             <Button type="button" variant="outline">
                                ⚙️ Configurações Avançadas do Relatório
                            </Button>
          </div>


                
            </FlexGridContainer>
      </main>
      {/* (C) PAGE FOOTER (Opcional) */}

      <footer className="page-footer"></footer>
    </div>
  );
};
