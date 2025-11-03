// src/components/Sidebar.tsx
import './Panel.css';
import { ReactNode } from "react";
import { colors, darkColors } from '../../../styles/colors';


interface PanelProps {
    children: ReactNode;
    isDarkMode: boolean; // Booleano para saber o estado atual do tema
}

export default function Panel({ children, isDarkMode }: PanelProps) {
  const themeColors = isDarkMode ? darkColors : colors;
  
  return (
    <main  className="page-layout" style={{ overflowY: 'auto', backgroundColor: isDarkMode ? themeColors.background : themeColors.background,}}>
      {children}
    </main>
  );
}
