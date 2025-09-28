// src/components/layout/PageLayout.tsx
import React from 'react';
// Define a interface para as propriedades (props) do componente
interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode; // Para passar botões de ação
  children: React.ReactNode; // O conteúdo principal da tela
  footerContent?: React.ReactNode; // Conteúdo opcional para o rodapé
}


const PageLayout: React.FC<PageLayoutProps> = ({
  title = 'Titulo',
  subtitle = 'SubTitulo',
  actions = 'ação' ,
  children = 'Main PAGE' ,
  footerContent = 'footer',
}) => {
  return (
    <div style={{background:'gray'}}>
      
      {/* (A) PAGE HEADER */}
      <header className="page-header">
      
        <div>

        <div className="title-section">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="actions-section">
          {actions}
        </div>
        </div>
      </header>
      {/* (B) PAGE CONTENT */}
      <main className="page-content " style={{background:'blue'}}>
        {children}
      </main>
      {/* (C) PAGE FOOTER (Opcional) */}
      {footerContent && (
        <footer className="page-footer" >
          {footerContent}
        </footer>
      )}
    </div>
  );
};
export default PageLayout;