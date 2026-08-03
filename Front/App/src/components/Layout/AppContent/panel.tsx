// src/components/Layout/AppContent/panel.tsx (ou o caminho do seu arquivo Panel)
import { ReactNode } from "react";
import { Layout } from "antd";

const { Content } = Layout;

interface PanelProps {
    children: ReactNode;
    isDarkMode: boolean; // Booleano para saber o estado atual do tema
}

export default function Panel({ children, isDarkMode }: PanelProps) {
  
  return (
    <Content 
      style={{
        overflowY: 'auto',
        height: 'calc(100vh - 50vh)', // Subtrai a altura do Header para o scroll ficar contido
        padding: '4px 4px',
        background: isDarkMode ? '#1f1f1f' : '#f0f2f5', // Muda a cor de fundo baseado no tema
      }}
    >
      {children}
    </Content>
  );
}