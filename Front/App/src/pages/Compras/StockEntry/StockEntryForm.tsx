import React, { useMemo, useState } from 'react';
import { checkSupplier, createSupplier } from '../../Compras/FornecedoresList/fornecedores.api'
import {
Typography,
Button,
Row,
Col,
Card,
Alert,
Divider,
Spin,
Space,
Statistic,
Tooltip,
Modal,
Radio,
message
} from 'antd';
import {
CheckCircleOutlined,
DollarOutlined,
InfoCircleOutlined,
SettingOutlined,
BugFilled,
CodeFilled
} from '@ant-design/icons';
import MappingModal from './ItemsConference/ProductMappingModal';
import NfeCards from './nfeCards/NfeCards';
import { ItemsConference } from './ItemsConference/ItemsConference';
import { SupplierModal } from './SupplierModal';
import PhysicalConferenceTable from './PhysicalConferenceTable';
import { parseNfeComplete, NfeDataFromXML } from './xml/utils/nfeParser';
import { reconcileFreight } from './freightReconciliation';
import { reconcileFinancial } from './financialReconciliation';
import { StockEntryHeader } from './StockEntryHeader';
import { sincronizarLoteXMLCompleto } from '../api/comprasApi';

interface ItemConferencia {
tempId: string;
nItem: string;
sku: string;
ean: string;
descricao: string;
ncm: string;
unidade: string;
quantidade: number;
receivedQuantity: number;
difference: number;
isConfirmed: boolean;
// Novos campos a serem capturados:
produtoIdSistema?: number | null;
skuSistema?: string | null;
familia?: string | null;
tipoEntrada?: string; // Ex: 'COMPRA_NORMAL', 'BONIFICACAO'
}

const { Title, Text } = Typography;
const StockEntryForm: React.FC = () => {

// Função para limpar os dados da tela e reiniciar a importação
const onReset = () => {
setRawXmlString('');
setItems([]);
setLoteId(null);
setStagingError(null);
message.info("Tela limpa. Você pode importar um novo arquivo XML.");
};

// Estados de Fornecedor
const [supplierStatus, setSupplierStatus] = useState<{
exists: boolean;
isChecking: boolean;
supplier?: { id: number; name: string; fantasyName: string };
}>({ exists: false, isChecking: false });

// No topo do StockEntryForm.tsx, adicione o estado do lote e a chamada da api de staging:
const [loteId, setLoteId] = useState<number | null>(null);
const [stagingError, setStagingError] = useState<string | null>(null); // <--- Adicione esta linha

// Estados locais
const [rawXmlString, setRawXmlString] = useState<string>('');
const [items, setItems] = useState<any[]>([]);
const [isProcessingItems, setIsProcessingItems] = useState<boolean>(false);

// Estados de Modais

const [isMappingModalOpen, setIsMappingModalOpen] = useState<boolean>(false);
const [itemToMap, setItemToMap] = useState<any>(null);
const [isConferenceModalOpen, setIsConferenceModalOpen] = useState<boolean>(false);
const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
const [isTotalDetailsModalOpen, setIsTotalDetailsModalOpen] = useState<boolean>(false);

// Estado para o Modal de Distribuição de Frete
const [isFreightModalOpen, setIsFreightModalOpen] = useState<boolean>(false);
const [freightDistributionMode, setFreightDistributionMode] = useState<string>('proportional_value');

// Estados temporários para criação de fornecedor
const [supplierCreationName, setSupplierCreationName] = useState<string>('');
const [supplierCreationFantasyName, setSupplierCreationFantasyName] = useState<string>('');

const [isPayloadModalOpen, setIsPayloadModalOpen] = useState<boolean>(false);


const handleSaveProductMapping = (mappedProduct: { 
produtoId: number; 
skuSistema: string; 
familia?: string;
tipoEntrada?: string;
}) => {
if (!itemToMap) return;

setItems(prevItems => prevItems.map(item => {
if (item.tempId === itemToMap.tempId) {
return {
...item,
produtoIdSistema: mappedProduct.produtoId,
skuSistema: mappedProduct.skuSistema,
familia: mappedProduct.familia || item.familia,
tipoEntrada: mappedProduct.tipoEntrada || item.tipoEntrada || 'COMPRA_NORMAL',
isMapped: true
};
}
return item;
}));

message.success(`Item ${itemToMap.sku} mapeado com sucesso!`);
setIsMappingModalOpen(false);
setItemToMap(null);
};

const handleProcessarXml = async (parsedNfeData) => {
try {
setStagingError(null);
// Opcional: define que está salvando

const response = await fetch('http://localhost:3001/api/stock-entry/staging', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
chaveAcesso: parsedNfeData.chaveAcesso,
emitente: parsedNfeData.emitente,
produtos: parsedNfeData.produtos // Array com os itens da NF-e
})
});

const data = await response.json();

