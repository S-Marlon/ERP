import React, { useState, useMemo } from 'react';
import styles from './OSListPage.module.css';
import Badge from '../../../../components/ui/Badge/Badge';
import Button from '../../../../components/ui/Button/Button';

/**
 * OS Status tipo
 */
type OSStatus = 'draft' | 'in_progress' | 'waiting_payment' | 'partially_paid' | 'completed' | 'cancelled';

/**
 * OS Item interface
 */
interface OrderService {
  id: string;
  number: string;
  customer: string;
  status: OSStatus;
  total: number;
  paid: number;
  createdAt: Date;
  technicianId?: string;
  description?: string;
}

/**
 * Props do componente
 */
interface OSListPageProps {
  onCreateOS?: () => void;
  onEditOS?: (osId: string) => void;
  onViewOS?: (osId: string) => void;
  onCollect?: (osId: string) => void;
  onBack?: () => void;
  initialData?: OrderService[];
}

/**
 * Mock data inicial
 */
const MOCK_OS_DATA: OrderService[] = [
  {
    id: 'os-001',
    number: 'OS-000123',
    customer: 'Cliente A LTDA',
    status: 'in_progress',
    total: 1500.00,
    paid: 500.00,
    createdAt: new Date('2026-04-20'),
    description: 'Manutenção linha hidráulica',
  },
  {
    id: 'os-002',
    number: 'OS-000124',
    customer: 'Empresa B S.A.',
    status: 'waiting_payment',
    total: 2300.00,
    paid: 0,
    createdAt: new Date('2026-04-21'),
    description: 'Prensagem de mangueiras',
  },
  {
    id: 'os-003',
    number: 'OS-000125',
    customer: 'Serviços C & Cia',
    status: 'partially_paid',
    total: 890.50,
    paid: 445.25,
    createdAt: new Date('2026-04-19'),
    description: 'Substituição de terminais',
  },
  {
    id: 'os-004',
    number: 'OS-000126',
    customer: 'Ind. D Comércio',
    status: 'completed',
    total: 5200.00,
    paid: 5200.00,
    createdAt: new Date('2026-04-15'),
    description: 'Reparo completo do cilindro',
  },
  {
    id: 'os-005',
    number: 'OS-000127',
    customer: 'Fábrica E',
    status: 'draft',
    total: 0,
    paid: 0,
    createdAt: new Date('2026-04-22'),
    description: 'Orçamento pendente',
  },
  {
    id: 'os-006',
    number: 'OS-000128',
    customer: 'Concessão F',
    status: 'cancelled',
    total: 1200.00,
    paid: 600.00,
    createdAt: new Date('2026-04-18'),
    description: 'Cliente cancelou',
  },
];

/**
 * Mapear status para badge color
 */
const getStatusColor = (status: OSStatus): 'success' | 'danger' | 'warning' | 'info' | 'secondary' => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'in_progress':
      return 'info';
    case 'waiting_payment':
      return 'warning';
    case 'partially_paid':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'danger';
    default:
      return 'secondary';
  }
};

/**
 * Tradução de status
 */
const getStatusLabel = (status: OSStatus): string => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'in_progress':
      return 'Em Andamento';
    case 'waiting_payment':
      return 'Aguardando Pagamento';
    case 'partially_paid':
      return 'Parcialmente Pago';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
};

/**
 * Formatador de moeda
 */
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * OSListPage Component
 */
