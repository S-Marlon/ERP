import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "antd";

// Componentes de Layout
import AppSidebar from './components/Layout/AppSidebar/AppSidebar'
import AppHeader from './components/Layout/AppHeader/AppHeader';
import PDVHeader from './components/Layout/AppHeader/PDVHeader';
import Panel from './components/Layout/AppContent/panel';

// Páginas Principais
import Dashboard from "./pages/Dashboard/Dashboard";
import Estoque from "./pages/Estoque/Estoque";
import { AjudaSuporte, CentralNotificacoes, DadosDaEmpresa, MeuPerfil, PreferenciasSistema } from "./pages/Configuracoes/Configuracoes";
import { ObrasModule } from './pages/Obras/ObrasModule';

// Contexts
import { ServiceProductProvider } from './context/NewServiceProductContext';
import { ProductProvider } from './context/NewProductContext';

// Formulários e subpáginas
import CadastroCliente from './components/forms/specific/CadastroCliente/CadastroCliente'; 
import CadastroContrato from './components/forms/specific/CadastroContrato/CadastroContrato';
import RelatorioPoco from './components/forms/specific/CadastroRelatorio/CadastroRelatorio';
import SaldoEstoque from './pages/Estoque/pages/SaldoEstoque/SaldoEstoque';
import Movimentacoes from './pages/Estoque/pages/Movimentacoes/Movimentacoes';
import Etiquetagem from './pages/Estoque/pages/Etiquetagem/Etiquetagem';
import { FinalizarVenda } from "./pages/PDV/pages/FinalizarVenda";
import PDVContent from './pages/PDV/PDV';
import CentralVendas from './pages/PDV/CentralVendas';
import VendasDoDia from './pages/PDV/pages/VendasDoDia/VendasDoDia';
import CaixasHistorico from './pages/PDV/pages/Caixas/CaixasHistorico';
import RegrasVenda from './pages/PDV/pages/RegrasVenda/RegrasVenda';
import TaxasPagamento from './pages/PDV/pages/TaxasPagamento/TaxasPagamento';
import Orcamentos from './pages/PDV/pages/Orcamentos/Orcamentos';
import { CaixaPaineis } from './pages/PDV/caixa/CaixaPainel';
import { carregarTaxaPreco } from './core/precos/taxaPreco';
import { rotasDosModulos } from './modulos/registroModulos';
import ModulosSistema from './modulos/ModulosSistema';
import { useModulos } from './modulos/modulosStore';
import { Suspense } from 'react';
import NotasEntrada from './pages/Compras/NotasEntrada/NotasEntrada';
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

import { ParceirosDashboard } from "./pages/Parceiros/ParceirosDashboard";
import FuncionariosPage from "./pages/Parceiros/FuncionariosPage";

import { MarcasPage } from "./pages/Catalogo/pages/MarcasManager/MarcasPage";
import PendenciasPim from "./pages/Catalogo/pages/PendenciasPim/PendenciasPim";
import ItensDuplicados from "./pages/Catalogo/pages/ItensDuplicados/ItensDuplicados";
import UnidadesPage from "./pages/Catalogo/pages/Unidades/UnidadesPage";
import Pedidos from "./pages/Clientes/Pedidos";
import ListaComprasExport from "./pages/Compras/ListaComprasExport";
import { LeitorXML } from "./pages/Compras/StockEntry/xml/LeitorXML";
import EmissaoFaturado from "./pages/Compras/EmissaoFaturado";
import { FinanceiroContasReceber } from "./pages/Financeiro/FinanceiroContasReceber";
import { VendasFaturamento } from "./pages/Financeiro/VendasFaturamento";
import Clientes from "./pages/Parceiros/Clientes";
import FamilyManagementPanel from "./pages/Catalogo/pages/FamilyManager/FamilyManagementPanel";
import EcommerceScreen from "./pages/Ecommerce/EcommerceScreen";
import ProductPricingModule from "./pages/Catalogo/pages/ProductPricingModule/ProductPricingModule";
import { StockEntryStagingView } from "./pages/Catalogo/pages/StagingManagement/StockEntryStagingView";

const { Sider, Header } = Layout;

