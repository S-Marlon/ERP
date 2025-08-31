// src/components/Sidebar.tsx
import './Panel.css';
import { ReactNode } from "react";

interface PanelProps {
    children: ReactNode;
}

export default function Panel({ children }: PanelProps) {
  return (
    <main className="content"
    
    >
      {children}
    </main>
  );
}
