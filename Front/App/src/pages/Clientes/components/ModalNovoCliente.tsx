import React, { useState } from 'react';
import { 
  type Cliente, 
  type TipoPessoa, 
  type StatusCliente 
} from '../../types/cliente.types';

import styles from './ModalNovoCliente.module.css';

interface ModalNovoClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (novoCliente: any) => void; // Ajustado para refletir a estrutura do seu banco
}

export const ModalNovoCliente = ({ isOpen, onClose, onSave }: ModalNovoClienteProps) => {
  // Estado inicial dividido exatamente entre a estrutura do banco
  const [formData, setFormData] = useState({
    // --- DADOS INDISPENSÁVEIS ---
    tipo_pessoa: 'PF' as TipoPessoa,
    status: 'ATIVO' as StatusCliente,
    aceita_marketing: 0,
    
    // Se PF
    nome: '',
    cpf: '',
    rg: '',
    
    // Se PJ
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    inscricao_estadual: '',

    // --- INFORMAÇÕES IMPORTANTES (OPCIONAIS) ---
    // Endereço
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    tipo_endereco: 'PRINCIPAL',
    
    // Outros
    observacoes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação Manual dos Obrigatórios baseado no Tipo de Pessoa
    if (formData.tipo_pessoa === 'PF') {
      if (!formData.nome.trim() || !formData.cpf.trim()) {
        alert('Por favor, preencha o Nome e o CPF.');
        return;
      }
    } else {
      if (!formData.razao_social.trim() || !formData.cnpj.trim()) {
        alert('Por favor, preencha a Razão Social e o CNPJ.');
        return;
      }
    }

    // Monta o payload estruturado simulando o que o banco espera receber
    const payloadDoCliente = {
      core: {
        tipo_pessoa: formData.tipo_pessoa,
        status: formData.status,
        aceita_marketing: formData.aceita_marketing,
        observacoes: formData.observacoes || null,
      },
      // Dados específicos da extensão do cliente
      especifico: formData.tipo_pessoa === 'PF' 
        ? {
            nome: formData.nome,
            cpf: formData.cpf.replace(/\D/g, ''), // Limpa máscara
            rg: formData.rg || null
          }
        : {
            razao_social: formData.razao_social,
            nome_fantasia: formData.nome_fantasia || null,
            cnpj: formData.cnpj.replace(/\D/g, ''), // Limpa máscara
            inscricao_estadual: formData.inscricao_estadual || null
          },
      // Endereço só é enviado se pelo menos a Cidade/Estado ou Logradouro forem preenchidos
      endereco: formData.logradouro || formData.cidade 
        ? {
            tipo: formData.tipo_endereco,
            principal: 1,
            logradouro: formData.logradouro || null,
            numero: formData.numero || null,
            complemento: formData.complemento || null,
            bairro: formData.bairro || null,
            cidade: formData.cidade || null,
            estado: formData.estado || null,
            cep: formData.cep || null,
            pais: 'Brasil'
          }
        : null
    };

    onSave(payloadDoCliente);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2>✨ Cadastrar Novo Cliente</h2>
          <button type="button" className={styles.btnClose} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          
          {/* ================= SEÇÃO 1: DADOS INDISPENSÁVEIS ================= */}
          <div className={styles.sectionContainer}>
            <h3 className={styles.sectionTitle}>📌 Dados Obrigatórios</h3>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Tipo de Pessoa *</label>
                <select 
                  value={formData.tipo_pessoa}
                  onChange={e => setFormData({...formData, tipo_pessoa: e.target.value as TipoPessoa})}
                >
                  <option value="PF">Pessoa Física (CPF)</option>
                  <option value="PJ">Pessoa Jurídica (CNPJ)</option>
                </select>
              </div>

              {/* Input Dinâmico: CPF ou CNPJ */}
              <div className={styles.formGroup}>
                <label>{formData.tipo_pessoa === 'PF' ? 'CPF *' : 'CNPJ *'}</label>
                <input 
                  type="text" 
                  required
                  placeholder={formData.tipo_pessoa === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                  value={formData.tipo_pessoa === 'PF' ? formData.cpf : formData.cnpj}
                  onChange={e => setFormData({
                    ...formData, 
                    [formData.tipo_pessoa === 'PF' ? 'cpf' : 'cnpj']: e.target.value
                  })}
                />
              </div>
            </div>

            {/* Campos exclusivos para Pessoa Física */}
            {formData.tipo_pessoa === 'PF' && (
              <div className={styles.formRow}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Nome Completo *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: José Maurício"
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>RG (Opcional)</label>
                  <input 
                    type="text" 
                    value={formData.rg}
                    onChange={e => setFormData({...formData, rg: e.target.value})}
                  />
                </div>
              </div>
            )}

            {/* Campos exclusivos para Pessoa Jurídica */}
            {formData.tipo_pessoa === 'PJ' && (
              <>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Razão Social *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ex: MARLON SONDA LTDA"
                    value={formData.razao_social}
                    onChange={e => setFormData({...formData, razao_social: e.target.value})}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Nome Fantasia</label>
                    <input 
                      type="text" 
                      value={formData.nome_fantasia}
                      onChange={e => setFormData({...formData, nome_fantasia: e.target.value})}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Inscrição Estadual</label>
                    <input 
                      type="text" 
                      value={formData.inscricao_estadual}
                      onChange={e => setFormData({...formData, inscricao_estadual: e.target.value})}
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <hr className={styles.divider} />

         

          {/* AÇÕES DO MODAL */}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSalvar}>Confirmar Cadastro</button>
          </div>
        </form>
      </div>
    </div>
  );
};