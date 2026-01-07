import React from 'react';
import FormControl from '../../../../../components/ui/FormControl/FormControl';
import Typography from '../../../../../components/ui/Typography/Typography';
import FlexGridContainer from '../../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Card from '../../../../../components/ui/Card/Card';
import Badge from '../../../../../components/ui/Badge/Badge';
// Importe aqui os seus componentes de UI de acordo com sua biblioteca
// import { FlexGridContainer, Card, Typography, FormControl } from './sua-biblioteca-de-ui';

interface NfeCardsProps {
    invoiceNumber: string;
    accessKey: string;
    entryDate: string;
    setEntryDate: (value: string) => void;
    supplier: string;
    cnpj?: string; // Opcional, já que no exemplo está fixo
    totalIpi: number;
    totalFreight: number;
    totalOtherExpenses: number;
    subtotal: number;
    totalNoteValue: number;
    formatCurrency: (value: number) => string;
    styles: any; // Idealmente, você deve tipar seus estilos CSS-in-JS
    // Novo: status do fornecedor
    supplierExists?: boolean | null; // null => desconhecido, true/false => conhecido
    isSupplierChecking?: boolean;
    onCreateSupplier?: () => void; // acionado quando usuário quer criar fornecedor manualmente
}

const NfeCards: React.FC<NfeCardsProps> = ({
    invoiceNumber,
    accessKey,
    entryDate,
    setEntryDate,
    supplier,
    cnpj = '00.000.000/0000-00',
    totalIpi,
    totalFreight,
    totalOtherExpenses,
    subtotal,
    totalNoteValue,
    formatCurrency,
    styles,
    supplierExists = null,
    isSupplierChecking = false,
    onCreateSupplier,
}) => {
    return (
        <FlexGridContainer layout='grid'>
            {/* 1. Informações da Nota Fiscal */}
            <Card variant='default' padding='20px'>
                <Typography variant='h2'>1. Informações da Nota Fiscal</Typography>

                <FlexGridContainer layout='grid' template='2fr 3fr 1fr' gap='10px'>
                    <FormControl 
                        label='Nº da Nota Fiscal:' 
                        type="text" 
                        readOnlyDisplay={true} 
                        value={invoiceNumber} 
                    />
                    <FormControl 
                        label='Chave de Acesso:' 
                        type="text" 
                        readOnlyDisplay={true} 
                        value={accessKey} 
                    />
                    <FormControl 
                        label='Data da Emissão:' 
                        type="date" 
                        value={entryDate} 
                        onChange={(e: any) => setEntryDate(e.target.value)} 
                        readOnlyDisplay={true} 
                    />
                </FlexGridContainer>

                <FlexGridContainer layout='grid' template='5fr 1fr' gap='10px'>
                    <div>
                        <FormControl 
                            label='Fornecedor:' 
                            type="text" 
                            value={supplier} 
                            readOnlyDisplay={true} 
                        />
                        {/* Badge de status do fornecedor */}
                        {isSupplierChecking ? (
                            <div style={{ marginTop: 6 }}><Badge color='paper'>Checando fornecedor...</Badge></div>
                        ) : (
                            supplierExists === true ? (
                                <div style={{ marginTop: 6 }}><Badge color='success'>Fornecedor no banco</Badge></div>
                            ) : (
                                supplierExists === false ? (
                                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <Badge color='warning'>Fornecedor não encontrado</Badge>
                                        {onCreateSupplier && (
                                            <button onClick={onCreateSupplier} style={{ padding: '6px 10px', backgroundColor: '#10b981', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Criar</button>
                                        )}
                                    </div>
                                ) : null
                            )
                        )}
                    </div>
                    <FormControl 
                        label='CNPJ:' 
                        type="text" 
                        value={cnpj} 
                        readOnlyDisplay={true} 
                    />
                </FlexGridContainer>
            </Card>

            {/* 2. Conferência de Totais Fiscais e Logísticos */}
            {accessKey && (
                <Card variant='default' padding='20px'>
                    <Typography variant='h2'>2. Conferência de Totais Fiscais e Logísticos</Typography>
                    <FlexGridContainer layout='grid' template='3fr 2fr' gap='30px'>
                        <div>
                            <p style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Total IPI (Rateável):</span>
                                <span style={styles.summaryValue}>{formatCurrency(totalIpi)}</span>
                            </p>
                            <p style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Total Frete (Rateável):</span>
                                <span style={styles.summaryValue}>{formatCurrency(totalFreight)}</span>
                            </p>
                            <p style={styles.summaryItem}>
                                <span style={styles.summaryLabel}>Total Outras Despesas:</span>
                                <span style={styles.summaryValue}>{formatCurrency(totalOtherExpenses)}</span>
                            </p>
                        </div>
                        <div style={styles.totalsBox}>
                            <p style={styles.totalLine}>
                                <span style={styles.totalLabel}>Soma dos Produtos (vProd NF): </span>
                            </p>
                            <span style={{ ...styles.totalValue, color: '#2675dcff', fontSize: '1.25rem' }}>
                                {formatCurrency(subtotal)}
                            </span>
                            <p style={{ ...styles.totalLine, borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                                <span style={{ ...styles.totalLabel, fontWeight: 700 }}>Valor Total da Nota (vNF):</span>
                            </p>
                            <span style={{ ...styles.totalValue, color: '#dc2626', fontSize: '1.25rem' }}>
                                {formatCurrency(totalNoteValue)}
                            </span>
                        </div>
                    </FlexGridContainer>
                </Card>
            )}
        </FlexGridContainer>
    );
};

export default NfeCards;