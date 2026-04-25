import React, { useState, useMemo } from 'react';
import styles from './HubVendas.module.css';
import Badge from '../../components/ui/Badge/Badge';
import Button from '../../components/ui/Button/Button';

/**
 * Tipos
 */
type VendaStatus = 'disponivel' | 'editando' | 'pagamento';
type VendaType = 'pdv' | 'os';

/**
 * Interface
 */
interface Venda {
  id: number;
  cliente: string;
  vendedor: string;
  itens: string[];
  valorTotal: number;
  ultimaAlteracao: Date;
  status: VendaStatus;
  type: VendaType;
  editadoPor?: string;
}

/**
 * Props
 */
interface HubVendasProps {
  onCreateVenda?: () => void;
  onOpenVenda?: (id: number) => void;
  onEditVenda?: (id: number) => void;
  onCollect?: (id: number) => void;
  onBack?: () => void;
  initialData?: Venda[];
}

/**
 * Mock data
 */

const getVendaStatusColor = (status: VendaStatus): 'success' | 'danger' | 'warning' | 'info' | 'secondary' => {
  switch (status) {
    case 'disponivel':
      return 'success';
    case 'editando':
      return 'warning';
    case 'pagamento':
      return 'info';
    default:
      return 'secondary';
  }
};

const progress = 60; // mock (depois pode vir do backend)
const MOCK_VENDAS: Venda[] = [
  {
    id: 1,
    cliente: "João Silva",
    vendedor: "Carlos",
    itens: ["Camiseta Polo", "Calça Jeans", "Cinto"],
    valorTotal: 250,
    ultimaAlteracao: new Date(Date.now() - 2 * 60000),
    status: 'disponivel',
    type: 'pdv'
  },
  {
    id: 2,
    cliente: "Maria Oliveira",
    vendedor: "Ana",
    itens: ["Troca de óleo", "Filtro de óleo"],
    valorTotal: 480.90,
    ultimaAlteracao: new Date(Date.now() - 10 * 60000),
    status: 'editando',
    type: 'os',
    editadoPor: "Marlon"
  },
  {
    id: 3,
    cliente: "Consumidor Final",
    vendedor: "Carlos",
    itens: ["Boné", "Camiseta básica"],
    valorTotal: 55,
    ultimaAlteracao: new Date(Date.now() - 40 * 60000),
    status: 'pagamento',
    type: 'pdv'
  },
  {
    id: 4,
    cliente: "Transportes Alfa LTDA",
    vendedor: "Bruno",
    itens: ["Reparo hidráulico", "Mangueira industrial"],
    valorTotal: 1890.50,
    ultimaAlteracao: new Date(Date.now() - 3 * 60 * 60000),
    status: 'pagamento',
    type: 'os'
  },
  {
    id: 5,
    cliente: "Mercado Central",
    vendedor: "Ana",
    itens: ["Uniforme completo", "Bonés personalizados"],
    valorTotal: 1320,
    ultimaAlteracao: new Date(Date.now() - 5 * 60 * 60000),
    status: 'disponivel',
    type: 'pdv'
  },
  {
    id: 6,
    cliente: "Construtora Norte",
    vendedor: "Carlos",
    itens: ["Manutenção cilindro hidráulico", "Vedação industrial"],
    valorTotal: 5200,
    ultimaAlteracao: new Date(Date.now() - 8 * 60 * 60000),
    status: 'editando',
    type: 'os',
    editadoPor: "João Técnico"
  },
  {
    id: 7,
    cliente: "Padaria São Jorge",
    vendedor: "Bruno",
    itens: ["Fardamento equipe", "Aventais"],
    valorTotal: 780,
    ultimaAlteracao: new Date(Date.now() - 15 * 60 * 60000),
    status: 'pagamento',
    type: 'pdv'
  },
  {
    id: 8,
    cliente: "Indústria Mecânica Delta",
    vendedor: "Ana",
    itens: ["Revisão sistema hidráulico", "Troca de válvulas"],
    valorTotal: 9400,
    ultimaAlteracao: new Date(Date.now() - 24 * 60 * 60000),
    status: 'disponivel',
    type: 'os'
  },
  {
    id: 9,
    cliente: "Supermercado Vitória",
    vendedor: "Carlos",
    itens: ["Uniformes novos", "Ajustes personalizados"],
    valorTotal: 2100,
    ultimaAlteracao: new Date(Date.now() - 90 * 60000),
    status: 'editando',
    type: 'pdv',
    editadoPor: "Supervisor Loja"
  },
  {
    id: 10,
    cliente: "Oficina Mecânica Rápida",
    vendedor: "Bruno",
    itens: ["Conserto prensa hidráulica", "Substituição mangueiras"],
    valorTotal: 3450,
    ultimaAlteracao: new Date(Date.now() - 6 * 60 * 60000),
    status: 'pagamento',
    type: 'os'
  },
  {
    id: 11,
    cliente: "Cliente Avulso",
    vendedor: "Carlos",
    itens: ["Boné promocional"],
    valorTotal: 35,
    ultimaAlteracao: new Date(Date.now() - 12 * 60 * 60000),
    status: 'disponivel',
    type: 'pdv'
  },
  {
    id: 12,
    cliente: "Empresa Horizonte",
    vendedor: "Ana",
    itens: ["Revisão preventiva sistema hidráulico"],
    valorTotal: 7800,
    ultimaAlteracao: new Date(Date.now() - 18 * 60 * 60000),
    status: 'editando',
    type: 'os',
    editadoPor: "Engenharia"
  }
];

