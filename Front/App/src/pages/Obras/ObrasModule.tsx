// src/modules/Obras/ObrasModule.tsx
import React from 'react';
// import { Routes, Route } from 'react-router-dom';
import { Link } from 'react-router-dom'; // ESSENCIAL para a navegação dos botões de ação

import './ObrasModule.css';
import PesquisaRapida from '../../components/forms/PesquisaRapida';

import TabsContainer from '../../components/ui/TabsContainer';
import { TabItem } from '../../types/tabs';
import DadosGeraisForm from '../../components/forms/-DadosGeraisForm';
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
import { ObraDetalhes } from './Components/ObraDetalhes';

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
             <div className="action-buttons-global" style={{ display: 'flex', gap: '10px' }}>
                    {/* Botões de navegação usando Link e estilizados  */}
                    <Link to="/clientes/novo" ><button>+ Novo Cliente</button></Link>
                    <Link to="/contratos/novo" ><button>+ Novo Contrato</button></Link>
                    <Link to="/pocos/novo" ><button>+ Novo Poço</button></Link> 
                </div> 
          
          
        </div>
        
      </header>
      {/* (B) PAGE CONTENT */}
      <main className="page-content layout-container" >

       
        {/* <PainelDetalhePoco pocoId={''} /> */}
        {/* <ObraFormulario /> */}
       

    <aside className="sidebar-fixa">
        
        <PesquisaRapida/>

         {/* Filtros Laterais (Intuitivos) */}
        

    </aside>

    <main className="conteudo-principal">

      <SearchDashboard />


        {/* <ObrasLista /> */}
       

    </main> 

    <div>
      
<ObraDetalhes/>
    </div>


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