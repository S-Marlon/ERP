/**
 * OS SUMMARY
 * Resumo financeiro da Ordem de Serviço
 */

import React, { useMemo } from 'react';
import type { OrderService } from '../../../../types/erp.types';
import styles from '../OSPanel.module.css';

interface OSSummaryProps {
  os: OrderService;
  money: Intl.NumberFormat;
  onConfirm?: () => void;
  onDiscard?: () => void;
  isLoading?: boolean;
}

interface LineItem {
  label: string;
  value: number;
  highlight?: boolean;
}

const OSSummary: React.FC<OSSummaryProps> = ({
  os,
  money,
  onConfirm,
  onDiscard,
  isLoading = false,
}) => {
  const lines = useMemo((): LineItem[] => [
    { label: 'Subtotal de Produtos', value: os.subtotalProducts },
    { label: 'Subtotal de Serviços', value: os.subtotalServices },
    { label: 'Mão de Obra', value: os.laborTotal },
    ...(os.discountAmount
      ? [{ label: 'Desconto', value: -os.discountAmount }]
      : os.discountPercentage
      ? [{ label: `Desconto (${os.discountPercentage}%)`, value: -(os.subtotalProducts + os.subtotalServices + os.laborTotal) * (os.discountPercentage / 100) }]
      : []),
    { label: 'TOTAL', value: os.totalAmount, highlight: true },
  ], [os]);

  return (
    <div className={styles.osTotalBox}>
      <div style={{ flex: 1 }}>
        <div style={{ marginBottom: '1rem' }}>
          <small style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>
            Resumo da Ordem de Serviço
          </small>
          <strong style={{ fontSize: '1.3rem' }}>{os.number}</strong>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem 0', textAlign: 'left' }}>
                  <strong style={{ fontWeight: line.highlight ? 'bold' : 'normal' }}>
                    {line.label}
                  </strong>
                </td>
                <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                  <span style={{ fontWeight: line.highlight ? 'bold' : 'normal' }}>
                    {money.format(line.value)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {onConfirm && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={styles.btnConfirmOS}
              style={{
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? '⌛ Processando...' : '💰 Gerar OS'}
            </button>
            {onDiscard && (
              <button
                onClick={onDiscard}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: '#f9f9f9',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                Descartar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OSSummary;
