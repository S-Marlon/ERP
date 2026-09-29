import { useState, useMemo } from 'react';
import { parseNfeXmlToData } from '../utils/nfeParser'; 
import { parseNfeComplete, NfeDataFromXML } from './xml/utils/nfeParser';
import { reconcileFreight } from './freightReconciliation';
import { reconcileFinancial } from './financialReconciliation';
import { 
    createSupplier, 
    checkSupplier, 
    processItemXML, 
    type ProcessarItemXMLResponse 
} from '../api/comprasApi';
import type { Item, MappingPayload } from './types';

interface FinancialTotals {
    invoiceNumber: string;
    supplier: string;
    supplierFantasyName: string;
    supplierCnpj: string;
    accessKey: string;
    entryDate: string;
    totalFreight: number;
    totalIpi: number;
    totalOtherExpenses: number;
    totalNoteValue: number;
    totalIcmsST: number;
    totalIBS?: number;
    totalCBS?: number;
}

const INITIAL_FINANCIALS: FinancialTotals = {
    invoiceNumber: '',
    supplier: '',
    supplierFantasyName: '',
    supplierCnpj: '',
    accessKey: '',
    entryDate: '',
    totalFreight: 0,
    totalIpi: 0,
    totalOtherExpenses: 0,
    totalNoteValue: 0,
    totalIcmsST: 0,
    totalIBS: undefined,
    totalCBS: undefined,
};

const formatCnpj = (cnpj?: string): string => {
    if (!cnpj) return '';
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) return cnpj;
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

