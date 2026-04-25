import { Routes, Route, useLocation } from "react-router-dom";
import { useState } from "react";


// Componentes de Layout
import AppSidebar from './components/Layout/AppSidebar/AppSidebar'
import AppHeader from './components/Layout/AppHeader/AppHeader';
import PDVHeader from './components/Layout/AppHeader/PDVHeader';
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

import  HubVendas  from './pages/PDV/HubVendas';
import Notas from './pages/Estoque/pages/notas/Notas';
import ProductForm from './pages/ProductForm';

function AppLayout() {
  const location = useLocation();
const isPDV = location.pathname.startsWith("/vendas/pdv");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
    
  const [isDarkMode, setIsDarkMode] = useState(false);
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const headerHeight = 50;

  return (
   <div className={`admin-grid-container ${isSidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <div className="sidebarArea">

      <AppSidebar
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar} 
      /> 
      </div>

      {/* 🔥 AGORA DINÂMICO */}
      {isPDV ? (
  <PDVHeader
    isDarkMode={isDarkMode}
    onThemeToggle={toggleTheme}
    // lastScan={lastScan}
  />
) : (
  <AppHeader
    title="Sistema ERP"
    headerHeight={headerHeight}
    onThemeToggle={toggleTheme}
    isDarkMode={isDarkMode}
  />
)}
      
      <Panel isDarkMode={isDarkMode}>
        <Routes>
          <Route path="/" element={<Dashboard text='Dashboard'/>} />
          <Route path="/clientes" element={<Clientes title={''} children={undefined} />} />
          <Route path="/clientes/novo" element={<CadastroCliente />} />
          <Route path="/contratos/novo" element={<CadastroContrato />} />
          <Route path="/pocos/novo" element={<RelatorioPoco />} />

          <Route path="/vendas" element={<HubVendas />} />
          <Route path="/vendas/pdv" element={<PDVContent/>} />
          <Route path="/vendas/pdv/finalizar" element={<FinalizarVenda onBack={() => {}} />} />

          <Route path="/produtos" element={<ProductForm />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/estoque/consulta" element={<StockInventory/>} />
          <Route path="/estoque/gerenciamento" element={<StockEntryForm/>} />
          <Route path="/estoque/notas" element={<Notas />} />
          <Route path="/estoque/operacoes" element={<StockAdjustmentForm/>} />
          <Route path="/estoque/etiquetagem" element={<StockLabelingForm/>} />

          <Route path="/obras" element={<ObrasModule />} />
          <Route path="*" element={<h2>404 | Página Não Encontrada</h2>} />
        </Routes>
      </Panel>
    </div>
  );
}

export default AppLayout;