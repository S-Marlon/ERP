import './App.css'
import { useState } from 'react'
import Sidebar from './components/sidebar'
import Header from './components/header';
import Panel from './components/panel';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const sidebarWidth = isSidebarOpen ? 200 : 90;
  const headerHeight = 80;

  return (
    <>
      <div className="admin-grid-container" style={{
        gridTemplateColumns: `${sidebarWidth}px`,
        gridTemplateRows: `${headerHeight}px`,
      }}>
        
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar}  sidebarWidth={sidebarWidth}/> 
        <Header headtext="Sistema ERP" headerHeight={headerHeight} />
        <Panel />
      </div>
    </>
  )
}

export default App
