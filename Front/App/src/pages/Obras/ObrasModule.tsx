// src/modules/Obras/ObrasModule.tsx
import React from 'react';
// import { Routes, Route } from 'react-router-dom';

import './ObrasModule.css';
import PesquisaRapida from '../../components/forms/PesquisaRapida';

import TabsContainer from '../../components/TabsContainer';
import { TabItem } from '../../types/tabs';
import DadosGeraisForm from '../../components/forms/DadosGeraisForm';
import DadosPerfuracaoForm from '../../components/forms/DadosPerfuracaoForm';
import DadosRevestimentoForm from '../../components/forms/DadosPerfuracaoForm';
import ChecklistOcorrenciasForm from '../../components/forms/ChecklistOcorrenciasForm';
import { ObrasLista } from './Components/ObrasLista';
import { ObraFormulario } from './Components/ObraFormulario';
import CadastroCliente from '../../components/forms/CadastroCliente';
import CadastroContrato from '../../components/forms/CadastroContrato';
import RelatorioPoco from '../../components/forms/RelatorioPoco';
import PainelDetalhePoco from './Components/PainelDetalhePoco';
import SearchDashboard from './Components/SearchDashboard';

// Supondo que você tenha os componentes de conteúdo para cada aba
const AbaGeralContent: React.FC = () => <DadosGeraisForm />; // Usando o formulário existente
const AbaAtividadesContent: React.FC = () => <DadosPerfuracaoForm />; // Exemplo de outro formulário
const AbaRegistrosTempoContent: React.FC = () => <DadosRevestimentoForm />; // Exemplo de outro formulário
const AbaLocalizacaoContent: React.FC = () => <ChecklistOcorrenciasForm />; // Exemplo de outro formulário

/**
 * Módulo de Obras
 * Gerencia as rotas /obras, /obras/:id e /obras/novo
 */
export const ObrasModule: React.FC = () => {

  // 1. Estrutura o array de abas usando a interface TabItem
    const obraTabs: TabItem[] = [
        {
            id: 'geral',
            label: 'Geral',
            content: <AbaGeralContent />
        },
        {
            id: 'atividades',
            label: 'Atividades/Tarefas',
            content: <AbaAtividadesContent />
        },
        {
            id: 'registros',
            label: 'Registros de Tempo',
            content: <AbaRegistrosTempoContent />
        },
        {
            id: 'localizacao',
            label: 'Localização',
            content: <AbaLocalizacaoContent />
        },
        {
            id: 'servicos',
            label: 'Serviços Futuros',
            content: <AbaLocalizacaoContent />
        },
        {
            id: 'galeria',
            label: 'galeria',
            content: <AbaLocalizacaoContent />
        },
    ];

    // O restante do seu layout (Sidebar 1fr e Elementos de Controle) estaria aqui.
    // O TabsContainer ocuparia a parte de "Camada B: Navegação (Abas)" e "Camada C: Conteúdo da Aba".


  return (

    <div>
      
      {/* (A) PAGE HEADER */}
      <header className="page-header">
        <div className="title-section">
        
            <h2>{ 'Módulo Obras" ou "Gerenciamento de Projetos/Obras'}</h2>
            <button>+ Nova Obra</button>
          
          
        </div>
        
      </header>
      {/* (B) PAGE CONTENT */}
      <main className="page-content layout-container" >
        <SearchDashboard />
        {/* <PainelDetalhePoco pocoId={''} /> */}
        {/* <ObraFormulario /> */}
       
{/* 
    <aside className="sidebar-fixa">
        
        <PesquisaRapida/>
        <ObrasLista />

    </aside>

    <main className="conteudo-principal">


        <h1>Detalhes da Obra</h1>

        <div className="flex-row" style={{justifyContent:'space-between', alignItems:'center'}}>
        <h2>P001-0825 - João vicente</h2>
        <h2 style={{textAlign:'right', background: 'orange', borderRadius:'8px', padding: '5px' }}>Em Andamento</h2>

        </div>

        <div className="action-buttons-container">

    <button className="action-button edit-button" >
        Editar
    </button>
    <button className="action-button time-log-button">
        Novo Registro de Tempo
    </button>
    <select className="dropdown">
        <option className="action-button dropdown-toggle">
            Ações
        </option>
            <option>Finalizar Obra</option>
            <option>Pausar Obra</option>
            <option>Gerar Relatório</option>
        
    </select>
</div>
        

<TabsContainer tabs={obraTabs} />

    </main>  */}


      </main>
      {/* (C) PAGE FOOTER (Opcional) */}
      
        <footer className="page-footer">
          
        </footer>
      
    </div>



    // <div className='flex-row'>
    //   {/* <div><ObrasLista /></div> */}
    //   <div><ObraFormulario /></div>
    //   {/* <div>
    //    <ObraDetalhes />
    //   </div> */}
    // </div>


    // <Routes>
    //   {/* Rota para a Lista de Obras */}
    //   <Route path="/" element={<ObrasLista />} />
      
    //   {/* Rota para Novo Cadastro de Obra */}
    //   <Route path="/novo" element={<ObraFormulario />} />
      
    //   {/* Rota para Detalhes e Edição da Obra. :id é o parâmetro da URL */}
    //   <Route path=":id" element={<ObraDetalhes />} />
    //   <Route path=":id/editar" element={<ObraFormulario />} /> 
      
    //   {/* Opcional: Rota de fallback caso o módulo seja acessado de forma incorreta */}
    //   <Route path="*" element={<h2>Página de Obras não encontrada</h2>} />
    // </Routes>
  );
};