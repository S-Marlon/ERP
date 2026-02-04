import React, { useEffect, useMemo, useState } from 'react';
import FormControl from '../../../../../components/ui/FormControl/FormControl';
import Typography from '../../../../../components/ui/Typography/Typography';
import FlexGridContainer from '../../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Card from '../../../../../components/ui/Card/Card';
import Badge from '../../../../../components/ui/Badge/Badge';
import { buscarSiglaNoBanco } from '../../../api/productsApi';

// --- Interface Atualizada conforme o novo nfeParser.ts ---
interface NfeCardsProps {
    data: {
        chaveAcesso: string;
        numero: string;
        serie: string;
        dataEmissao: string;
        emitente: {
            cnpj: string;
            nome: string;
            nomeFantasia?: string;
        };
        totais: {
            valorTotalProdutos: number;
            valorTotalIpi: number;
            valorTotalFrete: number;
            valorOutrasDespesas: number;
            valorTotalDesconto: number;
            valorTotalIcms: number;
            valorTotalIcmsST: number;
            valorTotalIBS?: number; // Reforma 2026
            valorTotalCBS?: number; // Reforma 2026
            valorTotalNf: number;
            valorTotalTributos: number;
        };
    };
    supplierStatus: {
        exists: boolean | null;
        isChecking: boolean;
    };
    actions: {
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
    const { totais, emitente } = data;

        const [sigla, setSigla] = useState(""); // Aqui vai morar o "9AC5"



        useEffect(() => {
            if (emitente.cnpj) {
                buscarSiglaNoBanco(emitente.cnpj).then(siglaRecebida => {
                    console.log("Sigla recebida via POST:", siglaRecebida);
                    setSigla(siglaRecebida);
                });
            }
        }, [emitente.cnpj]);
    

    const siglaGerada = useMemo(() => {
    if (!emitente?.nomeFantasia) return "";

    return emitente.nomeFantasia
        .normalize("NFD")                // Decompõe caracteres acentuados (ex: á -> a + ´)
        .replace(/[\u0300-\u036f]/g, "") // Remove os acentos
        .replace(/[^a-zA-Z0-9]/g, "")    // Remove tudo que não for letra ou número (caracteres especiais e espaços)
        .substring(0, 10)                // Garante o máximo de 10 caracteres
        .toUpperCase();                  // Padroniza em maiúsculas
}, [emitente?.nomeFantasia]);

    return (
        <FlexGridContainer layout="grid" template="1fr" gap="20px">
            
            {/* 1. Identificação e Emitente (Cards Lado a Lado) */}
            <FlexGridContainer layout="grid" template="1.5fr 1fr 1fr" gap="20px">
                
                {/* Identificação da NF */}
                <Card variant="default" padding="20px">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Typography variant="h2">1. Identificação da NF</Typography>
                        
                    </div>

                    <FlexGridContainer layout="grid" template="1fr 1fr 2fr" gap="10px">
                        <FormControl label="Número" value={data.numero} readOnlyDisplay />
                        <FormControl label="Série" value={data.serie} readOnlyDisplay />
                        <FormControl label="Emissão" value={new Date(data.dataEmissao).toLocaleDateString('pt-BR')} readOnlyDisplay />
                    </FlexGridContainer>
                    
                    <div style={{ marginTop: 10 }}>
                        <FormControl label="Chave de Acesso" value={data.chaveAcesso} readOnlyDisplay />
                    </div>
                </Card>

                {/* Emitente */}
                <Card variant="default" padding="20px">
                    <Typography variant="h2">2. Fornecedor (Emitente)</Typography>
                    {supplierStatus.isChecking && <Badge color="paper">Verificando...</Badge>}
                        {supplierStatus.exists === true && <Badge color="success">Fornecedor Ativo</Badge>}
                        {supplierStatus.exists === false && (
                             <div style={{ display: 'flex', gap: 8 }}>
                                <Badge color="warning">Não Cadastrado</Badge>
                                <button onClick={actions.onCreateSupplier} style={styles.miniButton}>Criar</button>
                             </div>
                        )}
                    <div style={{ marginTop: 15 }}>
                        <FormControl label="CNPJ" value={emitente.cnpj} readOnlyDisplay />
                        <FormControl 
                            label="Razão Social" 
                            value={emitente.nome} 
                            readOnlyDisplay 
                            style={{ marginTop: 10 }}
                        />
                        <FormControl 
                            label="Nome Fantasia" 
                            value={emitente.nomeFantasia || emitente.nome} 
                            readOnlyDisplay 
                            style={{ marginTop: 10 }}
                        />

                         <FormControl 
    label="Sigla" 
    // Priorizamos a sigla que veio do banco de dados (estado local)
    // Se não houver, ele pode mostrar um placeholder ou vazio
    value={sigla || emitente.sigla || "Buscando..."} 
    readOnlyDisplay 
    style={{ marginTop: 10 }}
/>
                       
                    </div>
                </Card>
            

            {/* 3. Totais Fiscais (Incluso Reforma 2026) */}
            <Card variant="default" padding="20px">
                <Typography variant="h2">3. Resumo Financeiro e Tributário</Typography>

                <FlexGridContainer layout="grid" template="1fr 1fr 1.2fr" gap="30px" style={{ marginTop: 20 }}>
                    {/* Coluna 1: Base e Comerciais */}
                    <div>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Total Produtos:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.valorTotalProdutos)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Frete (+) :</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.valorTotalFrete)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Desconto (-) :</span>
                            <span style={{...styles.summaryValue, color: '#10b981'}}>{formatCurrency(totais.valorTotalDesconto)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>Outras Despesas:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.valorOutrasDespesas)}</span>
                        </p>
                    </div>

                    {/* Coluna 2: Impostos (Transição 2026) */}
                    <div style={{ borderLeft: '1px solid #eee', paddingLeft: 20 }}>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>IPI:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.valorTotalIpi)}</span>
                        </p>
                        <p style={styles.summaryItem}>
                            <span style={styles.summaryLabel}>ICMS + ST:</span>
                            <span style={styles.summaryValue}>{formatCurrency(totais.valorTotalIcms + totais.valorTotalIcmsST)}</span>
                        </p>
                        {/* Se houver valores de IBS/CBS (Reforma), exibe-os */}
                        {(totais.valorTotalIBS || totais.valorTotalCBS) && (
                            <div style={{ marginTop: 10, paddingTop: 5, borderTop: '1px dashed #ddd' }}>
                                <p style={styles.summaryItem}>
                                    <span style={styles.summaryLabel}>IBS (Novo):</span>
                                    <span style={styles.summaryValue}>{formatCurrency(totais.valorTotalIBS || 0)}</span>
                                </p>
                                <p style={styles.summaryItem}>
                                    <span style={styles.summaryLabel}>CBS (Novo):</span>
                                    <span style={styles.summaryValue}>{formatCurrency(totais.valorTotalCBS || 0)}</span>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Coluna 3: Totais Finais */}
                    <div style={styles.totalsBox}>
                        <div style={{ textAlign: 'right' }}>
                            <Typography variant="small" style={{ color: '#6b7280' }}>Total Tributos (Lei 12.741)</Typography>
                            <Typography variant="h3" style={{ color: '#7c3aed', marginBottom: 15 }}>
                                {formatCurrency(totais.valorTotalTributos)}
                            </Typography>
                            
                            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 10 }}>
                                <Typography variant="small" style={{ fontWeight: 700 }}>VALOR TOTAL DA NOTA</Typography>
                                <Typography variant="h1" style={{ color: '#dc2626', fontSize: '1.8rem' }}>
                                    {formatCurrency(totais.valorTotalNf)}
                                </Typography>
                            </div>
                        </div>
                    </div>
                </FlexGridContainer>
            </Card>
            </FlexGridContainer>
        </FlexGridContainer>
    );
};

export default NfeCards;