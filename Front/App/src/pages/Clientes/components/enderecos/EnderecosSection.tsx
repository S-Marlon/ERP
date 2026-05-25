import React from 'react';
import styles from './EnderecosSection.module.css';

type Endereco = {
  id?: number;
  tipo: 'FISCAL' | 'ENTREGA' | 'COBRANCA' | 'FILIAL';
  principal?: boolean;

  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  referencia?: string;
};

type Props = {
   enderecos: Endereco[];
  setEnderecos: (enderecos: Endereco[]) => void;
  enderecoForm: Endereco;
  setEnderecoForm: (e: Endereco) => void;

  isAddingEndereco: boolean;
  setIsAddingEndereco: (v: boolean) => void;

  maskCEP: (v: string) => string;
};

const EnderecosSection = ({
  enderecos,
  setEnderecos,
  enderecoForm,
  setEnderecoForm,
  isAddingEndereco,
  setIsAddingEndereco,
  maskCEP,
}: Props) => {
  return (
    <section className={styles.card}>
      <h3 className={styles.title}>📍 Endereços</h3>

      {/* LISTA */}
      <div className={styles.list}>
        {enderecos.length === 0 && (
          <p className={styles.emptyState}>
            Nenhum endereço cadastrado.
          </p>
        )}

        {enderecos.map((e, index) => (
          <div key={e.id || index} className={styles.row}>
            <div className={styles.view}>
              <div className={styles.main}>
                <strong>{e.tipo}</strong>

                {e.principal && (
                  <span className={styles.badgePrimary}>
                    Principal
                  </span>
                )}
              </div>

              <div className={styles.address}>
                {e.logradouro}, {e.numero} - {e.bairro}
              </div>

              <div className={styles.city}>
                {e.cidade} - {e.estado} | {e.cep}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.removeBtn}
                
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FORM TOGGLE */}
      <div className={styles.form}>
        {!isAddingEndereco ? (
          <button
            className={styles.addBtn}
            onClick={() => setIsAddingEndereco(true)}
          >
            + Adicionar endereço
          </button>
        ) : (
          <>
            <h4>Novo endereço</h4>

            <select
              className={styles.input}
              value={enderecoForm.tipo}
              onChange={e =>
                setEnderecoForm({
                  ...enderecoForm,
                  tipo: e.target.value as any,
                })
              }
            >
              <option value="FISCAL">Fiscal</option>
              <option value="ENTREGA">Entrega</option>
              <option value="COBRANCA">Cobrança</option>
              <option value="FILIAL">Filial</option>
            </select>

            <input
              className={styles.input}
              value={enderecoForm.cep}
              onChange={e =>
                setEnderecoForm({
                  ...enderecoForm,
                  cep: maskCEP(e.target.value),
                })
              }
              placeholder="CEP"
            />

            <input
              className={styles.input}
              value={enderecoForm.logradouro}
              onChange={e =>
                setEnderecoForm({
                  ...enderecoForm,
                  logradouro: e.target.value,
                })
              }
              placeholder="Logradouro"
            />

            <div className={styles.grid2}>
              <input
                className={styles.input}
                value={enderecoForm.numero}
                onChange={e =>
                  setEnderecoForm({
                    ...enderecoForm,
                    numero: e.target.value,
                  })
                }
                placeholder="Número"
              />

              <input
                className={styles.input}
                value={enderecoForm.bairro}
                onChange={e =>
                  setEnderecoForm({
                    ...enderecoForm,
                    bairro: e.target.value,
                  })
                }
                placeholder="Bairro"
              />
            </div>

            <div className={styles.grid2}>
              <input
                className={styles.input}
                value={enderecoForm.cidade}
                onChange={e =>
                  setEnderecoForm({
                    ...enderecoForm,
                    cidade: e.target.value,
                  })
                }
                placeholder="Cidade"
              />

              <input
                className={styles.input}
                value={enderecoForm.estado}
                onChange={e =>
                  setEnderecoForm({
                    ...enderecoForm,
                    estado: e.target.value.toUpperCase(),
                  })
                }
                placeholder="UF"
                maxLength={2}
              />
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={!!enderecoForm.principal}
                onChange={e =>
                  setEnderecoForm({
                    ...enderecoForm,
                    principal: e.target.checked,
                  })
                }
              />
              Principal
            </label>

            <div className={styles.actions}>
              <button
                className={styles.saveBtn}
                onClick={() => {
                 setEnderecos(
  enderecos.filter((_, i) => i !== index)
)

                  setEnderecoForm({
                    tipo: 'FISCAL',
                    cep: '',
                    logradouro: '',
                    numero: '',
                    bairro: '',
                    cidade: '',
                    estado: '',
                    principal: false,
                  });

                  setIsAddingEndereco(false);
                }}
              >
                ✔ Salvar
              </button>

              <button
                className={styles.cancelBtn}
                onClick={() => setIsAddingEndereco(false)}
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

export default EnderecosSection;