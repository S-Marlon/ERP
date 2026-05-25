import React, { useState } from 'react';
import { 
  type Cliente,
  type TipoCliente,
  type StatusCredito,
  type StatusCliente
} from '../../types/cliente.types';

import styles from './ModalNovoCliente.module.css'; // Importação do CSS Module

interface ModalNovoClienteProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (novoCliente: Cliente) => void;
}

export const ModalNovoCliente = ({ isOpen, onClose, onSave }: ModalNovoClienteProps) => {
  // Estado inicial baseado estritamente na sua interface 'Cliente'
  const [formData, setFormData] = useState({
    tipo_cliente: 'CONSUMIDOR' as TipoCliente,
    nome_razao: '',
    cpf_cnpj: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome_razao.trim() || !formData.cpf_cnpj.trim()) {
      alert('Por favor, preencha o Nome/Razão Social e o CPF/CNPJ.');
      return;
    }

    // Monta o objeto exato esperado pela sua interface 'Cliente'
    const novoCliente: Cliente = {
      id_cliente: Date.now(), // Será removido no POST do Clientes.tsx
      nome_razao: formData.nome_razao,
      cpf_cnpj: formData.cpf_cnpj,
      tipo_cliente: formData.tipo_cliente,
      endereco: formData.endereco || undefined,
      bairro: formData.bairro || undefined,
      cidade: formData.cidade || undefined,
      estado: formData.estado || undefined,
      cep: formData.cep || undefined,
      observacoes: formData.observacoes || undefined,
      
      // Valores financeiros e cadastrais padrão do seu tipo
      limite_credito: 0,
      dia_vencimento: 10,
      status_credito: 'LIBERADO' as StatusCredito,
      status_cliente: 'ATIVO' as StatusCliente,
      saldo_devedor_atual: 0,
      criado_em: new Date().toISOString()
    };

    onSave(novoCliente);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2>✨ Cadastrar Novo Cliente</h2>
          <button type="button" className={styles.btnClose} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          
          {/* GRUPO: TIPO DE CLIENTE */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Perfil do Cliente</label>
              <select 
                value={formData.tipo_cliente}
                onChange={e => setFormData({...formData, tipo_cliente: e.target.value as TipoCliente})}
              >
                <option value="CONSUMIDOR">Consumidor</option>
                <option value="SERRALHERIA">Serralheria</option>
                <option value="OFICINA">Oficina</option>
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label>CPF / CNPJ *</label>
              <input 
                type="text" 
                required
                placeholder="Apenas números ou formatado"
                value={formData.cpf_cnpj}
                onChange={e => setFormData({...formData, cpf_cnpj: e.target.value})}
              />
            </div>
          </div>

          {/* GRUPO: DADOS BÁSICOS */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label>Nome / Razão Social *</label>
            <input 
              type="text" 
              required
              placeholder="Ex: João da Silva ou Metalúrgica Silva LTDA"
              value={formData.nome_razao}
              onChange={e => setFormData({...formData, nome_razao: e.target.value})}
            />
          </div>

          {/* GRUPO: ENDEREÇO */}
          <h3>📍 Localização</h3>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 2 }}>
              <label>Endereço (Rua, Nº, Compl.)</label>
              <input 
                type="text" 
                placeholder="Av. Principal, 1500"
                value={formData.endereco}
                onChange={e => setFormData({...formData, endereco: e.target.value})}
              />
            </div>
            <div className={styles.formGroup}>
              <label>CEP</label>
              <input 
                type="text" 
                placeholder="00000-000"
                value={formData.cep}
                onChange={e => setFormData({...formData, cep: e.target.value})}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Bairro</label>
              <input 
                type="text" 
                value={formData.bairro}
                onChange={e => setFormData({...formData, bairro: e.target.value})}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Cidade</label>
              <input 
                type="text" 
                value={formData.cidade}
                onChange={e => setFormData({...formData, city: e.target.value})} // Alinhado com o estado local 'cidade'
                /* Nota: Corrigido e.target.value para mapear corretamente o campo cidade do seu state */
                onChange={e => setFormData({...formData, cidade: e.target.value})}
              />
            </div>
            <div className={styles.formGroup} style={{ maxWidth: '80px' }}>
              <label>UF</label>
              <input 
                type="text" 
                maxLength={2}
                placeholder="SP"
                value={formData.estado}
                onChange={e => setFormData({...formData, estado: e.target.value.toUpperCase()})}
              />
            </div>
          </div>

          {/* COMPLEMENTO: OBSERVAÇÕES */}
          <div className={`${styles.formGroup} ${styles.fullWidth}`}>
            <label>Observações Internas</label>
            <textarea 
              rows={3}
              placeholder="Informações comerciais importantes..."
              value={formData.observacoes}
              onChange={e => setFormData({...formData, observacoes: e.target.value})}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
            />
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.btnCancelar} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnSalvar}>Confirmar Cadastro</button>
          </div>
        </form>
      </div>
    </div>
  );
};