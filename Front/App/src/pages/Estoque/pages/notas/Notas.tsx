import React, { useState, useEffect } from 'react';
import Typography from '../../../../components/ui/Typography/Typography';
import Badge from '../../../../components/ui/Badge/Badge';
import Button from '../../../../components/ui/Button/Button';
import FormControl from '../../../../components/ui/FormControl/FormControl';
import { fetchStockEntryNotes, fetchStockEntryDetails } from '../../api/productsApi';
import NotasDetailModal from './components/NotasDetailModal';
import NotasStats from './components/NotasStats';
import NotasExport from './components/NotasExport';

interface StockEntryItem {
    id?: string;
    codigoInterno: string;
    skuFornecedor: string;
    quantidadeRecebida: number;
    unidade: string;
    custoUnitario: number;
    impostos?: {
        ipi?: number;
        icmsST?: number;
        ibs?: number;
        cbs?: number;
    };
    ncm?: string;
    cest?: string;
}

interface StockEntryNote {
    id: string | number;
    invoiceNumber: string;
    series?: string;
    accessKey: string;
    emissionDate?: string;
    entryDate: string;
    supplierCnpj: string;
    supplierName: string;
    totalFreight?: number;
    totalInsurance?: number;
    totalIBS?: number;
    totalCBS?: number;
    totalTaxes?: number;
    totalOtherExpenses?: number;
    totalNoteValue: number;
    items?: StockEntryItem[];
    itemsCount: number;
    status?: string;
}

const formatCurrency = (value: number | undefined): string => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const formatDate = (dateString?: string): string => {
    if (!dateString) return '';

    const date = new Date(dateString);

    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('pt-BR');
};

