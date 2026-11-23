import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Layout } from "antd";

// Componentes de Layout
import AppSidebar from './layout/AppSidebar/AppSidebar'
import AppHeader from './layout/AppHeader/AppHeader';
import PDVHeader from './layout/AppHeader/PDVHeader';
import Panel from './layout/AppContent/panel';

// Páginas Principais
import CentralDoDia from "../areas/inicio/CentralDoDia";
import Estoque from "../areas/estoque/Estoque";
import { AjudaSuporte, CentralNotificacoes, DadosDaEmpresa, MeuPerfil, PreferenciasSistema } from "../areas/configuracoes/Configuracoes";

// Contexts

// Formulários e subpáginas
import SaldoEstoque from '../areas/estoque/saldo/SaldoEstoque';
import Movimentacoes from '../areas/estoque/movimentacoes/Movimentacoes';
import Etiquetagem from '../areas/estoque/etiquetagem/Etiquetagem';
import InventarioRotativo from '../areas/estoque/inventario/InventarioRotativo';
import CurvaAbc from '../areas/estoque/curvaAbc/CurvaAbcPagina';
import OndeFocar from '../areas/estoque/curvaAbc/OndeFocarPagina';
import Equivalencias from '../areas/estoque/curvaAbc/EquivalenciasPagina';
import FundosReposicao from '../areas/financeiro/reservas/FundosReposicao';
import PDVContent from '../areas/vendas/pdv/PDV';
import CentralVendas from '../areas/vendas/painel/CentralVendas';
import VendasDoDia from '../areas/vendas/vendasDoDia/VendasDoDia';
import CaixasHistorico from '../areas/vendas/caixa/historico/CaixasHistorico';
import RegrasVenda from '../areas/vendas/regras/RegrasVenda';
import TaxasPagamento from '../areas/vendas/taxas/taxasPagamento/TaxasPagamento';
import Orcamentos from '../areas/vendas/orcamentos/Orcamentos';
import PedidosFaturados from '../areas/vendas/pedidos/PedidosFaturados';
import NotasFiscais from '../areas/fiscal/notasSaida/NotasFiscais';
import { CaixaPaineis } from '../areas/vendas/caixa/CaixaPainel';
import { carregarTaxaPreco } from '../shared/core/precos/taxaPreco';
import { rotasDosModulos } from '../modulos/registroModulos';
import ModulosSistema from '../modulos/ModulosSistema';
import { useModulos } from '../modulos/modulosStore';
import { Suspense } from 'react';
import NotasEntrada from '../areas/compras/notasEntrada/NotasEntrada';
import ComprasDashboard from "../areas/compras/ComprasDashboard";
import CompraInteligente from "../areas/compras/inteligente/CompraInteligente";
import StockEntryForm from "../areas/compras/entradaNf/StockEntryForm";
import { CatalogManager } from "../areas/catalogo/CatalogManager";
import { CategoryManager } from "../areas/catalogo/categorias/CategoryManager";
import { GlobalAttributeManager } from "../areas/catalogo/atributos/GlobalAttributeManager";


import { FamilyManager } from "../areas/catalogo/familias/FamilyManager";


import CatalogSku from "../areas/catalogo/skus/CatalogSku";
import FornecedoresList from "../areas/parceiros/fornecedores/FornecedoresList";
import RelatoriosPage from "../areas/estoque/relatorios/Relatorios";

import { ParceirosDashboard } from "../areas/parceiros/ParceirosDashboard";
import FuncionariosPage from "../areas/parceiros/FuncionariosPage";

