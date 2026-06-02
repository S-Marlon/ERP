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

  {/* =========================
      RESUMO GERAL
  ========================= */}
  <div className={styles.grid3}>
    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>Tipo de Cliente</label>
      <div className={styles.readonlyValue}>
        {formData.tipo_cliente === 'PESSOA_FISICA'
          ? '👤 Pessoa Física'
          : '🏢 Pessoa Jurídica'}
      </div>
    </div>

    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>Status</label>
      <div className={styles.readonlyValue}>
        {formData.status_cliente === StatusCliente.ATIVO
          ? '🟢 Ativo'
          : formData.status_cliente === StatusCliente.INATIVO
          ? '⚫ Inativo'
          : '🔴 Bloqueado'}
      </div>
    </div>

    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>Segmento</label>
      <div className={styles.readonlyValue}>
        {formData.segmento || 'Não informado'}
      </div>
    </div>
  </div>

  {/* =========================
      IDENTIDADE PRINCIPAL
  ========================= */}
  <div className={styles.grid3}>
    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>
        {formData.tipo_cliente === 'PESSOA_FISICA'
          ? 'Nome Completo'
          : 'Razão Social'}
      </label>
      <div className={styles.readonlyValue}>
        {formData.nome_razao || formData.razao_social || '-'}
      </div>
    </div>

    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>Código Cliente</label>
      <div className={styles.readonlyValue}>
        {formData.id_cliente || '-'}
      </div>
    </div>

    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>
        {formData.tipo_cliente === 'PESSOA_FISICA' ? 'CPF' : 'CNPJ'}
      </label>
      <div className={styles.readonlyValue}>
        {formData.cpf_cnpj || '-'}
      </div>
    </div>
  </div>

  {/* =========================
      PF - DADOS PESSOAIS
  ========================= */}
  {formData.tipo_cliente === 'PESSOA_FISICA' && (
    <div className={styles.grid3}>
      <div className={styles.inputWrapper}>
        <label className={styles.fieldLabel}>RG</label>
        <div className={styles.readonlyValue}>
          {formData.rg_ie || '-'}
        </div>
      </div>

      <div className={styles.inputWrapper}>
        <label className={styles.fieldLabel}>Data de Nascimento</label>
        <div className={styles.readonlyValue}>
          {formData.data_nascimento
            ? new Date(formData.data_nascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
            : '-'}
        </div>
      </div>

      <div className={styles.inputWrapper}>
        <label className={styles.fieldLabel}>Gênero</label>
        <div className={styles.readonlyValue}>
          {formData.genero || '-'}
        </div>
      </div>
    </div>
  )}

  {/* =========================
      PJ - DADOS EMPRESARIAIS E FISCAIS
  ========================= */}
  {formData.tipo_cliente === 'PESSOA_JURIDICA' && (
    <>
      <div className={styles.grid3}>
        <div className={styles.inputWrapper}>
          <label className={styles.fieldLabel}>Nome Fantasia</label>
          <div className={styles.readonlyValue}>
            {formData.nome_fantasia || '-'}
          </div>
        </div>

      

      <div className={styles.grid3}>
        <div className={styles.inputWrapper}>
          <label className={styles.fieldLabel}>Última Atualização</label>
          <div className={styles.readonlyValue}>
            {formData.updated_at
              ? new Date(formData.updated_at).toLocaleDateString('pt-BR')
              : '-'}
          </div>
        </div>

          <div className={styles.inputWrapper}>
          <label className={styles.fieldLabel}>Inscrição Estadual</label>
          <div className={styles.readonlyValue}>
            {formData.inscricao_estadual || formData.rg_ie || '-'}
          </div>
        </div>

        <div className={styles.inputWrapper}>
          <label className={styles.fieldLabel}>Inscrição Municipal</label>
          <div className={styles.readonlyValue}>
            {formData.inscricao_municipal || '-'}
          </div>
        </div>
      </div>
      </div>
    </>
  )}

  {/* =========================
      RELACIONAMENTO
  ========================= */}
  <div className={styles.grid2}>
    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>Marketing</label>
      <div className={styles.readonlyValue}>
        {formData.aceita_marketing
          ? '✅ Aceita comunicações'
          : '❌ Não aceita'}
      </div>
    </div>

    <div className={styles.inputWrapper}>
      <label className={styles.fieldLabel}>Contribuinte ICMS</label>
      <div className={styles.readonlyValue}>
        {formData.contribuinte_icms || 'Não informado'}
      </div>
    </div>
  </div>
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


          {/* 4. Historico de Eventos */}

          <div className={styles.card}>
            <h3 className={styles.title}> 📜 Historico de Eventos</h3>

          </div>

          {/* 5. Documentos e Anexos */}

          <div className={styles.card}>
            <h3 className={styles.title}>📄 Documentos e Anexos</h3>

          </div>
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