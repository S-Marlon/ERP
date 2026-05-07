/**
 * COMPONENTE: ContatosTab
 */

import React, { useState } from 'react';
import type {
  ClienteContato,
  ClienteEmail,
} from '../../../../types/cliente.types';

import type { UseClienteReturn } from '../../../../hooks/useCliente';

import {
  maskPhone,
  validaEmail,
  validaTelefone,
} from '../../../../utils/validators';

import './ContatosTab.css';

interface ContatosTabProps {
  hook: UseClienteReturn;
}

const ContatosTab: React.FC<ContatosTabProps> = ({ hook }) => {
  const {
    cliente,
    contatos,
    emails,
    loading,
    adicionarContato,
    removerContato,
    adicionarEmail,
    removerEmail,
  } = hook;

  // =========================================================================
  // STATE
  // =========================================================================

  const [novoContato, setNovoContato] = useState<Partial<ClienteContato>>({
    tipo: 'CELULAR',
    numero: '',
    nome_referencia: '',
  });

  const [novoEmail, setNovoEmail] = useState<Partial<ClienteEmail>>({
    email: '',
    tipo: 'PESSOAL',
  });

  const [erros, setErros] = useState<Record<string, string>>({});

  // =========================================================================
  // HANDLERS - CONTATO
  // =========================================================================

  const handleAdicionarContato = async () => {
    const novosErros: Record<string, string> = {};

    if (!novoContato.numero?.trim()) {
      novosErros.numero = 'Número é obrigatório';
    } else if (!validaTelefone(novoContato.numero)) {
      novosErros.numero = 'Telefone inválido';
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    await adicionarContato({
      ...novoContato,
      id_cliente: cliente?.id_cliente!,
    } as ClienteContato);

    setNovoContato({
      tipo: 'CELULAR',
      numero: '',
      nome_referencia: '',
    });

    setErros({});
  };

  const handleRemoverContato = async (id: number) => {
    if (window.confirm('Remover contato?')) {
      await removerContato(id);
    }
  };

  // =========================================================================
  // HANDLERS - EMAIL
  // =========================================================================

  const handleAdicionarEmail = async () => {
    const novosErros: Record<string, string> = {};

    if (!novoEmail.email?.trim()) {
      novosErros.email = 'Email obrigatório';
    } else if (!validaEmail(novoEmail.email)) {
      novosErros.email = 'Email inválido';
    }

    if (Object.keys(novosErros).length > 0) {
      setErros(novosErros);
      return;
    }

    await adicionarEmail({
      ...novoEmail,
      id_cliente: cliente?.id_cliente!,
    } as ClienteEmail);

    setNovoEmail({
      email: '',
      tipo: 'PESSOAL',
    });

    setErros({});
  };

  const handleRemoverEmail = async (id: number) => {
    if (window.confirm('Remover email?')) {
      await removerEmail(id);
    }
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="contatos-tab">
      
      {/* TELEFONES */}
      <div className="contatos-section">
        <h3>📱 Telefones</h3>

        {contatos.length === 0 ? (
          <div className="empty-list">Nenhum contato</div>
        ) : (
          contatos.map((c) => (
            <div key={c.id_contato} className="contato-item">
              <span>{c.tipo}</span>
              <span>{c.numero}</span>

              <button onClick={() => handleRemoverContato(c.id_contato)}>
                ✕
              </button>
            </div>
          ))
        )}

        <div className="form-inline">
          <input
            value={novoContato.numero || ''}
            onChange={(e) =>
              setNovoContato({
                ...novoContato,
                numero: maskPhone(e.target.value),
              })
            }
            placeholder="Telefone"
          />

          <button onClick={handleAdicionarContato} disabled={loading}>
            Adicionar
          </button>
        </div>

        {erros.numero && <span>{erros.numero}</span>}
      </div>

      <hr />

      {/* EMAILS */}
      <div className="contatos-section">
        <h3>📧 Emails</h3>

        {emails.length === 0 ? (
          <div className="empty-list">Nenhum email</div>
        ) : (
          emails.map((e) => (
            <div key={e.id_email} className="email-item">
              <span>{e.tipo}</span>
              <span>{e.email}</span>

              <button onClick={() => handleRemoverEmail(e.id_email)}>
                ✕
              </button>
            </div>
          ))
        )}

        <div className="form-inline">
          <input
            value={novoEmail.email || ''}
            onChange={(e) =>
              setNovoEmail({
                ...novoEmail,
                email: e.target.value,
              })
            }
            placeholder="Email"
          />

          <button onClick={handleAdicionarEmail} disabled={loading}>
            Adicionar
          </button>
        </div>

        {erros.email && <span>{erros.email}</span>}
      </div>
    </div>
  );
};

export default ContatosTab;