import { MarcasPage } from "../areas/catalogo/marcas/MarcasPage";
import TagsCatalogo from "../areas/catalogo/tags/TagsCatalogo";
import LogisticaLote from "../areas/catalogo/logistica/LogisticaLote";
import PendenciasPim from "../areas/catalogo/pendencias/PendenciasPim";
import ItensDuplicados from "../areas/catalogo/duplicados/ItensDuplicados";
import UnidadesPage from "../areas/catalogo/unidades/UnidadesPage";
import KitsPage from "../areas/catalogo/kits/KitsPage";
import Pedidos from "../areas/clientes/Pedidos";
import ListaComprasExport from "../areas/compras/ListaComprasExport";
import { LeitorXML } from "../areas/compras/entradaNf/xml/LeitorXML";
import EmissaoFaturado from "../areas/compras/EmissaoFaturado";
import { FinanceiroContasReceber } from "../areas/financeiro/FinanceiroContasReceber";
import FinanceiroContasPagar from "../areas/financeiro/pagar/FinanceiroContasPagar";
import { VendasFaturamento } from "../areas/financeiro/VendasFaturamento";
import PainelFinanceiro from "../areas/financeiro/painel/PainelFinanceiro";
import ContasFixas from "../areas/financeiro/pagar/ContasFixas";
import ResultadoMes from "../areas/financeiro/resultado/ResultadoMes";
import Clientes from "../areas/parceiros/Clientes";
import FamilyManagementPanel from "../areas/catalogo/familias/FamilyManagementPanel";
import ProductPricingModule from "../areas/catalogo/precos/ProductPricingModule";
import VarejoAtacadoLote from "../areas/catalogo/precos/VarejoAtacadoLote";
import { StockEntryStagingView } from "../areas/catalogo/staging/StockEntryStagingView";

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
            <Route path="/" element={<CentralDoDia />} />
            <Route path="/pedidos" element={<Pedidos />} />

            <Route path="/financeiro" element={<FinanceiroContasReceber />} />
            <Route path="/financeiro/pagar" element={<FinanceiroContasPagar />} />
            <Route path="/financeiro/fundos" element={<FundosReposicao />} />
            <Route path="/financeiro/painel" element={<PainelFinanceiro />} />
            <Route path="/financeiro/contas-fixas" element={<ContasFixas />} />
            <Route path="/financeiro/resultado" element={<ResultadoMes />} />
            <Route path="/financeiro/faturamento" element={<VendasFaturamento />} />

            <Route path="/parceiros" element={<ParceirosDashboard />} />

            <Route path="/parceiros/fornecedores" element={<FornecedoresList />} />
            <Route path="/parceiros/clientes" element={<Clientes />} />
            <Route path="/parceiros/funcionarios" element={<FuncionariosPage />} />

            <Route path="/vendas" element={<CentralVendas />} />
            <Route path="/vendas/pdv" element={<PDVContent />} />
            <Route path="/vendas/do-dia" element={<VendasDoDia />} />
            <Route path="/vendas/caixas" element={<CaixasHistorico />} />
            <Route path="/vendas/regras" element={<RegrasVenda />} />
            <Route path="/vendas/taxas" element={<TaxasPagamento />} />
            <Route path="/vendas/orcamentos" element={<Orcamentos />} />
            <Route path="/vendas/pedidos-faturados" element={<PedidosFaturados />} />
            <Route path="/vendas/notas-fiscais" element={<NotasFiscais />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/estoque/consulta" element={<SaldoEstoque />} />
            <Route path="/estoque/inventario" element={<InventarioRotativo />} />
            <Route path="/estoque/curva-abc" element={<CurvaAbc />} />
            <Route path="/estoque/onde-focar" element={<OndeFocar />} />
            <Route path="/estoque/equivalentes" element={<Equivalencias />} />
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
            <Route path="/catalogo/tags" element={<TagsCatalogo />} />
            <Route path="/catalogo/logistica" element={<LogisticaLote />} />
            <Route path="/catalogo/unidades" element={<UnidadesPage />} />
            <Route path="/catalogo/kits" element={<KitsPage />} />
            <Route path="/catalogo/pendencias" element={<PendenciasPim />} />
            <Route path="/catalogo/duplicados" element={<ItensDuplicados />} />
            <Route path="/catalogo/preco" element={<ProductPricingModule/>} />
            <Route path="/catalogo/preco/atacado" element={<VarejoAtacadoLote />} />
            <Route path="/compras" element={<ComprasDashboard />} />
            <Route path="/compras/inteligente" element={<CompraInteligente />} />
            <Route path="/compras/ListaCompras" element={<ListaComprasExport />} />
            <Route path="/compras/entrada-nfe" element={<StockEntryForm />} />
            <Route path="/compras/fornecedores" element={<FornecedoresList />} />
            <Route path="/compras/Faturamento" element={<EmissaoFaturado/>} />
            <Route path="/relatorios" element={<RelatoriosPage />} />

            <Route path="/stagings" element={<StockEntryStagingView/>} />

            


            <Route path="*" element={<h2>404 | Página Não Encontrada</h2>} />


            <Route path="/compras/xml" element={< LeitorXML/>} />

          </Routes>
        </Panel>
      </Layout>
    </Layout>
  );
}