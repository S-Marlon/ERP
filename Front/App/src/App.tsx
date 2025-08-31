import './App.css'
import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from './components/sidebar'
import Header from './components/header';
import Panel from './components/panel';

import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Produtos from "./pages/Produtos";
import Vendas from "./pages/Vendas";
import Estoque from "./pages/Estoque";
import Servicos from "./pages/Servicos";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const sidebarWidth = isSidebarOpen ? 200 : 90;
  const headerHeight = 80;

  return (
    <>
    <BrowserRouter>
      <div className="admin-grid-container" style={{
        gridTemplateColumns: `${sidebarWidth}px`,
        gridTemplateRows: `${headerHeight}px`,
      }}>
        
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar}  sidebarWidth={sidebarWidth}/> 
        <Header headtext="Sistema ERP" headerHeight={headerHeight} />
        <Panel>
           
            <Routes>
            <Route path="/" element={<Dashboard text='Dashboard'/>} />
            <Route path="/clientes" element={<Clientes  text='Clientes'/>} />
            <Route path="/produtos" element={<Produtos  text='Produtos'/>} />
            <Route path="/vendas" element={<Vendas  text='Vendas'/>} />
            <Route path="/Estoque" element={<Estoque  text='Estoque'/>} />
            <Route path="/Servicos" element={<Servicos  text='Servicos'/>} />
          </Routes>
          
        </Panel>
      </div>
      </BrowserRouter>
    </>
  )
}

export default App
