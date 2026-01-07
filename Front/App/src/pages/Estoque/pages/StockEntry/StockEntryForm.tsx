// src/pages/StockEntryForm.tsx (FINAL COMPLETO E INTEGRADO)
import React, { useState, useMemo, useCallback } from 'react';
import Button from '../../../../components/ui/Button/Button';
import FlexGridContainer from '../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Typography from '../../../../components/ui/Typography/Typography';
import MappingModal from './_components/MappingModal'; // Modal de Mapeamento
import { parseNfeXmlToData, NfeDataFromXML } from '../../utils/nfeParser';
import Badge from '../../../../components/ui/Badge/Badge';
import { ActionPopover } from '../../../../components/ui/Popover/ActionPopover';
import NfeCards from './_components/NfeCards';
import { checkExistingMappings } from '../../api/productsApi';

// --- Interfaces ---
interface ProductEntry {
    isMapped: any;
    tempId: number;
    sku: string;
    name: string;
    unitPrice: number;
    quantity: number;
    unitOfMeasure: string; // ✨ Adicionado
    quantityReceived: number;
    difference: number;
    total: number;
    isConfirmed: boolean;
    unitCostWithTaxes: number;
    mappedId?: string;
    category?: string;
    mappedData?: any;
}

interface NfeData {
    invoiceNumber: string;
    supplier: string;
    entryDate: string;
    accessKey: string;
    totalFreight: number;
    totalIpi: number;
    totalOtherExpenses: number;
    totalNoteValue: number;
    items: ProductEntry[];
}

const itemActions = [
    {
        label: 'Resetar Quantidade',
        icon: '↺',
        onClick: () => resetQuantity(item.id)
    },
    {
        label: 'Resetar Mapeamento',
        icon: '🔗',
        onClick: () => resetMap(item.id)
    },
    {
        label: 'Resetar Categoria',
        icon: '🏷️',
        variant: 'danger' as const,
        onClick: () => removeItem(item.id)
    },
];

// --- Helpers ---
const formatCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mapNfeDataToEntryForm = (xmlData: NfeDataFromXML): NfeData => {
    const totalFreight = parseFloat(xmlData.valorTotalFrete || '0.00');
    const totalIpi = parseFloat(xmlData.valorTotalIpi || '0.00');
    const totalOtherExpenses = parseFloat(xmlData.valorOutrasDespesas || '0.00');

    const subtotalProducts = xmlData.produtos.reduce((sum, p) => {
        const total = parseFloat(p.valorTotal || '0.00');
        return sum + total;
    }, 0);

    const items: ProductEntry[] = xmlData.produtos.map((produto, index) => {
        const quantity = parseFloat(produto.quantidade || '0.00');
        const unitPrice = parseFloat(produto.valorUnitario || '0.00');
        const totalProductValue = parseFloat(produto.valorTotal || '0.00');
        const ratio = subtotalProducts > 0 ? (totalProductValue / subtotalProducts) : 0;
        const freightRate = totalFreight * ratio;
        const ipiRate = totalIpi * ratio;
        const otherExpensesRate = totalOtherExpenses * ratio;
        const totalCostItem = totalProductValue + freightRate + ipiRate + otherExpensesRate;
        const unitCostWithTaxes = quantity > 0 ? (totalCostItem / quantity) : unitPrice;

        return {
            tempId: index + 1,
            sku: produto.codigo,
            mappedId: undefined,
            name: produto.descricao,
            unitOfMeasure: produto.unidadeMedida || 'UN', // ✨ Capturando do XML
            unitPrice: parseFloat(unitPrice.toFixed(4)),
            quantity: parseFloat(quantity.toFixed(4)),
            quantityReceived: parseFloat(quantity.toFixed(4)),
            difference: 0,
            total: parseFloat(totalProductValue.toFixed(2)),
            unitCostWithTaxes: parseFloat(unitCostWithTaxes.toFixed(4)),
            isConfirmed: false,
            category: '',
        };
    });

    return {
        invoiceNumber: `NF ${xmlData.numero}`,
        supplier: xmlData.emitente.nome,
        entryDate: xmlData.dataEmissao.substring(0, 10),
        accessKey: xmlData.chaveAcesso,
        totalFreight,
        totalIpi,
        totalOtherExpenses,
        totalNoteValue: parseFloat(xmlData.valorTotal || '0.00'),
        items,
    };
};

