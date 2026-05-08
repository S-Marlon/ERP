import React, { useState } from 'react';
import type {
  ClienteContato,
  ClienteEmail,
} from '../../../../types/cliente.types';

import {
  maskPhone,
  validaEmail,
  validaTelefone,
} from '../../../../utils/validators';

import './ContatosTab.css';

interface ContatosTabProps {
  clienteId: number;

  contatos: ClienteContato[];
  emails: ClienteEmail[];

  setContatos: React.Dispatch<React.SetStateAction<ClienteContato[]>>;
  setEmails: React.Dispatch<React.SetStateAction<ClienteEmail[]>>;

  loading?: boolean;
}

const ContatosTab: React.FC<ContatosTabProps> = ({
  clienteId,
  contatos,
  emails,
  setContatos,
  setEmails,
  loading = false,
}) => {
  // =========================================================
  // STATE LOCAL
  // =========================================================

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

  // =========================================================
  // CONTATO
  // =========================================================

  const handleAdicionarContato = () => {
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

    const contato: ClienteContato = {
      id_contato: Date.now(),
      id_cliente: clienteId,
      tipo: novoContato.tipo || 'CELULAR',
      numero: novoContato.numero!,
      nome_referencia: novoContato.nome_referencia,
    };

    setContatos((prev) => [...prev, contato]);

    setNovoContato({
      tipo: 'CELULAR',
      numero: '',
      nome_referencia: '',
    });

    setErros({});
  };

  const handleRemoverContato = (id: number) => {
    if (window.confirm('Remover contato?')) {
      setContatos((prev) =>
        prev.filter((c) => c.id_contato !== id)
      );
    }
  };

  // =========================================================
  // EMAIL
  // =========================================================

  const handleAdicionarEmail = () => {
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

    const email: ClienteEmail = {
      id_email: Date.now(),
      id_cliente: clienteId,
      email: novoEmail.email!,
      tipo: novoEmail.tipo || 'PESSOAL',
    };

    setEmails((prev) => [...prev, email]);

    setNovoEmail({
      email: '',
      tipo: 'PESSOAL',
    });

    setErros({});
  };

  const handleRemoverEmail = (id: number) => {
    if (window.confirm('Remover email?')) {
      setEmails((prev) =>
        prev.filter((e) => e.id_email !== id)
      );
    }
  };

  // =========================================================
  // RENDER
  // =========================================================

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