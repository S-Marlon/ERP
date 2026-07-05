import React from 'react';
import styles from '../CatalogManager.module.css';
import { Grupo as Familia } from '../CatalogManager.types'; // Aliás para manter compatibilidade com seu type se necessário

interface SidebarFamiliasProps {
  familias: Familia[];
  familiaSelecionadaId: string | null;
  onSelecionarFamilia: (id: string) => void;
  onDeletarFamilia: (id: string) => void;
}

export const SidebarFamilias: React.FC<SidebarFamiliasProps> = ({
  familias,
  familiaSelecionadaId,
  onSelecionarFamilia,
  onDeletarFamilia,
}) => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h2>Famílias Ativas</h2>
        <span className={styles.sidebarCounter}>{familias.length} registros</span>
      </div>
      
      <div className={styles.listaFamilias}>
        {familias.map(f => {
          // Determina se é a família ativa na tela
          const isAtivo = familiaSelecionadaId === f.id;
          
          return (
            <div 
              key={f.id} 
              className={`${styles.cardFamilia} ${isAtivo ? styles.ativo : ''}`} 
              onClick={() => onSelecionarFamilia(f.id)}
              style={{ '--familia-color': f.cor || '#0050b3' } as React.CSSProperties}
            >
              {/* Indicador visual lateral sutil usando a cor identidificadora */}
              <div className={styles.indicatorBadge} />

              <div className={styles.cardFamiliaInfo}>
                <h3>{f.nome || 'Família sem Nome'}</h3>
                <span className={styles.tagCategoriaPaiSidebar}>
                  {f.categoriaPaiNome || 'Sem Categoria Global'}
                </span>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletarFamilia(f.id);
                }} 
                className={styles.btnDeleteMini}
                title="Excluir Família"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
};