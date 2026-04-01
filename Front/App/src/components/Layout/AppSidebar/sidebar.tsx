// src/components/Sidebar.tsx

import './Sidebar.css';
import reactLogo from '../../../assets/react.svg'
import Home from '../../../assets/pic/icons8-casa-48.png'
import clientes from '../../../assets/pic/icons8-grupo-de-negócios-50.png'
import Vendas from '../../../assets/pic/icons8-caixa-registradora-48.png'
import Produtos from '../../../assets/pic/icons8-novo-50.png'

import Estoque from '../../../assets/pic/icons8-empilhamento-50.png'
import Servico from '../../../assets/pic/icons8-trabalhador-da-construção-50.png'
import Obras from '../../../assets/pic/icons8-guindaste-50.png'

import { Link } from "react-router-dom"



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
            <img src={Home}  className="react" alt="Home" title='Home'/>
            {isOpen && <span >Home</span>}
        </li>
          </Link>



            <Link to="/clientes">
          <li>
           <img src={clientes}  className="react" alt="Clientes" title='Clientes' />
            {isOpen && <span >clientes</span>}
          </li>
          </Link>



            <Link to="/produtos">
          <li>
          <img src={Produtos}  className="react"  alt="Produtos" title='Produtos'  />
            {isOpen && <span >Produtos</span>}
          </li>
          </Link>



            <Link to="/vendas">
          <li>
            <img src={Vendas}  className="react" alt="Vendas"  title='Vendas'/>
            {isOpen && <span >Vendas</span>}
            </li>
            </Link>


             <Link to="/Estoque">
          <li>
            <img src={Estoque}  className="react" alt="Estoque" title='Estoque' />
            {isOpen && <span >Estoque</span>}
            </li>
            </Link>


            <Link to="/Servicos">
          <li>
            <img src={Servico}  className="react" alt="Servico"  title='Servico'/>
            {isOpen && <span >Servico</span>}
            </li>
            </Link>


            <Link to="/Obras">
          <li>
            <img src={Obras}  className="react" alt="Obras" title='Obras'/>
            {isOpen && <span >Obras</span>}
            </li>
            </Link>


      </ul>
    </div>
  );
};

export default Sidebar;
