// src/pages/StockEntryForm.tsx 
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Button from '../../../../components/ui/Button/Button';
import FlexGridContainer from '../../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Typography from '../../../../components/ui/Typography/Typography';
import MappingModal, { MappingPayload } from './_components/MappingModal'; // Modal de Mapeamento
import { parseNfeXmlToData, NfeDataFromXML, ProdutoNF } from '../../utils/nfeParser';
import Badge from '../../../../components/ui/Badge/Badge';
import { ActionPopover } from '../../../../components/ui/Popover/ActionPopover';
import NfeCards from './_components/NfeCards';
import { checkExistingMappings, checkSupplier, createSupplier, submitStockEntry } from '../../api/productsApi';
import FormControl from '../../../../components/ui/FormControl/FormControl';


interface ProductEntry extends ProdutoNF {
  tempId: number;
  isMapped: boolean;
  mappedId?: string;
  isConfirmed: boolean;
  category?: string;
  mappedData?: any;
  quantityReceived: number;
  difference: number;
  total: number;
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

// --- Helpers ---

const formatCurrency = (value: number): string =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const roundQuantityByUnit = (quantity: number, unitOfMeasure: string): number => {
    const unit = (unitOfMeasure || 'UN').toUpperCase();
    let decimalPlaces = 2;

    if (['UN', 'PC', 'CX', 'FD', 'RST'].includes(unit)) decimalPlaces = 0;
    else if (['M', 'MT', 'M2', 'M3'].includes(unit)) decimalPlaces = 2;
    else if (['KG', 'L', 'LT', 'ML'].includes(unit)) decimalPlaces = 3;

    const factor = Math.pow(10, decimalPlaces);
    return Math.round(quantity * factor) / factor;
};

const mapNfeDataToEntryForm = (xmlData: NfeDataFromXML): NfeData => {
   const items: ProductEntry[] = xmlData.produtos.map((produto, index) => ({
    ...produto,                  // pega todos os campos do ProdutoNF
    tempId: index + 1,
    isMapped: false,
    isConfirmed: false,
    category: '',
    mappedData: undefined,
    quantityReceived: produto.quantidade || 0,                       // inicializa a quantidade recebida
    total: (produto.quantidade || 0) * (produto.valorUnitario || 0), // inicializa total
    difference: 0,                                                   // inicializa diferença
}));

    return {
        invoiceNumber: `NF ${xmlData.numero}`,
        supplier: xmlData.emitente.nome,
        supplierFantasyName: xmlData.emitente.nomeFantasia || xmlData.emitente.nome,
        supplierCnpj: xmlData.emitente.cnpj,
        entryDate: xmlData.dataEmissao.substring(0, 10),
        accessKey: xmlData.chaveAcesso,
        totalFreight: xmlData.valorTotalFrete,
        totalIpi: xmlData.valorTotalIpi,
        totalIcmsST: xmlData.valorTotalIcmsST,
        totalIBS: xmlData.valorTotalIBS,
        totalCBS: xmlData.valorTotalCBS,
        totalOtherExpenses: xmlData.valorOutrasDespesas,
        totalNoteValue: xmlData.valorTotalNf,
        items,
    };
};

// --- Componente Principal ---
const StockEntryForm: React.FC = () => {
    // Header / nota
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [supplier, setSupplier] = useState('');
    const [supplierFantasyName, setSupplierFantasyName] = useState(''); // ✨ Novo estado
const [supplierCnpj, setSupplierCnpj] = useState<string>('');
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [supplierToCreate, setSupplierToCreate] = useState<{ cnpj: string; name: string, fantasyName: string } | null>(null);
    // Form state for creating supplier
    const [supplierCreationName, setSupplierCreationName] = useState('');
    const [supplierCreationLoading, setSupplierCreationLoading] = useState(false);
    const [isSupplierChecking, setIsSupplierChecking] = useState(false);
    const [supplierExists, setSupplierExists] = useState<boolean | null>(null);
    const [pendingXmlData, setPendingXmlData] = useState<NfeData | null>(null);
    const [pendingSkus, setPendingSkus] = useState<string[] | null>(null);
    const [entryDate, setEntryDate] = useState(''); // Começa vazio
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


const [totalIcmsST, setTotalIcmsST] = useState(0);
const [totalIBS, setTotalIBS] = useState<number | undefined>(undefined);
const [totalCBS, setTotalCBS] = useState<number | undefined>(undefined);
const [mappedItems, setMappedItems] = useState<Record<number, MappingPayload>>({});








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

    // Função que faz a sincronização de mapeamentos e atualiza os itens (usada ao importar XML e após criar fornecedor)
    const performMappingSync = async (cnpjToUse: string, xmlToUse: NfeData) => {
        try {
            const skus = xmlToUse.items.map(i => i.sku);
            const existingMappings = await checkExistingMappings(cnpjToUse, skus);
            const reconciledItems = xmlToUse.items.map((item: any) => {
                const mapping = existingMappings.find((m: any) => m.sku_fornecedor === item.sku);
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

            // Atualiza itens e seleção
            setItems(reconciledItems);
            setSelectedPendingIds(new Set(reconciledItems.filter((i: any) => !i.isConfirmed).map((i: any) => i.tempId)));
            setSelectedConfirmedIds(new Set());

            const mapeadosCount = reconciledItems.filter((i: any) => i.isMapped).length;
            alert(`XML importado! ${reconciledItems.length} itens carregados (${mapeadosCount} sincronizados automaticamente).`);

            // limpa pendentes
            setPendingXmlData(null);
            setPendingSkus(null);
        } catch (err) {
            console.error('Erro ao sincronizar mapeamentos:', err);
            alert('Erro ao sincronizar mapeamentos: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
        }
    };

     const [nomeFantasia, setNomeFantasia] = useState("");

// Função auxiliar para gerar o hash MD5 no navegador
async function gerarHashCNPJ(cnpj: string): Promise<string> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const msgUint8 = new TextEncoder().encode(cnpjLimpo);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8); // Usando SHA-256 (nativo e mais seguro que MD5 no browser)
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const [siglaGerada, setSiglaGerada] = useState("");

useEffect(() => {
    if (supplierCnpj.length >= 14) { // Só gera quando o CNPJ estiver completo
        gerarHashCNPJ(supplierCnpj).then(hash => {
            setSiglaGerada(hash.substring(0, 4).toUpperCase());
        });
    } else {
        setSiglaGerada("");
    }
}, [supplierCnpj]);

   // Upload XML
const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
        alert('Por favor, selecione um arquivo XML (.xml) válido.');
        return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const xmlContent = e.target?.result as string;
            const rawXmlData = parseNfeXmlToData(xmlContent);

            if (!rawXmlData) throw new Error('Falha ao extrair dados do XML.');

            const xmlData = mapNfeDataToEntryForm(rawXmlData);
            const formattedSupplierCnpj = formatCnpj(xmlData.supplierCnpj);

            // 1️⃣ Popula Cabeçalho e Totais
            setSupplierCnpj(formattedSupplierCnpj);
            setInvoiceNumber(xmlData.invoiceNumber);
            setSupplier(xmlData.supplier);
            setSupplierFantasyName(xmlData.supplierFantasyName);
            setEntryDate(xmlData.entryDate);
            setAccessKey(xmlData.accessKey);

            setTotalFreight(xmlData.totalFreight);
            setTotalIpi(xmlData.totalIpi);
            setTotalOtherExpenses(xmlData.totalOtherExpenses);
            setTotalNoteValue(xmlData.totalNoteValue);
            
            // Novos campos 2026
            setTotalIcmsST(xmlData.totalIcmsST);
            setTotalIBS(xmlData.totalIBS);
            setTotalCBS(xmlData.totalCBS);

            // 2️⃣ Verifica Fornecedor
            setIsSupplierChecking(true);
            try {
                const supplierCheck = await checkSupplier(formattedSupplierCnpj);

                if (!supplierCheck.exists) {
                    setSupplierExists(false);
                    setSupplierToCreate({
                        cnpj: formattedSupplierCnpj,
                        name: xmlData.supplier,
                        fantasyName: xmlData.supplierFantasyName
                    });
                    setSupplierCreationName(xmlData.supplier);

                    // Dados pendentes para processar após criar fornecedor
                    setPendingXmlData(xmlData);
                    setItems(xmlData.items);
                    setSelectedPendingIds(new Set(xmlData.items.map(i => i.tempId)));
                    
                    setIsSupplierModalOpen(true);
                    return; // Interrompe para aguardar criação do fornecedor
                } 
                
                setSupplierExists(true);
                setSupplier(supplierCheck.supplier?.name || xmlData.supplier);
                
                // 3️⃣ Sincroniza Mapeamentos (Se o fornecedor já existe)
                await performMappingSync(formattedSupplierCnpj, xmlData);

            } catch (err) {
                console.error('Erro ao checar fornecedor:', err);
                setSupplierExists(false);
            } finally {
                setIsSupplierChecking(false);
            }

        } catch (error) {
            console.error('Erro ao processar XML:', error);
            alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    };

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
};

    const handleModalMap = useCallback((tempId: number, data: MappingPayload) => {
        if (!data) {
            console.error("Erro: dados de mapeamento não recebidos");
            return;
        }

        setMappedItems(prev => ({
            ...prev,
            [tempId]: data
        }));

        setItems(prev => prev.map(it => {
            if (it.tempId === tempId) {
                return {
                    ...it,
                    isMapped: true,
                    mappedId: data.CodInterno || data.sku,
                    category: data.Categorias || "",
                    unitOfMeasure: data.individualUnit || "UN",
                    name: data.name || "",
                    mappedData: data
                };
            }
            return it;
        }));

        setIsMappingModalOpen(false);
        setItemToMap(null);

        console.log(`Produto ${tempId} mapeado com sucesso para o ID: ${data.CodInterno}`);
    }, []);


const openMappingModal = (item: ProductEntry) => {
      console.log('🔥 ABRINDO MODAL COM:', item);  // ← ADICIONE
    setItemToMap(item);
};

const closeModal = () => {
      console.log('🔥 FECHANDO MODAL');  // ← ADICIONE
    setItemToMap(null);
};
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
    // Per-item actions (fix undefined top-level actions)
    const getItemActions = (item: ProductEntry) => [
        {
            label: 'Resetar Quantidade',
            icon: '↺',
            onClick: () => handleResetReceivedQuantity(item.tempId)
        },
        {
            label: 'Resetar Mapeamento',
            icon: '🔗',
            onClick: () => {
                if (!window.confirm('Deseja resetar o mapeamento deste item?')) return;
                setItems(prev => prev.map(it => it.tempId === item.tempId ? { ...it, mappedId: undefined, isMapped: false, mappedData: undefined, category: '' } : it));
                setSelectedPendingIds(prev => { const n = new Set(prev); n.add(item.tempId); return n; });
            }
        },
        {
            label: 'Remover Item',
            icon: '🗑️',
            variant: 'danger' as const,
            onClick: () => handleRemoveItem(item.tempId)
        }
    ];


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
                <th style={{ ...styles.tableTh, width: '60px' }}>EAN</th>
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
                    {item.tempId}
                </td>
                <td style={styles.tableCell}>
                    {item.isMapped ? (
                        <Badge color="success">Cod Interno: {item.mappedId}</Badge>
                    ) : (
                        <Button onClick={() => openMappingModal(item)} variant='warning' fontsize='11px' padding='5px' >
                            🔗 Mapear
                        </Button>
                    )}
                </td>
                
                <td style={styles.tableCell}>{item.sku}</td>
                <td style={styles.tableCell}>{item.gtin || '-'}</td>
                <td style={{ ...styles.tableCell, fontWeight: 500 }}>{item.descricao}</td>
                <td style={styles.tableCell}>R$ {item.valorProdutos.toFixed(3)}</td>
                <td style={{ ...styles.tableCell, fontWeight: 700, color: '#4b5563' }}>{item.quantidade.toFixed(2)}</td>
                <td style={{ ...styles.tableCell, fontWeight: 700, color: '#4b5563' }}>{item.unidadeMedida}</td>
                <td style={styles.tableCell}>
                    {item.isConfirmed ? (
                        <span style={{ fontWeight: 600, color: '#10b981' }}>{item.quantidade}</span>
                    ) : (
                        <input
                            type="number" min="0" step={item.unidadeMedida === 'UN' || item.unidadeMedida === 'PC' ? '1' : '0.1'}
                            value={String(item.quantidade)}
                            onChange={(e) => handleUpdateReceivedQuantityFn(item.tempId, e.target.value)}
                            style={{
                                maxWidth: '50px',
                                backgroundColor: isDivergent ? '#fee2e2' : '#ffffff',
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

                        <ActionPopover actions={getItemActions(item)} />
                    )}

                </td>
            </tr>
        );
    };




    // Confirma entrada
    const handleConfirmEntry = async () => {
        if (items.length === 0) { alert('Não há itens para dar entrada no estoque.'); return; }
        if (hasPendingItems) { alert('ERRO: Todos os itens devem ser conferidos antes de finalizar a entrada.'); return; }
        const allMapped = items.every(item => item.mappedId);
        if (!allMapped) { alert('ERRO: Todos os itens devem estar mapeados antes de confirmar a entrada.'); return; }
        
        if (hasDivergence) {
            const confirmDivergence = window.confirm(`ATENÇÃO: ${divergentItems.length} divergência(s). Confirmar entrada dos itens recebidos (${totalItems.toFixed(2)} unidades)?`);
            if (!confirmDivergence) return;
        }

        try {
            // Monta o payload conforme esperado pelo backend
            const payload = {
    invoiceNumber: invoiceNumber.replace('NF ', ''),
    accessKey,
    entryDate,
    supplierCnpj,
    supplierName: supplier,

    totalFreight,
    totalIpi,
    totalIcmsST,
    totalIBS,
    totalCBS,
    totalOtherExpenses,
    totalNoteValue,

    items: items
        .filter(item => item.isConfirmed)
        .map(item => ({
            codigoInterno: item.mappedId!,
            skuFornecedor: item.sku,
            quantidadeRecebida: item.quantidade,
            unidade: item.unidadeMedida,

            custoUnitario: item.valorCustoReal,

            impostos: {
                ipi: totalIpi,
                icmsST: totalIcmsST,
                ibs: item.valorIBS,
                cbs: item.valorCBS,
            },

            ncm: item.ncm,
            cest: item.cest,
        }))
};

            // ✨ DEBUG: Log do payload sendo enviado
            console.log('[PAYLOAD ENVIADO] Total de itens:', payload.items.length);
            console.log('[PAYLOAD ENVIADO] Itens completos:', payload.items);
            payload.items.forEach((item, idx) => {
                console.log(`  [Item ${idx + 1}] SKU: ${item.skuFornecedor}, ID: ${item.codigoInterno}, Qty: ${item.quantidadeRecebida}, Unit: ${item.unidade}`);
            });

            // Chama a API para consolidar a entrada
            const response = await submitStockEntry(payload);

            // Sucesso!
            alert(`✅ ${response.message}\nNota ID: ${response.notaId}\nItens processados: ${response.itemsProcessed}`);

            // Limpa o formulário para uma nova importação
            setInvoiceNumber('');
            setSupplier('');
            setSupplierFantasyName('');
            setSupplierCnpj('');
            setEntryDate('');
            setAccessKey('');
            setItems([]);
            setTotalFreight(0);
            setTotalIpi(0);
            setTotalOtherExpenses(0);
            setTotalNoteValue(0);
            setSelectedPendingIds(new Set());
            setSelectedConfirmedIds(new Set());

        } catch (error) {
            console.error('Erro ao confirmar entrada:', error);
            alert('Erro ao consolidar a entrada: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
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


                            <label htmlFor="xml-upload" style={styles.importButton}>Alterar XML</label>
                            
                        </div>
                    )}

                </FlexGridContainer>
            </div>

           
<NfeCards
    data={{
        chaveAcesso: accessKey,
        numero: invoiceNumber.replace('NF ', ''),
        serie: items.length > 0 ? (pendingXmlData?.serie || '') : '', // Recupera a série do estado pendente
        dataEmissao: entryDate,
        emitente: {
            cnpj: supplierCnpj,
            nome: supplier,
            nomeFantasia: supplierFantasyName,
        },
        totais: {
            valorTotalProdutos: subtotal, // Soma dos itens processados
            valorTotalIpi: totalIpi,
            valorTotalFrete: totalFreight,
            valorOutrasDespesas: totalOtherExpenses,
            valorTotalDesconto: items.reduce((acc, it) => acc + (it.valorDesconto || 0), 0), // Opcional: buscar do estado
            valorTotalIcms: 0, // Pode ser expandido se você criar o estado setTotalIcms
            valorTotalIcmsST: totalIcmsST,
            valorTotalIBS: totalIBS,
            valorTotalCBS: totalCBS,
            valorTotalNf: totalNoteValue,
            valorTotalTributos: (totalIpi + totalIcmsST + (totalIBS || 0) + (totalCBS || 0)),
        },
    }}
    supplierStatus={{
        exists: supplierExists,
        isChecking: isSupplierChecking,
    }}
    actions={{
        onCreateSupplier: () => setIsSupplierModalOpen(true),
        formatCurrency,
    }}
    styles={styles}
/>

            {/* Restante do seu código (Tabelas de itens, etc) */}

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
                                    <Typography variant='p'><strong>SKU {item.sku}:</strong> {item.descricao}</Typography>
                                    <p style={styles.divergenceDetails}>
                                        Quantidade na NF: <strong>{item.quantidade.toFixed(2)}</strong> | Recebido: <strong>{item.quantidade.toFixed(2)}</strong> |
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

                    <button onClick={handleConfirmEntry} style={styles.confirmButton} disabled={items.length === 0 || hasUnmappedItems || hasPendingItems}>
                        {items.length === 0 ? '🚫 Importe o XML' : hasPendingItems ? '🚫 Finalize a conferência' : hasUnmappedItems ? '🚫 Mapeie os itens' : '✅ Confirmar Entrada e Atualizar Estoque'}
                    </button> 
                </div>
            </FlexGridContainer>

            
    {itemToMap && (
  <MappingModal
    item={itemToMap}          // ✅ ProductEntry (dados originais)
    supplierCnpj={supplierCnpj} 
    onClose={closeModal}      // ✅ Fecha modal
    onMap={handleModalMap}    // ✅ Recebe MappingPayload
  />
)}

            {isSupplierModalOpen && supplierToCreate && (
                <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <div style={{ width: 480, padding: 20, borderRadius: 8, backgroundColor: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0, color:'black' }}>Criar Fornecedor</h3>
                        <p style={{color:'black'}}>O fornecedor extraído da NF não foi localizado no sistema. Preencha os dados abaixo para criá-lo.</p>

                        <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>Nome do Fornecedor</label>
                                <input
                                    value={supplierCreationName}
                                    onChange={(e) => setSupplierCreationName(e.target.value)}
                                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                                    placeholder='Nome do fornecedor'
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>CNPJ</label>
                                <input value={supplierToCreate.cnpj} readOnly style={{ color: '#374151', width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }} />
                            </div>

                            <div>
    <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: 6 }}>
        Nome Fantasia
    </label>
    <input 
        style={{ 
            color: '#374151', 
            width: '100%', 
            padding: '8px', 
            borderRadius: 6, 
            border: '1px solid #e5e7eb', 
            backgroundColor: '#fff' 
        }} 
        value={nomeFantasia}
        onChange={(e) => setNomeFantasia(e.target.value)} 
        placeholder="Ex: Lojas São José"
    />
</div>

                            <div>
                                <FormControl 
    label="Sigla Gerada (BD)" 
    value={siglaGerada} 
    readOnlyDisplay 
    style={{ marginTop: 10, backgroundColor: '#f3f4f6' }}
/>
                            </div>

                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                                <button onClick={() => {
                                    setIsSupplierModalOpen(false);
                                    setSupplierToCreate(null);
                                    setSupplierExists(false);
                                    setSupplierCreationName('');
                                    setIsSupplierChecking(false);
                                    setPendingXmlData(null);
                                    setPendingSkus(null);
                                }} style={{ padding: '8px 12px', backgroundColor: '#9ca3af', color: 'white', border: 'none', borderRadius: 6 }}>Cancelar</button>

                                <button
                                    disabled={supplierCreationLoading || supplierCreationName.trim() === ''}
                                    onClick={async () => {
                                        setSupplierCreationLoading(true);
                                        try {
                                            const created = await createSupplier({ cnpj: supplierToCreate.cnpj, name: supplierCreationName.trim(), nomeFantasia: nomeFantasia.trim(), siglaGerada });
                                            alert(`Fornecedor criado: ${created.name} (ID ${created.id})`);
                                            setSupplier(created.name);
                                            setSupplierExists(true);
                                            setIsSupplierModalOpen(false);
                                            setSupplierToCreate(null);
                                            setSupplierCreationName('');

                                            // Se há XML pendente, executa a sincronização agora que o fornecedor existe
                                            if (pendingXmlData) {
                                                try {
                                                    await performMappingSync(created.cnpj || supplierToCreate.cnpj, pendingXmlData);
                                                } catch (syncErr) {
                                                    console.error('Erro ao sincronizar após criar fornecedor:', syncErr);
                                                }
                                            }
                                        } catch (err: any) {
                                            console.error('Erro ao criar fornecedor:', err);
                                            alert('Erro ao criar fornecedor: ' + (err?.message || String(err)));
                                        } finally {
                                            setSupplierCreationLoading(false);
                                        }
                                    }}
                                    style={{ padding: '8px 12px', backgroundColor: supplierCreationLoading || supplierCreationName.trim() === '' ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: 6 }}>
                                    {supplierCreationLoading ? 'Criando...' : 'Criar Fornecedor'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- styles ---
const styles: { [key: string]: React.CSSProperties } = {
    container: { padding: '24px', backgroundColor: '#f3f4f6', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' },
    title: { fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '20px', letterSpacing: '-0.025em' },
    panel: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' },
    panelTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' },
    subTitle: { fontSize: '1rem', fontWeight: 600, color: '#4b5563', marginBottom: '0px' }, // Removi a margem para alinhar com botões
    
    importArea: { 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e5e7eb', 
        borderRadius: '8px', marginBottom: '24px' 
    },
    importButton: { 
        padding: '8px 16px', backgroundColor: '#4f46e5', color: 'white', 
        borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.875rem',
        transition: 'background-color 0.2s'
    },
    
    tableResponsive: { 
        overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '8px', 
        border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' 
    },
    dataTable: { width: '100%', borderCollapse: 'collapse', minWidth: '800px' },
    tableTh: { 
        padding: '12px 8px', textAlign: 'left', fontSize: '0.75rem', 
        fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', 
        backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' 
    },
    tableCell: { 
        padding: '10px 8px', textAlign: 'left', fontSize: '0.875rem', 
        color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' 
    },
    
    // Botões de Ação na Tabela
    checkButton: { padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 },
    uncheckButton: { padding: '6px 12px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' },
    mapButton: { padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
    
    // Rodapé de Confirmação
    confirmationArea: { 
        marginTop: '32px', display: 'flex', flexDirection: 'column', 
        alignItems: 'flex-end', gap: '16px', borderTop: '2px solid #e5e7eb', paddingTop: '24px' 
    },
    totalsBoxFooter: { 
        padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', 
        border: '1px solid #e5e7eb', width: '100%', maxWidth: '400px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
    },
    confirmButton: { 
        width: '100%', maxWidth: '400px', padding: '16px', 
        backgroundColor: '#059669', color: 'white', border: 'none', 
        borderRadius: '8px', fontWeight: 600, fontSize: '1rem', cursor: 'pointer',
        boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
    },
    
    totalLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
    totalLabel: { color: '#6b7280', fontSize: '0.875rem' },
    totalValue: { fontWeight: 600, color: '#111827' },
    
    divergenceItem: { 
        padding: '12px 16px', borderLeft: '4px solid #ef4444', 
        backgroundColor: '#fff1f2', borderRadius: '4px', marginBottom: '8px' 
    }
};

export default StockEntryForm;




// async function localizarProdutoNoSistema(itemXml: ProdutoNF, idFornecedor: number) {
//     // 1º PASSO: Busca por GTIN (O mais forte)
//     if (itemXml.gtin && itemXml.gtin !== 'SEM GTIN') {
//         const produto = await db.produtos.findFirst({ where: { codigo_barras: itemXml.gtin } });
//         if (produto) return { produto, tipoMatch: 'GTIN' };
//     }

//     // 2º PASSO: Busca por Relação SKU/Fornecedor (O de-para já aprendido)
//     const relacao = await db.produto_fornecedor.findFirst({ 
//         where: { id_fornecedor: idFornecedor, sku_fornecedor: itemXml.codigo } 
//     });
//     if (relacao) {
//         const produto = await db.produtos.findFirst({ where: { id_produto: relacao.id_produto } });
//         return { produto, tipoMatch: 'RELACAO_EXISTENTE' };
//     }

//     // 3º PASSO: Se for "SEM GTIN" e nunca foi relacionado, é um "Órfão"
//     return { produto: null, tipoMatch: 'NECESSITA_VINCULO_MANUAL' };
// }







