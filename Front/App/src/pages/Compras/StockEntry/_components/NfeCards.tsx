import React, { useEffect, useState } from 'react';
import { buscarSiglaNoBanco } from '../../api/productsApi';

import styles from './NfeCards.module.css';
import { NfeDataFromXML } from '../../utils/nfeParser';
import FlexGridContainer from '../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Card from '../../../../components/ui/Card/Card';
import Typography from '../../../../components/ui/Typography/Typography';
import FormControl from '../../../../components/ui/FormControl/FormControl';
import Badge from '../../../../components/ui/Badge/Badge';
import Button from '../../../../components/ui/Button/Button';

interface NfeCardsProps {
    data: NfeDataFromXML;
    supplierStatus: {
        isChecking: boolean;
        exists: boolean | null;
    };
    actions: {
        onCreateSupplier: () => void;
    };
}

const formatarDataBR = (dataString?: string) => {
    if (!dataString) return '-';
    try {
        const data = new Date(dataString);
        return data.toLocaleDateString('pt-BR');
    } catch {
        return dataString.split('T')[0].split('-').reverse().join('/');
    }
};

const formatarChaveAcesso = (chave: string) => {
    return chave.replace(/(.{4})/g, '$1 ').trim();
};

// Helper para formatar moeda (R$)
const formatarMoeda = (valor?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

const NfeCards: React.FC<NfeCardsProps> = ({
    data,
    supplierStatus,
    actions,
}) => {
    const { emitente } = data;
    const [sigla, setSigla] = useState("");

    // Estados dos Modais
    const [isNfDetailsOpen, setIsNfDetailsOpen] = useState(false);
    const [isSupplierDetailsOpen, setIsSupplierDetailsOpen] = useState(false);
    const [isLogisticsDetailsOpen, setIsLogisticsDetailsOpen] = useState(false); // 🟢 Novo estado

    useEffect(() => {
        if (emitente.cnpj) {
            buscarSiglaNoBanco(emitente.cnpj).then(siglaRecebida => {
                setSigla(siglaRecebida);
            });
        }
    }, [emitente.cnpj]);

    return (
        <FlexGridContainer layout="grid" template="1fr" className={styles.gridContainer}>

            <FlexGridContainer layout="grid" template="3fr 3fr 2fr" >

                {/* CARD 1: Identificação da NF */}
                <Card variant="nfe-card" padding="14px">
                    <div className={styles.headerCard}>
                        <Typography variant="h2">1. Identificação da NF</Typography>
                        <button className={styles.infoIconButton} onClick={() => setIsNfDetailsOpen(true)} title="Ver detalhes da nota">ℹ️</button>
                    </div>
                    <FlexGridContainer layout="grid" template="1fr 1fr 1fr" gap="10px">
                        <FormControl label="Número" value={data.numero} readOnlyDisplay />
                        <FormControl label="Série" value={data.serie} readOnlyDisplay />
                        <FormControl label="Data de Emissão" value={formatarDataBR(data.dataEmissao)} readOnlyDisplay />
                    </FlexGridContainer>
                    <div className={styles.formGroupInline}>
                        <FormControl label="Chave de Acesso" value={data.chaveAcesso} readOnlyDisplay />
                    </div>

                </Card>

                {/* CARD 2: Emitente */}
                <Card variant="nfe-card" padding="14px">
                    <div className={styles.headerCard}>
                        <Typography variant="h2">2. Fornecedor (Emitente)</Typography>
                        <div className={styles.badgeContainer}>
                            {supplierStatus.isChecking && <Badge color="paper">Verificando...</Badge>}
                            {supplierStatus.exists === true && <Badge color="success">Fornecedor Ativo</Badge>}
                            {supplierStatus.exists === false && (
                                <>
                                    <Badge color="warning">Não Cadastrado</Badge>
                                    <button className={styles.createButton} onClick={actions.onCreateSupplier}>Criar</button>
                                </>
                            )}
                        </div>
                        <button className={styles.infoIconButton} onClick={() => setIsSupplierDetailsOpen(true)} title="Ver detalhes do fornecedor">ℹ️</button>
                    </div>

                    <FlexGridContainer layout="grid" template="1fr 1fr" gap="10px">
                        <FormControl label="CNPJ" value={emitente.cnpj} readOnlyDisplay />
                        
                        <FormControl
                            label="Nome Fantasia"
                            value={emitente.nomeFantasia || "Não Informado"}
                            readOnlyDisplay
                        />
                    <FormControl label="Razão Social" value={emitente.nome} readOnlyDisplay />
                    </FlexGridContainer>
                </Card>

                {/* CARD 3: Dados de Logística e Volumes */}
                <Card variant="nfe-card" padding="14px">
                    <div className={styles.headerCard}>
                        <Typography variant="h2">3. Logística de Entrega</Typography>
                        {/* 🟢 Adicionado botão de informação para o Card 3 */}
                        <button
                            className={styles.infoIconButton}
                            onClick={() => setIsLogisticsDetailsOpen(true)}
                            title="Ver resumo financeiro e tributário"
                        >
                            ℹ️
                        </button>
                    </div>
                    <FlexGridContainer layout="grid" template="1fr 1fr" gap="10px">
                        <FormControl
                            label="Qtd Volumes"
                            value={data.quantidadeVolumes !== undefined ? String(data.quantidadeVolumes) : "Não Informado"}
                            readOnlyDisplay
                        />
                        <FormControl
                            label="Peso Bruto (KG)"
                            value={data.pesoBruto !== undefined ? `${data.pesoBruto} kg` : "Não Informado"}
                            readOnlyDisplay
                        />
                    </FlexGridContainer>
                    <div className={styles.formGroupInline} style={{ marginTop: '10px' }}>
                        <FormControl
                            label="Valor Total da Nota"
                            value={formatarMoeda(data.valorTotalNf)}
                            readOnlyDisplay
                        />
                    </div>
                </Card>
                

            </FlexGridContainer>

            {/* ================= MODAL: DETALHES DA NF ================= */}
            {isNfDetailsOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContent}>
                        <h3 className={styles.modalTitle}>📄 Detalhes Técnicos da NF-e</h3>
                        <p className={styles.modalSubtitle}>Dados de validação fiscal do arquivo XML importado.</p>
                        <div className={styles.modalDetailsGrid}>
                            <div className={styles.detailRow}><strong>Chave de Acesso:</strong> <span style={{ fontFamily: 'monospace' }}>{formatarChaveAcesso(data.chaveAcesso)}</span></div>
                            <div className={styles.detailRow}><strong>Número:</strong> <span>{data.numero}</span></div>
                            <div className={styles.detailRow}><strong>Série:</strong> <span>{data.serie}</span></div>
                            <div className={styles.detailRow}><strong>Data Emissão:</strong> <span>{formatarDataBR(data.dataEmissao)}</span></div>
                            <div className={styles.detailRow}><strong>Modelo Fiscal:</strong> <span>55 (Nota Fiscal Eletrônica)</span></div>
                            <div className={styles.detailRow}><strong>Ambiente:</strong> <span>1 (Produção)</span></div>
                            <div className={styles.detailRow}><strong>Status SEFAZ:</strong> <span className={styles.textGreen}>100 - Autorizado o uso da NF-e</span></div>
                        </div>
                        <div className={styles.modalActions}>
                            <Button variant='secondary' onClick={() => setIsNfDetailsOpen(false)}>Fechar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL: DETALHES DO FORNECEDOR ================= */}
            {isSupplierDetailsOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContent}>
                        <h3 className={styles.modalTitle}>🏢 Dados Completos do Emitente</h3>
                        <p className={styles.modalSubtitle}>Informações cadastrais extraídas do documento.</p>
                        <div className={styles.modalDetailsGrid}>
                            <div className={styles.detailRow}><strong>Razão Social:</strong> <span>{emitente.nome}</span></div>
                            <div className={styles.detailRow}><strong>Nome Fantasia:</strong> <span>{emitente.nomeFantasia || '-'}</span></div>
                            <div className={styles.detailRow}><strong>CNPJ:</strong> <span>{emitente.cnpj}</span></div>
                            <div className={styles.detailRow}><strong>Inscrição Estadual:</strong> <span>{emitente.ie || '-'}</span></div>
                            <div className={styles.detailRow}><strong>Endereço:</strong> <span>{`${emitente.logradouro || ''}, ${emitente.numeroEnd || ''}`}</span></div>
                            <div className={styles.detailRow}><strong>Bairro:</strong> <span>{emitente.bairro || '-'}</span></div>
                            <div className={styles.detailRow}><strong>Cidade/UF:</strong> <span>{`${emitente.municipio || '-'} / ${emitente.uf || '-'}`}</span></div>
                        </div>
                        <div className={styles.modalActions}>
                            <Button variant='secondary' onClick={() => setIsSupplierDetailsOpen(false)}>Fechar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= 🟢 MODAL NOVO: RESUMO FINANCEIRO E LOGÍSTICO ================= */}
            {isLogisticsDetailsOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
                        <h3 className={styles.modalTitle}>💰 Totais e Composição de Valores</h3>
                        <p className={styles.modalSubtitle}>Apurado de despesas e tributos retidos no XML.</p>

                        <div className={styles.modalDetailsGrid}>
                            {/* Bloco de Valores da Mercadoria */}
                            <div className={styles.detailRow}><strong>Valor dos Produtos:</strong> <span>{formatarMoeda(data.valorTotalProdutos)}</span></div>
                            <div className={styles.detailRow}><strong>(+) Valor do Frete:</strong> <span>{formatarMoeda(data.valorTotalFrete)}</span></div>
                            <div className={styles.detailRow}><strong>(+) Valor do Seguro:</strong> <span>{formatarMoeda(data.valorTotalSeguro)}</span></div>
                            <div className={styles.detailRow}><strong>(+) Outras Despesas:</strong> <span>{formatarMoeda(data.valorOutrasDespesas)}</span></div>
                            <div className={styles.detailRow}><strong>(-) Desconto Total:</strong> <span className={styles.textGreen}>({formatarMoeda(data.valorTotalDesconto)})</span></div>

                            <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '10px 0' }} />

                            {/* Bloco Fiscal Tradicional */}
                            <div className={styles.detailRow}><strong>ICMS Próprio:</strong> <span>{formatarMoeda(data.valorTotalIcms)}</span></div>
                            <div className={styles.detailRow}><strong>ICMS ST (Subst. Tributária):</strong> <span>{formatarMoeda(data.valorTotalIcmsST)}</span></div>
                            <div className={styles.detailRow}><strong>IPI (IPI Comercial):</strong> <span>{formatarMoeda(data.valorTotalIpi)}</span></div>

                            {/* Bloco Reforma Tributária */}
                            {data.valorTotalIBS !== undefined && (
                                <div className={styles.detailRow}><strong>IBS Total (Reforma 2026):</strong> <span>{formatarMoeda(data.valorTotalIBS)}</span></div>
                            )}
                            {data.valorTotalCBS !== undefined && (
                                <div className={styles.detailRow}><strong>CBS Total (Reforma 2026):</strong> <span>{formatarMoeda(data.valorTotalCBS)}</span></div>
                            )}

                            <hr style={{ border: '0', borderTop: '2px solid #ccc', margin: '10px 0' }} />

                            {/* Totalizador Geral */}
                            <div className={styles.detailRow} style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                <span>VALOR LÍQUIDO DA NOTA:</span>
                                <span className={styles.textBlue}>{formatarMoeda(data.valorTotalNf)}</span>
                            </div>
                        </div>

                        <div className={styles.modalActions} style={{ marginTop: '20px' }}>
                            <Button variant='secondary' onClick={() => setIsLogisticsDetailsOpen(false)}>Fechar</Button>
                        </div>
                    </div>
                </div>
            )}

        </FlexGridContainer>
    );
};

export default NfeCards;