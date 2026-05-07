import React, { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { ContaReceber } from '../../../../types/cliente.types';
import { clienteService } from '../../../../services/clienteService';
import { formatCurrency, formatDate } from '../../../../utils/validators';
import '../styles/FinanceiroTab.css';

interface FinanceiroTabProps {
  cliente: { id_cliente: number } | null;
}

interface FinanceiroSummary {
  totalAberto: number;
  totalPago: number;
  totalAtrasado: number;
}

interface ContaReceberWithFormatting extends ContaReceber {
  diasAtraso?: number;
}

export const FinanceiroTab: React.FC<FinanceiroTabProps> = ({ cliente }) => {
  const [contas, setContas] = useState<ContaReceberWithFormatting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceiroSummary>({
    totalAberto: 0,
    totalPago: 0,
    totalAtrasado: 0,
  });
  const [showPagamentoForm, setShowPagamentoForm] = useState(false);
  const [selectedConta, setSelectedConta] = useState<ContaReceber | null>(null);
  const [pagamentoValue, setPagamentoValue] = useState('');

  // Carregar dados financeiros
  useEffect(() => {
    if (!cliente?.id_cliente) {
      setContas([]);
      setSummary({ totalAberto: 0, totalPago: 0, totalAtrasado: 0 });
      return;
    }

    carregarFinanceiro();
  }, [cliente?.id_cliente]);

  const carregarFinanceiro = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteService.obterFinanceiro(cliente!.id_cliente);
      
      // Processar contas com cálculo de dias de atraso
      const contasProcessadas = (response.contas || []).map(conta => ({
        ...conta,
        diasAtraso: calculaDiasAtraso(conta.data_vencimento, conta.data_pagamento, conta.status),
      }));

      setContas(contasProcessadas);

      // Atualizar resumo
      setSummary({
        totalAberto: response.totalAberto || 0,
        totalPago: response.totalPago || 0,
        totalAtrasado: response.totalAtrasado || 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados financeiros';
      setError(message);
      console.error('Erro ao carregar financeiro:', err);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id_cliente]);

  const calculaDiasAtraso = (dataVencimento: string | Date, dataPagamento: string | Date | null, status: string): number => {
    if (status === 'PAGO' || dataPagamento) return 0;
    
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diferenca = hoje.getTime() - vencimento.getTime();
    const dias = Math.ceil(diferenca / (1000 * 60 * 60 * 24));
    
    return dias > 0 ? dias : 0;
  };

  const obterClasseStatus = (status: string, diasAtraso: number): string => {
    if (status === 'PAGO') return 'status-pago';
    if (diasAtraso > 0) return 'status-atrasado';
    return 'status-aberto';
  };

  const obterTextoStatus = (status: string, diasAtraso: number): string => {
    if (status === 'PAGO') return 'Pago';
    if (diasAtraso > 0) return `Atrasado (${diasAtraso}d)`;
    return 'Aberto';
  };

  const handleRegistrarPagamento = (conta: ContaReceber) => {
    setSelectedConta(conta);
    setPagamentoValue(formatCurrency(conta.valor));
    setShowPagamentoForm(true);
  };

  const handleConfirmarPagamento = async () => {
    if (!selectedConta || !pagamentoValue) {
      Swal.fire('Erro', 'Preencha o valor do pagamento', 'error');
      return;
    }

    try {
      // Aqui você chamaria a API para registrar o pagamento
      // await clienteService.registrarPagamento(selectedConta.id_conta, parseFloat(pagamentoValue));
      
      Swal.fire({
        title: 'Sucesso!',
        text: 'Pagamento registrado com sucesso',
        icon: 'success',
        confirmButtonText: 'OK',
      });

      setShowPagamentoForm(false);
      setPagamentoValue('');
      setSelectedConta(null);
      carregarFinanceiro();
    } catch (err) {
      Swal.fire('Erro', 'Erro ao registrar pagamento', 'error');
    }
  };

  const handleCancelarPagamento = () => {
    setShowPagamentoForm(false);
    setPagamentoValue('');
    setSelectedConta(null);
  };

  if (!cliente?.id_cliente) {
    return (
      <div className="financeiro-tab">
        <div className="empty-state">
          <p>Selecione um cliente para visualizar dados financeiros</p>
        </div>
      </div>
    );
  }

  return (
    <div className="financeiro-tab">
      {/* Resumo Financeiro */}
      <div className="financeiro-summary">
        <div className="summary-card total-aberto">
          <div className="summary-label">Total em Aberto</div>
          <div className="summary-value">{formatCurrency(summary.totalAberto)}</div>
          <div className="summary-count">{contas.filter(c => c.status === 'ABERTO').length} contas</div>
        </div>

        <div className="summary-card total-atrasado">
          <div className="summary-label">Total Atrasado</div>
          <div className="summary-value">{formatCurrency(summary.totalAtrasado)}</div>
          <div className="summary-count">{contas.filter(c => c.status === 'ABERTO' && calculaDiasAtraso(c.data_vencimento, c.data_pagamento, c.status) > 0).length} contas</div>
        </div>

        <div className="summary-card total-pago">
          <div className="summary-label">Total Pago</div>
          <div className="summary-value">{formatCurrency(summary.totalPago)}</div>
          <div className="summary-count">{contas.filter(c => c.status === 'PAGO').length} contas</div>
        </div>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabela de Contas */}
      <div className="contas-section">
        <h3>Contas a Receber</h3>

        {loading ? (
          <div className="loading-state">
            <p>Carregando dados...</p>
          </div>
        ) : contas.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma conta a receber registrada</p>
          </div>
        ) : (
          <div className="contas-table-wrapper">
            <table className="contas-table">
              <thead>
                <tr>
                  <th>ID Venda</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((conta) => (
                  <tr key={conta.id_conta} className={`conta-row ${obterClasseStatus(conta.status, conta.diasAtraso || 0)}`}>
                    <td className="id-venda">{conta.id_venda}</td>
                    <td className="valor">{formatCurrency(conta.valor)}</td>
                    <td className="data-vencimento">{formatDate(conta.data_vencimento)}</td>
                    <td className="data-pagamento">
                      {conta.data_pagamento ? formatDate(conta.data_pagamento) : '-'}
                    </td>
                    <td className="status">
                      <span className={`status-badge ${obterClasseStatus(conta.status, conta.diasAtraso || 0)}`}>
                        {obterTextoStatus(conta.status, conta.diasAtraso || 0)}
                      </span>
                    </td>
                    <td className="acao">
                      {conta.status === 'ABERTO' && (
                        <button
                          className="btn-pagar"
                          onClick={() => handleRegistrarPagamento(conta)}
                          title="Registrar Pagamento"
                        >
                          Pagar
                        </button>
                      )}
                      {conta.status === 'PAGO' && (
                        <span className="badge-paid">✓ Pago</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Pagamento */}
      {showPagamentoForm && selectedConta && (
        <div className="modal-overlay" onClick={handleCancelarPagamento}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Registrar Pagamento</h3>
              <button className="btn-close" onClick={handleCancelarPagamento}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Venda ID:</label>
                <input type="text" value={selectedConta.id_venda} disabled />
              </div>

              <div className="form-group">
                <label>Data de Vencimento:</label>
                <input type="text" value={formatDate(selectedConta.data_vencimento)} disabled />
              </div>

              <div className="form-group">
                <label>Valor da Conta:</label>
                <input type="text" value={formatCurrency(selectedConta.valor)} disabled />
              </div>

              <div className="form-group">
                <label htmlFor="valor-pago">Valor do Pagamento:</label>
                <input
                  id="valor-pago"
                  type="number"
                  value={pagamentoValue}
                  onChange={(e) => setPagamentoValue(e.target.value)}
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="data-pagamento">Data do Pagamento:</label>
                <input
                  id="data-pagamento"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={handleCancelarPagamento}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handleConfirmarPagamento}>
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroTab;
