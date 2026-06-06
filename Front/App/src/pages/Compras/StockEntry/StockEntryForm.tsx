import React, { useState, useMemo } from 'react';
import MappingModal, { MappingPayload } from './_components/ProductMappingModal';
import { parseNfeXmlToData } from '../utils/nfeParser';
import NfeCards from './_components/NfeCards';

// 🟢 Importação da Nova API do Módulo de Compras/Fornecedores
import { createSupplier, checkSupplier } from '../api/comprasApi';

import { ItemsConference } from './ItemsConference';
import './StockEntry.css';
import { NfeDataFromXML, ProdutoNF } from '../types/NF-e';
import FlexGridContainer from '../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Badge from '../../../components/ui/Badge/Badge';
import Card from '../../../components/ui/Card/Card';

interface ProductEntry extends ProdutoNF {
    tempId: number;
    isMapped: boolean;
    mappedId?: string;
    isConfirmed: boolean;
    category?: string;
    mappedData?: any;
    receivedQuantity: number; 
    difference: number;
}

type NfeData = Omit<NfeDataFromXML, 'produtos'> & {
    invoiceNumber: string;
    supplier: string;
    supplierFantasyName: string;
    supplierCnpj: string;
    entryDate: string;
    accessKey: string;
    totalFreight: number;
    totalIpi: number;
    totalIcmsST: number;
    totalOtherExpenses: number;
    totalNoteValue: number;
    items: ProductEntry[];
};

const formatCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const mapNfeDataToEntryForm = (xmlData: NfeDataFromXML): NfeData => {
    const items: ProductEntry[] = xmlData.produtos.map((produto, index) => ({
        ...produto,
        tempId: index + 1,
        isMapped: false,
        isConfirmed: false,
        category: '',
        mappedData: undefined,
        receivedQuantity: produto.quantidade || 0,
        difference: 0,
    }));

    const dataFicticia = new Date().toISOString().substring(0, 10);

    return {
        ...xmlData,
        invoiceNumber: `NF ${xmlData.numero}`,
        supplier: xmlData.emitente.nome,
        supplierFantasyName: xmlData.emitente.nomeFantasy || xmlData.emitente.nome,
        supplierCnpj: xmlData.emitente.cnpj,
        entryDate: dataFicticia,
        accessKey: xmlData.chaveAcesso,
        totalFreight: xmlData.valorTotalFrete,
        totalIpi: xmlData.valorTotalIpi,
        totalIcmsST: xmlData.valorTotalIcmsST,
        totalOtherExpenses: xmlData.valorOutrasDespesas,
        totalNoteValue: xmlData.valorTotalNf,
        items,
    };
};

