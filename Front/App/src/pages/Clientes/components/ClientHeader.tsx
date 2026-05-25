import React, { useMemo } from 'react';
import type { ClienteDTO } from '../types/cliente.types';
import {
  formataMoeda,
  formataData,
  diasDesdeUltimaCompra,
} from '../utils/validators';
import './ClientHeader.css';

interface ClientHeaderProps {
  cliente: ClienteDTO; // 👈 MODELO LIMPO
  ultimaCompra?: string | Date;
  ticketMedio?: number;
  onAcao?: (acao: string) => void;
  actions?: React.ReactNode;
}

type AcaoCliente =
  | 'pagar'
  | 'bloquear'
  | 'desbloquear'
  | 'orcamento';

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  cliente,
  ultimaCompra,
  ticketMedio,
  onAcao,
  actions,
}) => {
  // =========================
  // FINANCEIRO
  // =========================

  const limiteCredito = cliente.limite_credito ?? 0;
  const saldoDevedor = cliente.saldo_devedor_atual ?? 0;

  const saldoDisponivel = useMemo(() => {
    return Math.max(0, limiteCredito - saldoDevedor);
  }, [limiteCredito, saldoDevedor]);

  const usoLimite = useMemo(() => {
    if (limiteCredito <= 0) return 0;
    return (saldoDevedor / limiteCredito) * 100;
  }, [saldoDevedor, limiteCredito]);

  const statusRisco = useMemo(() => {
    if (usoLimite >= 100) return 'ALTO';
    if (usoLimite >= 80) return 'MEDIO';
    return 'OK';
  }, [usoLimite]);

  const riscoLabel = useMemo(() => {
    if (statusRisco === 'ALTO') return '⚠ Limite estourado';
    if (statusRisco === 'MEDIO') return '⚠ Atenção ao crédito';
    return '✔ Saúde financeira OK';
  }, [statusRisco]);

  // =========================
  // ÚLTIMA COMPRA
  // =========================

  const ultimaCompraDate = useMemo(() => {
    if (!ultimaCompra) return null;

    return typeof ultimaCompra === 'string'
      ? new Date(ultimaCompra)
      : ultimaCompra;
  }, [ultimaCompra]);

  const textoUltimaCompra = useMemo(() => {
    if (!ultimaCompraDate) return null;

    const dias = diasDesdeUltimaCompra(ultimaCompraDate);

    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Há 1 dia';
    return `Há ${dias} dias`;
  }, [ultimaCompraDate]);

  const bloqueado = cliente.status_credito === 'BLOQUEADO';

  // =========================
  // AÇÕES
  // =========================

  const acoes = useMemo(() => {
    if (!onAcao) return [];

    const lista: {
      key: AcaoCliente;
      label: string;
      icon: string;
      variant: string;
      show: boolean;
    }[] = [
      {
        key: 'pagar',
        label: 'Pagamento',
        icon: '💰',
        variant: 'primary',
        show: !bloqueado,
      },
      {
        key: 'orcamento',
        label: 'Orçamento',
        icon: '🧾',
        variant: 'outline',
        show: !bloqueado,
      },
      {
        key: 'bloquear',
        label: 'Bloquear',
        icon: '🚫',
        variant: 'danger',
        show: !bloqueado,
      },
      {
        key: 'desbloquear',
        label: 'Desbloquear',
        icon: '✅',
        variant: 'success',
        show: bloqueado,
      },
    ];

    return lista.filter((a) => a.show);
  }, [onAcao, bloqueado]);

  // =========================
  // RENDER
  // =========================

  return (
    <div className="client-header">
      <div className="header-top">
        <div className="client-main-section">
          <div className="name-row">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png"
              alt={cliente.nome_razao}
              className="client-avatar"
            />

            <div className="client-titles">
              <h1 className="client-name">
                {cliente.nome_razao}
              </h1>

              <div className="client-badges">
                <span className="chip secondary">
                  {cliente.tipo_cliente || 'N/A'}
                </span>

                <span className="chip secondary">
                  {cliente.status_cliente || 'N/A'}
                </span>

                {cliente.observacoes && (
                  <span className="chip secondary">
                    {cliente.observacoes}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="client-footer-row">
            <div className="client-details-horizontal">
              <div className="detail-item">
                <span>Documento</span>
                <strong>{cliente.cpf_cnpj}</strong>
              </div>

              {cliente.cidade && (
                <div className="detail-item">
                  <span>Localização</span>
                  <strong>
                    {cliente.cidade} - {cliente.estado}
                  </strong>
                </div>
              )}

              <div className="detail-item">
                <span>Contato</span>
                <strong>
                  {cliente.telefone || '(00) 0000-0000'}
                </strong>
              </div>
            </div>

            <div className="header-actions">
              {acoes.map((acao) => (
                <button
                  key={acao.key}
                  className={`btn ${acao.variant}`}
                  onClick={() => onAcao?.(acao.key)}
                >
                  {acao.icon} {acao.label}
                </button>
              ))}

              {actions && (
                <div className="actions-divider" />
              )}

              {actions}
            </div>
          </div>
        </div>

        {/* FINANCEIRO */}
        <div className="finance-section">
          <div className="finance-card">
            <div className="finance-header">
              <span>Uso do limite</span>
              <strong>{usoLimite.toFixed(0)}%</strong>
            </div>

            <div className="progress-bar">
              <div
                className={`progress-fill ${statusRisco.toLowerCase()}`}
                style={{
                  width: `${Math.min(usoLimite, 100)}%`,
                }}
              />
            </div>

            <div className="finance-metrics">
              <div className="metric">
                <span>Limite</span>
                <strong>
                  {formataMoeda(limiteCredito)}
                </strong>
              </div>

              <div
                className={`metric ${
                  statusRisco === 'ALTO' ? 'danger' : ''
                }`}
              >
                <span>Utilizado</span>
                <strong>
                  {formataMoeda(saldoDevedor)}
                </strong>
              </div>

              <div className="metric highlight">
                <span>Disponível</span>
                <strong>
                  {formataMoeda(saldoDisponivel)}
                </strong>
              </div>
            </div>
          </div>

          <div className="side-metrics">
            <div className="metric secondary">
              <span>Última compra</span>
              <strong>
                {ultimaCompraDate
                  ? formataData(ultimaCompraDate)
                  : '-'}
              </strong>
              {textoUltimaCompra && (
                <small>{textoUltimaCompra}</small>
              )}
            </div>

            <div className="metric secondary">
              <span>Ticket médio</span>
              <strong>
                {ticketMedio
                  ? formataMoeda(ticketMedio)
                  : '-'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {statusRisco !== 'OK' && (
        <div className={`alert ${statusRisco.toLowerCase()}`}>
          {riscoLabel}
        </div>
      )}
    </div>
  );
};

export default ClientHeader;