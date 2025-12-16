// src/components/CategoryTree/CategoryTree.tsx

import React, { useState, useEffect, CSSProperties, useMemo } from 'react';
import { Category } from '../utils/CategoryTreeBuilder';
import { getCategoryTree } from '../services/productsApi';
// Certifique-se de que o caminho para getCategoryTree e Category estão corretos

// --- Tipagem de Props (Simplificada) ---
interface CategoryTreeProps {
  // Não precisamos mais da prop 'categories' aqui, pois vamos carregá-la.
  // Se for usar uma função customizada, defina a prop: 
  loadCategories?: () => Promise<Category[]>; 
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategoryId: string | null;
  onCategoryNameChange?: (name: string | null) => void;
}

// --- Definição dos Estilos (Simulando CSS-in-JS) ---

const styles = {
  // Estilo principal para a lista (ul)
  categoryTree: {
    listStyle: 'none',
    paddingLeft: 0,
    margin: 0,
    border: '1px solid #ccc',
    borderRadius: '6px',
    backgroundColor: '#fff',
    minWidth: '300px',
    color: '#333',
  } as CSSProperties,

  // Estilo para a lista aninhada (ul dentro de ul)
  nestedList: {
    listStyle: 'none',
    paddingLeft: '20px', // Indentação
    margin: 0,
    borderLeft: '1px dotted #ddd',
    marginLeft: '5px',
  } as CSSProperties,

  // Estilo para cada item da lista (li)
  categoryItem: {
    margin: '0.25em 0',
    cursor: 'pointer',
  } as CSSProperties,

  // Estilo para o cabeçalho (div que contém o nome e o ícone)
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 8px',
  } as CSSProperties,

  // Efeito hover simulado (melhor se feito com styled-components ou CSS Module real)
  // Nota: Para React puro, você precisaria de um hook `useState` para gerenciar o hover
  // ou usar uma biblioteca, mas vamos manter o estilo de base aqui.

  // Estilo para o nome da categoria
  categoryName: {
    flexGrow: 1,
    userSelect: 'none',
    transition: 'color 0.1s',
  } as CSSProperties,

  // Estilo para a categoria selecionada
  selected: {
    fontWeight: 'bold',
    color: '#007bff',
    backgroundColor: '#e6f2ff',
    borderRadius: '4px',
  } as CSSProperties,

  // Estilo para o ícone de toggle
  toggleIcon: {
    width: '15px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'transform 0.2s ease-in-out',
    fontWeight: 'bold',
    color: '#555',
  } as CSSProperties,

  // Rotação do ícone de toggle (expansão)
  expandedIcon: {
    transform: 'rotate(90deg)',
  } as CSSProperties,

  // Espaço para alinhar itens sem filhos
  emptySpace: {
    width: '15px',
    visibility: 'hidden', // Ocupa o espaço sem ser visível
  } as CSSProperties,

  // Estilo para o radio button
  categoryRadio: {
    marginLeft: 'auto',
  } as CSSProperties,
};

// --- Componente Principal ---

const CategoryTree: React.FC<CategoryTreeProps> = ({
  loadCategories = getCategoryTree, 
  onSelectCategory,
  selectedCategoryId,
    onCategoryNameChange,
}) => {

    // NOVO ESTADO: Para armazenar o ARRAY de categorias carregado
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Efeito para carregar as categorias na montagem
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    loadCategories()
      .then(data => {
        setCategories(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar categorias:', err);
        setError('Falha ao carregar categorias. Tente novamente.');
        setIsLoading(false);
      });
  }, [loadCategories]); // Dependência: Roda novamente se a função de carregamento mudar
  
  

  // Estado para controlar quais categorias estão expandidas
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

// 1. FUNÇÃO DE BUSCA RECURSIVA DO NOME DA CATEGORIA
  const findCategoryNameById = (id: string | null, nodes: Category[]): string | null => {
    if (!id) return null;

    for (const node of nodes) {
      if (node.id === id) {
        return node.name; // Encontrou o nó
      }
      if (node.children && node.children.length > 0) {
        const found = findCategoryNameById(id, node.children);
        if (found) return found; // Encontrou nos filhos
      }
    }
    return null; // Não encontrou
  };

  // 2. USE MEMO para calcular o nome da categoria selecionada
  const selectedCategoryName = useMemo(() => {
    return findCategoryNameById(selectedCategoryId, categories);
  }, [selectedCategoryId, categories]); // Recalcula quando o ID ou as categorias mudam

// NOVO useEffect para chamar o callback de nome no componente pai
useEffect(() => {
    if (onCategoryNameChange) {
        onCategoryNameChange(selectedCategoryName);
    }
}, [selectedCategoryName, onCategoryNameChange]); // Chama sempre que o nome muda

  const toggleExpand = (categoryId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Função Recursiva para renderizar uma única categoria e seus filhos
  const renderCategory = (category: Category) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedNodes.has(category.id);
    const isSelected = selectedCategoryId === category.id;

    // Constrói o estilo dinâmico para o cabeçalho
    const categoryNameStyle: CSSProperties = {
      ...styles.categoryName,
      ...(isSelected ? styles.selected : {}), // Aplica 'selected' se a categoria estiver selecionada
      padding: '0 5px', // Adiciona padding interno ao nome para o destaque
    };
    
    // Constrói o estilo dinâmico para o ícone de toggle
    const toggleIconStyle: CSSProperties = {
        ...styles.toggleIcon,
        ...(isExpanded ? styles.expandedIcon : {}),
    };


    return (
      <li key={category.id} style={styles.categoryItem}>
        <div 
          style={styles.categoryHeader}
          // Nota: Você pode usar onMouseEnter/onMouseLeave para simular :hover
        >
          {/* 1. Ícone de Toggle (somente se houver filhos) */}
          {hasChildren ? (
            <span
              style={toggleIconStyle}
              onClick={() => toggleExpand(category.id)}
            >
              {isExpanded ? '▼' : '►'}
            </span>
          ) : (
            <span style={styles.emptySpace}></span> // Espaço para alinhamento
          )}

          {/* 2. Nome da Categoria (Clicável para Seleção) */}
          <span
            style={categoryNameStyle}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </span>
          
          {/* 3. Input de Seleção (Radio Button) */}
          <input
            type="radio" 
            name="categorySelection" 
            value={category.id}
            checked={isSelected}
            onChange={() => onSelectCategory(category.id)}
            style={styles.categoryRadio}
          />
        </div>

        {/* 4. Lista Aninhada (Renderizada recursivamente se houver filhos e estiver expandida) */}
        {hasChildren && isExpanded && (
          <ul style={styles.nestedList}>
            {category.children!.map(renderCategory)}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div style={{ padding: '10px' }}>
      <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
        Selecione uma categoria 
        ({selectedCategoryId 
            ? `ID: ${selectedCategoryId} | Nome: ${selectedCategoryName || 'Carregando Nome...'}` 
            : 'Nenhum item selecionado'
        })
      </p>
      <ul style={styles.categoryTree}>
        {isLoading && (
          <li style={{ padding: '10px', color: '#007bff' }}>Carregando categorias...</li>
        )}
        {error && (
          <li style={{ padding: '10px', color: 'red' }}>{error}</li>
        )}
        
        {!isLoading && categories.length > 0 && (
          categories.map(renderCategory)
        )}  
        
        {!isLoading && !error && categories.length === 0 && (
          <li style={{ padding: '10px', color: '#999' }}>Nenhuma categoria disponível.</li>
        )}
      </ul>
    </div>
  );
};

export default CategoryTree;