if (!response.ok || !data.success) {
throw new Error(data.message || 'Erro ao salvar no banco de dados.');
}

// Seta o ID real retornado pelo banco!
setLoteId(data.lote_importacao_id);
message.success(`Staging #${data.lote_importacao_id} salvo com sucesso no banco!`);

} catch (err: any) {
console.error("Erro real no staging:", err);
setStagingError(err.message || 'Erro de conexão com o servidor.');
setLoteId(null);
}
};

// 1. Processamento modular completo da NFe
const parsedNfe = useMemo<NfeDataFromXML | null>(() => {
if (!rawXmlString) return null;
try {
return parseNfeComplete(rawXmlString);
} catch (error) {
console.error("Erro ao parsear a NF-e do XML:", error);
return null;
}
}, [rawXmlString]);

// Valor total da NF-e extraído do XML
const nfeTotalValue = useMemo(() => {
return Number(parsedNfe?.totais?.icmsTot?.vNF || 0) || 0;
}, [parsedNfe]);

// Valor do Frete extraído do XML
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

// Função para lidar com o upload do arquivo XML
// Função para lidar com o upload do arquivo XML atualizada
const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
const file = event.target.files?.[0];
if (!file) return;

setIsProcessingItems(true);
const reader = new FileReader();
reader.onload = async (e) => {
const content = e.target?.result as string;
if (content) {
setRawXmlString(content); // Salva o XML cru em string para download/visualização futura
try {
const parsed = parseNfeComplete(content);
if (parsed && parsed.produtos) {
if (parsed.emitente?.cnpj) {
const cleanCnpj = parsed.emitente.cnpj.replace(/\D/g, '');

setSupplierStatus(prev => ({ ...prev, isChecking: true }));
const tenantId = 1; 

try {
const res = await checkSupplier(cleanCnpj, tenantId);
setSupplierStatus({
exists: res.exists,
isChecking: false,
supplier: res.supplier
});
if (res.exists) {
message.success(`Fornecedor já cadastrado: ${res.supplier?.name}`);
} else {
message.warning("Fornecedor não encontrado no sistema. Necessário cadastrar.");
}
} catch (err) {
console.error("Erro ao verificar fornecedor:", err);
message.error("Erro ao verificar se o fornecedor existe.");
setSupplierStatus({ exists: false, isChecking: false });
}
}

const initialItems = parsed.produtos.map((item, index) => {
const qtdXml = parseFloat(item.prod.qCom) || 0;
const vlrUnit = parseFloat(item.prod.vUnCom) || 0;
const vlrProd = parseFloat(item.prod.vProd) || (qtdXml * vlrUnit);

const baseUnitCalculated = qtdXml > 0 ? vlrProd / qtdXml : vlrUnit;

const freightItem = parseFloat(item.prod.vFrete || '0') || 0;
const otherExpenses = parseFloat(item.prod.vOutro || '0') || 0;
const insuranceItem = parseFloat(item.prod.vSeg || '0') || 0;

const ipiObj = item.imposto?.ipi?.IPITrib || item.imposto?.IPI?.ipitrib || item.imposto?.ipi || {};
const vIpiItem = parseFloat(ipiObj.vIPI || ipiObj.VIPI || '0') || 0;

const icmsObj = item.imposto?.icms || {};
const vStItem = Number(icmsObj.vICMSST || icmsObj.vBCST || 0) || 0;

const totalAcrescimosItem = freightItem + otherExpenses + insuranceItem + vIpiItem + vStItem;
const valorTotalRealItem = vlrProd + totalAcrescimosItem;
const effectiveUnitCost = qtdXml > 0 ? valorTotalRealItem / qtdXml : vlrUnit;

return {
tempId: `item-${index + 1}`,
nItem: item.nItem || String(index + 1),
sku: item.prod.cProd,
ean: item.prod.cEAN,
descricao: item.prod.xProd,
ncm: item.prod.NCM,
unidade: item.prod.uCom,
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
desconto: parseFloat(item.prod.vDesc || '0') || 0,
ipi: vIpiItem,
icmsSt: vStItem,
prod: {
...item.prod,
qCom: String(qtdXml),
vUnCom: String(vlrUnit),
vProd: String(vlrProd),
},
imposto: {
...item.imposto,
totalTaxes: totalAcrescimosItem
},
difference: 0,
isConfirmed: false,
};
});

setItems(initialItems);

// ==========================================
// SINCRONIZAÇÃO COMPLETA: XML Bruto + JSON + Itens
// ==========================================
const tenantId = 1;

const payloadItens = initialItems.map((item) => ({
  nItem: item.nItem,
  cProd: item.sku,
  cEan: item.ean,
  xProd: item.descricao,
  ncm: item.ncm,
  cest: item.prod?.CEST || null,
  uCom: item.unidade,
  quantidade: item.quantidade,
  receivedQuantity: item.receivedQuantity,
  valorUnitario: item.valorUnitario,
  valorBaseUnitario: item.valorBaseUnitario,
  valorTotal: item.valorTotal,
  valorProdutos: item.valorProdutos,
  freightOriginal: item.freightOriginal,
  freightDistributed: item.freightDistributed,
  freightAdded: item.freightAdded,
  seguro: item.seguro,
  outrasDespesas: item.outrasDespesas,
  desconto: item.desconto,
  ipi: item.ipi,
  icmsSt: item.icmsSt,
  // Envia os objetos JSON completos do XML para salvar nas colunas JSON/JSONB do banco
  prodJson: item.prod,
  impostoJson: item.imposto,
  // Dados de mapeamento se houver
  produtoIdSistema: item.produtoIdSistema || null,
  skuSistema: item.skuSistema || null,
  familia: item.familia || null,
  tipoEntrada: item.tipoEntrada || 'COMPRA_NORMAL'
}));

try {
// Chamada da API unificada que envia o XML cru e o objeto JSON de dados
const respostaLote = await sincronizarLoteXMLCompleto({
tenant_id: tenantId,
chave_acesso: parsed.chaveAcesso,
numero_nf: parsed.numero,
cnpj_fornecedor: parsed.emitente?.cnpj || '',
xml_conteudo: content, // <-- Aqui vai o XML inteiro em LONGTEXT
lote_importacao_id: loteId, // Se o seu controller aceitar ou esperar
dados_nota_fiscal: {
emitente: parsed.emitente,
totais: parsed.totais,
dataEmissao: parsed.dataEmissao,
serie: parsed.serie
},
itens: payloadItens
});

if (respostaLote && respostaLote.success) {
if (respostaLote.lote_importacao_id) {
setLoteId(respostaLote.lote_importacao_id);
}
message.success("Rascunho e XML bruto salvos com sucesso na Staging!");
} else {
throw new Error(respostaLote.error || 'Erro ao sincronizar lote.');
}
} catch (apiErr: any) {
console.error("Erro ao salvar itens no staging:", apiErr);
message.error("Erro ao comunicar com o servidor para salvar o staging: " + apiErr.message);
}

if (parsed.emitente?.nome) {
setSupplierCreationName(parsed.emitente.nome);
setSupplierCreationFantasyName(parsed.emitente.nomeFantasia || '');
}
} else {
setItems([]);
}
} catch (err) {
console.error("Erro ao popular itens da NF-e:", err);
setItems([]);
}
}
setIsProcessingItems(false);
};
reader.readAsText(file);
};

