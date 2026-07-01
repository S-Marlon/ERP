import React from 'react';
import styles from './CatalogManager.module.css';
import { Grupo } from './CatalogManager.types';

interface SidebarGruposProps {
  grupos: Grupo[];
  grupoSelecionadoId: string | null;
  onSelecionarGrupo: (id: string) => void;
  onDeletarGrupo: (id: string) => void;
}

export const SidebarGrupos: React.FC<SidebarGruposProps> = ({
  grupos,
  grupoSelecionadoId,
  onSelecionarGrupo,
  onDeletarGrupo,
}) => {
  return (
    <aside className={styles.sidebar}>
      <h2>Grupos Ativos</h2>
      <div className={styles.listaGrupos}>
        {grupos.map(g => (
          <div 
            key={g.id} 
            className={`${styles.cardGrupo} ${grupoSelecionadoId === g.id ? styles.ativo : ''}`} 
            onClick={() => onSelecionarGrupo(g.id)}
          >
            <div className={styles.cardGrupoInfo}>
              <h3>{g.nome}</h3>
              <small className={styles.tagCategoriaPaiSidebar}>{g.categoriaPai || 'Sem pai'}</small>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDeletarGrupo(g.id);
              }} 
              className={styles.btnDeleteMini}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};