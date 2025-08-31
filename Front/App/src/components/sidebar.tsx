// src/components/Sidebar.tsx

import './Sidebar.css';
import reactLogo from '../assets/react.svg'
import { Link } from "react-router-dom";


interface SidebarProps {
  // Defina props se necessário, como o estado de aberto/fechado
  isOpen: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;

}

 
const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  return (
    // <div className={`sidebar ${isOpen ? 'open' : ''}`}>
    <div className={`sidebar ${isOpen ? 'open' : ''}`}
     >
      <button className="close-btn" onClick={toggleSidebar} > {isOpen ? '<<' : '>>'}
      </button>
      
      <ul>

          <Link to="/">
        <li>
            <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span >Home</span>}
        </li>
          </Link>

            <Link to="/clientes">
          <li>
           <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span >clientes</span>}
          </li>
          </Link>
            <Link to="/produtos">
          <li>
          <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span >produtos</span>}
          </li>
          </Link>
            <Link to="/vendas">
          <li>
            <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span >vendas</span>}
            </li>
            </Link>
             <Link to="/Estoque">
          <li>
            <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span >Estoque</span>}
            </li>
            </Link>
            <Link to="/Servicos">
          <li>
            <img src={reactLogo}  className="react" alt="React logo" />
            {isOpen && <span >Servicos</span>}
            </li>
            </Link>
      </ul>
    </div>
  );
};

export default Sidebar;