const beforeUpload = (file: File) => {
handleXmlUpload({ target: { files: [file] } });
return false;
};

// Estado para controlar o frete adicional (pago por fora / Correios / Carreto)
const [freteAdicionalInfo, setFreteAdicionalInfo] = useState({
valor: 0,
metodo: 'Correios - PAC',
observacao: ''
});

// Valor total do frete (XML + Frete Adicional informando pelo usuário)
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const totalFreightCombined = useMemo(() => {
const xmlFreight = nfeFreightValue;
const additionalFreight = Number(freteAdicionalInfo?.valor) || 0;
return xmlFreight + additionalFreight;
}, [nfeFreightValue, freteAdicionalInfo]);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////q


// Função para aplicar a distribuição de frete nos itens
const handleApplyFreightDistribution = () => {
const totalItens = items.reduce((total, item) => {
const freteConsiderado = Number(item.freightAdded) || 0;
return total + Math.max(0, (Number(item.valorTotal) || 0) - freteConsiderado);
}, 0);
if (totalItens <= 0) {
message.error("Não há valor nos itens para ratear o frete.");
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
message.success("Frete distribuído com sucesso entre os custos unitários dos itens!");
};

// Manipuladores de Ações dos Itens
const handleToggleItemConfirmation = (tempId: string) => {
setItems(prev => prev.map(item =>
item.tempId === tempId ? { ...item, isConfirmed: !item.isConfirmed } : item
));
};

const handleConfirmAllItems = () => {
setItems(prev => prev.map(item => ({ ...item, isConfirmed: true })));
message.success("Todos os itens foram marcados como conferidos.");
};

const handleUnconfirmAllItems = () => {
setItems(prev => prev.map(item => ({ ...item, isConfirmed: false })));
};

const handleRemoveItem = (tempId: string) => {
setItems(prev => prev.filter(item => item.tempId !== tempId));
message.info("Item removido da conferência.");
};

const handleReceberTotalDoFilho = (valorCalculado: number) => {
console.log("O valor recebido do filho é:", valorCalculado);
// Faça o que precisar com o valor aqui (ex: salvar em um estado do pai)
};

// Quando alterar a quantidade ou status de um item na conferência física/tabela:
const handleQuantityChange = async (tempId: string, newReceivedQty: number, stagingItemId?: number) => {
setItems(prev => prev.map(item => {
if (item.tempId === tempId) {
const diff = newReceivedQty - item.quantidade;
return { ...item, receivedQuantity: newReceivedQty, difference: diff };
}
return item;
}));

// Sincroniza com o Backend (Staging Table) se houver o ID do banco
if (stagingItemId) {
try {
await fetch(`http://localhost:3001/api/produtos/itens/staging/${stagingItemId}/status`, {
method: 'PATCH',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ quantidade: newReceivedQty }) // ou status correspondente
});
} catch (err) {
console.error("Erro ao atualizar item na staging do banco:", err);
}
}
};

