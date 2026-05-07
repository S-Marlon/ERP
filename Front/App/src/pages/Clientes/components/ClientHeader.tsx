/**
 * COMPONENTE: ClientHeader
 * Dashboard visual do cliente com resumo de informações
 */

import React from 'react';
import type { Cliente } from '../types/cliente.types';
import { formataMoeda, formataData, getCorStatus } from '../utils/validators';
import { StatusBadge } from './StatusBadge';
import './ClientHeader.css';

interface ClientHeaderProps {
  cliente: Cliente;
  ultimaCompra?: Date;
  ticketMedio?: number;
  onAcao?: (acao: 'pagar' | 'bloquear' | 'desbloquear' | 'novo') => void;
  loading?: boolean;
}

export const ClientHeader: React.FC<ClientHeaderProps> = ({
  cliente,
  ultimaCompra,
  ticketMedio,
  onAcao,
  loading = false,
}) => {
  const temAtraso = cliente.saldo_devedor_atual > cliente.limite_credito;
  const saldoDisponivel = Math.max(0, cliente.limite_credito - cliente.saldo_devedor_atual);

  return (
    <div className="client-header">
      {/* SEÇÃO 1: IDENTIFICAÇÃO */}
      <div className="header-top">
        <div className="client-info">
          <h1 className="client-nome">{cliente.nome_razao}</h1>
          <p className="client-doc">{cliente.cpf_cnpj}</p>
          {cliente.cidade && (
            <p className="client-localizacao">
              📍 {cliente.cidade} - {cliente.estado}
            </p>
          )}
        </div>

        <div className="header-status">
          <StatusBadge status={cliente.status_credito} size="lg" />
          {temAtraso && (
            <div className="alerta-excedido">
              ⚠️ <strong>Limite Excedido</strong>
            </div>
          )}
        </div>
      </div>

      {/* SEÇÃO 2: MÉTRICAS */}
      <div className="header-metricas">
        <div className="metrica-card">
          <label>Limite de Crédito</label>
          <div className="valor">{formataMoeda(cliente.limite_credito)}</div>
        </div>

        <div className={`metrica-card ${temAtraso ? 'alerta' : ''}`}>
          <label>Saldo Devedor</label>
          <div className="valor" style={{ color: temAtraso ? '#dc3545' : '#28a745' }}>
            {formataMoeda(cliente.saldo_devedor_atual)}
          </div>
        </div>

        <div className="metrica-card">
          <label>Saldo Disponível</label>
          <div className="valor" style={{ color: '#0066cc' }}>
            {formataMoeda(saldoDisponivel)}
          </div>
          {saldoDisponivel < cliente.limite_credito * 0.2 && (
            <small className="warning">⚠️ Crédito baixo</small>
          )}
        </div>

        {ultimaCompra && (
          <div className="metrica-card">
            <label>Última Compra</label>
            <div className="valor">{formataData(ultimaCompra)}</div>
          </div>
        )}

        {ticketMedio && (
          <div className="metrica-card">
            <label>Ticket Médio</label>
            <div className="valor">{formataMoeda(ticketMedio)}</div>
          </div>
        )}
      </div>

      {/* SEÇÃO 3: AÇÕES RÁPIDAS */}
      {onAcao && (
        <div className="header-acoes">
          {cliente.status_cliente === 'ATIVO' && cliente.status_credito !== 'BLOQUEADO' && (
            <button
              className="btn btn-primary"
              onClick={() => onAcao('pagar')}
              disabled={loading}
              title="Registrar pagamento de conta"
            >
              💰 Registrar Pagamento
            </button>
          )}

          {cliente.status_cliente === 'ATIVO' && (
            <button
              className="btn btn-danger"
              onClick={() => onAcao('bloquear')}
              disabled={loading}
              title="Bloquear cliente para compras"
            >
              🚫 Bloquear
            </button>
          )}

          {cliente.status_cliente === 'BLOQUEADO' && (
            <button
              className="btn btn-success"
              onClick={() => onAcao('desbloquear')}
              disabled={loading}
              title="Desbloquear cliente"
            >
              ✅ Desbloquear
            </button>
          )}

          <button
            className="btn btn-outline"
            onClick={() => onAcao('novo')}
            disabled={loading}
            title="Criar novo cliente"
          >
            ➕ Novo Cliente
          </button>
        </div>
      )}

      {/* ALERTAS */}
      {temAtraso && (
        <div className="alert-box alert-danger">
          <strong>⚠️ Atenção:</strong> Cliente excedeu o limite de crédito (
          {formataMoeda(cliente.saldo_devedor_atual - cliente.limite_credito)} acima do limite)
        </div>
      )}

      {cliente.status_credito === 'BLOQUEADO' && !temAtraso && (
        <div className="alert-box alert-warning">
          <strong>🚫 Bloqueado:</strong> Este cliente está bloqueado para compras
        </div>
      )}

      {cliente.status_credito === 'ANALISE' && (
        <div className="alert-box alert-info">
          <strong>⏳ Análise:</strong> Crédito em análise, não é possível fazer compras ainda
        </div>
      )}
    </div>
  );
};
