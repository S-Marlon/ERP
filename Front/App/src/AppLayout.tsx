import { Routes, Route, useLocation } from "react-router-dom";
import { useState } from "react";
import { Layout } from "antd";

// Componentes de Layout
import AppSidebar from './components/Layout/AppSidebar/AppSidebar'
import AppHeader from './components/Layout/AppHeader/AppHeader';
import PDVHeader from './components/Layout/AppHeader/PDVHeader';
import Panel from './components/Layout/AppContent/panel';

// Páginas Principais
import Dashboard from "./pages/Dashboard/Dashboard";
import Clientes from "./pages/Clientes/Clientes";
import Estoque from "./pages/Estoque/Estoque";
import { ObrasModule } from './pages/Obras/ObrasModule';

// Contexts
import { ServiceProductProvider } from './context/NewServiceProductContext';
import { ProductProvider } from './context/NewProductContext';

// Formulários e subpáginas
import CadastroCliente from './components/forms/specific/CadastroCliente/CadastroCliente'; 
import CadastroContrato from './components/forms/specific/CadastroContrato/CadastroContrato';
import RelatorioPoco from './components/forms/specific/CadastroRelatorio/CadastroRelatorio';
import StockAdjustmentForm from './pages/Estoque/pages/StockAdjustment/NotaFiscalManager';
import StockInventory from './pages/Estoque/pages/StockInventory/StockInventory';
import StockLabelingForm from './pages/Estoque/pages/StockLabelingForm/StockLabelingForm';
import { FinalizarVenda } from "./pages/PDV/pages/FinalizarVenda";
import PDVContent from './pages/PDV/PDV';
import HubVendas from './pages/PDV/HubVendas';
import Notas from './pages/Estoque/pages/notas/Notas';
import ProductForm from './pages/ProductForm';
import Fornecedores from "./pages/Fornecedores/Fornecedores";
import ComprasDashboard from "./pages/Compras/ComprasDashboard";
import StockEntryForm from "./pages/Compras/StockEntry/StockEntryForm";
import { CatalogManager } from "./pages/Catalogo/pages/CatalogManager";
import { CategoryManager } from "./pages/Catalogo/pages/CategoryManager/CategoryManager";
import { GlobalAttributeManager } from "./pages/Catalogo/pages/GlobalAttributeManager/GlobalAttributeManager";
import { FamilyManager } from "./pages/Catalogo/pages/FamilyManager/FamilyManager";
import CatalogSku from "./pages/Catalogo/pages/CatalogSkus/CatalogSku";
import FornecedoresList from "./pages/Compras/FornecedoresList/FornecedoresList";
import RelatoriosPage from "./pages/Estoque/Relatorios/Relatorios";
import RelatorioPocoPage from "./pages/Estoque/Relatorios/RelatorioPocoPage";
import { IndustrialLandingPage } from "./pages/Dashboard/IndustrialLandingPage";
import { ParceirosDashboard } from "./pages/Catalogo/Parceiros/ParceirosDashboard";
import FuncionariosPage from "./pages/Catalogo/Parceiros/FuncionariosPage";
import { MarcasPage } from "./pages/Catalogo/pages/MarcasPage";
import Pedidos from "./pages/Clientes/Pedidos";
import ListaComprasExport from "./pages/Compras/ListaComprasExport";
import { LeitorXML } from "./pages/Compras/StockEntry/xml/LeitorXML";
import EmissaoFaturado from "./pages/Compras/EmissaoFaturado";

const { Sider, Header } = Layout;

export default function AppLayout() {
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
    <Layout style={{ minHeight: '100vh', width: '100vw' }}>
      {/* Sidebar estruturada com o Ant Design Sider */}
     <Sider 
        collapsible 
        collapsed={!isSidebarOpen} 
        trigger={null}
        width={200}
        collapsedWidth={80}
        style={{ 
          background: 'linear-gradient(180deg, #9c2e2e 0%, #712626 35%, #1e0d0d 85%, #0f0606 100%)',
          borderRight: 'none' // Remove qualquer borda lateral padrão do Sider
        }}
      >
        <AppSidebar
          isOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar} 
        /> 
      </Sider>
      
      {/* Layout direito contendo Header dinâmico e Conteúdo */}
      <Layout>
        <Header style={{ 
          height: headerHeight, 
          padding: '0px 0px', 
          lineHeight: `${headerHeight}px`, 
          background: isDarkMode ? '#1f1f1f' : '#fff',
          borderBottom: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0' // Borda limpa e sutil opcional no header
        }}>
          {isPDV ? (
            <PDVHeader
              isDarkMode={isDarkMode}
              onThemeToggle={toggleTheme}
            />
          ) : (
            <AppHeader
              title="Sistema ERP"
              headerHeight={headerHeight}
              onThemeToggle={toggleTheme}
              isDarkMode={isDarkMode}
            />
          )}
        </Header>
        
        <Panel isDarkMode={isDarkMode}  
          >
          <Routes>
            <Route path="/" element={<Dashboard text={"Pagina inicial"} />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/parceiros" element={<ParceirosDashboard />} />
            <Route path="/parceiros/fornecedores" element={<FornecedoresList />} />
            <Route path="/parceiros/clientes" element={<Clientes />} />
            <Route path="/parceiros/funcionarios" element={<FuncionariosPage />} />
            <Route path="/clientes/novo" element={<CadastroCliente />} /> 
            <Route path="/contratos/novo" element={<CadastroContrato />} />
            <Route path="/pocos/novo" element={<RelatorioPoco />} />
            <Route path="/vendas" element={<HubVendas />} />
            <Route path="/vendas/pdv" element={<PDVContent />} />
            <Route path="/vendas/pdv/finalizar" element={<FinalizarVenda onBack={() => {}} />} />
            <Route path="/produtos" element={<ProductForm />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/estoque/consulta" element={<StockInventory />} />
            <Route path="/estoque/gerenciamento" element={<StockEntryForm />} />
            <Route path="/estoque/notas" element={<Notas />} />
            <Route path="/estoque/operacoes" element={<StockAdjustmentForm />} />
            <Route path="/estoque/etiquetagem" element={<StockLabelingForm />} />
            <Route path="/catalogo" element={<CatalogManager />} />
            <Route path="/catalogo/familias" element={<FamilyManager />} />
            <Route path="/catalogo/categorias" element={<CategoryManager />} />
            <Route path="/catalogo/atributos" element={<GlobalAttributeManager />} />
            <Route path="/catalogo/gerenciador" element={<CatalogSku />} />
            <Route path="/catalogo/marcas" element={<MarcasPage />} />
            <Route path="/compras" element={<ComprasDashboard />} />
            <Route path="/compras/ListaCompras" element={<ListaComprasExport />} />
            <Route path="/compras/entrada-nfe" element={<StockEntryForm />} />
            <Route path="/compras/fornecedores" element={<FornecedoresList />} />
            <Route path="/compras/Faturamento" element={<EmissaoFaturado/>} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/relatorios/poco" element={<RelatorioPocoPage />} />
            <Route path="/obras" element={<ObrasModule />} />
            <Route path="*" element={<h2>404 | Página Não Encontrada</h2>} />

            <Route path="/compras/xml" element={< LeitorXML/>} />

          </Routes>
        </Panel>
      </Layout>
    </Layout>
  );
}