const totalDivergences = useMemo(() => items.filter(i => i.difference !== 0).length, [items]);
const totalConfirmed = useMemo(() => items.filter(i => i.isConfirmed).length, [items]);
const totalPhysicalItems = useMemo(() => items.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0), [items]);
const progressPercent = useMemo(() => {
if (items.length === 0) return 0;
return Math.round((totalConfirmed / items.length) * 100);
}, [items.length, totalConfirmed]);

const isSubmitDisabled = items.length === 0 || totalConfirmed < items.length;

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
<title>DANFE Simplificado - NF-e ${parsedNfe?.chaveAcesso || ''}</title>
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
<span class="bold" style="font-size: 14px;">${parsedNfe?.emitente.nome || 'Emitente não informado'}</span><br>
<span>CNPJ: ${parsedNfe?.emitente.cnpj || '-'} | Fantasia: ${parsedNfe?.emitente.nomeFantasia || '-'}</span><br>
<span>NF-e Nº: ${parsedNfe?.numero || '-'} | Emissão: ${parsedNfe?.dataEmissao || '-'}</span>
</div>
<div class="text-right">
<span class="bold" style="font-size: 13px;">DANFE SIMPLIFICADO</span><br>
<span>Entrada de Mercadorias</span><br>
<span style="font-size: 9px;">Chave: ${parsedNfe?.chaveAcesso || '-'}</span>
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

return (
<div style={{ padding: '8px', background: '#f5f5f5', minHeight: '100vh' }}>

{/* CABEÇALHO ISOLADO COM STATUS DE STAGING */}
<StockEntryHeader 
parsedNfe={parsedNfe}
itemsLength={items.length}
totalConfirmed={totalConfirmed}
totalDivergences={totalDivergences}
progressPercent={progressPercent}
loteId={loteId} // <--- Confirme se essa variável está populada com o ID retornado do backend!
stagingError={stagingError}
beforeUpload={beforeUpload}
handlePrintDanfeHtml={handlePrintDanfeHtml}
onReset={onReset}
/>

{/* 2. LAYOUT DO WORKSPACE */}
<Spin spinning={isProcessingItems} tip="Analisando e vinculando itens com o banco...">
<Row gutter={[6, 6]}>
<Col xs={24} lg={19}>
<Space direction="vertical" size={8} style={{ width: '100%' }}>


{parsedNfe?.chaveAcesso && (
<NfeCards
data={parsedNfe}
supplierStatus={supplierStatus}
actions={{ 
onCreateSupplier: () => setIsSupplierModalOpen(true) 
}}
freteAdicionalData={freteAdicionalInfo}
// 1. Passamos o valor total consolidado do frete para o card exibir
valorTotalFrete={totalFreightCombined} 

// 2. Recebemos o frete atualizado aqui no pai para a conferência
onUpdateFreteAdicional={(novosDados) => {
setFreteAdicionalInfo(novosDados);

// Aqui você já recebe no pai e pode realizar a conferência/recalcule necessário:
console.log("Frete recebido no pai para conferência:", novosDados);
message.success(`Frete adicional atualizado: R$ ${novosDados.valor.toFixed(2)} (${novosDados.metodo})`);
}}/>)}

{items.length > 0 && (
<Card bordered={false} style={{ borderRadius: 8 }}>
<ItemsConference
items={items.map((i, index) => ({ ...i, nItem: i.nItem || index + 1, confirmed: i.isConfirmed, isConfirmed: i.isConfirmed }))}
onConfirmItems={handleConfirmAllItems}
onUnconfirmItems={handleUnconfirmAllItems}
onMapProducts={(item) => { setItemToMap(item); setIsMappingModalOpen(true); }}
onRemoveItems={handleRemoveItem}
onToggleItem={(tempId) => handleToggleItemConfirmation(tempId)}
onQuantityChange={(tempId, qty) => handleQuantityChange(tempId, qty)}
onAssignGroupToItems={() => { }}
onUnassignGroup={() => { }}
onUnassignItem={() => { }}
/>
</Card>
)}
</Space>
</Col>

{/* COLUNA DIREITA */}
<Col xs={24} lg={5}>
<Space direction="vertical" size={8} style={{ width: '100%' }}>

{/* Alerta 1: Validação Financeira */}
{items.length > 0 || nfeTotalValue > 0 ? (
<Alert
type={financialReconciliation.matches ? "success" : "error"}
showIcon
message={financialReconciliation.matches ? "Valores Financeiros Correspondem" : "Divergência Financeira Detectada"}
description={
<div style={{ fontSize: '11px', marginTop: 4 }}>
{/* Tabela compacta */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

{/* Cabeçalho da tabelinha */}
<div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', paddingBottom: 2, fontWeight: 600, color: 'rgba(0, 0, 0, 0.45)' }}>
<span>Campo</span>
<div style={{ display: 'flex', gap: 16 }}>
<span style={{ width: 65, textAlign: 'right' }}>Nota Fiscal</span>
<span style={{ width: 65, textAlign: 'right' }}>Itens</span>
</div>
</div>

{/* Linhas de Dados */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span>Produtos:</span>
<div style={{ display: 'flex', gap: 16 }}>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.note.produtos.toFixed(2)}</span>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.items.produtos.toFixed(2)}</span>
</div>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span>Frete:</span>
<div style={{ display: 'flex', gap: 16 }}>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.note.frete.toFixed(2)}</span>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.items.frete.toFixed(2)}</span>
</div>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span>IPI:</span>
<div style={{ display: 'flex', gap: 16 }}>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.note.ipi.toFixed(2)}</span>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.items.ipi.toFixed(2)}</span>
</div>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<span>ICMS-ST:</span>
<div style={{ display: 'flex', gap: 16 }}>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.note.icmsSt.toFixed(2)}</span>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.items.icmsSt.toFixed(2)}</span>
</div>
</div>