const OSListPage: React.FC<OSListPageProps> = ({
  onCreateOS,
  onEditOS,
  onViewOS,
  onCollect,
  onBack,
  initialData,
}) => {
  // State
  const [osList, setOsList] = useState<OrderService[]>(initialData || MOCK_OS_DATA);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OSStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');

  // Filtrar OS
  const filteredOS = useMemo(() => {
    return osList.filter(os => {
      const matchSearch =
        os.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        os.customer.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = selectedStatus === 'all' || os.status === selectedStatus;

      return matchSearch && matchStatus;
    });
  }, [osList, searchTerm, selectedStatus]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = filteredOS.length;
    const totalValue = filteredOS.reduce((sum, os) => sum + os.total, 0);
    const totalPaid = filteredOS.reduce((sum, os) => sum + os.paid, 0);
    const remaining = totalValue - totalPaid;

    return { total, totalValue, totalPaid, remaining };
  }, [filteredOS]);

  // Handlers
  const handleCreateOS = () => {
    onCreateOS?.();
  };

  const handleEditOS = (osId: string) => {
    onEditOS?.(osId);
  };

  const handleViewOS = (osId: string) => {
    onViewOS?.(osId);
  };

  const handleCollect = (osId: string) => {
    onCollect?.(osId);
  };

  const handleCancelOS = (osId: string) => {
    const updatedList = osList.map(os =>
      os.id === osId ? { ...os, status: 'cancelled' as OSStatus } : os
    );
    setOsList(updatedList);
  };

  const handleExportPDF = (osId: string) => {
    console.log('Exportar PDF:', osId);
    // TODO: implementar export PDF
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>📋 Ordens de Serviço</h1>
            <p className={styles.subtitle}>Gerenciamento de OS e manutenção</p>
          </div>
          <div className={styles.headerRight}>
            <Button
              variant="primary"
              onClick={handleCreateOS}
              style={{ gap: '8px', padding: '10px 20px' }}
            >
              ⭐ Nova OS
            </Button>
            {onBack && (
              <Button
                variant="secondary"
                onClick={onBack}
                style={{ padding: '10px 20px' }}
              >
                ← Voltar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* FILTROS */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <input
            type="text"
            placeholder="Buscar OS ou cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.filterGroup}>
          <label htmlFor="status-filter" className={styles.filterLabel}>
            Status:
          </label>
          <select
            id="status-filter"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as OSStatus | 'all')}
            className={styles.filterSelect}
          >
            <option value="all">Todos</option>
            <option value="draft">Rascunho</option>
            <option value="in_progress">Em Andamento</option>
            <option value="waiting_payment">Aguardando Pagamento</option>
            <option value="partially_paid">Parcialmente Pago</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Visualização:</label>
          <div className={styles.viewModeButtons}>
            <button
              className={`${styles.modeBtn} ${viewMode === 'list' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('list')}
              title="Visualização em lista"
            >
              📋
            </button>
            <button
              className={`${styles.modeBtn} ${viewMode === 'cards' ? styles.modeBtnActive : ''}`}
              onClick={() => setViewMode('cards')}
              title="Visualização em cards"
            >
              🗂️
            </button>
          </div>
        </div>
      </div>

      {/* ESTATÍSTICAS */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>OS Encontradas</span>
          <strong className={styles.statValue}>{stats.total}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Valor Total</span>
          <strong className={styles.statValue}>{money.format(stats.totalValue)}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Pago</span>
          <strong className={styles.statValue} style={{ color: '#10b981' }}>
            {money.format(stats.totalPaid)}
          </strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>A Receber</span>
          <strong className={styles.statValue} style={{ color: '#f59e0b' }}>
            {money.format(stats.remaining)}
          </strong>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main className={styles.contentArea}>
        {filteredOS.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Nenhuma OS encontrada</p>
            <small>Tente ajustar os filtros ou criar uma nova OS</small>
          </div>
        ) : viewMode === 'list' ? (
          // VISUALIZAÇÃO EM LISTA (Tabela)
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
                {filteredOS.map(os => (
                  <tr key={os.id} className={styles.tableRow}>
                    <td className={styles.osNumber}>
                      <strong>{os.number}</strong>
                    </td>
                    <td className={styles.customerName}>{os.customer}</td>
                    <td className={styles.statusCell}>
                      <Badge color={getStatusColor(os.status)}>
                        {getStatusLabel(os.status)}
                      </Badge>
                    </td>
                    <td className={styles.date}>
                      {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className={styles.amount}>{money.format(os.total)}</td>
                    <td
                      className={styles.amount}
                      style={{ color: os.paid > 0 ? '#10b981' : '#999' }}
                    >
                      {money.format(os.paid)}
                    </td>
                    <td
                      className={styles.amount}
                      style={{ color: os.total - os.paid > 0 ? '#f59e0b' : '#10b981' }}
                    >
                      {money.format(os.total - os.paid)}
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.actionBtn}
                          title="Visualizar"
                          onClick={() => handleViewOS(os.id)}
                        >
                          👁️
                        </button>
                        <button
                          className={styles.actionBtn}
                          title="Editar"
                          onClick={() => handleEditOS(os.id)}
                        >
                          ✏️
                        </button>
                        <button
                          className={styles.actionBtn}
                          title="Cobrança/Venda"
                          onClick={() => handleCollect(os.id)}
                        >
                          💰
                        </button>
                        <button
                          className={styles.actionBtn}
                          title="Exportar PDF"
                          onClick={() => handleExportPDF(os.id)}
                        >
                          📄
                        </button>
                        {os.status !== 'cancelled' && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            title="Cancelar"
                            onClick={() => handleCancelOS(os.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          // VISUALIZAÇÃO EM CARDS
          <div className={styles.cardsGrid}>
            {filteredOS.map(os => (
              <div key={os.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitleSection}>
                    <h3 className={styles.cardTitle}>{os.number}</h3>
                    <Badge color={getStatusColor(os.status)}>
                      {getStatusLabel(os.status)}
                    </Badge>
                  </div>
                  <small className={styles.cardDate}>
                    {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                  </small>
                </div>

                <div className={styles.cardBody}>
                  <p className={styles.cardCustomer}>
                    <strong>Cliente:</strong> {os.customer}
                  </p>
                  {os.description && (
                    <p className={styles.cardDescription}>
                      <strong>Descrição:</strong> {os.description}
                    </p>
                  )}
                </div>

                <div className={styles.cardFinancial}>
                  <div className={styles.finRow}>
                    <span>Total:</span>
                    <strong>{money.format(os.total)}</strong>
                  </div>
                  <div className={styles.finRow}>
                    <span>Pago:</span>
                    <strong style={{ color: '#10b981' }}>{money.format(os.paid)}</strong>
                  </div>
                  <div className={styles.finRow}>
                    <span>Restante:</span>
                    <strong style={{ color: '#f59e0b' }}>
                      {money.format(os.total - os.paid)}
                    </strong>
                  </div>
                </div>

                <div className={styles.cardActions}>
                  <button className={styles.cardActionBtn} onClick={() => handleViewOS(os.id)}>
                    👁️ Ver
                  </button>
                  <button className={styles.cardActionBtn} onClick={() => handleEditOS(os.id)}>
                    ✏️ Editar
                  </button>
                  <button className={styles.cardActionBtn} onClick={() => handleCollect(os.id)}>
                    💰 Cobrar
                  </button>
                  <button className={styles.cardActionBtn} onClick={() => handleExportPDF(os.id)}>
                    📄 PDF
                  </button>
                  {os.status !== 'cancelled' && (
                    <button
                      className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
                      onClick={() => handleCancelOS(os.id)}
                    >
                      🗑️ Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default OSListPage;
