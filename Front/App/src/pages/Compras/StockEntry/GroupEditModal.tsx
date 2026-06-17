import React, { useEffect, useState } from 'react';
import styles from './GroupEditModal.module.css';
import { Group, GroupAttribute } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  grupo: Group | null;
  onSave: (grupo: Group) => void;
}

export const GroupEditModal: React.FC<Props> = ({
  isOpen,
  onClose,
  grupo,
  onSave,
}) => {
  const [nome, setNome] = useState('');
  const [atributos, setAtributos] = useState<GroupAttribute[]>([]);

  useEffect(() => {
    if (!isOpen || !grupo) return;

    setNome(grupo.nome || '');
    setAtributos(grupo.atributos?.length ? grupo.atributos : []);
  }, [isOpen, grupo]);

  const handleAddAtributo = () => {
    // Trava de segurança para não passar de 5 características
    if (atributos.length >= 5) return;

    setAtributos(prev => [
      ...prev,
      { 
        nome: '', 
        principal: prev.length === 0, // Se for o primeiro, já nasce como principal
        ordem: prev.length + 1 
      },
    ]);
  };

  const handleRemoveAtributo = (index: number) => {
    setAtributos(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      // Se removeu o atributo que era principal, define o primeiro da lista restante como principal
      if (prev[index]?.principal && filtered.length > 0) {
        filtered[0].principal = true;
      }
      // Reordena os itens restantes
      return filtered.map((attr, i) => ({ ...attr, ordem: i + 1 }));
    });
  };

  const handleChangeAtributoName = (index: number, value: string) => {
    setAtributos(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        nome: value,
      };
      return copy;
    });
  };

  const handleSetPrincipal = (indexToSet: number) => {
    setAtributos(prev =>
      prev.map((attr, idx) => ({
        ...attr,
        principal: idx === indexToSet,
      }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!grupo?.id) {
      alert('Grupo inválido.');
      return;
    }

    const nomeGrupoLimpo = nome.trim().toUpperCase();
    if (!nomeGrupoLimpo) {
      alert('O nome do grupo não pode ficar vazio.');
      return;
    }

    // Filtra campos vazios e padroniza os nomes em Caixa Alta (UpperCase)
    const cleanAttributes: GroupAttribute[] = atributos
      .filter(a => a.nome?.trim())
      .map((a, i) => ({
        nome: a.nome.trim().toUpperCase(),
        principal: !!a.principal,
        ordem: i + 1,
      }));

    // Se houver atributos mas nenhum marcado como principal por algum motivo, força o primeiro
    if (cleanAttributes.length > 0 && !cleanAttributes.some(a => a.principal)) {
      cleanAttributes[0].principal = true;
    }

    onSave({
      id: grupo.id,
      nome: nomeGrupoLimpo,
      atributos: cleanAttributes,
    });

    onClose();
  };

  if (!isOpen || !grupo) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Editar Estrutura do Grupo</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <form className={styles.body} onSubmit={handleSubmit}>
          {/* NOME DO GRUPO */}
          <div className={styles.field}>
            <label htmlFor="groupNameEdit">Nome do Grupo</label>
            <input
              id="groupNameEdit"
              className={styles.textInput}
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: AMANCO TEE"
            />
          </div>

          {/* ATRIBUTOS SCHEMA */}
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <label>
                Atributos / Características 
                <span className={`${styles.counterBadge} ${atributos.length >= 5 ? styles.counterLimit : ''}`}>
                  ({atributos.length} de 5)
                </span>
              </label>
              <button
                type="button"
                onClick={handleAddAtributo}
                className={styles.addBtn}
                disabled={atributos.length >= 5}
                title={atributos.length >= 5 ? "Limite máximo de 5 atributos atingido" : "Adicionar novo atributo"}
              >
                {atributos.length >= 5 ? '🛑 Limite Atingido' : '➕ Novo Atributo'}
              </button>
            </div>

            <div className={styles.list}>
              {atributos.length === 0 ? (
                <div className={styles.emptyAttributes}>
                  Nenhum atributo cadastrado. Itens vinculados usarão apenas o nome do grupo.
                </div>
              ) : (
                atributos.map((attr, index) => (
                  <div key={index} className={styles.row}>
                    <input
                      className={styles.textInput}
                      placeholder="Nome do campo (ex: COR, BITOLA, VOLTAGEM)"
                      value={attr.nome}
                      onChange={e => handleChangeAtributoName(index, e.target.value)}
                    />

                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="principalAttributeEdit"
                        checked={!!attr.principal}
                        onChange={() => handleSetPrincipal(index)}
                      />
                      <span>Principal</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveAtributo(index)}
                      className={styles.removeBtn}
                      title="Remover este atributo"
                    >
                      &times;
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AÇÕES DE SALVAMENTO */}
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSave}>
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GroupEditModal;