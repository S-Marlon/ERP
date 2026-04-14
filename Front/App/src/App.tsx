import './App.css'
import './forms.css'
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Componentes de Layout
import Sidebar from './components/Layout/AppSidebar/sidebar'
import Header from './components/Layout/AppHeader/header';
import Panel from './components/Layout/AppContent/panel';

// Páginas Principais
import Dashboard from "./pages/Dashboard/Dashboard";
import Clientes from "./pages/Clientes/Clientes";
import Produtos from "./pages/Produtos/Produtos";
import Vendas from "./pages/PDV/PDVScreen";
import Estoque from "./pages/Estoque/Estoque";
import { ObrasModule } from './pages/Obras/ObrasModule';

// Contexts
import { ServiceProductProvider } from './context/NewServiceProductContext';
import { ProductProvider } from './context/NewProductContext';

// 🆕 NOVAS IMPORTAÇÕES DE FORMULÁRIOS
// (Ajuste os caminhos conforme sua estrutura real, se necessário)
import CadastroCliente from './components/forms/specific/CadastroCliente/CadastroCliente'; 
import CadastroContrato from './components/forms/specific/CadastroContrato/CadastroContrato';
import RelatorioPoco from './components/forms/specific/CadastroRelatorio/CadastroRelatorio'; // Usado para "Novo Poço"
import StockEntryForm from './pages/Estoque/pages/StockEntry/StockEntryForm';
import StockAdjustmentForm from './pages/Estoque/pages/StockAdjustment/StockAdjustmentForm';
import StockInventory from './pages/Estoque/pages/StockInventory/StockInventory';
import StockLabelingForm from './pages/Estoque/pages/StockLabelingForm/StockLabelingForm';
import { FinalizarVenda} from "./pages/PDV/pages/FinalizarVenda";
import PDVContent from './pages/PDV/PDV';

import { HubVendas } from './pages/PDV/HubVendas';
import Notas from './pages/Estoque/pages/notas/Notas';
import ProductForm from './pages/ProductForm';

function App() {






  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
    
  const [isDarkMode, setIsDarkMode] = useState(false);
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Você pode salvar a preferência do usuário no localStorage aqui, se quiser
  };

  const sidebarWidth = isSidebarOpen ? 170 : 90;
  const headerHeight = 50;

  return (
    <>

    
    <BrowserRouter>
      <div className="admin-grid-container" style={{
        gridTemplateColumns: `${sidebarWidth}px`,
        gridTemplateRows: `${headerHeight}px`,
      }}>
        
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} sidebarWidth={sidebarWidth}/> 
        <Header title="Sistema ERP" headerHeight={headerHeight} onThemeToggle={toggleTheme} 
        isDarkMode={isDarkMode} />
        
        <Panel isDarkMode={isDarkMode}>
            
            <Routes>
              <Route path="/" element={<Dashboard text='Dashboard'/>} />
              
              {/* Rota principal de Clientes (Lista/Dashboard) */}
              <Route path="/clientes" element={<Clientes title={''} children={undefined} />} />
              
              {/* 🆕 ROTA: NOVO CLIENTE */}
              <Route 
                path="/clientes/novo" 
                element={<CadastroCliente />} 
              />
              
              {/* 🆕 ROTA: NOVO CONTRATO */}
              {/* Nota: Se '/contratos' for uma página principal, adicione-a também! */}
              <Route 
                path="/contratos/novo" 
                element={<CadastroContrato />} 
              />

              {/* 🆕 ROTA: NOVO POÇO */}
              <Route 
                path="/pocos/novo" 
                element={<RelatorioPoco />} // Usando o RelatorioPoco como o formulário de cadastro de novo poço
              />

              {/* Rota de Vendas/PDV envolvida pelos Contexts */}
              {/* <Route 
                  path="/vendas" 
                  element={
                      <ServiceProductProvider>
                          <ProductProvider>
                              <Vendas/> 
                          </ProductProvider>
                      </ServiceProductProvider>
                  } 
              /> */}




              <Route path="/vendas" element={<HubVendas />} />
              <Route path="/vendas/pdv" element={<PDVContent/>} />
              <Route path="/vendas/pdv/finalizar" element={ <FinalizarVenda  onBack={() => {}}/>  } />


              <Route path="/produtos" element={<ProductForm />} />
              <Route path="/Estoque" element={<Estoque />} />
              <Route path="/Estoque/consulta" element={<StockInventory/>} />
              <Route path="/Estoque/gerenciamento" element={<StockEntryForm/>} />
              <Route path="/Estoque/notas" element={<Notas />} />
              <Route path="/Estoque/operacoes" element={<StockAdjustmentForm/>} />
              <Route path="/Estoque/etiquetagem" element={<StockLabelingForm/>} />

              
              {/* Rota principal do Módulo Obras */}
              <Route path="/obras" element={<ObrasModule />} />

              {/* Rota de fallback para qualquer caminho não encontrado */}
              <Route path="*" element={<h2>404 | Página Não Encontrada</h2>} />

            </Routes>
        
        </Panel>
      </div>
      </BrowserRouter>
    </>
  )
}

export default App