export default function AppLayout() {
  const location = useLocation();
  // Taxa da maquininha embutida no preço: usada pelas contas de preço do catálogo e da entrada de NF
  useEffect(() => { carregarTaxaPreco(); }, []);
  // Módulos plugáveis ligados nesta loja (rotas e menu)
  const { ativos: modulosAtivos } = useModulos();
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
        {/* Painéis do caixa fora do PDV (no PDV ficam no cabeçalho) */}
        {!isPDV && <CaixaPaineis />}
        
        <Panel isDarkMode={isDarkMode}  
          >
          <Routes>
            <Route path="/" element={<Dashboard text={"Pagina inicial"} />} />
            <Route path="/pedidos" element={<Pedidos />} />

            <Route path="/financeiro" element={<FinanceiroContasReceber />} />
            <Route path="/financeiro/faturamento" element={<VendasFaturamento />} />

            <Route path="/parceiros" element={<ParceirosDashboard />} />

            <Route path="/parceiros/fornecedores" element={<FornecedoresList />} />
            <Route path="/parceiros/clientes" element={<Clientes />} />
            <Route path="/parceiros/funcionarios" element={<FuncionariosPage />} />

            <Route path="/clientes/novo" element={<CadastroCliente />} /> 
            <Route path="/contratos/novo" element={<CadastroContrato />} />
            <Route path="/pocos/novo" element={<RelatorioPoco />} />
            <Route path="/vendas" element={<CentralVendas />} />
            <Route path="/vendas/pdv" element={<PDVContent />} />
            <Route path="/vendas/do-dia" element={<VendasDoDia />} />
            <Route path="/vendas/caixas" element={<CaixasHistorico />} />
            <Route path="/vendas/regras" element={<RegrasVenda />} />
            <Route path="/vendas/taxas" element={<TaxasPagamento />} />
            <Route path="/vendas/orcamentos" element={<Orcamentos />} />
            <Route path="/vendas/pdv/finalizar" element={<FinalizarVenda onBack={() => {}} />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/estoque/consulta" element={<SaldoEstoque />} />
            <Route path="/estoque/gerenciamento" element={<StockEntryForm />} />
            {/* Notas de entrada agora ficam em Compras (endereço antigo redireciona) */}
            <Route path="/estoque/notas" element={<Navigate to="/compras/notas" replace />} />
            <Route path="/compras/notas" element={<NotasEntrada />} />
            <Route path="/estoque/operacoes" element={<Movimentacoes />} />
            <Route path="/estoque/etiquetagem" element={<Etiquetagem />} />
            <Route path="/catalogo" element={<CatalogManager />} />
            <Route path="/configuracoes/perfil" element={<MeuPerfil />} />
            <Route path="/configuracoes/empresa" element={<DadosDaEmpresa />} />
            <Route path="/configuracoes/preferencias" element={<PreferenciasSistema />} />
            <Route path="/configuracoes/notificacoes" element={<CentralNotificacoes />} />
            <Route path="/configuracoes/modulos" element={<ModulosSistema />} />
            {rotasDosModulos(modulosAtivos).map(r => (
              <Route key={r.path} path={r.path} element={<Suspense fallback={null}>{r.element}</Suspense>} />
            ))}
            <Route path="/ajuda" element={<AjudaSuporte />} />
            <Route path="/catalogo/familias" element={<FamilyManager />} />
            <Route path="/catalogo/familias/test" element={<FamilyManagementPanel />} />
            <Route path="/catalogo/categorias" element={<CategoryManager />} />
            <Route path="/catalogo/atributos" element={<GlobalAttributeManager />} />
            <Route path="/catalogo/gerenciador" element={<CatalogSku />} />
            <Route path="/catalogo/marcas" element={<MarcasPage />} />
            <Route path="/catalogo/unidades" element={<UnidadesPage />} />
            <Route path="/catalogo/pendencias" element={<PendenciasPim />} />
            <Route path="/catalogo/duplicados" element={<ItensDuplicados />} />
            <Route path="/catalogo/preco" element={<ProductPricingModule/>} />
            <Route path="/compras" element={<ComprasDashboard />} />
            <Route path="/compras/ListaCompras" element={<ListaComprasExport />} />
            <Route path="/compras/entrada-nfe" element={<StockEntryForm />} />
            <Route path="/compras/fornecedores" element={<FornecedoresList />} />
            <Route path="/compras/Faturamento" element={<EmissaoFaturado/>} />
            <Route path="/relatorios" element={<RelatoriosPage />} />
            <Route path="/relatorios/poco" element={<RelatorioPocoPage />} />
            <Route path="/obras" element={<ObrasModule />} />

            <Route path="/stagings" element={<StockEntryStagingView/>} />

            

          <Route path="/ecommerce" element={<EcommerceScreen />} />

            <Route path="*" element={<h2>404 | Página Não Encontrada</h2>} />


            <Route path="/compras/xml" element={< LeitorXML/>} />

          </Routes>
        </Panel>
      </Layout>
    </Layout>
  );
}