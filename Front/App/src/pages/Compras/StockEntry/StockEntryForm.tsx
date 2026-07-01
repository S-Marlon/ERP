import React, { useMemo } from 'react';
import MappingModal from './_components/ProductMappingModal';
import NfeCards from './_components/NfeCards';
import { ItemsConference } from './ItemsConference';
import FlexGridContainer from '../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Badge from '../../../components/ui/Badge/Badge';
import { useStockEntry } from './useStockEntry';
import { SupplierModal } from './SupplierModal';
import './StockEntry.css';

const formatCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const StockEntryForm: React.FC = () => {
    const {
        financials, items, subtotal, adjustedPhysicalSubtotal, isSubmitDisabled,
        frete, 
        supplierExists, isSupplierChecking, isSupplierModalOpen, supplierCreationLoading,
        supplierCreationName, supplierCreationFantasyName, supplierToCreate,
        isMappingModalOpen, itemToMap, isProcessingItems, // 🟢 Importado do Hook atualizado
        setSupplierCreationName, setSupplierCreationFantasyName,
        handleXmlUpload, handleCancelSupplierCreation, handleCreateSupplierSubmit,
        handleConfirmItems, handleUnconfirmItems, handleToggleSingleItem,
        handleRemoveItemsFromConference, handleOpenMappingFromTable, handleModalMapSuccess,
        handleQuantityReceivedChange, handleAssignGroupToItems, setIsMappingModalOpen, setItemToMap,
        setIsSupplierModalOpen // 🟢 Adicionado para controle do fluxo do Card
    } = useStockEntry();

    // --- MEMOS DE AUXÍLIO VISUAL (Evita re-cálculos inúteis na renderização) ---
    const totalDivergences = useMemo(() => items.filter(i => i.difference !== 0).length, [items]);
    const totalConfirmed = useMemo(() => items.filter(i => i.isConfirmed).length, [items]);
    const totalUnmapped = useMemo(() => items.filter(i => !i.mappedId).length, [items]);
    const totalPhysicalItems = useMemo(() => items.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0), [items]);
    const totalDiscounts = useMemo(() => items.reduce((acc, it) => acc + (it.valorDesconto || 0), 0), [items]);

    return (
        <div className="stock-entry-container">
            {/* CABEÇALHO DA PÁGINA */}
            <div className="page-header">
                <FlexGridContainer layout='grid' template='1fr 1fr 1fr' gap='20px'>
                    <h1 className="page-title">📥 Entrada de Mercadorias (Registro de NF-e)</h1>
                    <div>
                        <div className="stats">
                            <Badge color="warning">pendentes: {items.length} {items.length === 1 ? 'item' : 'itens'}</Badge>
                            <Badge color="success">conferidos: {totalConfirmed}</Badge>
                            <Badge color="danger">divergências: {totalDivergences}</Badge>
                            <Badge color="poco">sem vínculo: {totalUnmapped}</Badge>
                        </div>
                    </div>
                    <div className="upload-action-wrapper">
                        <input type="file" style={{ display: 'none' }} accept=".xml" id="xml-upload" onChange={handleXmlUpload} />
                        <label htmlFor="xml-upload" className="btn-upload">
                            {financials.accessKey ? '🔄 Alterar XML' : '⬆️ Importar XML da NF-e'}
                        </label>
                    </div>
                </FlexGridContainer>
            </div>

            {/* ÁREA DE CONTEÚDO */}
            <div className="workspace-layout">
                {/* COLUNA ESQUERDA */}
                <div className="main-workflow-column">
                    {financials.accessKey && (
                        <div className="section-wrapper">
                            <NfeCards
    data={{
        chaveAcesso: financials.accessKey,
        numero: financials.invoiceNumber.replace('NF ', ''),
        serie: '1',
        dataEmissao: financials.entryDate,
        emitente: { cnpj: financials.supplierCnpj, nome: financials.supplier, nomeFantasia: financials.supplierFantasyName },
        
        // 🎯 INJETE O FRETE AQUI PARA O CARD ENXERGAR:
        frete: frete, 

        totais: {
            valorTotalProdutos: subtotal,
            valorTotalIpi: financials.totalIpi,
            valorTotalFrete: financials.totalFreight,
            valorOutrasDespesas: financials.totalOtherExpenses,
            valorTotalDesconto: totalDiscounts,
            valorTotalIcms: 0,
            valorTotalIcmsST: financials.totalIcmsST,
            valorTotalIBS: financials.totalIBS,
            valorTotalCBS: financials.totalCBS,
            valorTotalNf: financials.totalNoteValue,
            valorTotalTributos: (financials.totalIpi + financials.totalIcmsST + (financials.totalIBS || 0) + (financials.totalCBS || 0)),
        }
    }}
    supplierStatus={{ exists: supplierExists, isChecking: isSupplierChecking }}
    actions={{ onCreateSupplier: () => setIsSupplierModalOpen(true), formatCurrency }}
/>
                        </div>
                    )}

                    {items.length > 0 && (
                        <div className="section-wrapper">
                            {isProcessingItems && <div className="loading-overlay-items">Analisando e vinculando itens com o banco...</div>}
                            <ItemsConference
                                // 🟢 Injetado tanto 'confirmed' quanto mantido o 'isConfirmed' para evitar quebra interna do subcomponente
                                items={items.map((i, index) => ({ ...i, nItem: i.nItem || index + 1, confirmed: i.isConfirmed, isConfirmed: i.isConfirmed }))}
                                onConfirmItems={handleConfirmItems}
                                onUnconfirmItems={handleUnconfirmItems}
                                onMapProducts={handleOpenMappingFromTable}
                                onRemoveItems={handleRemoveItemsFromConference}
                                onToggleItem={handleToggleSingleItem}
                                onQuantityChange={handleQuantityReceivedChange} 
                                onAssignGroupToItems={handleAssignGroupToItems}
                                onUnassignGroup={() => {}}
                                onUnassignItem={() => {}}
                            />
                        </div>
                    )}
                </div>

                {/* COLUNA DIREITA */}
                <div className="side-control-panel">
                    {totalDivergences > 0 ? (
                        <div className="alert-box error">
                            <h3 className="alert-title">🚨 Divergências Detectadas ({totalDivergences})</h3>
                            <p className="alert-description">O recebimento físico difere da NF.</p>
                            <div className="divergence-list">
                                {items.filter(i => i.difference !== 0).map(item => (
                                    <div key={item.tempId} className="divergence-item">
                                        <strong>SKU {item.sku || 'N/A'}:</strong> {item.descricao} <br />
                                        <span className="qty-comparison">NF: {item.quantidade} | Rec: {item.receivedQuantity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : items.length > 0 ? (
                        <div className="alert-box success">
                            <strong>🎉 Conferência Perfeita!</strong>
                        </div>
                    ) : null}

                    {/* Resumo Financeiro */}
                    <div className="finance-totals-card">
                        <h3 className="totals-card-title">📊 Resumo do Recebimento</h3>
                        <div className="total-row">
                            <span>Total de Itens Físicos:</span>
                            <strong className="dark-value">{totalPhysicalItems} un</strong>
                        </div>
                        <hr className="totals-divider" />
                            <span>Frete:</span>

                             {/* FEEDBACK DA TRAVA DE CONFERÊNCIA */}
                                                <div style={{
                                                    display: 'flex',
                                                    color:'black',
                                                    justifyContent: 'space-between',
                                                    paddingTop: '15px',
                                                    borderTop: '2px solid #dee2e6',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    <span>Soma Informada: <strong>R$ 0,00</strong></span>
                                                    <span>Soma Distribuída: <strong>R$ 0,00</strong></span>
                                                </div>


                        <hr className="totals-divider" />
                        <div className="total-row text-muted">
                            <span>Valor Total da Nota (NF-e):</span>
                            <span className="dark-value">{formatCurrency(financials.totalNoteValue)}</span>
                        </div>
                        <div className="total-row main-total">
                            <span className="brand-green">Custo Ajustado Total:</span>
                            <strong className="brand-green">
                                {formatCurrency(adjustedPhysicalSubtotal + financials.totalFreight + financials.totalIpi + financials.totalOtherExpenses)}
                            </strong>
                        </div>

                        <button
                            onClick={() => console.log('Processar Envio:', items)}
                            disabled={isSubmitDisabled}
                            className={`btn-submit-entry ${isSubmitDisabled ? 'disabled' : 'active'}`}
                        >
                            {isProcessingItems 
                                ? '⏳ Cruzando dados...' 
                                : items.length === 0 
                                ? '🚫 Importe o XML' 
                                : '✅ Confirmar Entrada e Estoque'}
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAIS ISOLADOS */}
            {isMappingModalOpen && itemToMap && (
                <MappingModal
                    item={itemToMap}
                    supplierCnpj={financials.supplierCnpj}
                    onClose={() => { setIsMappingModalOpen(false); setItemToMap(null); }}
                    onMap={handleModalMapSuccess}
                />
            )}

            <SupplierModal
                isOpen={isSupplierModalOpen}
                loading={supplierCreationLoading}
                name={supplierCreationName}
                fantasyName={supplierCreationFantasyName}
                cnpj={supplierToCreate?.cnpj || ''}
                setName={setSupplierCreationName}
                setFantasyName={setSupplierCreationFantasyName}
                onCancel={handleCancelSupplierCreation}
                onSubmit={handleCreateSupplierSubmit}
            />
        </div>
    );
};

export default StockEntryForm;