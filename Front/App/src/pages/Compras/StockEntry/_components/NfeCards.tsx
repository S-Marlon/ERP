import React, { useState } from 'react';

import styles from './NfeCards.module.css';
import { NfeDataFromXML } from '../../types/NF-e';
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

// Helper para traduzir a modalidade de frete da SEFAZ
const traduzirModalidadeFrete = (mod?: string) => {
    switch (mod) {
        case '0': return '0 - Contratação por conta do Remetente (CIF)';
        case '1': return '1 - Contratação por conta do Destinatário (FOB)';
        case '2': return '2 - Contratação por conta de Terceiros';
        case '3': return '3 - Transporte Próprio por conta do Remetente';
        case '4': return '4 - Transporte Próprio por conta do Destinatário';
        case '9': return '9 - Sem Ocorrência de Transporte';
        default: return 'Não Informado';
    }
};

const NfeCards: React.FC<NfeCardsProps> = ({
    data,
    supplierStatus,
    actions,
}) => {
    const { emitente } = data;

    // Estados dos Modais
    const [isNfDetailsOpen, setIsNfDetailsOpen] = useState(false);
    const [isSupplierDetailsOpen, setIsSupplierDetailsOpen] = useState(false);
    const [isLogisticsDetailsOpen, setIsLogisticsDetailsOpen] = useState(false);

    return (
        <FlexGridContainer layout="grid" template="1fr" className={styles.gridContainer}>

            <FlexGridContainer layout="grid" template="3fr 4fr 4fr" >

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
                    </FlexGridContainer>
                    <FlexGridContainer layout="grid" template="1fr" gap="10px">
                        <FormControl label="Razão Social" value={emitente.nome} readOnlyDisplay />

                    </FlexGridContainer>

                </Card>

                {/* CARD 3: Dados de Logística e Volumes */}
               <Card variant="nfe-card" padding="14px">
    <div className={styles.headerCard}>
        <Typography variant="h2">3. Logística de Entrega e Rateio de Frete</Typography>
        <button
            className={styles.infoIconButton}
            onClick={() => setIsLogisticsDetailsOpen(true)}
            title="Ver resumo logístico, financeiro e tributário"
        >
            ℹ️
        </button>
    </div>

    {/* 📦 SEÇÃO 1: CONFERÊNCIA FÍSICA (Grid de 3 Colunas para encaixar a Espécie) */}
    <FlexGridContainer layout="grid" template="1fr 1fr 1fr" gap="10px">
        <FormControl
            label="Qtd Volumes"
            value={data?.frete?.volumes?.quantidade !== undefined ? String(data.frete.volumes.quantidade) : "Não Informado"}
            readOnlyDisplay
        />
        <FormControl
            label="Espécie dos Vols."
            value={data?.frete?.volumes?.especie || "Não Informado"}
            readOnlyDisplay
        />
        <FormControl
            label="Peso Bruto (KG)"
            value={data?.frete?.volumes?.pesoBruto ? `${data.frete.volumes.pesoBruto} kg` : "Não Informado"}
            readOnlyDisplay
        />
    </FlexGridContainer>

    {/* 🚚 SEÇÃO 2: DADOS DE TRANSPORTE E MODALIDADE */}
    <FlexGridContainer layout="grid" template="1fr" gap="10px" style={{ marginTop: '5px' }}>
        <FormControl
            label="Transportadora"
            value={data?.frete?.transportadora?.nome || "Não Informada no XML"}
            readOnlyDisplay
        />
        <FormControl
            label="Modalidade do Frete (XML)"
            value={traduzirModalidadeFrete(data?.frete?.modalidade)}
            readOnlyDisplay
        />
    </FlexGridContainer>

    {/* 💵 SEÇÃO 3: INPUTS PARA INSERÇÃO MANUAL NO ERP */}
    <FlexGridContainer layout="grid" template="1fr 1fr" gap="10px" style={{ marginTop: '10px' }}>
        <div>
            <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Valor do Frete (R$)
            </label>
            <input
                type="number"
                placeholder="0,00"
                style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
            />
        </div>

        <div>
            <label style={{ fontSize: '14px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Método de Rateio
            </label>
            <select style={{ padding: '8px', width: '100%', boxSizing: 'border-box', backgroundColor: '#fff' }}>
                <option value="VALOR">Proporcional por Valor</option>
                <option value="PESO">Proporcional por Peso (Cadastro)</option>
                <option value="IGUAL">Divisão Igualitária por Item</option>
                <option value="MANUAL">Digitação Manual por Item</option>
            </select>
        </div>
    </FlexGridContainer>
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

            {/* ================= MODAL: RESUMO FINANCEIRO E LOGÍSTICO ================= */}
            {isLogisticsDetailsOpen && (
    <div className={styles.modalBackdrop}>
        <div className={styles.modalContent} style={{ maxWidth: '650px' }}>
            <h3 className={styles.modalTitle}>💰 Totais e Composição de Valores</h3>
            <p className={styles.modalSubtitle}>Apurado de despesas, logística e tributos retidos no XML.</p>

            {/* 🚚 Bloco de Logística e Frete Integrado perfeitamente no Modal */}
            <div className="modal-resumo-frete" style={{ padding: '10px 0', borderBottom: '1px solid #eee', marginBottom: '15px' }}>
                <Typography variant="h3" style={{ marginBottom: '10px', paddingBottom: '5px', fontSize: '1rem', fontWeight: 'bold' }}>
                    🚚 Detalhes de Logística e Frete
                </Typography>

                <FlexGridContainer layout="grid" template="1fr 1fr" gap="15px">
                    {/* Coluna 1: Dados da Empresa de Transporte */}
                    <div>
                        <Typography variant="body2" style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Dados do Transportador</Typography>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>Razão Social:</strong> {data?.frete?.transportadora?.nome || "N/A"}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>CNPJ/CPF:</strong> {data?.frete?.transportadora?.cnpjCpf || "N/A"}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>Inscrição Estadual:</strong> {data?.frete?.transportadora?.ie || "N/A"}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>Endereço:</strong> {data?.frete?.transportadora?.endereco || "N/A"} 
                            {data?.frete?.transportadora?.municipio ? ` - ${data.frete.transportadora.municipio}/${data.frete.transportadora.uf}` : ""}
                        </p>
                    </div>

                    {/* Coluna 2: Totais e Pesos */}
                    <div>
                        <Typography variant="body2" style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Pesos Declarados</Typography>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>Peso Bruto Total:</strong> {data?.frete?.volumes?.pesoBruto ? `${data.frete.volumes.pesoBruto} kg` : "N/A"}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>Peso Líquido Total:</strong> {data?.frete?.volumes?.pesoLiquido ? `${data.frete.volumes.pesoLiquido} kg` : "N/A"}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: '13px' }}>
                            <strong>Espécie dos Vols:</strong> {data?.frete?.volumes?.especie || "N/A"}
                        </p>
                    </div>
                </FlexGridContainer>
            </div>

            {/* 💵 Composição dos Valores Financeiros */}
            <div className={styles.modalDetailsGrid}>
                <div className={styles.detailRow}><strong>Valor dos Produtos:</strong> <span>{formatarMoeda(data?.totais?.valorTotalProdutos ?? data?.valorTotalProdutos)}</span></div>
                <div className={styles.detailRow}><strong>(+) Valor do Frete:</strong> <span>{formatarMoeda(data?.totais?.valorTotalFrete ?? data?.valorTotalFrete)}</span></div>
                <div className={styles.detailRow}><strong>(+) Valor do Seguro:</strong> <span>{formatarMoeda(data?.totais?.valorTotalSeguro ?? data?.valorTotalSeguro)}</span></div>
                <div className={styles.detailRow}><strong>(+) Outras Despesas:</strong> <span>{formatarMoeda(data?.totais?.valorOutrasDespesas ?? data?.valorOutrasDespesas)}</span></div>
                <div className={styles.detailRow}><strong>(-) Desconto Total:</strong> <span className={styles.textGreen}>({formatarMoeda(data?.totais?.valorTotalDesconto ?? data?.valorTotalDesconto)})</span></div>

                <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '10px 0' }} />

                <div className={styles.detailRow}><strong>ICMS Próprio:</strong> <span>{formatarMoeda(data?.totais?.valorTotalIcms ?? data?.valorTotalIcms)}</span></div>
                <div className={styles.detailRow}><strong>ICMS ST (Subst. Tributária):</strong> <span>{formatarMoeda(data?.totais?.valorTotalIcmsST ?? data?.valorTotalIcmsST)}</span></div>
                <div className={styles.detailRow}><strong>IPI (IPI Comercial):</strong> <span>{formatarMoeda(data?.totais?.valorTotalIpi ?? data?.valorTotalIpi)}</span></div>

                {(data?.totais?.valorTotalIBS ?? data?.valorTotalIBS) !== undefined && (
                    <div className={styles.detailRow}><strong>IBS Total (Reforma 2026):</strong> <span>{formatarMoeda(data?.totais?.valorTotalIBS ?? data?.valorTotalIBS)}</span></div>
                )}
                {(data?.totais?.valorTotalCBS ?? data?.valorTotalCBS) !== undefined && (
                    <div className={styles.detailRow}><strong>CBS Total (Reforma 2026):</strong> <span>{formatarMoeda(data?.totais?.valorTotalCBS ?? data?.valorTotalCBS)}</span></div>
                )}

                <hr style={{ border: '0', borderTop: '2px solid #ccc', margin: '10px 0' }} />

                <div className={styles.detailRow} style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    <span>VALOR LÍQUIDO DA NOTA:</span>
                    <span className={styles.textBlue}>{formatarMoeda(data?.totais?.valorTotalNf ?? data?.valorTotalNf)}</span>
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