const StockEntryForm: React.FC = () => {
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [supplierFantasyName, setSupplierFantasyName] = useState('');
    const [supplierCnpj, setSupplierCnpj] = useState<string>('');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [supplierToCreate, setSupplierToCreate] = useState<{ cnpj: string; name: string, fantasyName: string } | null>(null);
    const [supplierCreationName, setSupplierCreationName] = useState('');
    const [supplierCreationFantasyName, setSupplierCreationFantasyName] = useState('');
    const [supplierCreationLoading, setSupplierCreationLoading] = useState(false);
    const [isSupplierChecking, setIsSupplierChecking] = useState(false);
    const [supplierExists, setSupplierExists] = useState<boolean | null>(null);
    const [pendingXmlData, setPendingXmlData] = useState<NfeData | null>(null);
    const [entryDate, setEntryDate] = useState('');
    const [items, setItems] = useState<ProductEntry[]>([]);
    const [accessKey, setAccessKey] = useState('');
    const [totalFreight, setTotalFreight] = useState(0);
    const [totalIpi, setTotalIpi] = useState(0);
    const [totalOtherExpenses, setTotalOtherExpenses] = useState(0);
    const [totalNoteValue, setTotalNoteValue] = useState(0);
    const [totalIcmsST, setTotalIcmsST] = useState(0);
    const [totalIBS, setTotalIBS] = useState<number | undefined>(undefined);
    const [totalCBS, setTotalCBS] = useState<number | undefined>(undefined);

    const [isOpen, setIsOpen] = useState(false);
    const [itemToMap, setItemToMap] = useState<any>(null);

    const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.valorProdutos || 0), 0), [items]);

    const adjustedPhysicalSubtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.receivedQuantity * (item.valorCustoReal || item.valorUnitario || 0)), 0);
    }, [items]);

    const hasUnmappedItems = useMemo(() => items.some(i => !i.mappedId), [items]);
    const hasUnconfirmedItems = useMemo(() => items.some(i => !i.isConfirmed), [items]);
    const isSubmitDisabled = items.length === 0 || hasUnmappedItems || hasUnconfirmedItems;

    const performMappingSync = async (cnpjToUse: string, xmlToUse: NfeData) => {
        try {
            const cnpjLimpo = cnpjToUse.replace(/\D/g, '');
            const skus = xmlToUse.items.map(i => i.sku);
            
            // ⚠️ TODO: Integrar com a nova API de checagem de mapeamentos
            // const existingMappings = await checkExistingMappings(cnpjLimpo, skus);
            const existingMappings: any[] = []; 

            if (!Array.isArray(existingMappings) || existingMappings.length === 0) {
                setItems(xmlToUse.items);
                return;
            }

            const mappingsBySku = new Map(existingMappings.map((m: any) => [m.sku_fornecedor, m]));

            const reconciledItems = xmlToUse.items.map((item) => {
                const mapping = mappingsBySku.get(item.sku);
                if (mapping) {
                    return {
                        ...item,
                        isMapped: true,
                        mappedId: mapping.codigo_interno,
                        category: mapping.nome_categoria,
                        mappedData: {
                            id: mapping.codigo_interno,
                            name: mapping.descricao,
                            category: mapping.nome_categoria,
                            unitOfMeasure: mapping.unidade,
                        },
                    };
                }
                return { ...item, isMapped: false };
            });

            setItems(reconciledItems);
        } catch (err) {
            console.error('Erro ao sincronizar mapeamentos:', err);
        }
    };

    const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const xmlContent = e.target?.result as string;
                const rawXmlData = parseNfeXmlToData(xmlContent);
                if (!rawXmlData) throw new Error('Falha ao extrair dados do XML.');

                const xmlData = mapNfeDataToEntryForm(rawXmlData);
                const formattedSupplierCnpj = formatCnpj(xmlData.supplierCnpj);
                const cnpjLimpo = xmlData.supplierCnpj.replace(/\D/g, '');

                setSupplierCnpj(formattedSupplierCnpj);
                setInvoiceNumber(xmlData.invoiceNumber);
                setSupplier(xmlData.supplier);
                setSupplierFantasyName(xmlData.supplierFantasyName);
                setAccessKey(xmlData.accessKey);
                setTotalFreight(xmlData.totalFreight);
                setTotalIpi(xmlData.totalIpi);
                setTotalOtherExpenses(xmlData.totalOtherExpenses);
                setTotalNoteValue(xmlData.totalNoteValue);
                setTotalIcmsST(xmlData.totalIcmsST);
                setTotalIBS(xmlData.valorTotalIBS);
                setTotalCBS(xmlData.valorTotalCBS);
                setEntryDate(xmlData.entryDate);

                setIsSupplierChecking(true);
                
                // 🟢 Uso real da API para verificar a existência do fornecedor no módulo de pessoas/compras
                const supplierCheck = await checkSupplier(cnpjLimpo);

                if (!supplierCheck || !supplierCheck.exists) {
                    setSupplierExists(false);
                    setSupplierToCreate({
                        cnpj: formattedSupplierCnpj,
                        name: xmlData.supplier,
                        fantasyName: xmlData.supplierFantasyName
                    });
                    setSupplierCreationName(xmlData.supplier);
                    setSupplierCreationFantasyName(xmlData.supplierFantasyName);
                    setPendingXmlData(xmlData);
                    setItems(xmlData.items);
                    setIsSupplierModalOpen(true);
                    return;
                }

                setSupplierExists(true);
                // Ajusta os nomes locais caso o cadastro no banco esteja mais atualizado que o XML
                setSupplier(supplierCheck.supplier?.name || xmlData.supplier);
                setSupplierFantasyName(supplierCheck.supplier?.fantasyName || xmlData.supplierFantasyName);
                
                // Dispara o fluxo de amarração/sincronização de SKUs
                await performMappingSync(formattedSupplierCnpj, xmlData);

            } catch (error) {
                console.error(error);
                alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido ao ler XML / Checar Fornecedor'}`);
            } finally {
                setIsSupplierChecking(false);
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleCancelSupplierCreation = () => {
        setIsSupplierModalOpen(false);
        setSupplierExists(null);
        setSupplierToCreate(null);
        setPendingXmlData(null);
        
        setSupplierCnpj('');
        setInvoiceNumber('');
        setSupplier('');
        setSupplierFantasyName('');
        setAccessKey('');
        setTotalFreight(0);
        setTotalIpi(0);
        setTotalOtherExpenses(0);
        setTotalNoteValue(0);
        setTotalIcmsST(0);
        setTotalIBS(undefined);
        setTotalCBS(undefined);
        setEntryDate('');
        setItems([]);
    };

    const handleCreateSupplierSubmit = async () => {
    if (!supplierToCreate) return;
    
    setSupplierCreationLoading(true);
    try {
        await createSupplier({
            cnpj: supplierToCreate.cnpj.replace(/\D/g, ''),
            name: supplierCreationName,
            fantasyName: supplierCreationFantasyName
        });

        setSupplierExists(true);
        setIsSupplierModalOpen(false);
        
        if (pendingXmlData) {
            await performMappingSync(supplierToCreate.cnpj, pendingXmlData);
        }
        
        alert('Fornecedor cadastrado com sucesso!');
    } catch (err: any) { // 🟢 Mudamos para 'any' para capturar a propriedade .message
        console.error('Erro detalhado ao cadastrar fornecedor:', err);
        
        // 🔍 Agora o alert vai mostrar o motivo real do erro!
        alert(`Falha ao cadastrar o fornecedor.\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
        setSupplierCreationLoading(false);
    }
};

    const handleConfirmItems = (ids: number[]) => {
        setItems(prev => prev.map(item => ids.includes(item.tempId) ? { ...item, isConfirmed: true } : item));
    };

    const handleUnconfirmItems = (ids: number[]) => {
        setItems(prev => prev.map(item => ids.includes(item.tempId) ? { ...item, isConfirmed: false } : item));
    };

    const handleRemoveItemsFromConference = (ids: number[]) => {
        if (window.confirm('Remover itens selecionados?')) {
            setItems(prev => prev.filter(item => !ids.includes(item.tempId)));
        }
    };

    const handleToggleSingleItem = (id: number) => {
        setItems(prev => prev.map(item => item.tempId === id ? { ...item, isConfirmed: !item.isConfirmed } : item));
    };

    const handleOpenMappingFromTable = (ids: number[]) => {
        const target = items.find(i => i.tempId === ids[0]);
        if (target) {
            setItemToMap(target);
            setIsOpen(true);
        }
    };

    const handleQuantityReceivedChange = (id: number, newQty: number) => {
        setItems(prev => prev.map(item => {
            if (item.tempId === id) {
                const diff = item.quantidade - newQty;
                return {
                    ...item,
                    receivedQuantity: newQty,
                    difference: diff
                };
            }
            return item;
        }));
    };

    const handleModalMapSuccess = (payload: MappingPayload) => {
        setItems(prev => prev.map(item => item.tempId === itemToMap?.tempId ? {
            ...item,
            isMapped: true,
            mappedId: payload.internalCode,
            category: payload.categoryName,
            mappedData: payload
        } : item));
        setIsOpen(false);
        setItemToMap(null);
    };

    return (
        <div className="stock-entry-container">
            {/* CABEÇALHO DA PÁGINA */}
            <div className="page-header">
                <FlexGridContainer layout='grid' template='1fr 1fr  1fr' gap='20px'>
                    <h1 className="page-title">📥 Entrada de Mercadorias (Registro de NF-e)</h1>

                   <div>
                    <div className="stats">
                        <Badge color="warning">
                            pendentes: 
                            {items.length} {items.length === 1 ? 'item' : 'itens'} 
                        </Badge>

                        <Badge color={"success"}>
                            conferidos: {items.filter(i => i.isConfirmed).length}
                        </Badge>

                            <Badge color={"danger"}>
                            divergências: {items.filter(i => i.difference !== 0).length}
                        </Badge>

                            <Badge color={"poco"}>
                            sem vínculo: {items.filter(i => !i.mappedId).length}
                        </Badge>
                    </div>

                    

                   </div>

                    <div className="upload-action-wrapper">
                        <input type="file" style={{ display: 'none' }} accept=".xml" id="xml-upload" onChange={handleXmlUpload} />
                        <label htmlFor="xml-upload" className="btn-upload">
                            {accessKey ? '🔄 Alterar XML' : '⬆️ Importar XML da NF-e'}
                        </label>
                    </div>
                </FlexGridContainer>
            </div>

            {/* ÁREA DE CONTEÚDO EM DUAS COLUNAS */}
            <div className="workspace-layout">

                {/* COLUNA ESQUERDA: WORKFLOW PRINCIPAL */}
                <div className="main-workflow-column">
                    {accessKey && (
                        <div className="section-wrapper">
                            <NfeCards
                                data={{
                                    chaveAcesso: accessKey,
                                    numero: invoiceNumber.replace('NF ', ''),
                                    serie: pendingXmlData?.serie || '1',
                                    dataEmissao: entryDate,
                                    emitente: { cnpj: supplierCnpj, nome: supplier, nomeFantasia: supplierFantasyName },
                                    totais: {
                                        valorTotalProdutos: subtotal,
                                        valorTotalIpi: totalIpi,
                                        valorTotalFrete: totalFreight,
                                        valorOutrasDespesas: totalOtherExpenses,
                                        valorTotalDesconto: items.reduce((acc, it) => acc + (it.valorDesconto || 0), 0),
                                        valorTotalIcms: 0,
                                        valorTotalIcmsST: totalIcmsST,
                                        valorTotalIBS: totalIBS,
                                        valorTotalCBS: totalCBS,
                                        valorTotalNf: totalNoteValue,
                                        valorTotalTributos: (totalIpi + totalIcmsST + (totalIBS || 0) + (totalCBS || 0)),
                                    }
                                }}
                                supplierStatus={{ exists: supplierExists, isChecking: isSupplierChecking }}
                                actions={{ onCreateSupplier: () => setIsSupplierModalOpen(true), formatCurrency }}
                            />
                        </div>
                    )}

                    {items.length > 0 && (
                        <div className="section-wrapper">
                            <ItemsConference
                                items={items.map((i, index) => ({
                                    ...i,
                                    nItem: i.nItem || index + 1,
                                    confirmed: i.isConfirmed 
                                }))}
                                onConfirmItems={handleConfirmItems}
                                onUnconfirmItems={handleUnconfirmItems}
                                onMapProducts={handleOpenMappingFromTable}
                                onRemoveItems={handleRemoveItemsFromConference}
                                onToggleItem={handleToggleSingleItem}
                                onQuantityChange={handleQuantityReceivedChange} 
                            />
                        </div>
                    )}
                </div>

                {/* COLUNA DIREITA: PAINEL DE CONTROLE DE RESUMO */}
                <div className="side-control-panel">
                    {items.filter(i => i.difference !== 0).length > 0 ? (
                        <div className="alert-box error">
                            <h3 className="alert-title">
                                🚨 Divergências Detectadas ({items.filter(i => i.difference !== 0).length})
                            </h3>
                            <p className="alert-description">
                                O recebimento físico difere da NF. O estoque será atualizado com a quantidade física coletada.
                            </p>
                            <div className="divergence-list">
                                {items.filter(i => i.difference !== 0).map(item => {
                                    const isSobra = item.difference < 0;
                                    return (
                                        <div key={item.tempId} className="divergence-item">
                                            <strong>SKU {item.sku}:</strong> {item.descricao} <br />
                                            <span className="qty-comparison">NF: {item.quantidade} | Rec: {item.receivedQuantity}</span>
                                            <span className={`status-tag ${isSobra ? 'sobra' : 'falta'}`}>
                                                ({isSobra ? `+${Math.abs(item.difference)} Sobra` : `${item.difference} Falta`})
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : items.length > 0 ? (
                        <div className="alert-box success">
                            <span>🎉</span>
                            <div>
                                <strong>Conferência Perfeita!</strong>
                                <p className="success-description">Nenhuma divergência de quantidade foi apontada até o momento.</p>
                            </div>
                        </div>
                    ) : null}

                    {/* Bloco de Totais Financeiros */}
                    <div className="finance-totals-card">
                        <h3 className="totals-card-title">📊 Resumo do Recebimento</h3>

                        <div className="total-row">
                            <span>Total de Itens Físicos:</span>
                            <strong className="dark-value">
                                {items.reduce((acc, it) => acc + it.receivedQuantity, 0)} un
                            </strong>
                        </div>

                        <hr className="totals-divider" />

                        <div className="total-row text-muted">
                            <span>Valor dos Produtos (NF):</span>
                            <span className="dark-value">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="total-row text-muted">
                            <span>Frete (NF):</span>
                            <span className="dark-value">{formatCurrency(totalFreight)}</span>
                        </div>
                        <div className="total-row text-muted">
                            <span>Total Tributos (IPI/ST/IBS/CBS):</span>
                            <span className="dark-value">
                                {formatCurrency(totalIpi + totalIcmsST + (totalIBS || 0) + (totalCBS || 0))}
                            </span>
                        </div>
                        <div className="total-row text-muted">
                            <span>Descontos (NF):</span>
                            <span className="dark-value">
                                -{formatCurrency(items.reduce((acc, it) => acc + (it.valorDesconto || 0), 0))}
                            </span>
                        </div>
                        <div className="total-row text-muted font-medium">
                            <span>Valor Total da Nota (NF-e):</span>
                            <span className="dark-value">{formatCurrency(totalNoteValue)}</span>
                        </div>

                        <hr className="totals-divider dashed" />

                        <div className="total-row main-total">
                            <span className="brand-green">Custo Ajustado Total:</span>
                            <strong className="brand-green">
                                {formatCurrency(adjustedPhysicalSubtotal + totalFreight + totalIpi + totalOtherExpenses)}
                            </strong>
                        </div>

                        <button
                            onClick={() => console.log('Processar Envio backend:', items)}
                            disabled={isSubmitDisabled}
                            className={`btn-submit-entry ${isSubmitDisabled ? 'disabled' : 'active'}`}
                        >
                            {items.length === 0
                                ? '🚫 Importe o XML'
                                : hasUnmappedItems
                                    ? '🚫 Vincule todos os produtos'
                                    : hasUnconfirmedItems
                                        ? '🚫 Confirme todos os itens'
                                        : '✅ Confirmar Entrada e Estoque'
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAIS */}
            {isOpen && itemToMap && (
                <MappingModal
                    item={itemToMap}
                    supplierCnpj={supplierCnpj}
                    onClose={() => { setIsOpen(false); setItemToMap(null); }}
                    onMap={handleModalMapSuccess}
                />
            )}

            {isSupplierModalOpen && supplierToCreate && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h3 className="modal-title">Criar Fornecedor</h3>
                        <button type="button" onClick={() => console.log('Navegar para enriquecimento detalhado')}>Enriquecer Cadastro</button>
                        <p className="modal-subtitle">O parceiro deste XML não existe no banco de dados.</p>
                        <div className="modal-form-grid">
                            <div className="form-group">
                                <label className="form-label">Razão Social</label>
                                <input className="form-input" value={supplierCreationName} onChange={(e) => setSupplierCreationName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nome Fantasia</label>
                                <input className="form-input" value={supplierCreationFantasyName} onChange={(e) => setSupplierCreationFantasyName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">CNPJ</label>
                                <input className="form-input read-only" value={supplierToCreate.cnpj} readOnly />
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-modal-cancel" onClick={handleCancelSupplierCreation}>
                                Cancelar
                            </button>
                            <button className="btn-modal-save" onClick={handleCreateSupplierSubmit} disabled={supplierCreationLoading}>
                                {supplierCreationLoading ? 'Salvando...' : 'Salvar Fornecedor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockEntryForm;