// src/components/Sidebar.tsx
import './Header.css';

interface HeaderProps {
  headtext: string;
  headerHeight: number;
  
}

const Header: React.FC<HeaderProps> = ({ headtext }) => {
  return (
    <div
      className="header"
      
    >
      <h3>{headtext}</h3>
    </div>
  );
};

export default Header;
