import React from 'react';
import Badge from '../../../../../components/ui/Badge/Badge';

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
    items?: any[];
    itemsCount?: number;
    status?: string;
}

interface NotasStatsProps {
    notes: StockEntryNote[];
    formatCurrency: (value: number | undefined) => string;
}

const NotasStats: React.FC<NotasStatsProps> = ({ notes, formatCurrency }) => {
    const totalNotes = notes.length;
    const totalValue = notes.reduce((acc, note) => acc + (note.totalNoteValue || 0), 0);
    const totalItems = notes.reduce((acc, note) => acc + (note.itemsCount || note.items?.length || 0), 0);
    const totalFreight = notes.reduce((acc, note) => acc + (note.totalFreight || 0), 0);
    const totalTaxes = notes.reduce(
        (acc, note) =>
            acc + (note.totalTaxes || 0) + (note.totalIBS || 0) + (note.totalCBS || 0),
        0
    );

    const uniqueSuppliers = new Set(notes.map((n) => n.supplierCnpj)).size;

    const styles = {
        container: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '25px',
        } as React.CSSProperties,
        card: {
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
        } as React.CSSProperties,
        label: {
            fontSize: '0.85rem',
            color: '#6b7280',
            fontWeight: 500,
            marginBottom: '8px',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.5px',
        } as React.CSSProperties,
        value: {
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1f2937',
        } as React.CSSProperties,
        valueMuted: {
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#10b981',
        } as React.CSSProperties,
        icon: {
            marginRight: '8px',
        } as React.CSSProperties,
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.label}>
                    <span style={styles.icon}>📋</span> Total de Notas
                </div>
                <div style={styles.value}>{totalNotes}</div>
            </div>

            <div style={styles.card}>
                <div style={styles.label}>
                    <span style={styles.icon}>📦</span> Total de Itens
                </div>
                <div style={styles.value}>{totalItems}</div>
            </div>

            <div style={styles.card}>
                <div style={styles.label}>
                    <span style={styles.icon}>🏢</span> Fornecedores
                </div>
                <div style={styles.value}>{uniqueSuppliers}</div>
            </div>

            <div style={styles.card}>
                <div style={styles.label}>
                    <span style={styles.icon}>💰</span> Valor Total
                </div>
                <div style={styles.valueMuted}>{formatCurrency(totalValue)}</div>
            </div>

            <div style={styles.card}>
                <div style={styles.label}>
                    <span style={styles.icon}>🚚</span> Frete Total
                </div>
                <div style={styles.valueMuted}>{formatCurrency(totalFreight)}</div>
            </div>

            <div style={styles.card}>
                <div style={styles.label}>
                    <span style={styles.icon}>💲</span> Impostos
                </div>
                <div style={styles.valueMuted}>{formatCurrency(totalTaxes)}</div>
            </div>
        </div>
    );
};

export default NotasStats;