{/* Linha Total (Com destaque sutil de borda superior) */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0, 0, 0, 0.06)', paddingTop: 3, fontWeight: 500 }}>
<span>Total:</span>
<div style={{ display: 'flex', gap: 16 }}>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.note.total.toFixed(2)}</span>
<span style={{ width: 65, textAlign: 'right' }}>R$ {financialReconciliation.items.total.toFixed(2)}</span>
</div>
</div>

</div>

{/* Rodapé de Diferença Total */}
<div style={{ marginTop: 6, paddingTop: 4, borderTop: '1px dashed rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between' }}>
<span>Diferença total:</span>
<strong style={{ color: financialReconciliation.matches ? '#52c41a' : '#ff4d4f' }}>
R$ {financialReconciliation.totalDifference.toFixed(2)}
</strong>
</div>
</div>
}
/>
) : (
<Alert
type="info"
showIcon
message="Aguardando XML"
description="Importe um XML para validar os valores financeiros."
/>
)}

{/* Alerta 3: Distribuição de Frete */}
{(nfeFreightValue > 0 || freightReconciliation.itemsTotal > 0 || (freteAdicionalInfo?.valor || 0) > 0) ? (
<Alert
type={
// Se houver frete adicional, a lógica de match pode precisar considerar se ele foi rateado ou somado
// Aqui mantemos a regra existente ou ajustamos para comparar com o frete total combinado
freightReconciliation.matches && ((freteAdicionalInfo?.valor || 0) === 0 || freightReconciliation.itemsTotal >= (nfeFreightValue + (freteAdicionalInfo?.valor || 0)))
? "success" 
: "error"
}
showIcon
message={
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
<span>
{freightReconciliation.matches ? "Frete conciliado" : "Divergência de frete"}
</span>
</div>
}
description={
<div style={{ position: 'relative', fontSize: '11px', marginTop: 2 }}>
{/* Ícone de Engrenagem no Canto Superior Direito */}
<Tooltip title="Configurar rateio de frete">
<Button
type="text"
size="small"
icon={<SettingOutlined />}
onClick={() => setIsFreightModalOpen(true)}
style={{
position: 'absolute',
top: -26,
right: 0,
color: 'rgba(0, 0, 0, 0.45)'
}}
/>
</Tooltip>

{/* Conteúdo compacto com a linha de Frete Adicional inclusa */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<span style={{ color: '#8c8c8c' }}>Frete da NF-e:</span>
<strong>R$ {freightReconciliation.noteTotal.toFixed(2)}</strong>
</div>

{/* Linha dinâmica do Frete Adicional (só aparece se houver valor > 0) */}
{(freteAdicionalInfo?.valor || 0) > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<span style={{ color: '#fa8c16' }}>Frete Adicional ({freteAdicionalInfo.metodo}):</span>
<strong style={{ color: '#fa8c16' }}>R$ {Number(freteAdicionalInfo.valor).toFixed(2)}</strong>
</div>
)}

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<span style={{ color: '#8c8c8c' }}>Frete considerado nos itens:</span>
<strong>R$ {freightReconciliation.itemsTotal.toFixed(2)}</strong>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0, 0, 0, 0.06)', paddingTop: 2, marginTop: 2 }}>
<span style={{ color: '#8c8c8c' }}>Diferença:</span>
<strong style={{ 
color: freightReconciliation.matches ? '#52c41a' : '#ff4d4f' 
}}>
R$ {Math.abs(
(freightReconciliation.noteTotal + (Number(freteAdicionalInfo?.valor) || 0)) - freightReconciliation.itemsTotal
).toFixed(2)}
</strong>
</div>
</div>
</div>
}
/>
) : null}

