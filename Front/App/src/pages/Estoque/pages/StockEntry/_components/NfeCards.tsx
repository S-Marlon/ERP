import React from 'react';
import FormControl from '../../../../../components/ui/FormControl/FormControl';
import Typography from '../../../../../components/ui/Typography/Typography';
import FlexGridContainer from '../../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Card from '../../../../../components/ui/Card/Card';
import Badge from '../../../../../components/ui/Badge/Badge';

interface NfeCardsProps {
    data: {
        ide: {
            numero: string;
            serie: string;
            modelo: string;
            naturezaOperacao: string;
            dataEmissao: string;
            ambiente: string;
            chaveAcesso: string;
        };
        emitente: {
            razaoSocial: string;
            nomeFantasia?: string;
            cnpj: string;
        };
        totais: {
            vProd: number;
            vIPI: number;
            vFrete: number;
            vOutro: number;
            vDesc: number;
            vICMS: number;
            vICMSST: number;
            vNF: number;
            vTotTrib: number;
        };
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
    const { ide, emitente, totais } = data;

    return (
        <FlexGridContainer layout="grid"  template="2fr 1fr 1fr">

            {/* 1. Identificação da Nota Fiscal */}
            <Card variant="default" padding="20px">
                <FlexGridContainer layout="grid" template="2fr 1fr " gap="10px">
                    <Typography variant="h2">1. Identificação da Nota Fiscal</Typography>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {supplierStatus.isChecking && <Badge color="paper">Checando fornecedor...</Badge>}
                        {supplierStatus.exists === true && <Badge color="success">Fornecedor cadastrado</Badge>}
                        {supplierStatus.exists === false && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <Badge color="warning">Fornecedor não encontrado</Badge>
                                <button
                                    onClick={actions.onCreateSupplier}
                                    style={{
                                        padding: '6px 10px',
                                        backgroundColor: '#10b981',
                                        color: '#fff',
                                        borderRadius: 6,
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Criar
                                </button>
                            </div>
                        )}
                    </div>
                </FlexGridContainer>

                <FlexGridContainer layout="grid" template="1fr 1fr 1fr" gap="10px" style={{ marginTop: 15 }}>
                    <FormControl label="Número NF" value={ide.numero} readOnlyDisplay />
                    <FormControl label="Série" value={ide.serie} readOnlyDisplay />
                    <FormControl label="Modelo" value={ide.modelo} readOnlyDisplay />
                </FlexGridContainer>

                <FlexGridContainer layout="grid" template="2fr 2fr 1fr" gap="10px" style={{ marginTop: 10 }}>
                    <FormControl label="Natureza da Operação" value={ide.naturezaOperacao} readOnlyDisplay />
                    <FormControl label="Chave de Acesso" value={ide.chaveAcesso} readOnlyDisplay />
                    <FormControl label="Ambiente" value={ide.ambiente} readOnlyDisplay />
                </FlexGridContainer>
            </Card>

            {/* 2. Emitente */}
            <Card variant="default" padding="20px" style={{ marginTop: 20 }}>
                <Typography variant="h2">2. Emitente</Typography>

                <FlexGridContainer layout="grid" template="2fr 3fr 1fr" gap="10px">
                    <FormControl
                        label="Nome Fantasia"
                        value={emitente.nomeFantasia || '-'}
                        readOnlyDisplay
                    />
                    <FormControl
                        label="Razão Social"
                        value={emitente.razaoSocial}
                        readOnlyDisplay
                    />
                    <FormControl
                        label="CNPJ"
                        value={emitente.cnpj}
                        readOnlyDisplay
                    />
                </FlexGridContainer>
            </Card>

            {/* 3. Totais Fiscais */}
            <Card variant="default" padding="20px" style={{ marginTop: 20 }}>
                <Typography variant="h2">3. Totais Fiscais da Nota</Typography>

                <FlexGridContainer layout="grid" template="2fr 2fr" gap="30px">
                    <div>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Total Produtos:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.vProd)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>IPI:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.vIPI)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>ICMS:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.vICMS)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>ICMS ST:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.vICMSST)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Outras Despesas:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.vOutro)}</span>
                        </p>
                    </div>

                    <div style={styles.totalsBox}>
                        <p style={styles.totalLine}>
                            <span style={styles.totalLabel}>Total Tributos:</span>
                        </p>
                        <span style={{ ...styles.totalValue, color: '#7c3aed' }}>
                            {formatCurrency(totais.vTotTrib)}
                        </span>

                        <p
                            style={{
                                ...styles.totalLine,
                                borderTop: '1px solid #e5e7eb',
                                paddingTop: 10,
                                marginTop: 10,
                            }}
                        >
                            <span style={{ ...styles.totalLabel, fontWeight: 700 }}>
                                Valor Total da NF:
                            </span>
                        </p>
                        <span style={{ ...styles.totalValue, color: '#dc2626', fontSize: '1.3rem' }}>
                            {formatCurrency(totais.vNF)}
                        </span>
                    </div>
                </FlexGridContainer>
            </Card>
        </FlexGridContainer>
    );
};

export default NfeCards;
