import React, { useState, useEffect, useMemo } from 'react';
import styles from './GroupMappingModal.module.css';
import { 
  Item, 
  Group, 
  ItemAttribute, 
  GroupMappingPayload, 
  GroupAttribute 
} from './types';
import { generateGroupId } from './helpers';

interface GroupMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  groups: Group[];
  onSaveGroupMapping: (payload: GroupMappingPayload) => void;
}

export const GroupMappingModal: React.FC<GroupMappingModalProps> = ({
  isOpen,
  onClose,
  item,
  groups,
  onSaveGroupMapping,
}) => {
  const [isNewGroup, setIsNewGroup] = useState<boolean>(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupAttributes, setNewGroupAttributes] = useState<GroupAttribute[]>([]);
  const [newAttrInputName, setNewAttrInputName] = useState<string>('');
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && item) {
      setIsNewGroup(!item.grupoId);
      setSelectedGroupId(item.grupoId || '');
      setNewGroupName('');
      setNewGroupAttributes([]);
      setNewAttrInputName('');
      
      const initialValues: Record<string, string> = {};
      if (item.atributosCustomizados) {
        item.atributosCustomizados.forEach(attr => {
          initialValues[attr.nome] = attr.valor;
        });
      }
      setAttributeValues(initialValues);
    }
  }, [isOpen, item]);

  const currentSelectedGroup = useMemo(() => {
    if (isNewGroup) return null;
    return groups.find(g => g.id === selectedGroupId) || null;
  }, [isNewGroup, selectedGroupId, groups]);

  const activeAttributesSchema = useMemo(() => {
    if (isNewGroup) {
      return newGroupAttributes;
    }
    return currentSelectedGroup ? currentSelectedGroup.atributos : [];
  }, [isNewGroup, newGroupAttributes, currentSelectedGroup]);

  // 📝 GERAÇÃO DO PREVIEW DA DESCRIÇÃO EM TEMPO REAL
  const generatedDescriptionPreview = useMemo(() => {
    const groupName = isNewGroup 
      ? newGroupName.trim().toUpperCase() 
      : (currentSelectedGroup?.nome || '');

    if (!groupName) return 'Aguardando definição do grupo...';

    // Encontra qual atributo do Schema é o principal (Key)
    const principalAttr = activeAttributesSchema.find(attr => attr.principal);
    
    if (!principalAttr) return groupName;

    // Pega o valor preenchido pelo usuário para esse atributo principal
    const principalValue = (attributeValues[principalAttr.nome] || '').trim().toUpperCase();

    return `${groupName} - ${principalValue || '[VALOR PRINCIPALEM BRANCO]'}`;
  }, [isNewGroup, newGroupName, currentSelectedGroup, activeAttributesSchema, attributeValues]);

  if (!isOpen || !item) return null;

  const handleAttributeValueChange = (nome: string, valor: string) => {
    setAttributeValues(prev => ({ ...prev, [nome]: valor }));
  };

  const handleAddNewAttributeSchema = () => {
    const nomeLimpo = newAttrInputName.trim().toUpperCase();
    if (!nomeLimpo) return;

    if (newGroupAttributes.some(attr => attr.nome === nomeLimpo)) {
      alert('Este atributo já foi adicionado ao esquema do grupo.');
      return;
    }

    const newAttr: GroupAttribute = {
      nome: nomeLimpo,
      principal: newGroupAttributes.length === 0,
      ordem: newGroupAttributes.length + 1
    };

    setNewGroupAttributes(prev => [...prev, newAttr]);
    setNewAttrInputName('');
  };

  const handleSetPrincipalAttribute = (indexToSet: number) => {
    setNewGroupAttributes(prev =>
      prev.map((attr, idx) => ({
        ...attr,
        principal: idx === indexToSet
      }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let targetGroupId = selectedGroupId;
    let createdGroupData: Group | undefined = undefined;

    if (isNewGroup) {
      const nomeGrupoLimpo = newGroupName.trim().toUpperCase();
      if (!nomeGrupoLimpo) {
        alert('Por favor, defina o nome do novo grupo.');
        return;
      }
      if (newGroupAttributes.length === 0) {
        alert('Por favor, adicione pelo menos um atributo ao esquema do novo grupo.');
        return;
      }
      targetGroupId = generateGroupId();
      createdGroupData = { id: targetGroupId, nome: nomeGrupoLimpo, atributos: newGroupAttributes };
    } else {
      if (!targetGroupId) {
        alert('Por favor, selecione um grupo existente.');
        return;
      }
    }

    const itemAttributesOverride: ItemAttribute[] = [];
    let missingValue = false;

    for (const attr of activeAttributesSchema) {
      const valorPreenchido = (attributeValues[attr.nome] || '').trim().toUpperCase();
      if (!valorPreenchido) {
        missingValue = true;
        alert(`Por favor, informe o valor da variação para o atributo "${attr.nome}".`);
        break;
      }
      itemAttributesOverride.push({
        nome: attr.nome,
        principal: attr.principal,
        valor: valorPreenchido
      });
    }

    if (missingValue) return;

    onSaveGroupMapping({
      groupId: targetGroupId,
      isNewGroup,
      groupData: createdGroupData,
      itemAttributesOverride: itemAttributesOverride.length > 0 ? itemAttributesOverride : undefined
    });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h3>Vincular Grupo ao Produto</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.itemContextPreview}>
          <p><strong>Item da NF:</strong> {item.descricao}</p>
          <p><strong>NCM:</strong> {item.ncm || '-'} | <strong>EAN:</strong> {item.gtin || '-'}</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          
          {/* SWITCH DE SELEÇÃO DE MODO */}
          <div className={styles.modeSwitchContainer}>
            <button
              type="button"
              className={`${styles.switchBtn} ${!isNewGroup ? styles.switchBtnActive : ''}`}
              onClick={() => setIsNewGroup(false)}
            >
              Escolher Existente
            </button>
            <button
              type="button"
              className={`${styles.switchBtn} ${isNewGroup ? styles.switchBtnActive : ''}`}
              onClick={() => setIsNewGroup(true)}
            >
              Criar Novo Grupo
            </button>
          </div>

          {/* CONTAINER FLEXÍVEL - TAMANHO ESTABILIZADO EM DUAS COLUNAS */}
          <div className={styles.modalBodyFlex}>
            
            {/* COLUNA ESQUERDA: Configuração ou Criação */}
            <div className={styles.leftColumn}>
              {!isNewGroup ? (
                <div className={styles.formGroup}>
                  <label htmlFor="modalSelectGroup">Selecione o Grupo</label>
                  <select
                    id="modalSelectGroup"
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className={styles.selectInput}
                  >
                    <option value="">-- Selecione um grupo cadastrado --</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className={styles.creativeGroupCard}>
                  <div className={styles.cardHeaderNotice}>
                    <h5>Modo de Criação Ativo</h5>
                    <p>Você está criando um novo grupo de grade. Defina as características dele abaixo:</p>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="newGroupNameInput">Nome do Novo Grupo</label>
                    <input
                      id="newGroupNameInput"
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Ex: AMANCO TEE MARROM"
                      className={styles.textInput}
                    />
                  </div>

                  <div className={styles.schemaBuilder}>
                    <h4>Esquema de Atributos do Grupo</h4>
                    <div className={styles.schemaInputRow}>
                      <input
                        type="text"
                        value={newAttrInputName}
                        onChange={e => setNewAttrInputName(e.target.value)}
                        placeholder="Ex: BITOLA, COR"
                        className={styles.textInput}
                      />
                      <button type="button" onClick={handleAddNewAttributeSchema} className={styles.btnAddAttr}>
                        + Add
                      </button>
                    </div>

                    {newGroupAttributes.length > 0 && (
                      <table className={styles.schemaTable}>
                        <thead>
                          <tr>
                            <th>Atributo</th>
                            <th style={{ width: '60px', textAlign: 'center' }}>Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {newGroupAttributes.map((attr, index) => (
                            <tr key={attr.nome}>
                              <td>{attr.nome}</td>
                              <td style={{ textAlign: 'center' }}>
                                <input
                                  type="radio"
                                  name="principalAttribute"
                                  checked={!!attr.principal}
                                  onChange={() => handleSetPrincipalAttribute(index)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* COLUNA DIREITA: Valores das Variações + Live Preview */}
            <div className={styles.rightColumn}>
              
              {/* 👁️ ÁREA DE LIVE PREVIEW DA DESCRIÇÃO FINAL */}
              <div className={styles.previewDescriptionBox}>
                <span className={styles.previewLabel}>Visualização do Nome do Item na Grade:</span>
                <div className={styles.previewValue}>
                  {generatedDescriptionPreview}
                </div>
              </div>

              {activeAttributesSchema.length > 0 ? (
                <div className={styles.instanceValuesSection}>
                  <h4>Valores deste Item Específico</h4>
                  <p className={styles.subtext}>Preencha a variação deste produto na grade:</p>
                  
                  <div className={styles.attributesVerticalStack}>
                    {activeAttributesSchema.map(attr => (
                      <div className={styles.formGroupInline} key={attr.nome}>
                        <label>
                          {attr.nome} {attr.principal && <span className={styles.starBadge} title="Atributo Principal">*</span>}
                        </label>
                        <input
                          type="text"
                          value={attributeValues[attr.nome] || ''}
                          onChange={e => handleAttributeValueChange(attr.nome, e.target.value)}
                          placeholder={`Valor para ${attr.nome}`}
                          className={styles.textInput}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.emptyStateRightColumn}>
                  <p>Defina ou selecione um grupo à esquerda para liberar os campos de variação do item.</p>
                </div>
              )}
            </div>
          </div>

          {/* AÇÕES DO MODAL */}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSave}>
              Confirmar Vínculo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};