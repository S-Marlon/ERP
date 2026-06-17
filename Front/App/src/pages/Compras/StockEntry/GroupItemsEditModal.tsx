import React, { useEffect, useState, useMemo } from 'react';
import styles from './GroupItemsEditModal.module.css';
import { Item, Group, ItemAttribute } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grupo: Group | null;
  items: Item[]; // Todos os itens do sistema para filtrarmos os deste grupo
  onSaveItemsAttributes: (
    updatedItems: { tempId: number; atributosCustomizados: ItemAttribute[] }[]
  ) => void;
  onRemoveItemFromGroup: (tempId: number) => void; // ➕ Callback para desvincular o item do grupo
}

export const GroupItemsEditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  grupo,
  items,
  onSaveItemsAttributes,
  onRemoveItemFromGroup,
}) => {
  // Filtra apenas os itens que pertencem a este grupo específico
  const groupItems = useMemo(() => {
    if (!grupo) return [];
    return items.filter(it => it.grupoId === grupo.id);
  }, [items, grupo]);

  // Encontra qual é o atributo principal (Key) definido no schema do grupo
  const atributoPrincipalSchema = useMemo(() => {
    if (!grupo) return null;
    return grupo.atributos.find(attr => attr.principal) || null;
  }, [grupo]);

  // Estado local para gerenciar os atributos de cada item
  const [valoresLocais, setValoresLocais] = useState<Record<number, ItemAttribute[]>>({});

  // Inicializa o estado local quando o modal abre
  useEffect(() => {
    if (!isOpen || !grupo || groupItems.length === 0) return;

    const initialMap: Record<number, ItemAttribute[]> = {};

    groupItems.forEach(item => {
      initialMap[item.tempId] = grupo.atributos.map(groupAttr => {
        const valorExistente = item.atributosCustomizados?.find(
          a => a.nome.toUpperCase() === groupAttr.nome.toUpperCase()
        );

        return {
          nome: groupAttr.nome,
          principal: groupAttr.principal,
          valor: valorExistente ? valorExistente.valor : '',
        };
      });
    });

    setValoresLocais(initialMap);
  }, [isOpen, grupo, groupItems]);

  // Altera o valor do atributo principal especificamente
  const handlePrincipalValueChange = (tempId: number, attrNome: string, newValue: string) => {
    setValoresLocais(prev => {
      const currentAttrs = prev[tempId] || [];
      const updatedAttrs = currentAttrs.map(attr => {
        if (attr.nome === attrNome) {
          return { ...attr, valor: newValue };
        }
        return attr;
      });

      return { ...prev, [tempId]: updatedAttrs };
    });
  };

  // Calcula a descrição resultante baseado apenas no valor do principal
  const computeItemGeneratedName = (tempId: number) => {
    const groupName = grupo?.nome || '';
    if (!atributoPrincipalSchema) return groupName;

    const attrsDoItem = valoresLocais[tempId] || [];
    const principalAttr = attrsDoItem.find(attr => attr.nome === atributoPrincipalSchema.nome);
    
    const principalValue = principalAttr?.valor.trim().toUpperCase() || '';
    return `${groupName} - ${principalValue || '[AGUARDANDO ATRIBUTO]'}`;
  };

  // Trata a desvinculação local e avisa o pai
  const handleRemoveClick = (tempId: number, descricao: string) => {
    if (confirm(`Deseja remover o produto "${descricao}" deste grupo?`)) {
      onRemoveItemFromGroup(tempId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = Object.entries(valoresLocais).map(([tempIdStr, atributos]) => {
      const cleanAttributes = atributos.map(attr => ({
        nome: attr.nome.trim().toUpperCase(),
        principal: attr.principal,
        valor: attr.valor.trim().toUpperCase(),
      }));

      return {
        tempId: Number(tempIdStr),
        atributosCustomizados: cleanAttributes,
      };
    });

    onSaveItemsAttributes(payload);
    onClose();
  };

  if (!isOpen || !grupo) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className={styles.header}>
          <div>
            <h3>Definir Valores da Variação Principal</h3>
            <p className={styles.subtitle}>
              Grupo Estrutural: <strong>{grupo.nome}</strong> • {groupItems.length} SKUs ativos nesta NF
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {/* CORPO OPERACIONAL DO FORMULÁRIO */}
        <form className={styles.body} onSubmit={handleSubmit}>
          
          {!atributoPrincipalSchema ? (
            <div className={styles.warningBox}>
              ⚠️ Este grupo não possui um <strong>Atributo Principal (Key)</strong> definido em sua estrutura. 
              Configure qual característica define o nome do item na tela de grupos antes de continuar.
            </div>
          ) : groupItems.length === 0 ? (
            <div className={styles.emptyItemsBox}>
              📭 Não há nenhum produto vinculado a este grupo no momento.
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.matrixTable}>
                <thead>
                  <tr>
                    <th className={styles.stickyColumnHeader}>Produto (NF-e / Nome Gerado)</th>
                    
                    {/* Exibe apenas a coluna do Atributo Principal */}
                    <th className={styles.attributeHeaderCell}>
                      <span className={styles.attrTitleText}>
                        Variação: {atributoPrincipalSchema.nome} <span className={styles.starBadge}>★ Key</span>
                      </span>
                    </th>

                    <th style={{ textAlign: 'center', width: '90px' }}>Qtd NF</th>
                    <th style={{ textAlign: 'center', width: '70px' }}>Ações</th> {/* ➕ Coluna de Ações */}
                  </tr>
                </thead>
                <tbody>
                  {groupItems.map(item => {
                    const attrsDoItem = valoresLocais[item.tempId] || [];
                    const currentAttr = attrsDoItem.find(a => a.nome === atributoPrincipalSchema.nome);
                    const currentAttrValue = currentAttr?.valor || '';

                    return (
                      <tr key={item.tempId}>
                        {/* Descrição Unificada (Original + Gerada) */}
                        <td className={styles.productCell}>
                          <span className={styles.desc} title={`Original: ${item.descricao}`}>
                            {item.descricao}
                          </span>
                          <div className={styles.generatedNameWrapper}>
                            <span className={styles.previewLabel}>Gerado:</span> {computeItemGeneratedName(item.tempId)}
                          </div>
                        </td>
                        
                        {/* Único Input: Atributo Principal */}
                        <td>
                          <input
                            type="text"
                            className={`${styles.tableInput} ${styles.tableInputPrincipal}`}
                            placeholder={`Ex: ${atributoPrincipalSchema.nome.toLowerCase()}...`}
                            value={currentAttrValue}
                            onChange={e => handlePrincipalValueChange(item.tempId, atributoPrincipalSchema.nome, e.target.value)}
                          />
                        </td>

                        {/* Quantidade */}
                        <td style={{ textAlign: 'center' }}>
                          <span className={styles.qtyBadge}>{item.receivedQuantity || 0} pçs</span>
                        </td>

                        {/* Botão de Remover Item do Grupo */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={styles.removeItemBtn}
                            onClick={() => handleRemoveClick(item.tempId, item.descricao)}
                            title="Desvincular produto deste grupo"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* RODAPÉ E BOTÕES DE AÇÃO */}
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className={styles.btnSave} 
              disabled={!atributoPrincipalSchema || groupItems.length === 0}
            >
              Salvar Alterações
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default GroupItemsEditModal;