export const useStockEntry = (tenantId: number = 1) => {
    // Estados Financeiros, de Itens e do XML Bruto
    const [financials, setFinancials] = useState<FinancialTotals>(INITIAL_FINANCIALS);
    const [items, setItems] = useState<Item[]>([]);
    const [frete, setFrete] = useState<any | null>(null);
    const [rawXmlString, setRawXmlString] = useState<string | null>(null);

    // Estados de Modais
    const [isConferenceModalOpen, setIsConferenceModalOpen] = useState(false);
    const [isTotalDetailsModalOpen, setIsTotalDetailsModalOpen] = useState(false);
    const [isFreightModalOpen, setIsFreightModalOpen] = useState(false);
    const [freightDistributionMode, setFreightDistributionMode] = useState<string>('proportional_value');
    
    // Estados do Fornecedor
    const [supplierExists, setSupplierExists] = useState<boolean | null>(null);
    const [isSupplierChecking, setIsSupplierChecking] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [supplierToCreate, setSupplierToCreate] = useState<{ 
        cnpj: string; 
        name: string; 
        fantasyName: string;
        stateRegistration?: string;
        address?: string;
        cityStateZip?: string;
        phone?: string;
    } | null>(null);
    
    const [supplierCreationName, setSupplierCreationName] = useState('');
    const [supplierCreationFantasyName, setSupplierCreationFantasyName] = useState('');
    const [supplierCreationLoading, setSupplierCreationLoading] = useState(false);
    
    // Estados de Controle Interno / Mapeamento / Carregamento de Itens
    const [pendingXmlData, setPendingXmlData] = useState<any | null>(null);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [itemToMap, setItemToMap] = useState<any>(null);
    const [isProcessingItems, setIsProcessingItems] = useState(false);
    
    // --- PARSING E RECONCILIAÇÃO AVANÇADA ---
    const parsedNfe = useMemo<NfeDataFromXML | null>(() => {
        if (!rawXmlString) return null;
        try {
            return parseNfeComplete(rawXmlString);
        } catch (error) {
            console.error("Erro ao parsear a NF-e do XML:", error);
            return null;
        }
    }, [rawXmlString]);

    const nfeTotalValue = useMemo(() => {
        return Number(parsedNfe?.totais?.icmsTot?.vNF || 0) || 0;
    }, [parsedNfe]);

    const nfeFreightValue = useMemo(() => {
        return Number(parsedNfe?.totais?.icmsTot?.vFrete || 0) || 0;
    }, [parsedNfe]);

    const freightReconciliation = useMemo(() => {
        return reconcileFreight(nfeFreightValue, items);
    }, [nfeFreightValue, items]);

    const financialReconciliation = useMemo(() => {
        const totals = parsedNfe?.totais?.icmsTot;
        return reconcileFinancial({
            produtos: totals?.vProd,
            frete: totals?.vFrete,
            seguro: totals?.vSeg,
            outrasDespesas: totals?.vOutro,
            desconto: totals?.vDesc,
            ipi: totals?.vIPI,
            icmsSt: totals?.vICMSST,
            total: totals?.vNF,
        }, items);
    }, [parsedNfe, items]);

    // --- CÁLCULOS E MEMOS ---
    const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.valorProdutos || 0), 0), [items]);

    const adjustedPhysicalSubtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + ((item.receivedQuantity || 0) * (item.valorCustoReal || item.valorUnitario || 0)), 0);
    }, [items]);

    const totalDivergences = useMemo(() => items.filter(i => i.difference !== 0).length, [items]);
    const totalConfirmed = useMemo(() => items.filter(i => i.isConfirmed).length, [items]);
    const totalPhysicalItems = useMemo(() => items.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0), [items]);
    
    const progressPercent = useMemo(() => {
        if (items.length === 0) return 0;
        return Math.round((totalConfirmed / items.length) * 100);
    }, [items.length, totalConfirmed]);

    const hasUnmappedItems = useMemo(() => items.some(i => !i.mappedId || i.mappingStatus === 'PRODUTO_INEDITO'), [items]);
    const hasUnconfirmedItems = useMemo(() => items.some(i => !i.isConfirmed), [items]);
    const isSubmitDisabled = items.length === 0 || hasUnmappedItems || hasUnconfirmedItems || isProcessingItems;

    // --- SINCRONIZAÇÃO E PROCESSAMENTO DE ITENS ---
    const performMappingSync = async (idFornecedor: number, itemsToUse: Item[]) => {
        setIsProcessingItems(true);
        try {
            const processedItems: Item[] = [];

            for (const item of itemsToUse) {
                try {
                    const apiResult: ProcessarItemXMLResponse = await processItemXML({
                        tenant_id: tenantId,
                        id_fornecedor: idFornecedor,
                        cProd: String(item.sku || item.codigo || item.cProd || '').trim(), 
                        cEAN: item.gtin || item.cEAN || null,
                        xProd: item.descricao || item.xProd || null
                    });

                    processedItems.push({
                        ...item,
                        mappingStatus: apiResult.status,
                        mappedId: apiResult.id_item || null,
                        isMapped: apiResult.status !== 'PRODUTO_INEDITO',
                        isConfirmed: apiResult.status !== 'PRODUTO_INEDITO' 
                    });
                } catch (err) {
                    console.error(`Erro ao processar item individual ${item.codigo || item.sku}:`, err);
                    processedItems.push({ 
                        ...item, 
                        mappingStatus: 'ERRO_PROCESSAMENTO', 
                        isMapped: false, 
                        isConfirmed: false 
                    });
                }
            }

            setItems(processedItems);
        } catch (err) {
            console.error('Erro crítico na esteira de processamento de itens:', err);
            alert('Houve um erro ao cruzar os itens do XML com o banco de dados.');
        } finally {
            setIsProcessingItems(false);
        }
    };

    // --- ENTRADA DO ARQUIVO XML ---
    const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] | FileList } }) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsProcessingItems(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const xmlContent = e.target?.result as string;
                if (!xmlContent) return;
                
                setRawXmlString(xmlContent);

                // Executa os parsers (Compatível com ambas abordagens para garantir robustez)
                const rawXmlData = parseNfeXmlToData(xmlContent);
                const parsedComplete = parseNfeComplete(xmlContent);

                if (!rawXmlData && !parsedComplete) throw new Error('Falha ao extrair dados do XML.');

                const emitenteData = parsedComplete?.emitente || rawXmlData?.emitente;
                const numeroNf = parsedComplete?.numero || rawXmlData?.numero;
                const chaveAcesso = parsedComplete?.chaveAcesso || rawXmlData?.chaveAcesso;
                
                const formattedCnpj = formatCnpj(emitenteData.cnpj);
                const cnpjLimpo = emitenteData.cnpj.replace(/\D/g, '');
                const dataFicticia = new Date().toISOString().substring(0, 10);

                // Processamento detalhado dos produtos
                const rawProdutos = parsedComplete?.produtos || rawXmlData?.produtos || [];
                const mappedItems: Item[] = rawProdutos.map((item: any, index: number) => {
                    const prodRef = item.prod || item; // Suporta formato modular completo ou simples
                    const qtdXml = parseFloat(prodRef.qCom || prodRef.quantidade) || 0;
                    const vlrUnit = parseFloat(prodRef.vUnCom || prodRef.valorUnitario) || 0;
                    const vlrProd = parseFloat(prodRef.vProd || prodRef.valorProdutos) || (qtdXml * vlrUnit);

                    const baseUnitCalculated = qtdXml > 0 ? vlrProd / qtdXml : vlrUnit;
                    const freightItem = parseFloat(prodRef.vFrete || '0') || 0;
                    const otherExpenses = parseFloat(prodRef.vOutro || '0') || 0;
                    const insuranceItem = parseFloat(prodRef.vSeg || '0') || 0;

                    const ipiObj = item.imposto?.ipi?.IPITrib || item.imposto?.IPI?.ipitrib || item.imposto?.ipi || {};
                    const vIpiItem = parseFloat(ipiObj.vIPI || ipiObj.VIPI || '0') || 0;

                    const icmsObj = item.imposto?.icms || {};
                    const vStItem = Number(icmsObj.vICMSST || icmsObj.vBCST || 0) || 0;
                    const totalAcrescimosItem = freightItem + otherExpenses + insuranceItem + vIpiItem + vStItem;
                    const valorTotalRealItem = vlrProd + totalAcrescimosItem;
                    const effectiveUnitCost = qtdXml > 0 ? valorTotalRealItem / qtdXml : vlrUnit;

                    return {
                        ...item,
                        tempId: index + 1,
                        nItem: item.nItem || String(index + 1),
                        sku: prodRef.cProd || prodRef.sku,
                        ean: prodRef.cEAN || prodRef.gtin,
                        descricao: prodRef.xProd || prodRef.descricao,
                        ncm: prodRef.NCM || prodRef.ncm,
                        unidade: prodRef.uCom || prodRef.unidade,
                        quantidade: qtdXml,
                        receivedQuantity: qtdXml,
                        valorUnitario: Number(effectiveUnitCost.toFixed(4)),
                        valorBaseUnitario: Number(baseUnitCalculated.toFixed(4)),
                        valorTotal: valorTotalRealItem,
                        valorProdutos: vlrProd,
                        freightOriginal: freightItem,
                        freightDistributed: 0,
                        freightAdded: freightItem,
                        seguro: insuranceItem,
                        outrasDespesas: otherExpenses,
                        desconto: parseFloat(prodRef.vDesc || '0') || 0,
                        ipi: vIpiItem,
                        icmsSt: vStItem,
                        difference: 0,
                        isConfirmed: false,
                        grupoId: null,
                        atributosCustomizados: [],
                    };
                });

                const totaisIcsm = parsedComplete?.totais?.icmsTot || {};

                setFinancials({
                    supplierCnpj: formattedCnpj,
                    invoiceNumber: `NF ${numeroNf}`,
                    supplier: emitenteData.nome,
                    supplierFantasyName: emitenteData.nomeFantasy || emitenteData.nomeFantasia || emitenteData.nome,
                    accessKey: chaveAcesso,
                    entryDate: dataFicticia,
                    totalFreight: Number(totaisIcsm.vFrete || rawXmlData?.valorTotalFrete || 0),
                    totalIpi: Number(totaisIcsm.vIPI || rawXmlData?.valorTotalIpi || 0),
                    totalOtherExpenses: Number(totaisIcsm.vOutro || rawXmlData?.valorOutrasDespesas || 0),
                    totalNoteValue: Number(totaisIcsm.vNF || rawXmlData?.valorTotalNf || 0),
                    totalIcmsST: Number(totaisIcsm.vICMSST || rawXmlData?.valorTotalIcmsST || 0),
                    totalIBS: rawXmlData?.valorTotalIBS,
                    totalCBS: rawXmlData?.valorTotalCBS,
                });

                setFrete(rawXmlData?.frete || null);
                if (emitenteData?.nome) {
                    setSupplierCreationName(emitenteData.nome);
                    setSupplierCreationFantasyName(emitenteData.nomeFantasy || emitenteData.nomeFantasia || '');
                }

                setIsSupplierChecking(true);
                const supplierCheck = await checkSupplier(cnpjLimpo, tenantId);

                if (!supplierCheck || !supplierCheck.exists || !supplierCheck.supplier) {
                    const endereco = emitenteData.endereco;
                    const enderecoCompleto = endereco 
                        ? `${endereco.xLgr || ''}, ${endereco.nro || ''} - ${endereco.xBairro || ''}`.trim()
                        : '';

                    const municipioUfCep = endereco 
                        ? `${endereco.xMun || ''} - ${endereco.UF || ''}, ${endereco.CEP || ''}`.trim()
                        : '';
                    
                    setSupplierExists(false);
                    setSupplierToCreate({
                        cnpj: formattedCnpj,
                        name: emitenteData.nome,
                        fantasyName: emitenteData.nomeFantasy || emitenteData.nomeFantasia || emitenteData.nome,
                        stateRegistration: emitenteData.ie || '',
                        address: enderecoCompleto,
                        cityStateZip: municipioUfCep,
                        phone: endereco?.fone || ''
                    });

                    setPendingXmlData({ items: mappedItems });
                    setItems(mappedItems);
                    setIsSupplierModalOpen(true);
                    return;
                }

                setSupplierExists(true);
                setFinancials(prev => ({
                    ...prev,
                    supplier: supplierCheck.supplier?.name || prev.supplier,
                    supplierFantasyName: supplierCheck.supplier?.fantasyName || prev.supplierFantasyName
                }));
                
                await performMappingSync(supplierCheck.supplier.id, mappedItems);

            } catch (error) {
                console.error(error);
                alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido ao ler XML'}`);
            } finally {
                setIsSupplierChecking(false);
                if ('target' in event && 'value' in event.target) {
                    (event.target as HTMLInputElement).value = '';
                }
            }
        };
        reader.readAsText(file);
    };

    // --- AÇÕES DE FRETE ---
    const handleApplyFreightDistribution = () => {
        const totalItens = items.reduce((total, item) => {
            const freteConsiderado = Number(item.freightAdded) || 0;
            return total + Math.max(0, (Number(item.valorTotal) || 0) - freteConsiderado);
        }, 0);
        
        if (totalItens <= 0) {
            alert("Não há valor nos itens para ratear o frete.");
            return;
        }

        setItems(prevItems => prevItems.map(item => {
            const freteAtual = Number(item.freightAdded) || 0;
            const itemProdTotal = Math.max(0, (Number(item.valorTotal) || 0) - freteAtual);
            let freightPortion = 0;

            if (freightDistributionMode === 'proportional_value') {
                const proportion = itemProdTotal / totalItens;
                freightPortion = nfeFreightValue * proportion;
            } else if (freightDistributionMode === 'proportional_quantity') {
                const totalQty = prevItems.reduce((acc, i) => acc + (i.quantidade || 0), 0);
                const proportion = totalQty > 0 ? (item.quantidade || 0) / totalQty : 0;
                freightPortion = nfeFreightValue * proportion;
            } else if (freightDistributionMode === 'equal') {
                freightPortion = prevItems.length > 0 ? nfeFreightValue / prevItems.length : 0;
            }

            const quantidade = Number(item.quantidade) || 1;
            const novoValorTotal = itemProdTotal + freightPortion;
            const newUnitCost = novoValorTotal / quantidade;
            return {
                ...item,
                valorUnitario: Number(newUnitCost.toFixed(4)),
                valorTotal: Number(novoValorTotal.toFixed(2)),
                freightDistributed: Number(freightPortion.toFixed(2)),
                freightAdded: Number(freightPortion.toFixed(2)),
            };
        }));

        setIsFreightModalOpen(false);
    };

    // --- IMPRESSÃO DANFE SIMPLIFICADO ---
    const handlePrintDanfeHtml = () => {
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (!printWindow) {
            alert('Permita pop-ups no navegador para gerar a impressão.');
            return;
        }

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
        <meta charset="UTF-8">
        <title>DANFE Simplificado - NF-e ${parsedNfe?.chaveAcesso || financials.accessKey || ''}</title>
        <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 10px; background: #fff; }
        .container { width: 100%; max-width: 800px; margin: 0 auto; border: 1px solid #000; padding: 8px; }
        .flex { display: flex; justify-content: space-between; }
        .box { border: 1px solid #000; padding: 5px; margin-bottom: 6px; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        </style>
        </head>
        <body>
        <div class="container">
        <div class="box">
        <div class="flex">
        <div>
        <span class="bold" style="font-size: 14px;">${parsedNfe?.emitente?.nome || financials.supplier || 'Emitente não informado'}</span><br>
        <span>CNPJ: ${parsedNfe?.emitente?.cnpj || financials.supplierCnpj || '-'} | Fantasia: ${parsedNfe?.emitente?.nomeFantasia || financials.supplierFantasyName || '-'}</span><br>
        <span>NF-e Nº: ${parsedNfe?.numero || financials.invoiceNumber || '-'}</span>
        </div>
        <div class="text-right">
        <span class="bold" style="font-size: 13px;">DANFE SIMPLIFICADO</span><br>
        <span>Entrada de Mercadorias</span><br>
        <span style="font-size: 9px;">Chave: ${parsedNfe?.chaveAcesso || financials.accessKey || '-'}</span>
        </div>
        </div>
        </div>
        </div>
        </body>
        </html>
        `;

        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleCancelSupplierCreation = () => {
        setIsSupplierModalOpen(false);
        setSupplierExists(null);
        setSupplierToCreate(null);
        setPendingXmlData(null);
        setFinancials(INITIAL_FINANCIALS);
        setItems([]);
        setFrete(null);
        setRawXmlString(null);
    };

    const handleCreateSupplierSubmit = async () => {
        if (!supplierToCreate) return;
        setSupplierCreationLoading(true);
        try {
            const response = await createSupplier({
                cnpj: supplierToCreate.cnpj,
                name: supplierCreationName,
                fantasyName: supplierCreationFantasyName,
                stateRegistration: supplierToCreate.stateRegistration,
                address: supplierToCreate.address,
                cityStateZip: supplierToCreate.cityStateZip,
                phone: supplierToCreate.phone,
            }, tenantId);

            setSupplierExists(true);
            setIsSupplierModalOpen(false);

            const novoFornecedorId = response.id || response.supplier?.id;

            if (pendingXmlData && novoFornecedorId) {
                await performMappingSync(novoFornecedorId, pendingXmlData.items);
            }
            alert('Fornecedor cadastrado com sucesso!');
        } catch (err: any) {
            alert(`Falha ao cadastrar o fornecedor.\nMotivo: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setSupplierCreationLoading(false);
        }
    };

    // --- GERENCIAMENTO DE ITENS DA TABELA ---
    const handleConfirmItems = (ids: number[]) => setItems(p => p.map(i => ids.includes(i.tempId) ? { ...i, isConfirmed: true } : i));
    const handleUnconfirmItems = (ids: number[]) => setItems(p => p.map(i => ids.includes(i.tempId) ? { ...i, isConfirmed: false } : i));
    const handleToggleSingleItem = (id: number) => setItems(p => p.map(i => i.tempId === id ? { ...i, isConfirmed: !i.isConfirmed } : i));
    
    const handleConfirmAllItems = () => setItems(p => p.map(item => ({ ...item, isConfirmed: true })));
    const handleUnconfirmAllItems = () => setItems(p => p.map(item => ({ ...item, isConfirmed: false })));

    const handleRemoveItemsFromConference = (ids: number[]) => {
        if (window.confirm('Remover itens selecionados?')) {
            setItems(p => p.filter(i => !ids.includes(i.tempId)));
        }
    };

    const handleOpenMappingFromTable = (ids: number[]) => {
        const target = items.find(i => i.tempId === ids[0]);
        if (target) {
            setItemToMap(target);
            setIsMappingModalOpen(true);
        }
    };

    const handleModalMapSuccess = (payload: MappingPayload) => {
        setItems(p => p.map(i => i.tempId === itemToMap?.tempId ? {
            ...i,
            isMapped: true,
            mappingStatus: 'VINCULO_DIRETO_ENCONTRADO',
            mappedId: payload.internalCode,
            category: payload.categoryName,
            mappedData: payload,
            isConfirmed: true
        } : i));
        setIsMappingModalOpen(false);
        setItemToMap(null);
    };

    const handleQuantityReceivedChange = (id: number, newQty: number) => {
        setItems(p => p.map(i => i.tempId === id ? { 
            ...i, 
            receivedQuantity: newQty, 
            difference: newQty - (i.quantidade || 0) 
        } : i));
    };

    const handleAssignGroupToItems = (ids: number[], groupData: any) => {
        const groupName = groupData.mode === 'LINK' ? groupData.grupoId : groupData.nomeGrupo;
        setItems(p => p.map(i => ids.includes(i.tempId) ? { ...i, grupo: groupName, grupoVariacao: groupData.variacao } : i));
    };

    const beforeUpload = (file: File) => {
    const isXml = file.type === 'text/xml' || file.name.endsWith('.xml');
    if (!isXml) {
        alert('Apenas arquivos XML são permitidos!');
        return false;
    }
    handleXmlUpload({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    return false;
};



// Inclua no objeto `return { ..., beforeUpload }`

    return {
        financials, 
        items, 
        subtotal, 
        adjustedPhysicalSubtotal, 
        isSubmitDisabled,
        frete,
        rawXmlString, 
        parsedNfe,
        nfeTotalValue,
        nfeFreightValue,
        freightReconciliation,
        financialReconciliation,
        totalDivergences,
        totalConfirmed,
        totalPhysicalItems,
        progressPercent,
        supplierExists, 
        isSupplierChecking, 
        isSupplierModalOpen, 
        supplierCreationLoading,
        supplierCreationName, 
        supplierCreationFantasyName, 
        supplierToCreate,
        isMappingModalOpen, 
        itemToMap, 
        isProcessingItems,
        isConferenceModalOpen,
        isTotalDetailsModalOpen,
        isFreightModalOpen,
        freightDistributionMode,
        setFreightDistributionMode,
        setIsFreightModalOpen,
        setIsTotalDetailsModalOpen,
        setSupplierCreationName, 
        setSupplierCreationFantasyName,
        handleXmlUpload, 
        handleCancelSupplierCreation, 
        handleCreateSupplierSubmit,
        handleConfirmItems, 
        handleUnconfirmItems, 
        handleToggleSingleItem,
        handleConfirmAllItems,
        handleUnconfirmAllItems,
        handleRemoveItemsFromConference, 
        handleOpenMappingFromTable, 
        handleModalMapSuccess,
        handleQuantityReceivedChange, 
        handleAssignGroupToItems, 
        handleApplyFreightDistribution,
        handlePrintDanfeHtml,
        setIsMappingModalOpen, 
        setItemToMap,
        setIsSupplierModalOpen,
        setIsConferenceModalOpen,
        beforeUpload,
        
    };
};  