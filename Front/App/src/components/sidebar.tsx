// src/components/Sidebar.tsx

import './Sidebar.css';
import reactLogo from '../assets/react.svg'


interface SidebarProps {
  // Defina props se necessário, como o estado de aberto/fechado
  isOpen: boolean;
  toggleSidebar: () => void;
}

 
const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <button className="close-btn" onClick={toggleSidebar} > {isOpen ? '<<' : '>>'}
      </button>
      
      <ul>
        <li>
          <a href="#home">
            <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span>Home</span>}
          </a>
        </li>
        <li>
          <a href="#about">
            <img src={reactLogo} className="react" alt="React logo" />
            {isOpen && <span>Dashboard</span>}
          </a>
        </li>
        
        <li>
          <a href="#contact">
            <img src={reactLogo} className="react" alt="React logo" />
            {isOpen && <span>Equipe</span>}
          </a>
        </li>
        <li>
          <a href="#contact">
            <img src={reactLogo} className="react" alt="React logo" />
            {isOpen && <span>Estoque</span>}
          </a>
        </li>
        <li>
          <a href="#contact">
            <img src={reactLogo} className="react" alt="React logo" />
            {isOpen && <span>Relatorios</span>}
          </a>
        </li>
        <li>
          <a href="#contact">
            <img src={reactLogo} className="react" alt="React logo" />
            {isOpen && <span>Serviços</span>}
          </a>
        </li>
          <li>
          <a href="#contact">
            <img src={reactLogo} className="react" alt="React logo" />
            {isOpen && <span>Reservas</span>}
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
