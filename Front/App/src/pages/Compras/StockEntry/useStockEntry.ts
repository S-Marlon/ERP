import { useState, useMemo } from 'react';
import { parseNfeXmlToData } from '../utils/nfeParser';
import { 
    createSupplier, 
    checkSupplier, 
    processItemXML, 
    type ProcessarItemXMLResponse 
} from '../api/comprasApi'; // Ajuste o path do seu arquivo de API
import type { Item, MappingPayload } from './types'; // Ajuste os paths conforme seu projeto

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
    // Estados Financeiros e de Itens
    const [financials, setFinancials] = useState<FinancialTotals>(INITIAL_FINANCIALS);
    const [items, setItems] = useState<Item[]>([]);
    const [frete, setFrete] = useState<any | null>(null);
    
    // Estados do Fornecedor
    const [supplierExists, setSupplierExists] = useState<boolean | null>(null);
    const [isSupplierChecking, setIsSupplierChecking] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    const [supplierToCreate, setSupplierToCreate] = useState<{ cnpj: string; name: string, fantasyName: string } | null>(null);
    const [supplierCreationName, setSupplierCreationName] = useState('');
    const [supplierCreationFantasyName, setSupplierCreationFantasyName] = useState('');
    const [supplierCreationLoading, setSupplierCreationLoading] = useState(false);
    
    // Estados de Controle Interno / Mapeamento / Carregamento de Itens
    const [pendingXmlData, setPendingXmlData] = useState<any | null>(null);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [itemToMap, setItemToMap] = useState<any>(null);
    const [isProcessingItems, setIsProcessingItems] = useState(false);

    // --- CÁLCULOS E MEMOS ---
    const subtotal = useMemo(() => items.reduce((sum, item) => sum + (item.valorProdutos || 0), 0), [items]);

    const adjustedPhysicalSubtotal = useMemo(() => {
        return items.reduce((sum, item) => sum + (item.receivedQuantity * (item.valorCustoReal || item.valorUnitario || 0)), 0);
    }, [items]);

    // O item precisa de mapeamento manual se o status retornado pela API for 'PRODUTO_INEDITO' ou não tiver mappedId
    const hasUnmappedItems = useMemo(() => items.some(i => !i.mappedId || i.mappingStatus === 'PRODUTO_INEDITO'), [items]);
    const hasUnconfirmedItems = useMemo(() => items.some(i => !i.isConfirmed), [items]);
    const isSubmitDisabled = items.length === 0 || hasUnmappedItems || hasUnconfirmedItems || isProcessingItems;

    // --- 🟢 SINCRONIZAÇÃO E PROCESSAMENTO DE ITENS COM A NOVA API ---
    const performMappingSync = async (idFornecedor: number, itemsToUse: Item[]) => {
    setIsProcessingItems(true);
    try {
        const processedItems: Item[] = [];

        // 🟢 Correção: Processa um item por vez de forma sequencial
        for (const item of itemsToUse) {
            try {
                const apiResult: ProcessarItemXMLResponse = await processItemXML({
    tenant_id: tenantId,
    id_fornecedor: idFornecedor,
    // 🟢 Garante que se um for undefined, ele tenta buscar as outras propriedades alternativas do XML
    cProd: String(item.sku || item.codigo || item.cProd || '').trim(), 
    cEAN: item.gtin || item.cEAN || null,
    xProd: item.descricao || item.xProd || null
});

                // Mescla as informações no estado do item
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

        // Atualiza o estado uma única vez ao final do laço
        setItems(processedItems);
    } catch (err) {
        console.error('Erro crítico na esteira de processamento de itens:', err);
        alert('Houve um erro ao cruzar os itens do XML com o banco de dados.');
    } finally {
        setIsProcessingItems(false);
    }
};

    // --- ENTRADA DO ARQUIVO XML ---
    const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const xmlContent = e.target?.result as string;
                const rawXmlData = parseNfeXmlToData(xmlContent);
                if (!rawXmlData) throw new Error('Falha ao extrair dados do XML.');

                const formattedCnpj = formatCnpj(rawXmlData.emitente.cnpj);
                const cnpjLimpo = rawXmlData.emitente.cnpj.replace(/\D/g, '');
                const dataFicticia = new Date().toISOString().substring(0, 10);

                const mappedItems: Item[] = rawXmlData.produtos.map((produto: any, index: number) => ({
                    ...produto,
                    tempId: index + 1,
                    receivedQuantity: produto.quantidade || 0,
                    isConfirmed: false,
                    difference: 0,
                    grupoId: null,
                    atributosCustomizados: [],
                }));

                setFinancials({
    supplierCnpj: formattedCnpj,
    invoiceNumber: `NF ${rawXmlData.numero}`,
    supplier: rawXmlData.emitente.nome,
    supplierFantasyName: rawXmlData.emitente.nomeFantasy || rawXmlData.emitente.nome,
    accessKey: rawXmlData.chaveAcesso,
    entryDate: dataFicticia,
    totalFreight: rawXmlData.valorTotalFrete,
    totalIpi: rawXmlData.valorTotalIpi,
    totalOtherExpenses: rawXmlData.valorOutrasDespesas,
    totalNoteValue: rawXmlData.valorTotalNf,
    totalIcmsST: rawXmlData.valorTotalIcmsST,
    totalIBS: rawXmlData.valorTotalIBS,
    totalCBS: rawXmlData.valorTotalCBS,
});

// 🎯 ADICIONE ESTA LINHA BEM AQUI PARA GUARDAR O FRETE:
setFrete(rawXmlData.frete);

                setIsSupplierChecking(true);
                // Passo 1: Dispara a consulta para a sua nova rota de verificação de fornecedor
                const supplierCheck = await checkSupplier(cnpjLimpo, tenantId);

                if (!supplierCheck || !supplierCheck.exists || !supplierCheck.supplier) {
                    setSupplierExists(false);
                    setSupplierToCreate({
                        cnpj: formattedCnpj,
                        name: rawXmlData.emitente.nome,
                        fantasyName: rawXmlData.emitente.nomeFantasy || rawXmlData.emitente.nome
                    });
                    setSupplierCreationName(rawXmlData.emitente.nome);
                    setSupplierCreationFantasyName(rawXmlData.emitente.nomeFantasy || rawXmlData.emitente.nome);
                    
                    // Retém os itens em memória para processar só depois do cadastro do fornecedor
                    setPendingXmlData({ items: mappedItems });
                    setItems(mappedItems);
                    setIsSupplierModalOpen(true);
                    return;
                }

                // Caso o fornecedor exista, atualiza os dados da tela e segue para o Passo 2 (Itens)
                setSupplierExists(true);
                setFinancials(prev => ({
                    ...prev,
                    supplier: supplierCheck.supplier?.name || prev.supplier,
                    supplierFantasyName: supplierCheck.supplier?.fantasyName || prev.supplierFantasyName
                }));
                
                // Dispara o processamento com o ID numérico real vindo do banco
                await performMappingSync(supplierCheck.supplier.id, mappedItems);

            } catch (error) {
                console.error(error);
                alert(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido ao ler XML'}`);
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
    setFinancials(INITIAL_FINANCIALS);
    setItems([]);
    setFrete(null); // 🎯 Zera o frete no cancelamento
};

    const handleCreateSupplierSubmit = async () => {
        if (!supplierToCreate) return;
        setSupplierCreationLoading(true);
        try {
            // Cadastra o fornecedor na API
            const response = await createSupplier({
                cnpj: supplierToCreate.cnpj,
                name: supplierCreationName,
                fantasyName: supplierCreationFantasyName
            }, tenantId);

            setSupplierExists(true);
            setIsSupplierModalOpen(false);

            // Resgata o ID gerado pelo banco para o novo fornecedor
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

    // --- DEMAIS ACOES DA TABELA ---
    const handleConfirmItems = (ids: number[]) => setItems(p => p.map(i => ids.includes(i.tempId) ? { ...i, isConfirmed: true } : i));
    const handleUnconfirmItems = (ids: number[]) => setItems(p => p.map(i => ids.includes(i.tempId) ? { ...i, isConfirmed: false } : i));
    const handleToggleSingleItem = (id: number) => setItems(p => p.map(i => i.tempId === id ? { ...i, isConfirmed: !i.isConfirmed } : i));
    
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
            mappingStatus: 'VINCULO_DIRETO_ENCONTRADO', // Força a normalização após o vínculo manual
            mappedId: payload.internalCode,
            category: payload.categoryName,
            mappedData: payload,
            isConfirmed: true // Pré-confirma já que o usuário acabou de vincular manualmente
        } : i));
        setIsMappingModalOpen(false);
        setItemToMap(null);
    };

    const handleQuantityReceivedChange = (id: number, newQty: number) => {
        setItems(p => p.map(i => i.tempId === id ? { ...i, receivedQuantity: newQty, difference: (i.quantidade || 0) - newQty } : i));
    };

    const handleAssignGroupToItems = (ids: number[], groupData: any) => {
        const groupName = groupData.mode === 'LINK' ? groupData.grupoId : groupData.nomeGrupo;
        setItems(p => p.map(i => ids.includes(i.tempId) ? { ...i, grupo: groupName, grupoVariacao: groupData.variacao } : i));
    };

    return {
        financials, items, subtotal, adjustedPhysicalSubtotal, isSubmitDisabled,
        frete, // 🎯 EXPORTE O ESTADO DE FRETE AQUI
        supplierExists, isSupplierChecking, isSupplierModalOpen, supplierCreationLoading,
        supplierCreationName, supplierCreationFantasyName, supplierToCreate,
        isMappingModalOpen, itemToMap, isProcessingItems,
        setSupplierCreationName, setSupplierCreationFantasyName,
        handleXmlUpload, handleCancelSupplierCreation, handleCreateSupplierSubmit,
        handleConfirmItems, handleUnconfirmItems, handleToggleSingleItem,
        handleRemoveItemsFromConference, handleOpenMappingFromTable, handleModalMapSuccess,
        handleQuantityReceivedChange, handleAssignGroupToItems, setIsMappingModalOpen, setItemToMap
    };
};