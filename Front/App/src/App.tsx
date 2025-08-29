import { useState } from 'react'
import Sidebar from './components/sidebar'
import './App.css'
import Header from './components/header';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const sidebarWidth = isSidebarOpen ? 90 : 0;

  return (
    <>
      <div className="App">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        <Header headtext="Sistema ERP" sidebarWidth={sidebarWidth} />
        <div className="content" style={{ marginLeft: `${sidebarWidth}px` }}>
        </div>
      </div>
    </>
  )
}

export default App
