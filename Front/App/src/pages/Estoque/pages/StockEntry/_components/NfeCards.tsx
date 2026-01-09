// _components/NfeCards.tsx
import React from 'react';
import FormControl from '../../../../../components/ui/FormControl/FormControl';
import Typography from '../../../../../components/ui/Typography/Typography';
import FlexGridContainer from '../../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Card from '../../../../../components/ui/Card/Card';
import Badge from '../../../../../components/ui/Badge/Badge';

// --- Interface de Props Agrupada ---
interface NfeCardsProps {
    data: {
        invoiceNumber: string;
        accessKey: string;
        entryDate: string;
        supplier: string;
        supplierCnpj: string;
        supplierFantasyName?: string; // ✨ Adicionado
        totalIpi: number;
        totalFreight: number;
        totalOtherExpenses: number;
        subtotal: number;
        totalNoteValue: number;
    };
    supplierStatus: {
        exists: boolean | null;
        isChecking: boolean;
    };
    actions: {
        setEntryDate: (value: string) => void;
        onCreateSupplier: () => void;
        formatCurrency: (value: number) => string;
    };
    styles: any;
}

const NfeCards: React.FC<NfeCardsProps> = ({
    data,
    supplierStatus,
    actions,
    styles,
}) => {
    const { formatCurrency } = actions;

    return (
        <FlexGridContainer layout='grid'>
            {/* 1. Informações da Nota Fiscal */}
            <Card variant='default' padding='20px'>
                <FlexGridContainer layout='grid' template='2fr 1fr' gap='10px'>
                    <Typography variant='h2'>1. Informações da Nota Fiscal</Typography>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {supplierStatus.isChecking ? (
                            <div style={{ marginTop: 6 }}><Badge color='paper'>Checando fornecedor...</Badge></div>
                        ) : (
                            supplierStatus.exists === true ? (
                                <div style={{ marginTop: 6 }}><Badge color='success'>Fornecedor Já Cadastrado</Badge></div>
                            ) : (
                                supplierStatus.exists === false ? (
                                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <Badge color='warning'>Fornecedor não encontrado</Badge>
                                        <button 
                                            onClick={actions.onCreateSupplier} 
                                            style={{ padding: '6px 10px', backgroundColor: '#10b981', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer' }}
                                        >
                                            Criar
                                        </button>
                                    </div>
                                ) : null
                            )
                        )}
                    </div>
                </FlexGridContainer>

                <FlexGridContainer layout='grid' template='1fr 2fr 1fr' gap='10px' style={{ marginTop: '15px' }}>
                    <FormControl 
                        label='Nº da Nota Fiscal:' 
                        type="text" 
                        readOnlyDisplay={true} 
                        value={data.invoiceNumber} 
                    />
                    <FormControl 
                        label='Chave de Acesso:' 
                        type="text" 
                        readOnlyDisplay={true} 
                        value={data.accessKey} 
                    />
                    <FormControl 
    label='Data da Emissão:' 
    type="date" 
    value={data.entryDate} 
    onChange={(e: any) => actions.setEntryDate(e.target.value)} 
    readOnlyDisplay={true} 
    // Se o seu FormControl suportar placeholder:
    placeholder="Aguardando XML..."
/>
                </FlexGridContainer>

                <hr /> 
                <Typography variant='pMuted'>-- Fornecedor--
                    </Typography>

                <FlexGridContainer layout='grid' template='1.5fr 4fr 1fr' gap='10px'>
                    <FormControl 
                        label='Nome Fantasia:' 
                        type="text" 
                        value={data.supplierFantasyName || "-"} 
                        readOnlyDisplay={true} 
                    />
                    <FormControl 
                        label='Razão Social:' 
                        type="text" 
                        value={data.supplier} 
                        readOnlyDisplay={true} 
                    />
                    <FormControl 
                        label='CNPJ:' 
                        type="text" 
                        value={data.supplierCnpj} 
                        readOnlyDisplay={true} 
                    />
                </FlexGridContainer>
            </Card>

            {/* 2. Conferência de Totais Fiscais e Logísticos */}
            {data.accessKey && (
                <Card variant='default' padding='20px' style={{ marginTop: '20px' }}>
                    <Typography variant='h2'>2. Conferência de Totais Fiscais e Logísticos</Typography>
                    <FlexGridContainer layout='grid' template='3fr 2fr' gap='30px'>
                        <div>
                            <p style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Total IPI (Rateável):</span>
                                <span style={styles.summaryValue}>{formatCurrency(data.totalIpi)}</span>
                            </p>
                            <p style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Total Frete (Rateável):</span>
                                <span style={styles.summaryValue}>{formatCurrency(data.totalFreight)}</span>
                            </p>
                            <p style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Total Outras Despesas:</span>
                                <span style={styles.summaryValue}>{formatCurrency(data.totalOtherExpenses)}</span>
                            </p>
                        </div>
                        <div style={styles.totalsBox}>
                            <p style={styles.totalLine}>
                                <span style={styles.totalLabel}>Soma dos Produtos (vProd NF): </span>
                            </p>
                            <span style={{ ...styles.totalValue, color: '#2675dcff', fontSize: '1.25rem' }}>
                                {formatCurrency(data.subtotal)}
                            </span>
                            <p style={{ ...styles.totalLine, borderTop: '1px solid #e5e7eb', paddingTop: '10px', marginTop: '10px' }}>
                                <span style={{ ...styles.totalLabel, fontWeight: 700 }}>Valor Total da Nota (vNF):</span>
                            </p>
                            <span style={{ ...styles.totalValue, color: '#dc2626', fontSize: '1.25rem' }}>
                                {formatCurrency(data.totalNoteValue)}
                            </span>
                        </div>
                    </FlexGridContainer>
                </Card>
            )}
        </FlexGridContainer>
    );
};

export default NfeCards;