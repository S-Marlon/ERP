import React, { useEffect, useState, useCallback } from 'react';
import { getHistoricoCliente } from '../../services/loja.clientes.api';
import { formatCurrency, formatDate } from '../../../../utils/validators';
import styles from '../styles/HistoricoTab.module.css';

/*
|--------------------------------------------------------------------------
| TYPES
|--------------------------------------------------------------------------
*/

interface HistoricoItem {
  id: number;
  id_cliente: number;

  tipo: string;
  origem?: string;
  canal?: string;

  titulo: string;
  descricao?: string;

  valor?: number;

  referencia?: {
    tipo?: string;
    id?: number;
  };

  metadata?: any;

  created_at: string;
}

interface HistoricoTabProps {
  cliente: { id_cliente: number } | null;
}

interface EstatisticasHistorico {
  totalEventos: number;
  valorTotal: number;
  ultimoEvento?: Date;
}

/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/

export const HistoricoTab: React.FC<HistoricoTabProps> = ({ cliente }) => {

  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  const [estatisticas, setEstatisticas] = useState<EstatisticasHistorico>({
    totalEventos: 0,
    valorTotal: 0,
  });

  /*
  |--------------------------------------------------------------------------
  | LOAD
  |--------------------------------------------------------------------------
  */

  const carregarHistorico = useCallback(async () => {

    if (!cliente?.id_cliente) return;

    try {
      setLoading(true);
      setError(null);

      const response = await getHistoricoCliente(cliente.id_cliente);

      setHistorico(response);

      if (response.length > 0) {

        const valorTotal = response.reduce(
          (acc: number, item: HistoricoItem) => acc + (item.valor || 0),
          0
        );

        const ultimoEvento = new Date(
          Math.max(...response.map((i: HistoricoItem) =>
            new Date(i.created_at).getTime()
          ))
        );

        setEstatisticas({
          totalEventos: response.length,
          valorTotal,
          ultimoEvento,
        });

      } else {

        setEstatisticas({
          totalEventos: 0,
          valorTotal: 0,
        });

      }

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao carregar histórico'
      );

    } finally {
      setLoading(false);
    }

  }, [cliente?.id_cliente]);

  useEffect(() => {

    if (!cliente?.id_cliente) {
      setHistorico([]);
      setEstatisticas({ totalEventos: 0, valorTotal: 0 });
      return;
    }

    carregarHistorico();

  }, [cliente?.id_cliente, carregarHistorico]);

  /*
  |--------------------------------------------------------------------------
  | EXPAND
  |--------------------------------------------------------------------------
  */

  const toggleExpand = (id: number) => {
    const novo = new Set(expandidos);

    if (novo.has(id)) novo.delete(id);
    else novo.add(id);

    setExpandidos(novo);
  };

  /*
  |--------------------------------------------------------------------------
  | EMPTY STATE
  |--------------------------------------------------------------------------
  */

  if (!cliente?.id_cliente) {
    return (
      <div className={styles.historicoTab}>
        <div className={styles.emptyState}>
          <p>Selecione um cliente para visualizar histórico</p>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className={styles.historicoTab}>

      {/* ESTATÍSTICAS */}
      <div className={styles.vendasStatistics}>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Eventos</div>
          <div className={styles.statValue}>{estatisticas.totalEventos}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Valor Total</div>
          <div className={styles.statValue}>
            {formatCurrency(estatisticas.valorTotal)}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Último Evento</div>
          <div className={styles.statValue}>
            {estatisticas.ultimoEvento
              ? formatDate(estatisticas.ultimoEvento)
              : '-'}
          </div>
        </div>

      </div>

      {/* ERRO */}
      {error && (
        <div className={styles.errorBanner}>
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading && <p>Carregando histórico...</p>}

      {/* TABLE */}
      {!loading && historico.length === 0 ? (
        <p className={styles.emptyState}>
          Nenhum histórico encontrado
        </p>
      ) : (
        <table className={styles.vendasTable}>

          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Título</th>
              <th>Valor</th>
            </tr>
          </thead>

          <tbody>
            {historico.map(item => (
              <React.Fragment key={item.id}>

                <tr onClick={() => toggleExpand(item.id)}>

                  <td>{expandidos.has(item.id) ? '▼' : '▶'}</td>

                  <td>{item.id}</td>

                  <td>{formatDate(item.created_at)}</td>

                  <td>{item.tipo}</td>

                  <td>{item.titulo}</td>

                  <td>
                    {item.valor
                      ? formatCurrency(item.valor)
                      : '-'}
                  </td>

                </tr>

                {/* EXPANDIDO */}
                {expandidos.has(item.id) && (
                  <tr>
                    <td colSpan={6} className={styles.expandRow}>

                      {item.descricao && (
                        <p><b>Descrição:</b> {item.descricao}</p>
                      )}

                      {item.origem && (
                        <p><b>Origem:</b> {item.origem}</p>
                      )}

                      {item.canal && (
                        <p><b>Canal:</b> {item.canal}</p>
                      )}

                      {item.referencia && (
                        <p>
                          <b>Referência:</b> {item.referencia.tipo}
                          {' #'}
                          {item.referencia.id}
                        </p>
                      )}

                      {item.metadata && (
                        <pre style={{ fontSize: 12 }}>
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      )}

                    </td>
                  </tr>
                )}

              </React.Fragment>
            ))}
          </tbody>

        </table>
      )}

    </div>
  );
};

export default HistoricoTab;