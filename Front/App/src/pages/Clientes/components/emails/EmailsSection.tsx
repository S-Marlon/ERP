import React from 'react';
import styles from './EmailsSection.module.css';

type Email = {
  id?: number;
  email: string;
  tipo?: string;
  principal?: boolean;
  verificado?: boolean;
};

type Props = {
  emails: Email[];
  setEmails: React.Dispatch<React.SetStateAction<Email[]>>;

  emailForm: Email;
  setEmailForm: (e: Email) => void;

  addEmail: () => void;

  removeEmail: (index: number) => void;

  validaEmail: (email: string) => boolean;

  isAddingEmail: boolean;
  setIsAddingEmail: (v: boolean) => void;
};

const EmailsSection = ({
  emails,
  emailForm,
  setEmailForm,
  addEmail,
  removeEmail,
  validaEmail,
  isAddingEmail,
  setIsAddingEmail,
}: Props) => {
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>📧 Canais de E-mail</h3>

      {/* LISTA */}
      <div className={styles.list}>
        {emails.length === 0 && (
          <p className={styles.emptyState}>
            Nenhum e-mail cadastrado.
          </p>
        )}

        {emails.map((e, index) => (
          <div key={e.id || index} className={styles.row}>
            <div className={styles.view}>
              <div className={styles.main}>
                <span>{e.email}</span>
              </div>

              <div className={styles.meta}>
                {e.principal && (
                  <span className={styles.badgePrimary}>
                    Principal
                  </span>
                )}

                {e.verificado && (
                  <span className={styles.badgeVerified}>
                    Verificado
                  </span>
                )}

                {e.tipo && (
                  <span className={styles.badge}>
                    {e.tipo}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.removeBtn}
                onClick={() => removeEmail(index)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FORM TOGGLE */}
      <div className={styles.form}>
        {!isAddingEmail ? (
          <button
            className={styles.addBtn}
            onClick={() => setIsAddingEmail(true)}
          >
            + Adicionar e-mail
          </button>
        ) : (
          <>
            <h4>Novo e-mail</h4>

            <input
              className={styles.input}
              value={emailForm.email}
              onChange={e =>
                setEmailForm({
                  ...emailForm,
                  email: e.target.value,
                })
              }
              placeholder="E-mail"
            />

            <div className={styles.grid2}>
              <select
                className={styles.select}
                value={emailForm.tipo || 'GERAL'}
                onChange={e =>
                  setEmailForm({
                    ...emailForm,
                    tipo: e.target.value,
                  })
                }
              >
                <option value="GERAL">Geral</option>
                <option value="FINANCEIRO">Financeiro</option>
                <option value="COMERCIAL">Comercial</option>
              </select>

              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={!!emailForm.principal}
                  onChange={e =>
                    setEmailForm({
                      ...emailForm,
                      principal: e.target.checked,
                    })
                  }
                />
                Principal
              </label>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.saveBtn}
                onClick={() => {
                  if (!validaEmail(emailForm.email)) {
                    alert('E-mail inválido');
                    return;
                  }

                  addEmail();
                  setIsAddingEmail(false);
                }}
              >
                ✔ Salvar
              </button>

              <button
                className={styles.cancelBtn}
                onClick={() => setIsAddingEmail(false)}
              >
                ✕ Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default EmailsSection;