const Notas: React.FC = () => {
    const [notes, setNotes] = useState<StockEntryNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNote, setSelectedNote] = useState<StockEntryNote | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Filtros
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterInvoice, setFilterInvoice] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    // Carrega notas ao montar o componente ou quando filtros mudam
    useEffect(() => {
        loadNotes();
    }, []);

   const loadNotes = async () => {
    setLoading(true);
    setError(null);

    try {
        const result = await fetchStockEntryNotes({
            supplierCnpj: filterSupplier || undefined,
            invoiceNumber: filterInvoice || undefined,
            startDate: filterStartDate || undefined,
            endDate: filterEndDate || undefined,
        });

        setNotes(result);

    } catch (err) {
        console.error('Erro ao buscar notas:', err);
        setError(err instanceof Error ? err.message : 'Erro ao buscar notas');
    } finally {
        setLoading(false);
    }
};

    const handleViewDetails = async (note: StockEntryNote) => {
        try {
            const details = await fetchStockEntryDetails(note.id);
            setSelectedNote(details);
            setShowDetailModal(true);
        } catch (err) {
            console.error('Erro ao buscar detalhes da nota:', err);
            alert('Erro ao buscar detalhes da nota: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
        }
    };

    const handleCloseModal = () => {
        setShowDetailModal(false);
        setSelectedNote(null);
    };

    const handleApplyFilters = () => {
        loadNotes();
    };

    const handleClearFilters = () => {
        setFilterSupplier('');
        setFilterInvoice('');
        setFilterStartDate('');
        setFilterEndDate('');
        setNotes([]);
    };

    const styles = {
        container: {
            padding: '20px',
            backgroundColor: '#f9fafb',
            minHeight: '100vh',
        } as React.CSSProperties,
        header: {
            marginBottom: '30px',
            display: 'flex',
            flexDirection: 'row' as const,
            alignItems: 'center',
            justifyContent: 'space-between',
        } as React.CSSProperties,
        title: {
            fontSize: '2rem',
            fontWeight: 700,
            color: '#1f2937',
            margin: '0 0 10px 0',
        } as React.CSSProperties,
        filterSection: {
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '20px',
        } as React.CSSProperties,
        filterGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '15px',
        } as React.CSSProperties,
        buttonGroup: {
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
        } as React.CSSProperties,
        tableContainer: {
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
        } as React.CSSProperties,
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            fontSize: '0.9rem',
        } as React.CSSProperties,
        thead: {
            backgroundColor: '#f3f4f6',
            borderBottom: '2px solid #e5e7eb',
        } as React.CSSProperties,
        th: {
            padding: '12px 16px',
            textAlign: 'left' as const,
            fontWeight: 600,
            color: '#374151',
        } as React.CSSProperties,
        tr: {
            borderBottom: '1px solid #e5e7eb',
            transition: 'background-color 0.2s',
        } as React.CSSProperties,
        trHover: {
            backgroundColor: '#f9fafb',
        } as React.CSSProperties,
        td: {
            padding: '12px 16px',
            color: '#374151',
        } as React.CSSProperties,
        emptyMessage: {
            textAlign: 'center' as const,
            padding: '40px 20px',
            color: '#6b7280',
        } as React.CSSProperties,
        loadingMessage: {
            textAlign: 'center' as const,
            padding: '40px 20px',
            color: '#6b7280',
        } as React.CSSProperties,
        errorMessage: {
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
        } as React.CSSProperties,
        actionButton: {
            padding: '6px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'background-color 0.2s',
        } as React.CSSProperties,
        actionButtonHover: {
            backgroundColor: '#2563eb',
        } as React.CSSProperties,
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h1 style={styles.title}>📋 Notas Fiscais Registradas</h1>

                <Typography variant="pMuted" style={{ margin: 0 }}>
                    Visualize e gerencie todas as notas de entrada de mercadorias
                </Typography>
            </div>

            {error && (
                <div style={styles.errorMessage}>
                    <strong>Erro:</strong> {error}
                </div>
            )}

            {/* Estatísticas - Mostrado apenas quando há notas */}
            {notes.length > 0 && (
                <NotasStats notes={notes} formatCurrency={formatCurrency} />
            )}

            {/* Seção de Filtros */}
            <div style={styles.filterSection}>
                <h3 style={{ margin: '0 0 20px 0', color: '#1f2937', fontSize: '1.1rem' }}>🔍 Filtrar Notas</h3>

                <div style={styles.filterGrid}>
                    <FormControl
                        label="Número da NF"
                        placeholder="Ex: 123456"
                        value={filterInvoice}
                        onChange={(e) => setFilterInvoice(e.target.value)}
                    />
                    <FormControl
                        label="CNPJ Fornecedor"
                        placeholder="Ex: 00.000.000/0000-00"
                        value={filterSupplier}
                        onChange={(e) => setFilterSupplier(e.target.value)}
                    />
                    <FormControl
                        label="Data Inicial"
                        type="date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                    <FormControl
                        label="Data Final"
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                </div>

                <div style={styles.buttonGroup}>
                    <Button onClick={handleClearFilters} variant="secondary">
                        🗑️ Limpar
                    </Button>
                    <Button onClick={handleApplyFilters} variant="primary">
                        🔍 Buscar
                    </Button>
                </div>
            </div>

            {/* Tabela de Notas */}
            <div style={styles.tableContainer}>
                {loading ? (
                    <div style={styles.loadingMessage}>
                        <Typography variant="p">Carregando notas...</Typography>
                    </div>
                ) : notes.length === 0 ? (
                    <div style={styles.emptyMessage}>
                        <Typography variant="p">📭 Nenhuma nota encontrada</Typography>
                        <Typography variant="pMuted" style={{ marginTop: '10px' }}>
                            Clique em "Buscar" para visualizar as notas registradas
                        </Typography>
                    </div>
                ) : (
                    <table style={styles.table}>
                        <thead style={styles.thead}>
                            <tr>
                                <th style={styles.th}>NF</th>
                                <th style={styles.th}>Data</th>
                                <th style={styles.th}>Fornecedor</th>
                                <th style={styles.th}>CNPJ</th>
                                <th style={styles.th}>Itens</th>
                                <th style={styles.th}>Valor Total</th>
                                <th style={styles.th}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {notes.map((note) => (
                                <tr
                                    key={note.id}
                                    style={styles.tr}
                                    onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb';
                                    }}
                                    onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent';
                                    }}
                                >
                                    <td style={styles.td}>
                                        <strong>{(note.invoiceNumber ?? '').replace('NF ', '')}</strong>
                                    </td>
                                    <td style={styles.td}>{formatDate(note.entryDate)}</td>
                                    <td style={styles.td}>{note.supplierName}</td>
                                    <td style={styles.td}>{formatCnpj(note.supplierCnpj)}</td>
                                    <td style={styles.td}>
                                        <Badge color="info">
                                            {note.itemsCount || 0} itens
                                        </Badge>
                                    </td>
                                    <td style={styles.td}>
                                        <strong>{formatCurrency(note.totalNoteValue)}</strong>
                                    </td>
                                    <td style={styles.td}>
                                        <button
                                            style={styles.actionButton}
                                            onMouseEnter={(e) => {
                                                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
                                            }}
                                            onMouseLeave={(e) => {
                                                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
                                            }}
                                            onClick={() => handleViewDetails(note)}
                                        >
                                            👁️ Ver Detalhes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Detalhes */}
            {showDetailModal && selectedNote && (
                <NotasDetailModal
                    note={selectedNote}
                    onClose={handleCloseModal}
                    formatCurrency={formatCurrency}
                    formatCnpj={formatCnpj}
                    formatDate={formatDate}
                />
            )}

            {/* Rodapé com resumo */}
            {notes.length > 0 && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px' }}>
                    <Typography variant="pMuted">
                        Total de {notes.length} nota(s) encontrada(s)
                    </Typography>
                    <NotasExport notes={notes} formatCurrency={formatCurrency} />
                </div>
            )}
        </div>
    );
};

export default Notas;