{/* Alerta 4: Validade e Lotes (Inspeção Qualitativa) */}
{items.length > 0 && items.some(i => i.hasExpirationIssue || i.isExpired) ? (
<Alert
message={<Text strong style={{ color: '#d46b08' }}>⚠️ Alerta de Validade / Lotes</Text>}
description={
<div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 8 }}>
{items.filter(i => i.hasExpirationIssue || i.isExpired).map(item => (
<div key={item.tempId} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #ffd591' }}>
<Text strong>SKU {item.sku || 'N/A'}:</Text> {item.descricao} <br />
<Text type="warning">Lote: {item.lote || 'Não informado'} | Validade: {item.validade || 'N/A'}</Text>
</div>
))}
</div>
}
type="warning"
showIcon
/>
) : null}

{/* Alerta 5: Divergência de Quantidade Física */}
{totalDivergences > 0 ? (
<Alert
message={<Text strong style={{ color: '#a8071a' }}>🚨 Divergências Físicas ({totalDivergences})</Text>}
description={
<div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: 8 }}>
{items.filter(i => i.difference !== 0).map(item => (
<div key={item.tempId} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px dashed #ffa39e' }}>
<Text strong>SKU {item.sku || 'N/A'}:</Text> {item.descricao} <br />
<Text type="danger">NF: {item.quantidade} | Recebido: {item.receivedQuantity}</Text>
</div>
))}
</div>
}
type="error"
showIcon
/>
) : items.length > 0 ? (
<Alert message="🎉 Conferência Física Perfeita!" description="A contagem física bate com a NF-e." type="success" showIcon />
) : null}

{/* Card de Resumo do Recebimento */}
<Card
title={
<Space>
<DollarOutlined style={{ color: '#52c41a' }} />
<span>Resumo do Recebimento</span>
</Space>
}
extra={
parsedNfe?.totais?.icmsTot && (
<Button type="link" size="small" onClick={() => setIsTotalDetailsModalOpen(true)} style={{ padding: 0 }}>
Detalhes
</Button>
)
}
bordered={false}
style={{ borderRadius: 8 }}
>
<Row gutter={[16, 16]}>
<Col span={12}>
<Statistic title="Itens Físicos" value={totalPhysicalItems} suffix="un" valueStyle={{ fontSize: 16 }} />
</Col>
<Col span={12}>
<Statistic
title="Total da Nota"
value={parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0')}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 16 }}
/>
</Col>
</Row>

{parsedNfe?.totais?.icmsTot && (
<div style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 6, marginTop: 12, fontSize: 12 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', color: '#595959' }}>
<span>Produtos:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vProd || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
</div>
{parseFloat(parsedNfe.totais.icmsTot.vFrete || '0') > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
<span>(+) Frete:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
</div>
)}

<div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
<span>(+) Seguro:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vSeg || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
</div>


{parseFloat(parsedNfe.totais.icmsTot.vSeg || '0') > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
<span>(+) Seguro:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
</div>
)}

{parseFloat(parsedNfe.totais.icmsTot.vOutro || '0') > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
<span>(+) Outros:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

</div>
)}

{parseFloat(parsedNfe.totais.icmsTot.vIPI || '0') > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
<span>(+) IPI:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vIPI).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

</div>
)}

{parseFloat(parsedNfe.totais.icmsTot.vST || '0') > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', color: '#1890ff' }}>
<span>(+) ICMS ST:</span>
<span>R$ {parseFloat(parsedNfe.totais.icmsTot.vICMSST).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>

</div>
)}

<div>
<span>(=) Total:</span>

{(() => {
const icmsTot = parsedNfe?.totais?.icmsTot;

// Converte cada string para número, usando 0 como padrão se estiver vazia
const vProd = parseFloat(icmsTot?.vProd || '0') || 0;

const vICMSST = parseFloat(icmsTot?.vICMSST || icmsTot?.vST || '0') || 0;
const vIPI = parseFloat(icmsTot?.vIPI || '0') || 0;
const vFrete = parseFloat(icmsTot?.vFrete || '0') || 0;
const vSeg = parseFloat(icmsTot?.vSeg || '0') || 0;
const vOutro = parseFloat(icmsTot?.vOutro || '0') || 0;

// Soma matemática correta
const total = vProd + vICMSST + vIPI + vFrete + vSeg + vOutro;

return (
<span>
R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
</span>
);
})()}

</div>
</div>
)}

<Divider style={{ margin: '14px 0' }} />

