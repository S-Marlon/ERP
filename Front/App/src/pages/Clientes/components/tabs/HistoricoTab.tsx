// frontend/src/components/clientes/tabs/HistoricoTab.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { Venda, VendaItem } from '../../../../types/cliente.types';
import { getVendasCliente } from '../../services/ClienteApi';
import { formatCurrency, formatDate } from '../../../../utils/validators';
import '../styles/HistoricoTab.css';

interface HistoricoTabProps {
  cliente: { id_cliente: number } | null;
}

interface VendaComItens extends Venda {
  itens?: VendaItem[];
}

interface EstatisticasVenda {
  totalVendas: number;
  valorTotal: number;
  ticketMedio: number;
  ultimaCompra?: Date;
}

export const HistoricoTab: React.FC<HistoricoTabProps> = ({ cliente }) => {
  const [vendas, setVendas] = useState<VendaComItens[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const [estatisticas, setEstatisticas] = useState<EstatisticasVenda>({
    totalVendas: 0,
    valorTotal: 0,
    ticketMedio: 0,
  });

  const [filtroData, setFiltroData] = useState<{ de?: string; ate?: string }>({});

  const carregarVendas = useCallback(async () => {
    if (!cliente?.id_cliente) return;

    try {
      setLoading(true);
      setError(null);

      // 🔥 chama backend correto
      const response = await getVendasCliente(cliente.id_cliente);

      const vendasProcessadas: VendaComItens[] = response.map((venda: any) => ({
        id_venda: venda.id_venda,
        data: venda.data_venda,
        valor_total: Number(venda.valor_total || 0),
        metodo_pagamento: venda.forma_pagamento || 'Não informado',
      }));

      let filtradas = vendasProcessadas;

      // filtro por data
      if (filtroData.de || filtroData.ate) {
        filtradas = filtradas.filter(v => {
          const dataVenda = new Date(v.data).toISOString().split('T')[0];
          if (filtroData.de && dataVenda < filtroData.de) return false;
          if (filtroData.ate && dataVenda > filtroData.ate) return false;
          return true;
        });
      }

      setVendas(filtradas);

      // estatísticas
      if (filtradas.length > 0) {
        const valorTotal = filtradas.reduce((acc, v) => acc + v.valor_total, 0);

        const ultimaCompra = new Date(
          Math.max(...filtradas.map(v => new Date(v.data).getTime()))
        );

        setEstatisticas({
          totalVendas: filtradas.length,
          valorTotal,
          ticketMedio: valorTotal / filtradas.length,
          ultimaCompra,
        });
      } else {
        setEstatisticas({
          totalVendas: 0,
          valorTotal: 0,
          ticketMedio: 0,
          ultimaCompra: undefined,
        });
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [cliente?.id_cliente, filtroData.de, filtroData.ate]);

  useEffect(() => {
    if (!cliente?.id_cliente) {
      setVendas([]);
      setEstatisticas({ totalVendas: 0, valorTotal: 0, ticketMedio: 0 });
      return;
    }

    carregarVendas();
  }, [cliente?.id_cliente, carregarVendas]);

  const toggleExpand = (vendaId: number) => {
    const novo = new Set(expandidos);

    if (novo.has(vendaId)) {
      novo.delete(vendaId);
    } else {
      novo.add(vendaId);
    }

    setExpandidos(novo);
  };

  const aplicarFiltro = (de?: string, ate?: string) => {
    setFiltroData({ de, ate });
  };

  if (!cliente?.id_cliente) {
    return (
      <div className="historico-tab">
        <div className="empty-state">
          <p>Selecione um cliente para visualizar histórico de vendas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="historico-tab">

      {/* ESTATÍSTICAS */}
      <div className="vendas-statistics">
        <div className="stat-card">
          <div className="stat-label">Total de Vendas</div>
          <div className="stat-value">{estatisticas.totalVendas}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Valor Total</div>
          <div className="stat-value">{formatCurrency(estatisticas.valorTotal)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Ticket Médio</div>
          <div className="stat-value">{formatCurrency(estatisticas.ticketMedio)}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Última Compra</div>
          <div className="stat-value">
            {estatisticas.ultimaCompra ? formatDate(estatisticas.ultimaCompra) : '-'}
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filtros-vendas">
        <h4>Filtrar por Data</h4>

        <input
          type="date"
          value={filtroData.de || ''}
          onChange={(e) => aplicarFiltro(e.target.value, filtroData.ate)}
        />

        <input
          type="date"
          value={filtroData.ate || ''}
          onChange={(e) => aplicarFiltro(filtroData.de, e.target.value)}
        />

        {(filtroData.de || filtroData.ate) && (
          <button onClick={() => aplicarFiltro(undefined, undefined)}>
            Limpar
          </button>
        )}
      </div>

      {/* ERRO */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* TABELA */}
      <div className="vendas-section">
        <h3>Histórico de Vendas</h3>

        {loading ? (
          <p>Carregando...</p>
        ) : vendas.length === 0 ? (
          <p>Nenhuma venda registrada</p>
        ) : (
          <table className="vendas-table">
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Pagamento</th>
              </tr>
            </thead>

            <tbody>
              {vendas.map(venda => (
                <React.Fragment key={venda.id_venda}>
                  <tr onClick={() => toggleExpand(venda.id_venda)}>
                    <td>{expandidos.has(venda.id_venda) ? '▼' : '▶'}</td>
                    <td>{venda.id_venda}</td>
                    <td>{formatDate(venda.data)}</td>
                    <td>{formatCurrency(venda.valor_total)}</td>
                    <td>{venda.metodo_pagamento}</td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default HistoricoTab;