import React from 'react';
import Badge from '../../../../../components/ui/Badge/Badge';
import Button from '../../../../../components/ui/Button/Button';
import Typography from '../../../../../components/ui/Typography/Typography';

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
    itemsCount?: number;
    status?: string;
}

interface NotasDetailModalProps {
    note: StockEntryNote;
    onClose: () => void;
    formatCurrency: (value: number) => string;
    formatCnpj: (cnpj?: string) => string;
    formatDate: (date: string) => string;
}

const NotasDetailModal: React.FC<NotasDetailModalProps> = ({
    note,
    onClose,
    formatCurrency,
    formatCnpj,
    formatDate,
}) => {
    const items = note.items || [];
    const totalItems = items.length;
    const totalQuantity = items.reduce((acc, item) => {
        const qty = Number(item.quantidadeRecebida) || 0;
        return acc + qty;
    }, 0);

    const styles = {
        overlay: {
            position: 'fixed' as const,
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
        },
        modal: {
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column' as const,
        },
        header: {
            padding: '20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        title: {
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1f2937',
            margin: 0,
        },
        closeButton: {
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#6b7280',
            padding: 0,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'all 0.2s',
        },
        content: {
            flex: 1,
            overflowY: 'auto' as const,
            padding: '20px',
        },
        section: {
            marginBottom: '25px',
        },
        sectionTitle: {
            fontSize: '1.1rem',
            fontWeight: 600,
            color: '#374151',
            marginBottom: '15px',
            paddingBottom: '10px',
            borderBottom: '2px solid #e5e7eb',
        },
        grid2Col: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            marginBottom: '15px',
        },
        infoBox: {
            backgroundColor: '#f9fafb',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
        },
        label: {
            fontSize: '0.85rem',
            color: '#6b7280',
            fontWeight: 500,
            marginBottom: '4px',
        },
        value: {
            fontSize: '1rem',
            color: '#1f2937',
            fontWeight: 600,
        },
        table: {
            width: '100%',
            borderCollapse: 'collapse' as const,
            marginTop: '15px',
        },
        thead: {
            backgroundColor: '#f3f4f6',
            borderBottom: '2px solid #e5e7eb',
        },
        th: {
            padding: '10px',
            textAlign: 'left' as const,
            fontWeight: 600,
            color: '#374151',
            fontSize: '0.9rem',
        },
        tr: {
            borderBottom: '1px solid #e5e7eb',
        },
        td: {
            padding: '10px',
            color: '#374151',
            fontSize: '0.9rem',
        },
        totalsBox: {
            backgroundColor: '#f0fdf4',
            border: '1px solid #dcfce7',
            padding: '15px',
            borderRadius: '6px',
            marginTop: '15px',
        },
        totalLine: {
            display: 'flex',
            justifyContent: 'space-between',
            margin: '8px 0',
            fontSize: '0.95rem',
        },
        totalValue: {
            fontWeight: 600,
            color: '#047857',
        },
        footer: {
            padding: '15px 20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: '#f9fafb',
        },
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h2 style={styles.title}>
                            📋 NF {note.invoiceNumber.replace('NF ', '')}
                        </h2>
                        <Typography variant="pMuted" style={{ margin: '4px 0 0 0' }}>
                            Chave de Acesso: {note.accessKey}
                        </Typography>
                    </div>
                    <button
                        style={styles.closeButton}
                        onClick={onClose}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e5e7eb';
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {/* Informações da Nota */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>📝 Informações da Nota</h3>

                        <div style={styles.grid2Col}>
                            <div style={styles.infoBox}>
                                <div style={styles.label}>Data de Entrada</div>
                                <div style={styles.value}>{formatDate(note.entryDate)}</div>
                            </div>
                            <div style={styles.infoBox}>
                                <div style={styles.label}>Chave de Acesso</div>
                                <div style={styles.value} title={note.accessKey}>
                                    {note.accessKey.slice(0, 10)}...
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Informações do Fornecedor */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>🏢 Fornecedor</h3>

                        <div style={styles.grid2Col}>
                            <div style={styles.infoBox}>
                                <div style={styles.label}>Razão Social</div>
                                <div style={styles.value}>{note.supplierName}</div>
                            </div>
                            <div style={styles.infoBox}>
                                <div style={styles.label}>CNPJ</div>
                                <div style={styles.value}>{formatCnpj(note.supplierCnpj)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Totalizações */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>💰 Totalizações</h3>

                        <div style={styles.totalsBox}>
                            <div style={styles.totalLine}>
                                <span>Valor dos Produtos:</span>
                                <span style={styles.totalValue}>
                                    {formatCurrency((note.totalNoteValue || 0) - (note.totalFreight || 0) - (note.totalInsurance || 0) - (note.totalOtherExpenses || 0) - (note.totalTaxes || 0))}
                                </span>
                            </div>
                            {note.totalTaxes ? (
                                <div style={styles.totalLine}>
                                    <span>Impostos Totais:</span>
                                    <span style={styles.totalValue}>{formatCurrency(note.totalTaxes)}</span>
                                </div>
                            ) : null}
                            {note.totalIBS ? (
                                <div style={styles.totalLine}>
                                    <span>IBS:</span>
                                    <span style={styles.totalValue}>{formatCurrency(note.totalIBS)}</span>
                                </div>
                            ) : null}
                            {note.totalCBS ? (
                                <div style={styles.totalLine}>
                                    <span>CBS:</span>
                                    <span style={styles.totalValue}>{formatCurrency(note.totalCBS)}</span>
                                </div>
                            ) : null}
                            {note.totalFreight ? (
                                <div style={styles.totalLine}>
                                    <span>Frete:</span>
                                    <span style={styles.totalValue}>{formatCurrency(note.totalFreight)}</span>
                                </div>
                            ) : null}
                            {note.totalInsurance ? (
                                <div style={styles.totalLine}>
                                    <span>Seguro:</span>
                                    <span style={styles.totalValue}>{formatCurrency(note.totalInsurance)}</span>
                                </div>
                            ) : null}
                            {note.totalOtherExpenses ? (
                                <div style={styles.totalLine}>
                                    <span>Outras Despesas:</span>
                                    <span style={styles.totalValue}>{formatCurrency(note.totalOtherExpenses)}</span>
                                </div>
                            ) : null}
                            <div
                                style={{
                                    ...styles.totalLine,
                                    borderTop: '2px solid #dcfce7',
                                    paddingTop: '10px',
                                    marginTop: '10px',
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                }}
                            >
                                <span>TOTAL DA NF:</span>
                                <span style={styles.totalValue}>{formatCurrency(note.totalNoteValue)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tabela de Itens */}
                    <div style={styles.section}>
                        <h3 style={styles.sectionTitle}>
                            📦 Produtos ({totalItems} itens, {totalQuantity.toFixed(2)} unidades)
                        </h3>

                        {items.length === 0 ? (
                            <Typography variant="pMuted">Nenhum item registrado para esta nota.</Typography>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={styles.table}>
                                    <thead style={styles.thead}>
                                        <tr>
                                            <th style={styles.th}>Código Interno</th>
                                            <th style={styles.th}>SKU Fornecedor</th>
                                            <th style={styles.th}>Quantidade</th>
                                            <th style={styles.th}>Un.</th>
                                            <th style={styles.th}>Custo Unitário</th>
                                            <th style={styles.th}>Total</th>
                                            <th style={styles.th}>NCM</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const qty = Number(item.quantidadeRecebida) || 0;
                                            const unitCost = Number(item.custoUnitario) || 0;
                                            const totalItem = qty * unitCost;
                                            return (
                                                <tr key={idx} style={styles.tr}>
                                                    <td style={styles.td}>
                                                        <strong>{item.codigoInterno}</strong>
                                                    </td>
                                                    <td style={styles.td}>{item.skuFornecedor}</td>
                                                    <td style={styles.td}>
                                                        <Badge color="info">{qty.toFixed(2)}</Badge>
                                                    </td>
                                                    <td style={styles.td}>{item.unidade}</td>
                                                    <td style={styles.td}>{formatCurrency(unitCost)}</td>
                                                    <td style={styles.td}>
                                                        <strong>
                                                            {formatCurrency(totalItem)}
                                                        </strong>
                                                    </td>
                                                    <td style={styles.td}>{item.ncm || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <Button onClick={onClose} variant="secondary">
                        ✕ Fechar
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default NotasDetailModal;