// Cabeçalho da tabela
const renderTableHead = (itemsList: ProductEntry[], toggleSelectAll: (isPending: boolean) => void, isPendingTable: boolean, selectedIds: Set<number>) => {
    const allSelected = itemsList.length > 0 && itemsList.every(item => selectedIds.has(item.tempId));
    return (
        <thead>
            <tr style={styles.tableHead}>
                <th style={styles.tableTh}>
                    {itemsList.length > 0 && (
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleSelectAll(isPendingTable)}
                        />
                    )}
                </th>
                <th style={styles.tableTh}>Mapeamento</th>
                <th style={{ ...styles.tableTh, width: '60px' }}>SKU Forn.</th>
                <th style={{ ...styles.tableTh, width: '450px' }}>Produto (NF)</th>
                <th style={{ ...styles.tableTh, width: '100px' }}>Preço Unitário (NF)</th>
                <th style={{ ...styles.tableTh, width: '80px' }}>Qtd. NF</th>
                <th style={{ ...styles.tableTh, width: '80px' }}>UN. NF</th>
                <th style={{ ...styles.tableTh, width: '70px' }}>*Qtd. Recebida*</th>
                <th style={{ ...styles.tableTh, width: '30px' }}>*Dif.*</th>
                <th style={{ ...styles.tableTh, width: '120px' }}>Categoria</th>
                <th style={{ ...styles.tableTh, width: '60px' }}>Total Produto</th>
                <th style={{ ...styles.tableTh, width: '30px' }}>Ações</th>
            </tr>
        </thead>
    );
};

