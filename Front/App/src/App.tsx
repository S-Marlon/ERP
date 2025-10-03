import './App.css'
import './forms.css'
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from './components/Layout/sidebar'
import Header from './components/Layout/header';
import Panel from './components/Layout/panel';

import Dashboard from "./pages/Dashboard/Dashboard";
import Clientes from "./pages/Clientes/Clientes";
import Produtos from "./pages/Produtos/Produtos";
import Vendas from "./pages/PDV/PDVScreen";
import Estoque from "./pages/Estoque/Estoque";
import Servicos from "./pages/Servicos/Servicos";
import { ObrasModule } from './pages/Obras/ObrasModule';
import { ServiceProductProvider } from './context/NewServiceProductContext';
import { ProductProvider } from './context/NewProductContext';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };
    const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Você pode salvar a preferência do usuário no localStorage aqui, se quiser
  };
   const [isDarkMode, setIsDarkMode] = useState(false);

  const sidebarWidth = isSidebarOpen ? 170 : 90;
  const headerHeight = 50;

  return (
    <>
    <BrowserRouter>
      <div className="admin-grid-container" style={{
        gridTemplateColumns: `${sidebarWidth}px`,
        gridTemplateRows: `${headerHeight}px`,
      }}>
        
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar}  sidebarWidth={sidebarWidth}/> 
        <Header title="Sistema ERP" headerHeight={headerHeight} onThemeToggle={toggleTheme} 
        isDarkMode={isDarkMode} />
        <Panel isDarkMode={isDarkMode}>
           
            <Routes>
        <Route path="/" element={<Dashboard text='Dashboard'/>} />
        <Route path="/clientes" element={<Clientes title={''} children={undefined} />} />
        
        {/*
          CORREÇÃO PRINCIPAL: Envolver a rota '/vendas' com os Providers.
          A ordem não importa muito aqui, mas é bom aninhar.
        */}
        <Route 
            path="/vendas" 
            element={
                <ServiceProductProvider>
                    <ProductProvider>
                        {/* Seu PDVScreen agora tem acesso aos dados! */}
                        <Vendas/> 
                    </ProductProvider>
                </ServiceProductProvider>
            } 
        />
        
        <Route path="/produtos" element={<Produtos  text='Produtos'/>} />
        <Route path="/Estoque" element={<Estoque />} />
        <Route path="/Servicos" element={<Servicos />} />
        <Route path="/Obras" element={<ObrasModule />} />
    </Routes>
          
        </Panel>
      </div>
      </BrowserRouter>
    </>
  )
}

export default App
