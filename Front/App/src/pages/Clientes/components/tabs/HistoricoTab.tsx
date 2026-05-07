import React, { useEffect, useState, useCallback } from 'react';
import { Venda, VendaItem } from '../../../../types/cliente.types';
import { clienteService } from '../../../../services/clienteService';
import { formatCurrency, formatDate } from '../../../../utils/validators';
import '../styles/HistoricoTab.css';

interface HistoricoTabProps {
  cliente: { id_cliente: number } | null;
}

interface VendaComItens extends Venda {
  itens?: VendaItem[];
  expandido?: boolean;
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

  // Carregar dados de vendas
  useEffect(() => {
    if (!cliente?.id_cliente) {
      setVendas([]);
      setEstatisticas({ totalVendas: 0, valorTotal: 0, ticketMedio: 0 });
      return;
    }

    carregarVendas();
  }, [cliente?.id_cliente, filtroData]);

  const carregarVendas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await clienteService.obterVendas(cliente!.id_cliente);
      
      // Processar vendas
      const vendasProcessadas = response.map(venda => ({
        ...venda,
        expandido: false,
      }));

      setVendas(vendasProcessadas);

      // Calcular estatísticas
      if (vendasProcessadas.length > 0) {
        const valorTotal = vendasProcessadas.reduce((acc, v) => acc + v.valor_total, 0);
        const ultimaCompra = new Date(Math.max(...vendasProcessadas.map(v => new Date(v.data).getTime())));

        setEstatisticas({
          totalVendas: vendasProcessadas.length,
          valorTotal,
          ticketMedio: valorTotal / vendasProcessadas.length,
          ultimaCompra,
        });
      } else {
        setEstatisticas({ totalVendas: 0, valorTotal: 0, ticketMedio: 0 });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar histórico de vendas';
      setError(message);
      console.error('Erro ao carregar vendas:', err);
    } finally {
      setLoading(false);
    }
  }, [cliente?.id_cliente]);

  const toggleExpand = async (vendaId: number, venda: VendaComItens) => {
    const novoExpandidos = new Set(expandidos);
    
    if (novoExpandidos.has(vendaId)) {
      // Se já está expandido, apenas fechar
      novoExpandidos.delete(vendaId);
    } else {
      // Se não está expandido, carregar itens e expandir
      if (!venda.itens) {
        try {
          // Aqui você chamaria a API para carregar os itens da venda
          // const itens = await clienteService.obterItensVenda(vendaId);
          
          // Para demo, vamos usar dados locais
          const vendaAtualizada = {
            ...venda,
            itens: [], // Substitua com dados reais
          };
          
          setVendas(vendas.map(v => v.id_venda === vendaId ? vendaAtualizada : v));
        } catch (err) {
          console.error('Erro ao carregar itens da venda:', err);
          return;
        }
      }
      novoExpandidos.add(vendaId);
    }
    
    setExpandidos(novoExpandidos);
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
      {/* Estatísticas */}
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

      {/* Filtros */}
      <div className="filtros-vendas">
        <h4>Filtrar por Data</h4>
        <div className="filtro-group">
          <div className="filtro-item">
            <label htmlFor="filtro-de">De:</label>
            <input
              id="filtro-de"
              type="date"
              value={filtroData.de || ''}
              onChange={(e) => aplicarFiltro(e.target.value, filtroData.ate)}
            />
          </div>

          <div className="filtro-item">
            <label htmlFor="filtro-ate">Até:</label>
            <input
              id="filtro-ate"
              type="date"
              value={filtroData.ate || ''}
              onChange={(e) => aplicarFiltro(filtroData.de, e.target.value)}
            />
          </div>

          {(filtroData.de || filtroData.ate) && (
            <button
              className="btn-limpar-filtro"
              onClick={() => aplicarFiltro(undefined, undefined)}
            >
              Limpar Filtro
            </button>
          )}
        </div>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabela de Vendas */}
      <div className="vendas-section">
        <h3>Histórico de Vendas</h3>

        {loading ? (
          <div className="loading-state">
            <p>Carregando histórico...</p>
          </div>
        ) : vendas.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma venda registrada</p>
          </div>
        ) : (
          <div className="vendas-table-wrapper">
            <table className="vendas-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Venda ID</th>
                  <th>Data</th>
                  <th>Valor Total</th>
                  <th>Método Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <React.Fragment key={venda.id_venda}>
                    <tr
                      className="venda-row"
                      onClick={() => toggleExpand(venda.id_venda, venda)}
                    >
                      <td className="expand-cell">
                        <button
                          className={`btn-expand ${expandidos.has(venda.id_venda) ? 'expandido' : ''}`}
                          title="Expandir/Recolher itens"
                        >
                          ▶
                        </button>
                      </td>
                      <td className="id-venda">{venda.id_venda}</td>
                      <td className="data">{formatDate(venda.data)}</td>
                      <td className="valor">{formatCurrency(venda.valor_total)}</td>
                      <td className="metodo">
                        <span className="badge-metodo">{venda.metodo_pagamento}</span>
                      </td>
                    </tr>

                    {/* Linha Expandida com Itens */}
                    {expandidos.has(venda.id_venda) && (
                      <tr className="venda-detalhes">
                        <td colSpan={5}>
                          <div className="detalhes-content">
                            <h5>Itens da Venda</h5>
                            {venda.itens && venda.itens.length > 0 ? (
                              <table className="itens-table">
                                <thead>
                                  <tr>
                                    <th>Produto</th>
                                    <th>Quantidade</th>
                                    <th>Valor Unitário</th>
                                    <th>Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {venda.itens.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="produto">{item.id_produto}</td>
                                      <td className="quantidade">{item.quantidade}</td>
                                      <td className="valor-unitario">
                                        {formatCurrency(item.valor_unitario)}
                                      </td>
                                      <td className="subtotal">
                                        {formatCurrency(item.quantidade * item.valor_unitario)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="empty-itens">
                                <p>Nenhum item registrado para esta venda</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoTab;