<Statistic
title={<Text strong style={{ fontSize: 13 }}>Custo Ajustado Total</Text>}
value={parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0')}
value={parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0')}
precision={2}
prefix="R$"
valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: 22 }}
/>

<Button
type="primary"
block
size="large"
icon={<CheckCircleOutlined />}
style={{ marginTop: 16, height: 46, background: isSubmitDisabled ? undefined : '#52c41a', border: 'none' }}
disabled={isSubmitDisabled}
onClick={() => setIsConferenceModalOpen(true)}
>
{items.length === 0 ? 'Aguardando XML...' : 'Confirmar Entrada e Estoque'}
</Button>

<Button
type="primary"
block
size="large"
icon={<BugFilled/>}
style={{ marginTop: 16, height: 46, background: 'black', border: 'none' }}
onClick={() => setIsPayloadModalOpen(true)} // <--- ADICIONADO AQUI
>
<CodeFilled/> Debug
</Button>

</Card>
</Space>
</Col>
</Row>
</Spin>

{/* 3. MODAIS */}
{isMappingModalOpen && itemToMap && (
<MappingModal
item={itemToMap}
supplierCnpj={parsedNfe?.emitente.cnpj || ''}
onClose={() => { setIsMappingModalOpen(false); setItemToMap(null); }}
onMap={() => { }}
/>
)}

<Modal
title="🚚 Configurar Distribuição de Frete"
open={isFreightModalOpen}
onCancel={() => setIsFreightModalOpen(false)}
onOk={handleApplyFreightDistribution}
okText="Aplicar Rateio no Custo"
cancelText="Cancelar"
width={540}
>
<p style={{ marginBottom: 8 }}>
Valor total do frete informado na NF-e: <strong>R$ {nfeFreightValue.toFixed(2)}</strong>
</p>
<p style={{ color: '#595959', fontSize: 13, marginBottom: 16 }}>
Escolha abaixo o critério de rateio para incorporar o frete proporcionalmente aos custos unitários dos produtos:
</p>

<Radio.Group
onChange={(e) => setFreightDistributionMode(e.target.value)}
value={freightDistributionMode}
style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
>

<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
<Radio value="original" style={{ flex: 1 }}>
<Text strong>Valor Original</Text>
</Radio>
<Tooltip title="Itens de maior valor financeiro recebem uma fatia proporcionalmente maior do frete. É o método padrão e mais recomendado para contabilidade.">
<InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
</Tooltip>
</div>

<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
<Radio value="proportional_value" style={{ flex: 1 }}>
<Text strong>Proporcional ao Valor do Item</Text>
</Radio>
<Tooltip title="Itens de maior valor financeiro recebem uma fatia proporcionalmente maior do frete. É o método padrão e mais recomendado para contabilidade.">
<InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
</Tooltip>
</div>

<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
<Radio value="proportional_quantity" style={{ flex: 1 }}>
<Text strong>Proporcional à Quantidade</Text>
</Radio>
<Tooltip title="O frete é rateado com base no volume físico (unidades). Ideal quando os produtos têm pesos ou quantidades muito discrepantes, mas custos unitários parecidos.">
<InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
</Tooltip>
</div>

<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
<Radio value="equal" style={{ flex: 1 }}>
<Text strong>Dividido Igualmente</Text>
</Radio>
<Tooltip title="O valor total do frete é dividido pelo número total de linhas de itens na nota de forma linear, independentemente de preços ou quantidades.">
<InfoCircleOutlined style={{ color: '#1890ff', fontSize: 16, cursor: 'pointer', marginTop: 3 }} />
</Tooltip>
</div>
</Radio.Group>
</Modal>

<Modal
title="Conferência Física de Quantidades"
open={isConferenceModalOpen}
onCancel={() => setIsConferenceModalOpen(false)}
width={1280}
footer={[
<Button key="back" onClick={() => setIsConferenceModalOpen(false)}>Continuar depois</Button>,
<Button key="submit" type="primary" style={{ background: '#52c41a' }} onClick={() => setIsConferenceModalOpen(false)}>
Finalizar e Dar Entrada no Estoque
</Button>
]}
destroyOnClose
>
<PhysicalConferenceTable
items={items}
onConfirmItems={handleConfirmAllItems}
onUnconfirmItems={handleUnconfirmAllItems}
onQuantityChange={handleQuantityChange}
/>
</Modal>

