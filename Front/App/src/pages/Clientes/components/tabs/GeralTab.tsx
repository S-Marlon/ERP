  import React, { useEffect, useMemo, useState } from 'react';
  import styles from './GeralTab.module.css';

  import type {
    Cliente,
    ClienteContato,
    ClienteEmail,
    ClienteFormData,
  } from '../../../../types/cliente.types';

  import {
    ClassificacaoCliente,
    PotencialCliente,
    SegmentoCliente,
    StatusCredito,
    TipoCliente,
    TipoContato,
  } from '../../../../types/cliente.types';

  import {
    maskCPF,
    maskCNPJ,
    maskCEP,
    maskPhone,
    validaEmail,
    validaTelefone,
  } from '../../../../utils/validators';

  interface GeralTabProps {
    cliente: Cliente;
    contatos: ClienteContato[];
    emails: ClienteEmail[];
    setContatos: React.Dispatch<React.SetStateAction<ClienteContato[]>>;
    setEmails: React.Dispatch<React.SetStateAction<ClienteEmail[]>>;
    onSave: (dados: ClienteFormData) => Promise<Cliente | null>;
  }

  const GeralTab: React.FC<GeralTabProps> = ({
    cliente,
    contatos,
    emails,
    setContatos,
    setEmails,
    onSave,
  }) => {

    // =====================================================
    // STATE PRINCIPAL
    // =====================================================

    const [formData, setFormData] = useState<Partial<Cliente>>({});
    const [loading, setLoading] = useState(false);
    const [editingContactId, setEditingContactId] = useState<number | null>(null);
const [tempContato, setTempContato] = useState<any | null>(null);

const addContato = () => {
  if (!validaTelefone(contatoForm.telefone)) return;

  const newContact = {
    id: Date.now(),
    id_cliente: cliente.id_cliente,
    telefone: maskPhone(contatoForm.telefone),
    tipo: 'GERAL',
    principal: false,
    whatsapp: false,
    referencia: '',
    criado_em: new Date().toISOString(),
  };

  setContatos(prev => [...prev, newContact]);

  // entra em modo edição automaticamente
  setEditingContactId(newContact.id);
  setTempContato(newContact);

  setContatoForm({
    telefone: '',
    tipo: 'GERAL',
    principal: false,
    whatsapp: false,
    referencia: '',
  });
};

const startEdit = (c: any) => {
  setEditingContactId(c.id);
  setTempContato({ ...c });
};

const saveEdit = () => {
  setContatos(prev =>
    prev.map(c =>
      c.id === editingContactId ? tempContato : c
    )
  );

  setEditingContactId(null);
  setTempContato(null);
};

const cancelEdit = () => {
  setEditingContactId(null);
  setTempContato(null);
};

    // contatos form
    const [contatoForm, setContatoForm] = useState({
      telefone: '',
      tipo: 'GERAL',
      principal: false,
      whatsapp: false,
      referencia: '',
    });

    // email form
    const [emailForm, setEmailForm] = useState({
      email: '',
      tipo: 'GERAL',
      principal: false,
    });

    // =====================================================
    // SYNC
    // =====================================================

    useEffect(() => {
      setFormData(cliente);
    }, [cliente]);

    const isDirty = useMemo(
      () => JSON.stringify(formData) !== JSON.stringify(cliente),
      [formData, cliente]
    );

    // =====================================================
    // HELPERS
    // =====================================================

    const updateField = <K extends keyof Cliente>(field: K, value: Cliente[K]) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateEndereco = (field: string, value: string) => {
      setFormData(prev => ({
        ...prev,
        endereco: {
          ...prev.endereco!,
          [field]: value,
        },
      }));
    };

    const mascaraDocumento = (value: string) => {
      const n = value.replace(/\D/g, '');
      return n.length <= 11 ? maskCPF(value) : maskCNPJ(value);
    };

    // =====================================================
    // CONTATOS
    // =====================================================

   

    const removeContato = (id: number) => {
      setContatos(prev => prev.filter(c => c.id !== id));
    };

    // =====================================================
    // EMAILS
    // =====================================================

    const addEmail = () => {
      if (!validaEmail(emailForm.email)) return;

      setEmails(prev => [
        ...prev,
        {
          id: Date.now(),
          id_cliente: cliente.id_cliente,
          email: emailForm.email,
          tipo: emailForm.tipo as TipoContato,
          principal: emailForm.principal,
          criado_em: new Date().toISOString(),
        },
      ]);

      setEmailForm({
        email: '',
        tipo: 'GERAL',
        principal: false,
      });
    };

    const removeEmail = (id: number) => {
      setEmails(prev => prev.filter(e => e.id !== id));
    };



    const EmailItem = ({
  email,
  setEmails,
  removeEmail,
}: any) => {
  const [editMode, setEditMode] = React.useState(false);

  const update = (field: string, value: any) => {
    setEmails((prev: any[]) =>
      prev.map((item) =>
        item.id === email.id
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  return (
    <div className={styles.row}>

      <div className={styles.rowContent}>

        {!editMode ? (
          <>
            {/* VIEW MODE */}
            <div className={styles.rowMain}>
              <span className={styles.rowText}>
                {email.email}
              </span>

              <div className={styles.badges}>
                {email.principal && (
                  <span className={styles.badgePrimary}>
                    Principal
                  </span>
                )}
                <span className={styles.badgeType}>
                  {email.tipo}
                </span>
              </div>
            </div>

            <button
              className={styles.editBtn}
              onClick={() => setEditMode(true)}
            >
              Editar
            </button>
          </>
        ) : (
          <>
            {/* EDIT MODE */}
            <input
              className={styles.inputInline}
              value={email.email}
              onChange={(e) =>
                update('email', e.target.value)
              }
            />

            <select
              className={styles.selectInline}
              value={email.tipo}
              onChange={(e) =>
                update('tipo', e.target.value)
              }
            >
              <option value="GERAL">Geral</option>
              <option value="COMERCIAL">Comercial</option>
              <option value="FINANCEIRO">Financeiro</option>
            </select>

            <label>
              <input
                type="checkbox"
                checked={email.principal}
                onChange={(e) =>
                  update('principal', e.target.checked)
                }
              />
              Principal
            </label>

            <button
              className={styles.saveBtn}
              onClick={() => setEditMode(false)}
            >
              OK
            </button>
          </>
        )}

      </div>

      {/* DELETE */}
      <button
        className={styles.removeBtn}
        onClick={() => removeEmail(email.id)}
      >
        ✕
      </button>
    </div>
  );
};

    

    // =====================================================
    // SAVE
    // =====================================================

    const handleSave = async () => {
      setLoading(true);
      try {
        await onSave(formData as ClienteFormData);
      } finally {
        setLoading(false);
      }
    };

    // =====================================================
    // UI HELPERS
    // =====================================================

    const renderSelectOptions = (EnumObj: any, labelFn?: (v: string) => string) =>
      Object.values(EnumObj).map((v) => (
        <option key={v} value={v}>
          {labelFn ? labelFn(v) : v}
        </option>
      ));

    // =====================================================
    // RENDER BLOCKS
    // =====================================================

    const DadosBasicos = () => (
      <section className={styles.card}>
        <h3 className={styles.title}>👤 Dados básicos</h3>

        <div className={styles.grid2}>
          <select
            className={styles.select}
            value={formData.tipo_cliente || ''}
            onChange={e => updateField('tipo_cliente', e.target.value as any)}
          >
            {renderSelectOptions(TipoCliente)}
          </select>

          <select
            className={styles.select}
            value={formData.segmento || ''}
            onChange={e => updateField('segmento', e.target.value as any)}
          >
            {renderSelectOptions(SegmentoCliente)}
          </select>
        </div>

        <input
          className={styles.input}
          value={formData.nome_razao || ''}
          onChange={e => updateField('nome_razao', e.target.value)}
          placeholder="Nome / Razão Social"
        />

        {formData.tipo_cliente === TipoCliente.PESSOA_JURIDICA && (
          <input
            className={styles.input}
            value={formData.nome_fantasia || ''}
            onChange={e => updateField('nome_fantasia', e.target.value)}
            placeholder="Nome Fantasia"
          />
        )}

        <input
          className={styles.input}
          value={formData.cpf_cnpj || ''}
          onChange={e => updateField('cpf_cnpj', mascaraDocumento(e.target.value))}
          placeholder="CPF / CNPJ"
        />
      </section>
    );

    const Endereco = () => (
      <section className={styles.card}>
        <h3 className={styles.title}>📍 Endereço</h3>

        <input
          className={styles.input}
          value={formData.endereco?.logradouro || ''}
          onChange={e => updateEndereco('logradouro', e.target.value)}
          placeholder="Logradouro"
        />

        <div className={styles.grid3}>
          <input
            className={styles.input}
            value={formData.endereco?.numero || ''}
            onChange={e => updateEndereco('numero', e.target.value)}
            placeholder="Número"
          />

          <input
            className={styles.input}
            value={formData.endereco?.bairro || ''}
            onChange={e => updateEndereco('bairro', e.target.value)}
            placeholder="Bairro"
          />

          <input
            className={styles.input}
            value={formData.endereco?.cep || ''}
            onChange={e => updateEndereco('cep', maskCEP(e.target.value))}
            placeholder="CEP"
          />
        </div>

        <div className={styles.grid2}>
          <input
            className={styles.input}
            value={formData.endereco?.cidade || ''}
            onChange={e => updateEndereco('cidade', e.target.value)}
            placeholder="Cidade"
          />

          <input
            className={styles.input}
            value={formData.endereco?.estado || ''}
            onChange={e => updateEndereco('estado', e.target.value.toUpperCase())}
            placeholder="UF"
            maxLength={2}
          />
        </div>
      </section>
    );

   const Financeiro = () => (
  <section className={styles.card}>
    <h3 className={styles.title}>💳 Crédito</h3>

    <div className={styles.grid2}>
      <input
        className={styles.input}
        type="number"
        value={formData.limite_credito || 0}
        onChange={(e) =>
          updateField(
            'limite_credito' as any,
            Number(e.target.value)
          )
        }
        placeholder="Limite de crédito"
      />

      <input
        className={styles.input}
        type="number"
        value={formData.dia_vencimento || 1}
        onChange={(e) =>
          updateField(
            'dia_vencimento' as any,
            Number(e.target.value)
          )
        }
        placeholder="Dia vencimento"
      />
    </div>

    <select
      className={styles.select}
      value={formData.status_credito || ''}
      onChange={(e) =>
        updateField(
          'status_credito' as any,
          e.target.value
        )
      }
    >
      {Object.values(StatusCredito).map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>

    <input
      className={styles.input}
      type="number"
      value={formData.saldo_devedor_atual || 0}
      onChange={(e) =>
        updateField(
          'saldo_devedor_atual' as any,
          Number(e.target.value)
        )
      }
      placeholder="Saldo devedor atual"
    />
  </section>
);

    // =====================================================
    // RETURN
    // =====================================================

    return (
      <div className={styles.container}>

        <div className={styles.grid}>

          <div className={styles.col}>
            <DadosBasicos />
            <Endereco />
            <Financeiro />

            {/* você pode continuar separando Crédito / CRM igual acima */}
          </div>

         <div className={styles.col}>

  {/* CONTATOS */}
  <section className={styles.card}>
  <h3 className={styles.title}>📞 Contatos</h3>

  <div className={styles.list}>

    {contatos.map(c => {
      const isEditing = editingContactId === c.id;
      const data = isEditing ? tempContato : c;

      return (
        <div key={c.id} className={styles.row}>

          <div className={styles.rowContent}>

            {/* TELEFONE */}
            <div className={styles.rowMain}>
              <span className={styles.rowText}>{c.telefone}</span>

              {c.principal && (
                <span className={styles.badgePrimary}>Principal</span>
              )}

              {c.whatsapp && (
                <span className={styles.badgeWhatsapp}>WhatsApp</span>
              )}
            </div>

            {/* MODO EDIÇÃO */}
            {isEditing ? (
              <>
                {/* TIPO */}
                <select
                  className={styles.selectInline}
                  value={data.tipo}
                  onChange={(e) =>
                    setTempContato({
                      ...data,
                      tipo: e.target.value,
                    })
                  }
                >
                  <option value="GERAL">Geral</option>
                  <option value="COMERCIAL">Comercial</option>
                  <option value="FINANCEIRO">Financeiro</option>
                </select>

                {/* REFERÊNCIA */}
                <input
                  className={styles.inputInline}
                  value={data.referencia || ''}
                  onChange={(e) =>
                    setTempContato({
                      ...data,
                      referencia: e.target.value,
                    })
                  }
                  placeholder="Referência"
                />

                {/* FLAGS */}
                <label>
                  <input
                    type="checkbox"
                    checked={data.principal || false}
                    onChange={(e) =>
                      setTempContato({
                        ...data,
                        principal: e.target.checked,
                      })
                    }
                  />
                  Principal
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={data.whatsapp || false}
                    onChange={(e) =>
                      setTempContato({
                        ...data,
                        whatsapp: e.target.checked,
                      })
                    }
                  />
                  WhatsApp
                </label>

                {/* ACTIONS */}
                <div className={styles.editActions}>
                  <button onClick={saveEdit}>Salvar</button>
                  <button onClick={cancelEdit}>Cancelar</button>
                </div>

              </>
            ) : (
              /* MODO VISUAL */
              <div className={styles.rowMeta}>
                <small>{c.tipo}</small>
                {c.referencia && <small>• {c.referencia}</small>}
              </div>
            )}

          </div>

          {/* AÇÕES */}
          <div className={styles.actions}>

            {!isEditing && (
              <button onClick={() => startEdit(c)}>
                Editar
              </button>
            )}

            <button
              className={styles.removeBtn}
              onClick={() =>
                setContatos(prev =>
                  prev.filter(item => item.id !== c.id)
                )
              }
            >
              ✕
            </button>

          </div>

        </div>
      );
    })}

  </div>

  {/* ADD CONTATO */}
  <div className={styles.formBlock}>
    <input
      className={styles.input}
      value={contatoForm.telefone}
      onChange={e =>
        setContatoForm({
          ...contatoForm,
          telefone: maskPhone(e.target.value),
        })
      }
      placeholder="Telefone"
    />

    <button className={styles.addBtn} onClick={addContato}>
      +
    </button>
  </div>
</section>

  {/* EMAILS (mantido simples) */}
  <section className={styles.card}>
  <h3 className={styles.title}>📧 Emails</h3>

  {/* LISTA */}
  <div className={styles.list}>
    {emails.map((e) => (
      <EmailItem
        key={e.id}
        email={e}
        setEmails={setEmails}
        removeEmail={removeEmail}
      />
    ))}
  </div>

  {/* ADD EMAIL */}
  <div className={styles.formBlock}>
    <input
      className={styles.input}
      value={emailForm.email}
      onChange={(ev) =>
        setEmailForm({ ...emailForm, email: ev.target.value })
      }
      placeholder="Email"
    />

    <select
      className={styles.select}
      value={emailForm.tipo}
      onChange={(e) =>
        setEmailForm({
          ...emailForm,
          tipo: e.target.value as any,
        })
      }
    >
      <option value="GERAL">Geral</option>
      <option value="COMERCIAL">Comercial</option>
      <option value="FINANCEIRO">Financeiro</option>
    </select>

    <label className={styles.checkboxInline}>
      <input
        type="checkbox"
        checked={emailForm.principal}
        onChange={(e) =>
          setEmailForm({
            ...emailForm,
            principal: e.target.checked,
          })
        }
      />
      Principal
    </label>

    <button className={styles.addBtn} onClick={addEmail}>
      +
    </button>
  </div>
</section>

</div>
        </div>

        <div className={styles.actionsBar}>
          {isDirty && <span className={styles.warning}>⚠️ Alterações não salvas</span>}

          <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>

      </div>
    );
  };

  export default GeralTab;