// --- Componente Principal ---
const StockEntryForm: React.FC = () => {
    // Header / nota
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
    const [items, setItems] = useState<ProductEntry[]>([]);
    // seleções separadas
    const [selectedPendingIds, setSelectedPendingIds] = useState<Set<number>>(new Set());
    const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<Set<number>>(new Set());
    const [availableCategories] = useState<string[]>(['Material', 'Insumo', 'Serviço', 'Outro']);
    const [bulkCategory, setBulkCategory] = useState<string>(availableCategories[0]);
    const [accessKey, setAccessKey] = useState('');
    const [totalFreight, setTotalFreight] = useState(0);
    const [totalIpi, setTotalIpi] = useState(0);
    const [totalOtherExpenses, setTotalOtherExpenses] = useState(0);
    const [totalNoteValue, setTotalNoteValue] = useState(0);

    // modal mapping
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [itemToMap, setItemToMap] = useState<ProductEntry | null>(null);
    const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
    const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantityReceived, 0), [items]);
    const hasUnmappedItems = items.some(item => !item.mappedId);
    const divergentItems = useMemo(() => items.filter(i => i.difference !== 0), [items]);
    const hasDivergence = divergentItems.length > 0;
    const pendingItems = useMemo(() => items.filter(item => !item.isConfirmed), [items]);
    const confirmedItems = useMemo(() => items.filter(item => item.isConfirmed), [items]);
    const hasPendingItems = pendingItems.length > 0;

    // Upload XML
    const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
        alert('Por favor, selecione um arquivo XML (.xml) válido.');
        return;
    }

    const reader = new FileReader();
    // Tornamos a função assíncrona para usar o await da API
    reader.onload = async (e) => {
        try {
            const xmlContent = e.target?.result as string;
            const rawXmlData = parseNfeXmlToData(xmlContent);
            if (!rawXmlData) throw new Error('Falha ao extrair dados do XML.');
            
            const xmlData = mapNfeDataToEntryForm(rawXmlData);

            // --- INÍCIO DA RECONCILIAÇÃO AUTOMÁTICA ---
            
            // 1. Pegamos o CNPJ do emitente (certifique-se que o mapNfeDataToEntryForm retorna isso)
            // const supplierCnpj = xmlData.supplierCnpj || rawXmlData.emitenteCnpj; 
            const supplierCnpj = '00.000.000/0000-00'; 
            
            // 2. Coletamos todos os SKUs dos itens da nota
            const skusDaNota = xmlData.items.map((i: any) => i.sku);

            // 3. Consultamos o backend para ver o que já está mapeado
            const existingMappings = await checkExistingMappings(supplierCnpj, skusDaNota);

            // 4. Cruzamos os dados: se existir mapeamento, o item já nasce "conectado"
            const reconciledItems = xmlData.items.map((item: any) => {
                const mapping = existingMappings.find((m: any) => m.sku_fornecedor === item.sku);

                if (mapping) {
                    return {
                        ...item,
                        isMapped: true, // Indica vínculo existente
                        internalProduct: {
                            id: mapping.codigo_interno,
                            name: mapping.descricao,
                            category: mapping.nome_categoria,
                            unitOfMeasure: mapping.unidade
                        }
                    };
                }
                return { ...item, isMapped: false };
            });
            // --- FIM DA RECONCILIAÇÃO ---

            // Atualização dos Estados
            setInvoiceNumber(xmlData.invoiceNumber);
            setSupplier(xmlData.supplier);
            setEntryDate(xmlData.entryDate);
            setAccessKey(xmlData.accessKey);
            setTotalFreight(xmlData.totalFreight);
            setTotalIpi(xmlData.totalIpi);
            setTotalOtherExpenses(xmlData.totalOtherExpenses);
            setTotalNoteValue(xmlData.totalNoteValue);
            
            // Agora setamos os itens já reconciliados
            setItems(reconciledItems);

            setSelectedPendingIds(new Set(reconciledItems.filter((i: any) => !i.isConfirmed).map((i: any) => i.tempId)));
            setSelectedConfirmedIds(new Set());

            const mapeadosCount = reconciledItems.filter((i: any) => i.isMapped).length;
            alert(`XML importado! ${reconciledItems.length} itens carregados (${mapeadosCount} sincronizados automaticamente).`);

        } catch (error) {
            console.error('Erro ao processar XML:', error);
            alert('Erro ao processar o arquivo XML. Detalhes: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
    };
    reader.onerror = () => { alert('Erro ao ler o arquivo.'); };
    reader.readAsText(file);
};

    // Manipuladores
    const toggleConfirmation = useCallback((tempId: number) => {
    const current = items.find(i => i.tempId === tempId);
    if (!current) return;

    const willConfirm = !current.isConfirmed;

    // Bloqueio estrito: Se for para confirmar e NÃO estiver mapeado, interrompe.
    if (willConfirm && !current.mappedId) {
        alert('Operação interrompida: Você precisa mapear o produto antes de confirmar a conferência.');
        return; 
    }

    // Postura de aviso: Se houver divergência, apenas avisa, mas permite seguir.
    if (willConfirm && current.difference !== 0) {
        console.warn(`Item ${current.sku} confirmado com divergência de ${current.difference}.`);
        // Se quiser um aviso visual para o usuário sem travar:
        // alert('Atenção: Este item possui divergência, mas será movido para conferidos.');
    }

    // Execução da atualização
    setItems(prev => prev.map(it => 
        it.tempId === tempId ? { ...it, isConfirmed: willConfirm } : it
    ));

    // Gerenciamento de IDs selecionados
    if (willConfirm) {
        setSelectedPendingIds(prev => { const n = new Set(prev); n.delete(tempId); return n; });
        setSelectedConfirmedIds(prev => { const n = new Set(prev); n.add(tempId); return n; });
    } else {
        setSelectedConfirmedIds(prev => { const n = new Set(prev); n.delete(tempId); return n; });
        setSelectedPendingIds(prev => { const n = new Set(prev); n.add(tempId); return n; });
    }

}, [items, setSelectedPendingIds, setSelectedConfirmedIds]);

    const handleUpdateReceivedQuantity = (tempId: number, value: string) => {
        const received = parseFloat(value);
        if (isNaN(received) || received < 0) return;
        setItems(prev => prev.map(it => {
            if (it.tempId === tempId) {
                const diff = received - it.quantity;
                return { ...it, quantityReceived: received, difference: parseFloat(diff.toFixed(4)) };
            } return it;
        }));
    };

    const handleResetReceivedQuantity = (tempId?: number, value?: string) => {
        // se houver seleção, reseta apenas os selecionados; senão reseta todos os pendentes
        const ids = Array.from(selectedPendingIds);

        setItems(prev =>
            prev.map(it => {
                if (ids.length > 0) {
                    return ids.includes(it.tempId)
                        ? { ...it, quantityReceived: it.quantity, difference: 0 }
                        : it;
                }
                // quando não há seleção, reseta todos os pendentes (não conferidos)
                return !it.isConfirmed ? { ...it, quantityReceived: it.quantity, difference: 0 } : it;
            })
        );

        // limpa seleção após o reset
        setSelectedPendingIds(new Set());

        const count = ids.length > 0 ? ids.length : pendingItems.length;
        alert(`${count} item(s) tiveram a quantidade recebida resetada para o valor da NF.`);
    };

    const handleUpdateItem = (tempId: number, field: keyof ProductEntry, value: string | number) => {
        setItems(prev => prev.map(it => {
            if (it.tempId === tempId) {
                let newItem = { ...it, [field]: value } as ProductEntry;
                if (field === 'unitPrice') {
                    const price = Number(value);
                    newItem.total = isNaN(price) ? 0 : parseFloat((it.quantity * price).toFixed(2));
                }
                return newItem;
            }
            return it;
        }));
    };

    const handleRemoveItem = (tempId: number) => {
        if (!window.confirm('Remover este item da lista de entrada?')) return;
        setItems(prev => prev.filter(it => it.tempId !== tempId));
        setSelectedPendingIds(prev => { const n = new Set(prev); n.delete(tempId); return n; });
        setSelectedConfirmedIds(prev => { const n = new Set(prev); n.delete(tempId); return n; });
    };

    const handleMapProduct = (tempId: number) => {
        const item = items.find(i => i.tempId === tempId);
        if (!item) return;
        setItemToMap(item);
        setIsMappingModalOpen(true);
    };

    const handleModalMap = useCallback((tempId: number, data: MappingPayload) => {
    setItems(prev => prev.map(it => {
        if (it.tempId === tempId) {
            return {
                ...it,
                // O mappedId é o ID oficial que veio do sistema/banco
                mappedId: data.mapped.id, 
                
                // Atualizamos a categoria com a que foi selecionada no modal
                category: data.mapped.category,
                
                // UNIDADE DE MEDIDA: É importante sincronizar se o sistema usa uma 
                // unidade diferente da que veio na nota fiscal
                unitOfMeasure: data.mapped.unitOfMeasure,

                // Mantemos o nome interno do sistema para clareza na conferência
                // Se preferir manter o nome da NF, pode comentar a linha abaixo
                name: data.mapped.name,

                // Guardamos o objeto completo para uso posterior no POST final da nota
                mappedData: data.mapped 
            };
        }
        return it;
    }));

    // Fecha o modal e limpa o estado
    setIsMappingModalOpen(false);
    setItemToMap(null);
    
    console.log(`Produto ${tempId} mapeado com sucesso para o ID: ${data.mapped.id}`);
}, []);

    const closeModal = () => { setIsMappingModalOpen(false); setItemToMap(null); };

    // Seleção por linha (isPending = true para pendentes)
    const toggleSelectItem = (tempId: number, isPending: boolean) => {
        if (isPending) {
            setSelectedPendingIds(prev => { const n = new Set(prev); n.has(tempId) ? n.delete(tempId) : n.add(tempId); return n; });
        } else {
            setSelectedConfirmedIds(prev => { const n = new Set(prev); n.has(tempId) ? n.delete(tempId) : n.add(tempId); return n; });
        }
    };

    const toggleSelectAll = (isPendingTable: boolean) => {
        const list = isPendingTable ? pendingItems : confirmedItems;
        if (isPendingTable) {
            const all = list.length > 0 && list.every(i => selectedPendingIds.has(i.tempId));
            setSelectedPendingIds(prev => {
                const n = new Set(prev);
                list.forEach(i => all ? n.delete(i.tempId) : n.add(i.tempId));
                return n;
            });
        } else {
            const all = list.length > 0 && list.every(i => selectedConfirmedIds.has(i.tempId));
            setSelectedConfirmedIds(prev => {
                const n = new Set(prev);
                list.forEach(i => all ? n.delete(i.tempId) : n.add(i.tempId));
                return n;
            });
        }
    };

    const handleBulkConfirmSelected = () => {
        const ids = Array.from(selectedPendingIds);
        setItems(prev => prev.map(it => ids.includes(it.tempId) ? { ...it, isConfirmed: true } : it));
        setSelectedPendingIds(new Set());
        setSelectedConfirmedIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
        alert(`${ids.length} itens marcados como Conferidos.`);
    };
    const handleBulkUnconfirmSelected = () => {
        const ids = Array.from(selectedConfirmedIds);
        setItems(prev => prev.map(it => ids.includes(it.tempId) ? { ...it, isConfirmed: false } : it));
        setSelectedConfirmedIds(new Set());
        setSelectedPendingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
        alert(`${ids.length} itens desmarcados (movidos para Pendentes).`);
    };
    // Render linha (agora recebe isPending + toggleSelectItem)
    const renderItemRow = (
        item: ProductEntry,
        toggleConfirmationFn: (tempId: number) => void,
        handleUpdateReceivedQuantityFn: (tempId: number, value: string) => void,
        handleMapProductFn: (tempId: number) => void,
        handleUpdateItemFn: (tempId: number, field: keyof ProductEntry, value: string | number) => void,
        handleRemoveItemFn: (tempId: number) => void,
        toggleSelectItemFn: (tempId: number, isPending: boolean) => void,
        isSelected: boolean,
        isPending: boolean
    ) => {
        const isDivergent = item.difference !== 0;
        // Alternância de cores por linha (índice do item)
        const rowIndex = (isPending ? pendingItems : confirmedItems).findIndex(i => i.tempId === item.tempId);
        const isEvenRow = rowIndex % 2 === 0;
        const baseRowColor = isEvenRow ? '#ffffff' : '#f9fafb';
        const selectedRowColor = '#dbeafe'; // azul claro ao selecionar
        const rowBackgroundColor = isSelected ? selectedRowColor : baseRowColor;
        const rowBorderLeft = isSelected ? '4px solid #3b82f6' : 'none';
        const rowPaddingLeft = isSelected ? '8px' : '12px';

        return (
            <tr key={item.tempId} style={{
                ...styles.tableRow,
                backgroundColor: rowBackgroundColor,
                borderLeft: rowBorderLeft,
                transition: 'all 0.2s ease-in-out',
                cursor: 'pointer',
            }}>
                <td style={{ ...styles.tableCell, textAlign: 'center' }}>
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItemFn(item.tempId, isPending)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    />
                </td>
                <td style={styles.tableCell}>
                    {item.isMapped ? (
                        <Badge color="success">Cod Interno: {item.sku}</Badge>
                    ) : (
                        <Button onClick={() => handleMapProductFn(item.tempId)} variant='warning' fontsize='11px' padding='5px' >
                            🔗 Mapear
                        </Button>
                    )}
                </td>
                
                <td style={styles.tableCell}>{item.sku}</td>
                <td style={{ ...styles.tableCell, fontWeight: 500 }}>{item.name}</td>
                <td style={styles.tableCell}>R$ {item.unitPrice.toFixed(3)}</td>
                <td style={{ ...styles.tableCell, fontWeight: 700, color: '#4b5563' }}>{item.quantity.toFixed(2)}</td>
                <td style={{ ...styles.tableCell, fontWeight: 700, color: '#4b5563' }}>{item.unitOfMeasure}</td>
                <td style={styles.tableCell}>
                    {item.isConfirmed ? (
                        <span style={{ fontWeight: 600, color: '#10b981' }}>{item.quantityReceived}</span>
                    ) : (
                        <input
                            type="number" min="0" step="1"
                            value={item.quantityReceived}
                            onChange={(e) => handleUpdateReceivedQuantityFn(item.tempId, e.target.value)}
                            style={{
                                maxWidth: '50px',
                                backgroundColor: isDivergent ? '#fee2e2' : '#ffffffff',
                                border: isDivergent ? '2px solid #dc2626' : '2px solid #10b981',
                                color: isDivergent ? '#991b1b' : '#10b981',
                            }}
                            disabled={item.isConfirmed}
                        />
                    )}
                </td>
                <td style={{
                    ...styles.tableCell, fontWeight: 700,
                    color: isDivergent ? (item.difference > 0 ? '#f97316' : '#dc2626') : '#10b981',
                    backgroundColor: isDivergent ? (item.difference > 0 ? '#fef3c7' : '#fee2e2') : 'transparent',
                    padding: '3px 6px',
                    borderRadius: '4px',
                }}>
                    {item.difference.toFixed(2)}
                </td>
                <td style={styles.tableCell}>
                    {item.category && item.category !== '' ? (
                        <span style={{
                            padding: '3px 8px',
                            backgroundColor: '#d1fae5',
                            color: '#065f46',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                        }}>
                            {item.category}
                        </span>
                    ) : (
                        <span style={{
                            padding: '5px 0px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                        }}>
                            Sem Categoria
                        </span>
                    )}
                </td>
                <td style={{ ...styles.tableCell, fontWeight: 700, color: '#10b981' }}>{formatCurrency(item.total)}</td>
                <td style={styles.tableCell}>
                    <button
                        onClick={() => toggleConfirmationFn(item.tempId)}
                        style={{
                            ...(item.isConfirmed ? styles.uncheckButton : styles.checkButton),
                            transition: 'all 0.15s',
                            fontWeight: 600,
                        }}
                    >
                        {item.isConfirmed ? 'Desmarcar' : 'Conferir'}
                    </button>
                    {!item.isConfirmed && (

                        <ActionPopover actions={itemActions} />
                    )}

                </td>
            </tr>
        );
    };

    // Confirma entrada
    const handleConfirmEntry = () => {
        if (items.length === 0) { alert('Não há itens para dar entrada no estoque.'); return; }
        if (hasPendingItems) { alert('ERRO: Todos os itens devem ser conferidos antes de finalizar a entrada.'); return; }
        const allMapped = items.every(item => item.mappedId);
        if (!allMapped) { alert('ERRO: Todos os itens devem estar mapeados antes de confirmar a entrada.'); return; }
        if (hasDivergence) {
            const confirmDivergence = window.confirm(`ATENÇÃO: ${divergentItems.length} divergência(s). Confirmar entrada dos itens recebidos (${totalItems.toFixed(2)} unidades)?`);
            if (!confirmDivergence) return;
        }
        alert(`Entrada de NF ${invoiceNumber} confirmada! ${totalItems.toFixed(2)} unidades serão atualizadas no estoque.`);
    };
    return (
        <div style={styles.container}>
            <div className="page-header">
                <FlexGridContainer layout='grid' template='3fr 3fr' gap='10px'>

                    <h1 style={styles.title}>📥 Entrada de Mercadorias (Registro de NF-e)</h1>
                    {!accessKey && (
                        <div style={styles.importArea}>
                            <input type="file" style={styles.fileInput} accept=".xml" id="xml-upload" onChange={handleXmlUpload} />
                            <label htmlFor="xml-upload" style={styles.importButton}>⬆️ Importar XML da NF-e</label>
                            <Typography variant='pMuted' style={{ marginTop: '10px' }}>(Preenche automaticamente cabeçalho, totais e lista de produtos)</Typography>
                        </div>
                    )}
                    {accessKey && (
                        <div style={styles.importArea}>
                            <label style={styles.importButton}> ✅ XML importado com sucesso. Dados da NF carregados.</label>


                            <label style={styles.importButton}>Alterar XML</label>
                        </div>
                    )}

                </FlexGridContainer>
            </div>

            <NfeCards
                invoiceNumber={invoiceNumber}
                accessKey={accessKey}
                entryDate={entryDate}
                setEntryDate={setEntryDate}
                supplier={supplier}
                totalIpi={totalIpi}
                totalFreight={totalFreight}
                totalOtherExpenses={totalOtherExpenses}
                subtotal={subtotal}
                totalNoteValue={totalNoteValue}
                formatCurrency={formatCurrency}
                styles={styles}
            />
            <hr />
            <h2 style={styles.panelTitle}>3. Conferência Detalhada de Itens {items.length == 1 ? '(1 item)' : `(${items.length} itens)`}</h2>
            <FlexGridContainer layout='grid'>

                <FlexGridContainer layout='flex'>
                    <h3 style={styles.subTitle}>🔴 Itens Pendentes de Ação ({pendingItems.length} produtos)</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <button onClick={handleBulkConfirmSelected} style={{ padding: '6px 10px', borderRadius: 4, backgroundColor: '#4f46e5', color: '#fff' }}>
                            Conferir Selecionados
                        </button>
                        <button onClick={() => handleResetReceivedQuantity()} style={{ padding: '6px 10px', borderRadius: 4, backgroundColor: '#f59e0b', color: '#fff' }}>
                            Resetar Quantidade
                        </button>
                        <button onClick={() => setSelectedPendingIds(new Set())} style={{ padding: '6px 10px', borderRadius: 4, backgroundColor: '#9ca3af', color: '#fff' }}>Limpar Seleção</button>
                        <span style={{ marginLeft: 8, color: '#6b7280' }}>{selectedPendingIds.size > 0 ? `${selectedPendingIds.size} selecionado(s)` : 'Selecione itens para ações em lote'}</span>
                    </div>

                    {hasUnmappedItems && hasPendingItems && <Badge color='warning'>⚠️ {items.filter(i => !i.mappedId).length} item(ns) precisam de Mapeamento.</Badge>}
                    <div style={{ ...styles.tableResponsive, marginBottom: '30px' }}>
                        <table style={styles.dataTable}>
                            {renderTableHead(pendingItems, toggleSelectAll, true, selectedPendingIds)}
                            <tbody>
                                {pendingItems.length === 0 ? (
                                    <tr style={styles.tableRow}>
                                        <td colSpan={12} style={{ ...styles.tableCell, textAlign: 'center', color: '#065f46', backgroundColor: '#ecfdf5' }}>
                                            🎉 Não há itens pendentes. Role para baixo e finalize a entrada.
                                        </td>
                                    </tr>
                                ) : (
                                    pendingItems.map(item =>
                                        renderItemRow(item, toggleConfirmation, handleUpdateReceivedQuantity, handleMapProduct, handleUpdateItem, handleRemoveItem, toggleSelectItem, selectedPendingIds.has(item.tempId), true)
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </FlexGridContainer>
                <FlexGridContainer >
                    <Typography variant='h3'>🟢 Itens Conferidos {confirmedItems.length == 1 ? '(1 item)' : `(${confirmedItems.length} itens)`}</Typography>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <button onClick={handleBulkUnconfirmSelected} style={{ padding: '6px 10px', borderRadius: 4, backgroundColor: '#ef4444', color: '#fff' }}>Desmarcar Selecionados</button>
                        <button onClick={() => setSelectedConfirmedIds(new Set())} style={{ padding: '6px 10px', borderRadius: 4, backgroundColor: '#9ca3af', color: '#fff' }}>Limpar Seleção</button>
                        <span style={{ marginLeft: 8, color: '#6b7280' }}>{selectedConfirmedIds.size > 0 ? `${selectedConfirmedIds.size} selecionado(s)` : 'Selecione itens para desmarcar em lote'}</span>
                    </div>

                    <div style={styles.tableResponsive}>
                        <table style={styles.dataTable}>
                            {renderTableHead(confirmedItems, toggleSelectAll, false, selectedConfirmedIds)}
                            <tbody>
                                {confirmedItems.length === 0 ? (
                                    <tr style={styles.tableRow}>
                                        <td colSpan={12} style={{ ...styles.tableCell, textAlign: 'center', color: '#6b7280' }}>Nenhum item foi marcado como conferido ainda.</td>
                                    </tr>
                                ) : (
                                    confirmedItems.map(item =>
                                        renderItemRow(item, toggleConfirmation, handleUpdateReceivedQuantity, handleMapProduct, handleUpdateItem, handleRemoveItem, toggleSelectItem, selectedConfirmedIds.has(item.tempId), false)
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </FlexGridContainer>
                {hasDivergence && (
                    <div style={{ ...styles.panel, backgroundColor: '#fef2f2' }}>
                        <h2 style={{ ...styles.panelTitle, color: '#dc2626' }}>🚨 3. Divergência Encontrada ({divergentItems.length})</h2>
                        <div style={styles.divergenceList}>
                            {divergentItems.map(item => (
                                <div key={item.tempId} style={styles.divergenceItem}>
                                    <Typography variant='p'><strong>SKU {item.sku}:</strong> {item.name}</Typography>
                                    <p style={styles.divergenceDetails}>
                                        Quantidade na NF: <strong>{item.quantity.toFixed(2)}</strong> | Recebido: <strong>{item.quantityReceived.toFixed(2)}</strong> |
                                        Diferença: <span style={{ color: item.difference > 0 ? '#f59e0b' : '#dc2626', fontWeight: 700 }}>{item.difference > 0 ? `+${item.difference.toFixed(2)}` : item.difference.toFixed(2)}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                        <Button variant='secondary'>Gerar Relatório</Button>
                    </div>
                )}
                <div style={styles.confirmationArea}>
                    <div style={styles.totalsBoxFooter}>
                        <p style={styles.totalLine}><span style={styles.totalLabel}>Total de Itens Físicos (Recebidos):</span><span style={styles.totalValue}>{totalItems.toFixed(2)}</span></p>
                        <p style={{ ...styles.totalLine, borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
                            <span style={{ ...styles.totalLabel, fontWeight: 700 }}>Total dos Produtos (Soma NF):</span>
                            <span style={{ ...styles.totalValue, color: '#10b981', fontSize: '1.5rem' }}>{formatCurrency(subtotal)}</span>
                        </p>
                        <p style={{ ...styles.totalLine, borderTop: '1px dashed #e5e7eb', paddingTop: '10px', fontSize: '1.1rem' }}>
                            <span style={{ ...styles.totalLabel, fontWeight: 700, color: '#047857' }}>Custo Total (Ajustado):</span>
                            <span style={{ ...styles.totalValue, color: '#047857', fontSize: '1.3rem' }}>{formatCurrency(subtotal + totalFreight + totalIpi + totalOtherExpenses)}</span>
                        </p>
                    </div>

                    <button onClick={handleConfirmEntry} style={styles.confirmButton} disbled={items.length === 0 || hasUnmappedItems || hasPendingItems}>
                        {items.length === 0 ? '🚫 Importe o XML' : hasPendingItems ? '🚫 Finalize a conferência' : hasUnmappedItems ? '🚫 Mapeie os itens' : '✅ Confirmar Entrada e Atualizar Estoque'}
                    </button>
                </div>
            </FlexGridContainer>

            {isMappingModalOpen && itemToMap && (
                <MappingModal
                    item={itemToMap}
                    onClose={closeModal}
                    onMap={handleModalMap} // Passa a função que agora entende o objeto
                    supplierCnpj={'00.000.000/0000-00'} // Certifique-se que este valor existe
                />
            )}
        </div>
    );
};

// --- styles ---
const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '24px', backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: 'Arial, sans-serif' },
    title: { fontSize: '1.875rem', fontWeight: 600, color: '#1f2937', marginBottom: '24px' },
    panel: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
    panelTitle: { fontSize: '1.25rem', fontWeight: 600, color: '#374151', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' },
    subTitle: { fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '10px', marginTop: '10px' },
    importArea: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '10px', border: '1px dashed #93c5fd', backgroundColor: '#eff6ff', borderRadius: '6px' },
    fileInput: { display: 'none' },
    importButton: { padding: '10px 15px', backgroundColor: '#4f46e5', color: 'white', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' },
    input: { padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' },
    tableResponsive: { overflowX: 'auto' },
    dataTable: { width: '100%', borderCollapse: 'collapse' },
    tableHead: { backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' },
    tableTh: { padding: '5px 5px', textAlign: 'left', fontSize: '0.70rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' },
    tableRow: {
        borderBottom: '1px solid #e5e7eb',
        transition: 'background-color 0.2s, border-left 0.2s',
    },
    ':hover': { // CSS-in-JS não suporta pseudo-seletores direto, mas adicionamos via inline styles nas linhas
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
    tableCell: { padding: '3px 5px', textAlign: 'left', fontSize: '0.75rem', color: '#1f2937', verticalAlign: 'middle' },
    removeButton: { padding: '4px 8px', backgroundColor: '#fca5a5', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 },
    checkButton: {
        padding: '4px 8px',
        backgroundColor: '#10b981',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
    },
    uncheckButton: {
        padding: '4px 8px',
        backgroundColor: '#6b7280',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
    },
    mapButton: {
        padding: '5px 10px',
        backgroundColor: '#f97316',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
    },
    mappedIdBadge: {
        padding: '5px 8px',
        backgroundColor: '#d1fae5',
        color: '#065f46',
        borderRadius: '4px',
        fontWeight: 600,
        fontSize: '0.8rem',
        display: 'inline-block',
        transition: 'all 0.15s',
    },
    confirmationArea: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: '20px' },
    totalsBoxFooter: { padding: '15px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#ffffff', width: '300px' },
    confirmButton: { padding: '15px 30px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' },
    summaryGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px', alignItems: 'flex-start' },
    summaryItem: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' },
    summaryLabel: { color: '#4b5563', fontWeight: 500 },
    summaryValue: { fontWeight: 600, color: '#1f2937' },
    totalLine: { display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '5px' },
    totalLabel: { color: '#4b5563' },
    totalValue: { fontWeight: 600 },
    divergenceList: { display: 'flex', flexDirection: 'column', gap: '10px' },
    divergenceItem: { padding: '10px', borderLeft: '4px solid #f87171', backgroundColor: '#fefefe', borderRadius: '4px' },
    divergenceDetails: { fontSize: '0.9rem', color: '#4b5563' },
};

export default StockEntryForm;