<Modal
title="📊 Detalhamento Completo de Totais e Tributos da NF-e"
open={isTotalDetailsModalOpen}
onCancel={() => setIsTotalDetailsModalOpen(false)}
footer={[
<Button key="close" type="primary" onClick={() => setIsTotalDetailsModalOpen(false)}>
Fechar
</Button>
]}
width={700}
destroyOnClose
>
{parsedNfe?.totais?.icmsTot ? (
<Row gutter={[16, 16]}>
<Col span={12}>
<Card size="small" title="Valores Comerciais">
<p><strong>Valor dos Produtos (vProd):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vProd || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
<p><strong>Frete (vFrete):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vFrete || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
<p><strong>Desconto (vDesc):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vDesc || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
<p style={{ marginTop: 12 }}><strong style={{ fontSize: 14, color: '#1890ff' }}>Valor Total da Nota (vNF): R$ {parseFloat(parsedNfe.totais.icmsTot.vNF || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></p>
</Card>
</Col>
<Col span={12}>
<Card size="small" title="Tributos e Impostos">
<p><strong>Base de Cálculo ICMS (vBC):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vBC || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
<p><strong>Valor do ICMS (vICMS):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vICMS || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
<p><strong>Valor IPI (vIPI):</strong> R$ {parseFloat(parsedNfe.totais.icmsTot.vIPI || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
</Card>
</Col>
</Row>
) : (
<Text type="secondary">Nenhum dado de totais disponível na nota atual.</Text>
)}
</Modal>

<Modal
title="🔍 Payload de Staging e Dados Consolidados"
open={isPayloadModalOpen}
onCancel={() => setIsPayloadModalOpen(false)}
footer={[
<Button key="close" type="primary" onClick={() => setIsPayloadModalOpen(false)}>
Fechar
</Button>
]}
width={850}
>
<div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
<p style={{ color: '#595959', fontSize: 13 }}>
Esta é a estrutura oficial que será enviada para a tabela de transição (Staging) do banco de dados, separando os dados brutos da NF-e dos itens conferidos e vinculados pelo operador:
</p>
<pre style={{ 
background: '#1e1e1e', 
color: '#d4d4d4', 
padding: '14px', 
borderRadius: '6px', 
fontSize: '12px',
overflowX: 'auto',
fontFamily: 'Consolas, Monaco, monospace'
}}>
{JSON.stringify({
lote_importacao_id: loteId,
status_lote: "EM_CONFERENCIA",
tenant_id: 1,
nota_fiscal: {
chaveAcesso: parsedNfe?.chaveAcesso,
numeroNf: parsedNfe?.numero,
serie: parsedNfe?.serie,
dataEmissao: parsedNfe?.dataEmissao,
emitente: {
cnpj: parsedNfe?.emitente?.cnpj,
razaoSocial: parsedNfe?.emitente?.nome,
nomeFantasia: parsedNfe?.emitente?.nomeFantasia,
endereco: parsedNfe?.emitente?.enderEmit
},
totais: parsedNfe?.totais?.icmsTot
},
frete_adicional: {
valor: freteAdicionalInfo.valor,
metodo: freteAdicionalInfo.metodo,
observacao: freteAdicionalInfo.observacao
},
resumo_conferencia: {
totalItensNfe: items.length,
totalItensConferidos: totalConfirmed,
totalDivergencias: totalDivergences,
valorTotalGeral: parsedNfe?.totais?.icmsTot?.vNF ? Number(parsedNfe.totais.icmsTot.vNF) : 0
},
itens_staging: items.map((item, idx) => ({
item_nfe_seq: item.nItem || idx + 1,
mapeamento_sistema: {
produto_id_sistema: item.produtoIdSistema || null,
sku_sistema: item.skuSistema || null,
familia: item.familia || null,
tipo_entrada: item.tipoEntrada || "COMPRA_NORMAL"
},
dados_xml: {
sku_original: item.sku,
ean: item.ean,
descricao: item.descricao,
ncm: item.ncm,
unidade: item.unidade,
quantidade_nfe: item.quantidade,
valor_unitario_nfe: item.valorBaseUnitario,
valor_total_nfe: item.valorProdutos
},
conferencia_fisica: {
quantidade_recebida: item.receivedQuantity,
divergencia: item.difference,
is_confirmed: item.isConfirmed
},
custos_fiscais_e_rateio: {
frete_rateado: item.freightAdded,
ipi: item.ipi,
icms_st: item.icmsSt,
custo_unitario_final: item.valorUnitario,
custo_total_final: item.valorTotal
}
}))
}, null, 2)}
</pre>
</div>
</Modal>

<SupplierModal
isOpen={isSupplierModalOpen}
loading={false}
name={supplierCreationName}
fantasyNameXml={parsedNfe?.emitente.nomeFantasia || ''}
cnpj={parsedNfe?.emitente.cnpj || ''}
stateRegistration={parsedNfe?.emitente.ie}
address={`${parsedNfe?.emitente.logradouro}, ${parsedNfe?.emitente.numeroEnd}`}
cityStateZip={`${parsedNfe?.emitente.municipio} - ${parsedNfe?.emitente.uf}`}
phone={parsedNfe?.emitente.fone}
fantasyName={supplierCreationFantasyName}
setFantasyName={setSupplierCreationFantasyName}
onCancel={() => setIsSupplierModalOpen(false)}
onSubmit={() => setIsSupplierModalOpen(false)}
/>
</div>
);
};

export default StockEntryForm;