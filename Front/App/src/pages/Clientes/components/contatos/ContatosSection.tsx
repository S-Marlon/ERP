import React from 'react';
import styles from './ContatosSection.module.css';

type Contato = {
  id?: number;
  id_contato?: number;
  nome?: string;
  telefone?: string;
  cargo?: string;
  tipo_telefone?: 'CELULAR' | 'FIXO' | 'COMERCIAL';
  whatsapp?: boolean;
  principal?: boolean;
};

type Props = {
  contatos: Contato[];
  setContatos: React.Dispatch<React.SetStateAction<Contato[]>>;

  editingContactId: any;
  setEditingContactId: (id: any) => void;

  tempContato: Contato | null;
  setTempContato: (c: Contato | null) => void;

  contatoForm: Contato;
  setContatoForm: (c: Contato) => void;

  addContato: () => void;
  startEditContato: (c: Contato) => void;
  saveEditContato: () => void;

  maskPhone: (v: string) => string;

  isAddingContato: boolean;
  setIsAddingContato: (v: boolean) => void;
};

const ContatosSection = ({
  contatos,
  setContatos,
  editingContactId,
  setEditingContactId,
  tempContato,
  setTempContato,
  contatoForm,
  setContatoForm,
  addContato,
  startEditContato,
  saveEditContato,
  maskPhone,
  isAddingContato,
  setIsAddingContato,
}: Props) => {
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>👥 Contatos</h3>

      {/* LISTA */}
      <div className={styles.list}>
        {contatos.length === 0 && (
          <p className={styles.emptyState}>
            Nenhum contato cadastrado.
          </p>
        )}

        {contatos.map((c) => {
          const id = c.id || c.id_contato;
          const isEditing = editingContactId === id;

          const data = isEditing ? tempContato : c;

          return (
            <div key={id} className={styles.row}>
              {!isEditing ? (
                <div className={styles.view}>
                  <strong>{c.nome}</strong>
                  <div>{c.telefone}</div>

                  <div className={styles.meta}>
                    {c.tipo_telefone}
                    {c.whatsapp && ' • WhatsApp'}
                    {c.principal && ' • Principal'}
                    {c.cargo && ` • ${c.cargo}`}
                  </div>
                </div>
              ) : (
                <div className={styles.edit}>
                  <input
                    className={styles.input}
                    value={data?.nome || ''}
                    onChange={e =>
                      setTempContato({
                        ...data!,
                        nome: e.target.value,
                      })
                    }
                  />

                  <input
                    className={styles.input}
                    value={data?.telefone || ''}
                    onChange={e =>
                      setTempContato({
                        ...data!,
                        telefone: maskPhone(e.target.value),
                      })
                    }
                  />

                  <select
                    className={styles.select}
                    value={data?.tipo_telefone || 'CELULAR'}
                    onChange={e =>
                      setTempContato({
                        ...data!,
                        tipo_telefone: e.target.value as any,
                      })
                    }
                  >
                    <option value="CELULAR">Celular</option>
                    <option value="FIXO">Fixo</option>
                    <option value="COMERCIAL">Comercial</option>
                  </select>

                  <label>
                    <input
                      type="checkbox"
                      checked={!!data?.whatsapp}
                      onChange={e =>
                        setTempContato({
                          ...data!,
                          whatsapp: e.target.checked,
                        })
                      }
                    />
                    WhatsApp
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={!!data?.principal}
                      onChange={e =>
                        setTempContato({
                          ...data!,
                          principal: e.target.checked,
                        })
                      }
                    />
                    Principal
                  </label>

                  <div className={styles.actions}>
                    <button onClick={saveEditContato}>
                      ✔ Salvar
                    </button>
                    <button
                      onClick={() =>
                        setEditingContactId(null)
                      }
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className={styles.rowActions}>
                  <button
                    onClick={() => startEditContato(c)}
                  >
                    Editar
                  </button>

                  <button
                    onClick={() =>
                      setContatos(prev =>
                        prev.filter(x => x !== c)
                      )
                    }
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BOTÃO ADD (TOGGLE) */}
      {!isAddingContato ? (
        <button
          className={styles.addBtn}
          onClick={() => setIsAddingContato(true)}
        >
          + Adicionar contato
        </button>
      ) : (
        <div className={styles.form}>
          <h4>Novo contato</h4>

          <input
            className={styles.input}
            value={contatoForm.nome}
            onChange={e =>
              setContatoForm({
                ...contatoForm,
                nome: e.target.value,
              })
            }
          />

          <input
            className={styles.input}
            value={contatoForm.telefone}
            onChange={e =>
              setContatoForm({
                ...contatoForm,
                telefone: maskPhone(e.target.value),
              })
            }
          />

          <div className={styles.actions}>
            <button onClick={addContato}>
              ✔ Salvar
            </button>

            <button
              onClick={() =>
                setIsAddingContato(false)
              }
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ContatosSection;