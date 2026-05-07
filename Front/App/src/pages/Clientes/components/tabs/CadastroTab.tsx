/**
 * COMPONENTE: CadastroTab
 * Aba para editar dados cadastrais do cliente
 */

import React, { useState, useEffect } from 'react';
import type { Cliente, ClienteFormData } from '../../../../types/cliente.types';
import {
  maskCPF,
  maskCNPJ,
  maskCEP,
  validaCPF,
  validaCNPJ,
} from '../../../../utils/validators';

import './CadastroTab.css';

interface CadastroTabProps {
  cliente: Cliente | null;
  onSave: (dados: ClienteFormData) => Promise<Cliente | null>;
}

const CadastroTab: React.FC<CadastroTabProps> = ({ cliente, onSave }) => {
  const [formData, setFormData] = useState<Partial<Cliente>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // =========================================================================
  // SYNC CLIENTE → FORM
  // =========================================================================

  useEffect(() => {
    if (cliente) {
      setFormData(cliente);
    }
  }, [cliente]);

  // =========================================================================
  // HELPERS
  // =========================================================================

  const mascaraCPFouCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.length <= 11 ? maskCPF(value) : maskCNPJ(value);
  };

  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(cliente || {});

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleChange = (field: keyof Cliente, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (erros[field]) {
      setErros((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validarFormulario = (): boolean => {
    const novosErros: Record<string, string> = {};

    if (!formData.nome_razao?.trim()) {
      novosErros.nome_razao = 'Nome/Razão Social é obrigatório';
    }

    if (formData.cpf_cnpj) {
      const cpf_cnpj = formData.cpf_cnpj.replace(/\D/g, '');

      if (cpf_cnpj.length === 11 && !validaCPF(formData.cpf_cnpj)) {
        novosErros.cpf_cnpj = 'CPF inválido';
      }

      if (cpf_cnpj.length === 14 && !validaCNPJ(formData.cpf_cnpj)) {
        novosErros.cpf_cnpj = 'CNPJ inválido';
      }
    }

    if (formData.limite_credito && formData.limite_credito < 0) {
      novosErros.limite_credito = 'Limite deve ser maior que zero';
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSalvar = async () => {
    if (!validarFormulario()) return;

    setLoading(true);
    try {
      await onSave(formData as ClienteFormData);
    } finally {
      setLoading(false);
    }
  };

  if (!cliente) {
    return <div className="tab-empty">Nenhum cliente selecionado</div>;
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="cadastro-tab">
      <form onSubmit={(e) => e.preventDefault()}>
        
        {/* IDENTIFICAÇÃO */}
        <div className="form-section">
          <h3>👤 Identificação</h3>

          <input
            type="text"
            value={formData.nome_razao || ''}
            onChange={(e) => handleChange('nome_razao', e.target.value)}
            placeholder="Nome / Razão Social"
          />
          {erros.nome_razao && <span>{erros.nome_razao}</span>}

          <input
            type="text"
            value={formData.cpf_cnpj || ''}
            onChange={(e) =>
              handleChange('cpf_cnpj', mascaraCPFouCNPJ(e.target.value))
            }
            placeholder="CPF / CNPJ"
          />
          {erros.cpf_cnpj && <span>{erros.cpf_cnpj}</span>}
        </div>

        {/* ENDEREÇO */}
        <div className="form-section">
          <h3>📍 Endereço</h3>

          <input
            type="text"
            value={formData.cep || ''}
            onChange={(e) =>
              handleChange('cep', maskCEP(e.target.value))
            }
            placeholder="CEP"
          />

          <input
            type="text"
            value={formData.endereco || ''}
            onChange={(e) =>
              handleChange('endereco', e.target.value)
            }
            placeholder="Endereço"
          />

          <input
            type="text"
            value={formData.cidade || ''}
            onChange={(e) =>
              handleChange('cidade', e.target.value)
            }
            placeholder="Cidade"
          />

          <input
            type="text"
            value={formData.estado || ''}
            onChange={(e) =>
              handleChange('estado', e.target.value.toUpperCase())
            }
            maxLength={2}
            placeholder="UF"
          />
        </div>

        {/* CRÉDITO */}
        <div className="form-section">
          <h3>💳 Crédito</h3>

          <input
            type="number"
            value={formData.limite_credito || 0}
            onChange={(e) =>
              handleChange('limite_credito', Number(e.target.value))
            }
          />

          <select
            value={formData.status_credito || 'ANALISE'}
            onChange={(e) =>
              handleChange('status_credito', e.target.value)
            }
          >
            <option value="ANALISE">Análise</option>
            <option value="LIBERADO">Liberado</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="form-section">
          <h3>📝 Observações</h3>

          <textarea
            value={formData.observacoes || ''}
            onChange={(e) =>
              handleChange('observacoes', e.target.value)
            }
          />
        </div>

        {/* AÇÕES */}
        <div className="form-actions">
          {isDirty && <span>⚠️ Alterações não salvas</span>}

          <button
            type="button"
            onClick={handleSalvar}
            disabled={loading || !isDirty}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CadastroTab;