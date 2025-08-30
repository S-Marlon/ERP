// src/components/Sidebar.tsx
import './Panel.css';

interface PanelProps {
    sidebarWidth?: number;
    headerHeight?: number;
}

const Panel: React.FC<PanelProps> = () => {
  return (
    <div
      className="content"
      
    >
      <span>
        Painel de Conteúdo
        </span>  

    </div>
  );
};

export default Panel;
