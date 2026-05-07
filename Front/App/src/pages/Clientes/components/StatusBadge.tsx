/**
 * COMPONENTE: StatusBadge
 * Badge visual para status de crédito do cliente
 */

import React from 'react';
import type { StatusCredito } from '../types/cliente.types';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: StatusCredito;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  LIBERADO: {
    label: 'LIBERADO',
    color: 'success',
    icon: '✅',
  },
  BLOQUEADO: {
    label: 'BLOQUEADO',
    color: 'danger',
    icon: '🚫',
  },
  ANALISE: {
    label: 'EM ANÁLISE',
    color: 'warning',
    icon: '⏳',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = statusConfig[status];

  return (
    <div className={`status-badge status-${config.color} size-${size}`}>
      <span className="status-icon">{config.icon}</span>
      <span className="status-label">{config.label}</span>
    </div>
  );
};
