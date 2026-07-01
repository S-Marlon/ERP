import React, { useEffect, useState } from 'react';
import styles from './GroupEditModal.module.css';
import { Group, GroupAttribute } from './types';

// Nota: Certifique-se de que sua interface 'GroupAttribute' em './types' contenha:
// nome: string;
// ordem: number;
// obrigatorio: boolean;
// geraVariacao: boolean;
// compoeSku: boolean;

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
    setAtributos(prev => [
      ...prev,
      { 
        nome: '', 
        ordem: prev.length + 1,
        obrigatorio: false,
        geraVariacao: false,
        compoeSku: false
      },
    ]);
  };

  const handleRemoveAtributo = (index: number) => {
    setAtributos(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      // Reordena os itens restantes
      return filtered.map((attr, i) => ({ ...attr, ordem: i + 1 }));
    });
  };

  const handleToggleCheckbox = (index: number, key: 'obrigatorio' | 'geraVariacao' | 'compoeSku') => {
    setAtributos(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        [key]: !copy[index][key],
      };
      return copy;
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
        ordem: i + 1,
        obrigatorio: !!a.obrigatorio,
        geraVariacao: !!a.geraVariacao,
        compoeSku: !!a.compoeSku,
      }));

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
            <label htmlFor="groupNameEdit">Nome do Grupo (Ex: Série 6200, Correias em V)</label>
            <input
              id="groupNameEdit"
              className={styles.textInput}
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: SÉRIE 6200"
            />
          </div>

          {/* ATRIBUTOS SCHEMA */}
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <label>
                Atributos e Regras Técnicas
                <span className={styles.counterBadge}>
                  ({atributos.length} cadastrados)
                </span>
              </label>
              <button
                type="button"
                onClick={handleAddAtributo}
                className={styles.addBtn}
                title="Adicionar novo atributo"
              >
                ➕ Novo Atributo
              </button>
            </div>

            <div className={styles.list}>
              {atributos.length === 0 ? (
                <div className={styles.emptyAttributes}>
                  Nenhum atributo cadastrado. Adicione campos como MARCA, MODELO, BLINDAGEM, etc.
                </div>
              ) : (
                atributos.map((attr, index) => (
                  <div key={index} className={styles.row}>
                    {/* Nome do Atributo */}
                    <input
                      className={styles.textInput}
                      placeholder="Ex: BLINDAGEM, MEDIDA EXTERNA"
                      value={attr.nome}
                      onChange={e => handleChangeAtributoName(index, e.target.value)}
                    />

                    {/* Checkbox: Obrigatório */}
                    <label className={styles.checkboxLabel} title="O lojista é obrigado a preencher este campo?">
                      <input
                        type="checkbox"
                        checked={!!attr.obrigatorio}
                        onChange={() => handleToggleCheckbox(index, 'obrigatorio')}
                      />
                      <span>Obrigatório</span>
                    </label>

                    {/* Checkbox: Gera Variação */}
                    <label className={styles.checkboxLabel} title="Gera variações comerciais/físicas no estoque?">
                      <input
                        type="checkbox"
                        checked={!!attr.geraVariacao}
                        onChange={() => handleToggleCheckbox(index, 'geraVariacao')}
                      />
                      <span>Gera Var.</span>
                    </label>

                    {/* Checkbox: Compõe SKU */}
                    <label className={styles.checkboxLabel} title="Este campo fará parte da string final do SKU dinâmico?">
                      <input
                        type="checkbox"
                        checked={!!attr.compoeSku}
                        onChange={() => handleToggleCheckbox(index, 'compoeSku')}
                      />
                      <span>Compõe SKU</span>
                    </label>

                    {/* Botão Remover */}
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