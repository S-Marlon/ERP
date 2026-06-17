import React, { useMemo } from 'react';
import styles from './ManageGroupsModal.module.css';
import { Item, Group } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  items: Item[];
  onCreateGroup?: () => void; // ➕ Adicionado para permitir a criação de um novo grupo
  onEditGroup: (groupId: string) => void;
  onEditGroupItems: (groupId: string) => void; // Abre a edição de itens/valores
  onDeleteGroup: (groupId: string) => void;
}

export default function ManageGroupsModal({
  isOpen,
  onClose,
  groups,
  items,
  onCreateGroup, // recebendo a nova prop voluntária
  onEditGroup,
  onEditGroupItems,
  onDeleteGroup,
}: Props) {
  // Indexação otimizada dos itens por grupo
  const itemsByGroupId = useMemo(() => {
    const map = new Map<string, Item[]>();

    for (const it of items) {
      if (!it.grupoId) continue;

      if (!map.has(it.grupoId)) map.set(it.grupoId, []);
      map.get(it.grupoId)!.push(it);
    }

    return map;
  }, [items]);

  const totalGroups = groups.length;
  const totalGroupedItems = useMemo(() => items.filter(i => i.grupoId).length, [items]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div className={styles.header}>
          <div>
            <h3>Gerenciamento de Grupos</h3>
            <p className={styles.subtitle}>
              {totalGroups} {totalGroups === 1 ? 'grupo' : 'grupos'} • {totalGroupedItems} {totalGroupedItems === 1 ? 'item vinculado' : 'itens vinculados'}
            </p>
          </div>

          {/* ÁREA DE AÇÃO DO HEADER: Botão Criar + Fechar */}
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.createGroupBtn}
              onClick={() => {
                if (onCreateGroup) {
                  onCreateGroup();
                } else {
                  alert('A integração de criação de grupos ainda está sendo conectada ao sistema pai.');
                }
              }}
              title="Criar um novo grupo estrutural"
            >
              ➕ Novo Grupo
            </button>
            
            <button className={styles.closeBtn} onClick={onClose} aria-label="Fechar modal">
              &times;
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className={styles.body}>
          {groups.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Nenhum grupo criado ainda.</p>
              <button
                type="button"
                className={styles.createGroupBtnInline}
                onClick={onCreateGroup}
              >
                Criar Primeiro Grupo
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {groups.map(group => {
                const groupItems = itemsByGroupId.get(group.id) || [];
                const qtdItens = groupItems.length;
                
                const somaRecebida = groupItems.reduce(
                  (sum, it) => sum + (it.receivedQuantity || 0),
                  0
                );

                const isEmpty = qtdItens === 0;
                
                // Busca o nome do atributo marcado como principal neste grupo
                const attrPrincipal = group.atributos?.find(a => a.principal)?.nome;
                const temEstrutura = group.atributos && group.atributos.length > 0;

                return (
                  <div
                    key={group.id}
                    className={`${styles.card} ${isEmpty ? styles.cardEmpty : ''}`}
                  >
                    {/* HEADER DO CARD */}
                    <div className={styles.cardHeader}>
                      <div>
                        <h4 className={styles.groupName} title={group.nome}>
                          {group.nome}
                        </h4> 

                        {/* Tag indicando qual a Chave de Variação ativa */}
                        <div className={styles.keyBadgeWrapper}>
                          {attrPrincipal ? (
                            <span className={styles.keyBadgeActive}>🔑 Key: {attrPrincipal}</span>
                          ) : (
                            <span className={styles.keyBadgeMissing}>⚠️ Sem Estrutura</span>
                          )}
                        </div>

                        <div className={styles.metrics}>
                          <span>{qtdItens} {qtdItens === 1 ? 'item' : 'itens'}</span>
                          <span>{somaRecebida} {somaRecebida === 1 ? 'peça' : 'peças'}</span>
                        </div>
                      </div>
                    </div>

                    {/* BODY DO CARD */}
                    <div className={styles.cardBody}>
                      {groupItems.length === 0 ? (
                        <div className={styles.noItems}>
                          Sem itens vinculados
                        </div>
                      ) : (
                        <ul className={styles.itemList}>
                          {groupItems.slice(0, 5).map(it => (
                            <li key={it.tempId} className={styles.itemRow}>
                              <span className={styles.itemDesc} title={it.descricao}>
                                {it.descricao}
                              </span>
                              <span className={styles.itemQty}>
                                {it.receivedQuantity}
                              </span>
                            </li>
                          ))}

                          {groupItems.length > 5 && (
                            <li className={styles.more}>
                              +{groupItems.length - 5} mais...
                            </li>
                          )}
                        </ul>
                      )}
                    </div>

                    {/* ACTIONS DO CARD */}
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => onEditGroup(group.id)}
                        title="Editar nome e características do grupo"
                      >
                        Estrutura
                      </button>
                      
                      <button
                        type="button"
                        className={styles.editItemsBtn}
                        onClick={() => onEditGroupItems(group.id)}
                        disabled={!temEstrutura || isEmpty}
                        title={
                          !temEstrutura 
                            ? "Configure a estrutura primeiro para poder preencher os valores" 
                            : isEmpty 
                            ? "Não há itens vinculados a este grupo para editar" 
                            : "Preencher valores das variações da grade"
                        }
                      >
                        Preencher Grade
                      </button>

                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => {
                          if (
                            confirm(
                              `Deseja realmente remover o grupo "${group.nome}"?\nIsso irá desvincular todos os ${qtdItens} itens associados.`
                            )
                          ) {
                            onDeleteGroup(group.id);
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className={styles.footer}>
          <button type="button" onClick={onClose} className={styles.btnMainClose}>
            Fechar Gerenciador
          </button>
        </div>

      </div>
    </div>
  );
}