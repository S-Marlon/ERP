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
  StatusCredito,
  StatusCliente,
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
import ContatosSection from '../contatos/ContatosSection';
import EmailsSection from '../emails/EmailsSection';
import EnderecosSection from '../enderecos/EnderecosSection';

interface GeralTabProps {
  cliente: Cliente;
  contatos: ClienteContato[];
  emails: ClienteEmail[];
  setContatos: React.Dispatch<React.SetStateAction<ClienteContato[]>>;
  setEmails: React.Dispatch<React.SetStateAction<ClienteEmail[]>>;
  onSave: (dados: ClienteFormData) => Promise<Cliente | null>;
}

// Interface estendida unificada para normalizar as propriedades vindas do MySQL
interface DBContato extends ClienteContato {
  id_contato?: number;
  numero?: string;
}

const GeralTab: React.FC<GeralTabProps> = ({
  cliente,
  contatos = [],
  emails = [],
  setContatos,
  setEmails,
  onSave,
}) => {
  // =====================================================
  // STATE PRINCIPAL
  // =====================================================
  const [formData, setFormData] = useState<Partial<Cliente>>({});
  const [loading, setLoading] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | number | null>(null);
  const [tempContato, setTempContato] = useState<ClienteContato | null>(null);

  const [isAddingContato, setIsAddingContato] = useState(false);



  const enderecoPadrao = useMemo(() => ({
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    pais: 'Brasil',
    referencia: ''
  }), []);

  const [contatoForm, setContatoForm] = useState({
    nome: '',
    telefone: '',
    cargo: '',
    tipo: 'GERAL',
    whatsapp: false,
    principal: false,
  });

  // =====================================================
  // SYNC E DIRTY CHECK (Expandido para segurança de dados)
  // =====================================================
  useEffect(() => {
    if (cliente) {
      setFormData({
        ...cliente,

        endereco: cliente.endereco || { ...enderecoPadrao },

        enderecos:
          cliente.enderecos?.length
            ? cliente.enderecos
            : cliente.endereco
              ? [
                {
                  ...cliente.endereco,
                  tipo: 'FISCAL',
                  principal: true,
                },
              ]
              : [],
      });
    }
  }, [cliente, enderecoPadrao]);

  const isDirty = useMemo(() => {
    if (!cliente || !formData.id_cliente) return false;

    return (
      formData.nome_razao !== cliente.nome_razao ||
      formData.nome_fantasia !== cliente.nome_fantasia ||
      formData.cpf_cnpj !== cliente.cpf_cnpj ||
      formData.tipo_cliente !== cliente.tipo_cliente ||
      formData.segmento !== cliente.segmento ||
      formData.status_cliente !== cliente.status_cliente ||
      formData.classificacao !== cliente.classificacao ||
      formData.potencial !== cliente.potencial ||
      formData.limite_credito !== cliente.limite_credito ||
      formData.dia_vencimento !== cliente.dia_vencimento ||
      formData.status_credito !== cliente.status_credito ||
      formData.endereco?.cep !== cliente.endereco?.cep ||
      formData.endereco?.logradouro !== cliente.endereco?.logradouro ||
      formData.endereco?.numero !== cliente.endereco?.numero
    );
  }, [formData, cliente]);

  // =====================================================
  // MANIPULADORES DE CAMPOS
  // =====================================================
  const updateField = <K extends keyof Cliente>(field: K, value: Cliente[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateEndereco = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      endereco: {
        ...enderecoPadrao,
        ...prev.endereco,
        [field]: value,
      }
    }));
  };

  const mascaraDocumento = (value: string) => {
    const n = value.replace(/\D/g, '');
    return n.length <= 11 ? maskCPF(value) : maskCNPJ(value);
  };

  // =====================================================
  // LÓGICA DE CONTATOS (Normalizada com Fallbacks do MySQL)
  // ===================================================== 

  const [emailForm, setEmailForm] = useState({
    email: '',
    tipo: 'GERAL',
    principal: false,
  });


  const [enderecoForm, setEnderecoForm] = useState({
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    pais: 'Brasil',
    referencia: '',
    tipo: 'ENTREGA',
  });

  const [isAddingEndereco, setIsAddingEndereco] = useState(false);

  const addEndereco = () => {
    const novo = {
      ...enderecoForm,
      id: Date.now(),
    };

    setFormData(prev => ({
      ...prev,
      enderecos: [...(prev.enderecos || []), novo],
    }));

    setEnderecoForm({
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      pais: 'Brasil',
      referencia: '',
      tipo: 'ENTREGA',
    });

    setIsAddingEndereco(false);
  };

  const removeEndereco = (index: number) => {
    setFormData(prev => ({
      ...prev,
      enderecos: (prev.enderecos || []).filter((_, i) => i !== index),
    }));
  };

  // =====================================================
  // LÓGICA DE CONTATOS (Normalizada com Fallbacks do MySQL)
  // =====================================================
  const addContato = () => {
    setContatos(prev => [
      ...prev,
      {
        ...contatoForm,
        id: Date.now(), // temporário
      },
    ]);

    setContatoForm({
      nome: '',
      telefone: '',
      cargo: '',
      tipo_telefone: 'CELULAR',
      whatsapp: false,
      principal: false,
    });

    setIsAddingContato(false);
  };

  const startEditContato = (c: Contato) => {
    setEditingContactId(c.id || c.id_contato);
    setTempContato({ ...c });
  };


  const saveEditContato = () => {
    setContatos(prev =>
      prev.map(c => {
        const idOriginal = c.id ?? c.id_contato;
        const idEdit = tempContato?.id ?? tempContato?.id_contato;

        if (idOriginal === idEdit) {
          return tempContato!;
        }

        return c;
      })
    );

    setEditingContactId(null);
    setTempContato(null);
  };


  // =====================================================
  // LÓGICA DE EMAILS
  // =====================================================

  const [isAddingEmail, setIsAddingEmail] = useState(false);




  const addEmail = () => {
    if (!validaEmail(emailForm.email)) {
      alert('E-mail inválido.');
      return;
    }

    setEmails(prev => {
      let lista = [...prev];

      if (emailForm.principal) {
        lista = lista.map(e => ({ ...e, principal: false }));
      }

      return [
        ...lista,
        {
          id: Date.now(),
          email: emailForm.email,
          tipo: emailForm.tipo || 'GERAL',
          principal: emailForm.principal,
          verificado: false,
        },
      ];
    });



    setIsAddingEmail(false); // 👈 fecha form após salvar
  };

  const removeEmail = (index: number) => {
    setEmails(prev => prev.filter((_, i) => i !== index));
  };



  // =====================================================
  // SALVAMENTO UNIFICADO
  // =====================================================
  const handleSave = async () => {
    if (!formData.nome_razao?.trim()) {
      alert("O campo Razão Social / Nome Completo é obrigatório.");
      return;
    }
    if (!formData.cpf_cnpj?.trim()) {
      alert("O campo CPF / CNPJ é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      const payload: ClienteFormData = {
        ...(formData as Cliente),
        contatos: contatos.map(c => ({
          ...c,
          telefone: c.telefone || (c as DBContato).numero // Normalização garantida pro Backend
        })),
        emails
      };
      await onSave(payload);
    } catch (err) {
      console.error('Erro ao salvar formulário principal:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid}>

        {/* COLUNA ESQUERDA: CADASTROS E MESTRES */}
        <div className={styles.col}>

          {/* 1. IDENTIFICAÇÃO E PERFIL */}
          <section className={styles.card}>

            <h3 className={styles.title}>👤 Identificação e Perfil</h3>

            <div className={styles.grid3}>
              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>
                  Tipo
                </label>

                ```
                <select
                  className={styles.select}
                  value={formData.tipo_cliente || ''}
                  onChange={(e) =>
                    updateField(
                      'tipo_cliente',
                      e.target.value as TipoCliente
                    )
                  }
                >
                  <option value={TipoCliente.PESSOA_FISICA}>
                    👤 Pessoa Física
                  </option>

                  <option value={TipoCliente.PESSOA_JURIDICA}>
                    🏢 Pessoa Jurídica
                  </option>
                </select>
                ```

              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>
                  Segmento
                </label>

                ```
                <select
                  className={styles.select}
                  value={formData.segmento || ''}
                  onChange={(e) =>
                    updateField('segmento', e.target.value)
                  }
                >
                  <option value="">
                    Selecione
                  </option>

                  <option value="VAREJO">
                    🛒 Varejo
                  </option>

                  <option value="DISTRIBUIDOR">
                    📦 Distribuidor
                  </option>

                  <option value="INDUSTRIA">
                    🏭 Indústria
                  </option>

                  <option value="SERVICOS">
                    🧰 Serviços
                  </option>

                  <option value="ATACADO">
                    🚚 Atacado
                  </option>
                </select>
                ```

              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>
                  Status
                </label>

                ```
                <select
                  className={styles.select}
                  value={formData.status_cliente || ''}
                  onChange={(e) =>
                    updateField(
                      'status_cliente',
                      e.target.value as StatusCliente
                    )
                  }
                >
                  <option value={StatusCliente.ATIVO}>
                    🟢 Ativo
                  </option>

                  <option value={StatusCliente.INATIVO}>
                    ⚫ Inativo
                  </option>

                  <option value={StatusCliente.BLOQUEADO}>
                    🔴 Bloqueado
                  </option>
                </select>
                ```

              </div>
            </div>


            <div className={styles.inputWrapper}>
              <label className={styles.fieldLabel}>Razão Social / Nome Completo *</label>
              <input
                className={styles.input}
                value={formData.nome_razao || ''}
                onChange={e => updateField('nome_razao', e.target.value)}
                placeholder="Razão Social ou Nome Completo"
              />
            </div>

            {formData.tipo_cliente === TipoCliente.PESSOA_JURIDICA && (
              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Nome Fantasia</label>
                <input
                  className={styles.input}
                  value={formData.nome_fantasia || ''}
                  onChange={e => updateField('nome_fantasia', e.target.value)}
                  placeholder="Nome Fantasia da Empresa"
                />
              </div>
            )}

            <div className={styles.grid2}>
              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>CPF / CNPJ *</label>
                <input
                  className={styles.input}
                  value={formData.cpf_cnpj || ''}
                  onChange={e => updateField('cpf_cnpj', mascaraDocumento(e.target.value))}
                  placeholder="Documento oficial"
                />
              </div>

            </div>


{formData.tipo_cliente === TipoCliente.PESSOA_JURIDICA && (
  <div className={styles.grid2}>
    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>
        Inscrição Estadual
      </label>

      <input
        className={styles.input}
        value={formData.inscricao_estadual || ''}
        onChange={e =>
          updateField('inscricao_estadual', e.target.value)
        }
        placeholder="IE"
      />
    </div>

    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>
        Inscrição Municipal
      </label>

      <input
        className={styles.input}
        value={formData.inscricao_municipal || ''}
        onChange={e =>
          updateField('inscricao_municipal', e.target.value)
        }
        placeholder="IM"
      />
    </div>
  </div>
)}

<div className={styles.inputWrapper}>
  <label className={styles.fieldLabel}>
    Observações
  </label>

  <textarea
    className={styles.textarea}
    value={formData.observacoes || ''}
    onChange={e =>
      updateField('observacoes', e.target.value)
    }
    placeholder="Informações rápidas do cliente..."
  />
</div>


<div className={styles.badges}>
  <span className={styles.badgeA}>
    Classe {formData.classificacao}
  </span>

  <span className={styles.badgeCredito}>
    {formData.status_credito}
  </span>
</div>

<div className={styles.inputWrapper}>
  <label className={styles.fieldLabel}>
    Cliente desde
  </label>

  <input
    className={styles.input}
    readOnly
    value={
      formData.criado_em
        ? new Date(formData.criado_em).toLocaleDateString()
        : ''
    }
  />
</div>

<div className={styles.inputWrapper}>
  <label className={styles.fieldLabel}>
    Última compra
  </label>

  <input
    className={styles.input}
    readOnly
    value={
      formData.ultima_compra
        ? new Date(formData.ultima_compra).toLocaleDateString()
        : 'Sem compras'
    }
  />
</div>

<label className={styles.checkbox}>
  <input
    type="checkbox"
    checked={!!formData.aceita_marketing}
    onChange={e =>
      updateField(
        'aceita_marketing',
        e.target.checked
      )
    }
  />

  Aceita comunicações e marketing
</label>

// Fiscal
inscricao_estadual?: string;
inscricao_municipal?: string;
indicador_ie?: 'CONTRIBUINTE' | 'ISENTO' | 'NAO_CONTRIBUINTE';

// Jurídico
suframa?: string;

// Pessoa Física
rg?: string;
orgao_emissor?: string;
data_nascimento?: string;

// Empresa
data_fundacao?: string;

<select>
  <option>Contribuinte ICMS</option>
  <option>Isento</option>
  <option>Não contribuinte</option>
</select>


          </section>




          {/* 3. ENDEREÇO PRINCIPAL */}
<EnderecosSection
            enderecos={formData.enderecos || []}
            setEnderecos={(updater) =>
  setFormData(prev => ({
    ...prev,
    enderecos:
      typeof updater === 'function'
        ? updater(prev.enderecos || [])
        : updater,
  }))
}
            enderecoForm={enderecoForm}
            setEnderecoForm={setEnderecoForm}
            addEndereco={addEndereco}
            removeEndereco={removeEndereco}
            maskCEP={maskCEP}
            isAddingEndereco={isAddingEndereco}
            setIsAddingEndereco={setIsAddingEndereco}
          />


          {/* 4. CONFIGURAÇÕES COMERCIAIS E FINANCEIRAS */}
          <section className={styles.card}>
            <h3 className={styles.title}>📈 Classificação Comercial & Crédito</h3>
            <div className={styles.grid2}>
              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Classificação ABC</label>
                <select
                  className={styles.select}
                  value={formData.classificacao || ''}
                  onChange={e => updateField('classificacao', e.target.value as ClassificacaoCliente)}
                >
                  <option value="">Não Definida</option>
                  <option value={ClassificacaoCliente.A}>Classe A (Alto Valor)</option>
                  <option value={ClassificacaoCliente.B}>Classe B (Médio Valor)</option>
                  <option value={ClassificacaoCliente.C}>Classe C (Baixo Valor)</option>
                </select>
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Potencial do Cliente</label>
                <select
                  className={styles.select}
                  value={formData.potencial || ''}
                  onChange={e => updateField('potencial', e.target.value as PotencialCliente)}
                >
                  <option value="">Não Definido</option>
                  <option value={PotencialCliente.BAIXO}>Baixo</option>
                  <option value={PotencialCliente.MEDIO}>Médio</option>
                  <option value={PotencialCliente.ALTO}>Alto</option>
                  <option value={PotencialCliente.ESTRATEGICO}>Estratégico</option>
                </select>
              </div>
            </div>

            <div className={styles.grid2} style={{ marginTop: '12px' }}>
              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Limite de Crédito (R$)</label>
                <input
                  className={styles.input}
                  type="number"
                  value={formData.limite_credito ?? 0}
                  onChange={e => updateField('limite_credito', Number(e.target.value))}
                />
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Melhor Dia Vencimento</label>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={31}
                  value={formData.dia_vencimento ?? 1}
                  onChange={e => updateField('dia_vencimento', Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.grid2}>
              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Status de Risco de Crédito</label>
                <select
                  className={styles.select}
                  value={formData.status_credito || ''}
                  onChange={e => updateField('status_credito', e.target.value as StatusCredito)}
                >
                  <option value={StatusCredito.ANALISE}>Análise</option>
                  <option value={StatusCredito.APROVADO}>Aprovado</option>
                  <option value={StatusCredito.RECUSADO}>Recusado</option>
                  <option value={StatusCredito.SUSPENSO}>Suspenso</option>
                </select>
              </div>

              <div className={styles.inputWrapper}>
                <label className={styles.fieldLabel}>Saldo Devedor Atual</label>
                <input
                  className={styles.input}
                  type="number"
                  value={formData.saldo_devedor_atual ?? 1}
                  style={{ backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                />
              </div>
            </div>
          </section>
        </div>

        {/* COLUNA DIREITA: RELACIONAMENTOS (CONTATOS E EMAILS ADICIONAIS) */}
        <div className={styles.col}>

          <ContatosSection
            contatos={contatos}
            setContatos={setContatos}
            editingContactId={editingContactId}
            setEditingContactId={setEditingContactId}
            tempContato={tempContato}
            setTempContato={setTempContato}
            contatoForm={contatoForm}
            setContatoForm={setContatoForm}
            addContato={addContato}
            startEditContato={startEditContato}
            saveEditContato={saveEditContato}
            isAddingContato={isAddingContato}
            setIsAddingContato={setIsAddingContato}
            maskPhone={maskPhone}
          />

          {/* SESSÃO: CANAIS DE EMAIL */}
          <EmailsSection
            emails={emails}
            setEmails={setEmails}
            emailForm={emailForm}
            setEmailForm={setEmailForm}
            addEmail={addEmail}
            removeEmail={removeEmail}
            validaEmail={validaEmail}
            isAddingEmail={isAddingEmail}
            setIsAddingEmail={setIsAddingEmail}
          />


        </div>
      </div>

      {/* BARRA DE BOTÕES GLOBAL */}
      <div className={styles.actionsBar}>
        {isDirty && <span className={styles.warning}>⚠️ Há modificações pendentes de salvamento neste cliente.</span>}
        <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
          {loading ? 'Sincronizando Banco...' : '💾 Gravar Alterações'}
        </button>
      </div>

    </div>
  );
};

export default GeralTab;