/**
 * Helpers
 */
const getMinutesAgo = (date: Date) =>
  Math.floor((Date.now() - date.getTime()) / 60000);

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const getStatusLabel = (status: VendaStatus) => {
  switch (status) {
    case 'disponivel':
      return 'Disponível';
    case 'editando':
      return 'Editando';
    case 'pagamento':
      return 'Pagamento';
    default:
      return status;
  }
};

const getTypeLabel = (type: VendaType) => {
  switch (type) {
    case 'pdv':
      return 'PDV';
    case 'os':
      return 'OS';
    default:
      return type;
  }
};

/**
 * Component
 */
const HubVendas: React.FC<HubVendasProps> = ({
  onCreateVenda,
  onOpenVenda,
  onEditVenda,
  onCollect,
  onBack,
  initialData,
}) => {

  const [vendas] = useState<Venda[]>(initialData || MOCK_VENDAS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | VendaType>('all');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards');
  

  /**
   * HANDLERS (com fallback real)
   */
  const handleCreate = () => {
    onCreateVenda?.();
  window.location.href = 'vendas/pdv';
  };

  const handleOpen = (id: number) => {
    onOpenVenda?.(id);
  };

  const handleEdit = (id: number) => {
    onEditVenda?.(id);
  };

  const handleCollectClick = (id: number) => {
    onCollect?.(id);
  };

  /**
   * FILTER
   */
  const filteredVendas = useMemo(() => {
    const normalized = searchTerm.toLowerCase();

    return vendas.filter(v => {
      const matchSearch =
        v.cliente.toLowerCase().includes(normalized) ||
        v.id.toString().includes(normalized);

      const matchType =
        selectedType === 'all' || v.type === selectedType;

      return matchSearch && matchType;
    });
  }, [vendas, searchTerm, selectedType]);

  /**
   * STATS (CORRIGIDO E ESTÁVEL)
   */
  const stats = useMemo(() => {
    const total = filteredVendas.length;

    const totalValue = filteredVendas.reduce(
      (sum, v) => sum + v.valorTotal,
      0
    );

    const paid = filteredVendas.reduce(
      (sum, v) => sum + v.valorTotal * 0.6,
      0
    );

    const remaining = totalValue - paid;

    return { total, totalValue, paid, remaining };
  }, [filteredVendas]);

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerTop}>

          <div className={styles.headerLeft}>
            <h1 className={styles.title}>💰 Hub de Vendas</h1>
            <p className={styles.subtitle}>Gerenciamento de vendas PDV e OS</p>
          </div>

          <div className={styles.headerRight}>
            <Button variant="primary" onClick={handleCreate}>
              ➕ Nova Venda
            </Button>

            {onBack && (
              <Button variant="secondary" onClick={onBack}>
                ← Voltar
              </Button>
            )}
          </div>

        </div>
      </header>

      {/* FILTERS */}
      <div className={styles.filterBar}>

        <div className={styles.filterGroup}>
          <input
            type="text"
            placeholder="Buscar venda ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className={styles.filterSelect}
          >
            <option value="all">Todos</option>
            <option value="pdv">PDV</option>
            <option value="os">OS</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.viewModeButtons}>
            <button
              className={`${styles.modeBtn} ${viewMode === 'list' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('list')}
            >
              📋
            </button>

            <button
              className={`${styles.modeBtn} ${viewMode === 'cards' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('cards')}
            >
              🗂️
            </button>
          </div>
        </div>

      </div>

      {/* STATS BAR (AGORA CORRETO) */}
      <div className={styles.statsBar}>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Vendas</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Valor Total</span>
          <strong className={styles.statValue}>
            {money.format(stats.totalValue)}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pago</span>
          <strong className={styles.statValue} style={{ color: '#10b981' }}>
            {money.format(stats.paid)}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span className={styles.statLabel}>A Receber</span>
          <strong className={styles.statValue} style={{ color: '#f59e0b' }}>
            {money.format(stats.remaining)}
          </strong>
        </div>

      </div>

      {/* CONTENT */}
      <main className={styles.contentArea}>

        {filteredVendas.length === 0 ? (
  <div className={styles.emptyState}>
    Nenhuma venda encontrada
  </div>
) : viewMode === 'cards' ? (

  <div className={styles.cardsGrid}>
    {filteredVendas.map(v => {
      const minutes = getMinutesAgo(v.ultimaAlteracao);

      return (
        <div key={v.id} className={styles.card}>

  {/* HEADER */}
  <div className={styles.cardHeader}>
    <div className={styles.cardTitleSection}>
      <h3 className={styles.cardTitle}>
        {v.cliente}
      </h3>

      <div style={{ display: 'flex', gap: 6 }}>
        <Badge color={getVendaStatusColor(v.status)}>
          {getStatusLabel(v.status)}
        </Badge>

        <Badge>
          {getTypeLabel(v.type)}
        </Badge>
      </div>
    </div>

    <small className={styles.cardDate}>
      {getMinutesAgo(v.ultimaAlteracao)} min atrás
    </small>
  </div>

  {/* BODY */}
  <div className={styles.cardBody}>
    <p className={styles.cardCustomer}>
      <strong>Vendedor:</strong> {v.vendedor}
    </p>

    <p className={styles.cardDescription}>
      <strong>Itens:</strong> {v.itens.slice(0, 3).join(', ')}
      {v.itens.length > 3 && '...'}
    </p>
  </div>

  {/* FINANCEIRO */}
  <div className={styles.cardFinancial}>

    <div className={styles.finRow}>
      <span>Total</span>
      <strong>{money.format(v.valorTotal)}</strong>
    </div>

    <div className={styles.finRow}>
      <span>Estimado pago</span>
      <strong style={{ color: '#10b981' }}>
        {money.format(v.valorTotal * 0.6)}
      </strong>
    </div>

    <div className={styles.finRow}>
      <span>A receber</span>
      <strong style={{ color: '#f59e0b' }}>
        {money.format(v.valorTotal * 0.4)}
      </strong>
    </div>

  </div>

  {/* PROGRESSO */}
  <div className={styles.progressContainer}>
    <div className={styles.progressLabel}>
      <span>Pagamento</span>
      <span>60%</span>
    </div>

    <div className={styles.progressBar}>
      <div
        className={styles.progressFill}
        style={{ width: '60%' }}
      />
    </div>
  </div>

  {/* LOCK STATE */}
  {v.status === 'editando' && (
    <div className={styles.cardWarning}>
      🔒 Em edição por {v.editadoPor}
    </div>
  )}

  {/* ACTIONS */}
  <div className={styles.cardActions}>
    <button
      className={styles.cardActionBtn}
      onClick={() => handleOpen(v.id)}
    >
      👁️ Abrir
    </button>

    <button
      className={styles.cardActionBtn}
      onClick={() => handleEdit(v.id)}
    >
      ✏️ Editar
    </button>

    <button
      className={styles.cardActionBtn}
      onClick={() => handleCollectClick(v.id)}
    >
      💰 Cobrar
    </button>
  </div>

</div>
      );
    })}
  </div>

) : (

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                 <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Restante</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
  {filteredVendas.map(v => {
    const paid = v.valorTotal * 0.6; // mock consistente
    const remaining = v.valorTotal - paid;

    return (
      <tr key={v.id} className={styles.tableRow}>
        
        {/* ID */}
        <td className={styles.osNumber}>
          <strong>V-{String(v.id).padStart(4, '0')}</strong>
        </td>

        {/* Cliente */}
        <td className={styles.customerName}>
          {v.cliente}
        </td>

        {/* Status */}
        <td className={styles.statusCell}>
          <Badge>
            {getStatusLabel(v.status)}
          </Badge>
        </td>

        {/* Data */}
        <td className={styles.date}>
          {v.ultimaAlteracao.toLocaleDateString('pt-BR')}
        </td>

        {/* Total */}
        <td className={styles.amount}>
          {money.format(v.valorTotal)}
        </td>

        {/* Pago */}
        <td
          className={styles.amount}
          style={{ color: paid > 0 ? '#10b981' : '#999' }}
        >
          {money.format(paid)}
        </td>

        {/* Restante */}
        <td
          className={styles.amount}
          style={{ color: remaining > 0 ? '#f59e0b' : '#10b981' }}
        >
          {money.format(remaining)}
        </td>

        {/* Ações */}
        <td className={styles.actionsCell}>
          <div className={styles.actionButtons}>

            <button
              className={styles.actionBtn}
              title="Visualizar"
              onClick={() => handleOpen(v.id)}
            >
              👁️
            </button>

            <button
              className={styles.actionBtn}
              title="Editar"
              onClick={() => handleEdit(v.id)}
            >
              ✏️
            </button>

            <button
              className={styles.actionBtn}
              title="Cobrança"
              onClick={() => handleCollectClick(v.id)}
            >
              💰
            </button>

            <button
              className={styles.actionBtn}
              title="Duplicar venda"
              onClick={() => console.log('Duplicar', v.id)}
            >
              📄
            </button>

            {v.status !== 'editando' && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                title="Cancelar"
                onClick={() => console.log('Cancelar', v.id)}
              >
                🗑️
              </button>
            )}

          </div>
        </td>

      </tr>
    );
  })}
</tbody>
            </table>
          </div>

        )}

      </main>
    </div>
  );
};

export default HubVendas;