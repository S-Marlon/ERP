// src/components/Sidebar.tsx
import './Header.css';

interface HeaderProps {
  headtext: string;
  sidebarWidth: number;
}

const Header: React.FC<HeaderProps> = ({ headtext, sidebarWidth }) => {
  return (
    <div
      className="header"
      style={{
        left: `${sidebarWidth}px`,
        width: `calc(100% - ${sidebarWidth}px)`
      }}
    >
      <h1>{headtext}</h1>
    </div>
  );
};

export default Header;
