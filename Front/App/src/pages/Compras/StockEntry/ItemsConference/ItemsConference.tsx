import React, { useMemo, useState, useEffect } from 'react';
import { useSelecaoPlanilha } from './selecaoPlanilha';
import { AvisoUnidadesNaoReconhecidas, ModalDefinirUnidade, normalizarSiglaNota, UnidadeNotaTag, useUnidadesEntrada } from './UnidadesEntrada';
import {
Table,
Button,
Checkbox,
Radio,
Space,
Typography,
Modal,
Input,
Tag,
Tooltip,
Row,
Col,
InputNumber,
Alert,
Descriptions,
Statistic,
Dropdown,
message,
Badge,
Progress
} from 'antd';
import {
CheckOutlined,
UndoOutlined,
LinkOutlined,
SwapOutlined,
ThunderboltFilled,
ApartmentOutlined,
InfoCircleOutlined,
DollarOutlined,
PaperClipOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
Item,
FilterType,
} from '../types';

import ProductMappingModal, { MappingPayload, getMappedId, SKU_A_GERAR } from './ProductMappingModal';
import { DestinosEditor, DestinoLinha } from './DestinosEditor';
import { ModalCadastroRapido, ModalClassificarLote, type ValoresPorItem } from './ModaisLote';
import { carregarFamiliasECategorias, type ClassificacaoItem } from './ClassificacaoPim';
import { ClassificacaoTag, type ClassificacaoCatalogo, type NomesCatalogo } from './ClassificacaoTag';
import { linhaItemNovo, linhaSemVinculo, situacaoSkusNovos } from '../edicaoLote';
import { buscarClassificacaoItens } from '../../api/comprasApi';
import { TIPOS_RECURSO, TIPO_RECURSO_PADRAO, TipoRecurso, getTipoRecursoConfig } from '../tipoRecurso';
import { hasCodigoInterno, MSG_SEM_CODIGO_INTERNO } from '../conferencia';
import { gtinEfetivo, normalizarGtin, situacaoGtin, validarGtin } from '../gtin';

interface Props {
items?: Item[];
onConfirmItems?: (ids: (string | number)[]) => void;
onUnconfirmItems?: (ids: (string | number)[]) => void;
onItemMapped?: (tempId: string | number, mapping: MappingPayload) => void;
// Linhas com o mesmo SKU: confirma que são o mesmo produto (sku) ou desfaz (null)
onConfirmarAgrupamento?: (ids: (string | number)[], sku: string | null) => void;
// Itens nunca saem da NF: apenas mudam de tipo de entrada (produto, consumo, ativo...)
onChangeTipoRecurso?: (ids: (string | number)[], tipo: TipoRecurso) => void;
onQuantityChange?: (tempId: string | number, newReceivedQty: number) => void;
onToggleItem?: (tempId: string | number, confirmed: boolean) => void;
onChangeGtin?: (tempId: string | number, gtin: string) => void;
// Destino no estoque (depósitos); null = padrão pelo tipo do item
onChangeDestinos?: (tempId: string | number, destinos: DestinoLinha[] | null) => void;
// Lote: cadastro rápido de itens novos e classificação no PIM
onCadastroRapidoLote?: (linhas: any[], opcoes: { markup: number; classificacao: ClassificacaoItem; porItem: ValoresPorItem | null }) => void;
onClassificarLote?: (linhas: any[], classificacao: ClassificacaoItem, substituir?: boolean, porItem?: ValoresPorItem | null) => void;
// NF já importada/descartada: tela apenas para consulta
readOnly?: boolean;
// CNPJ do emitente: as regras de unidade podem ser só deste fornecedor
cnpjFornecedor?: string;
onSendTotal?: (total: number) => void;
}

const { Text, Title } = Typography;

export const ItemsConference: React.FC<Props> = ({
items: initialItems,
onConfirmItems,
onUnconfirmItems,
onItemMapped,
onConfirmarAgrupamento,
onChangeTipoRecurso,
onQuantityChange,
onToggleItem,
onChangeGtin,
onChangeDestinos,
onCadastroRapidoLote,
onClassificarLote,
readOnly = false,
onSendTotal,
cnpjFornecedor = '',
}) => {
const [localItems, setLocalItems] = useState<Item[]>(initialItems || []);
const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
const [filter, setFilter] = useState<FilterType>('all');
const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);
const [loteAberto, setLoteAberto] = useState<'cadastro' | 'classificar' | null>(null);
const itensSelecionados = useMemo(() => localItems.filter(i => selectedRowKeys.includes(i.tempId as React.Key)), [localItems, selectedRowKeys]);
// Classificação de uma linha só (clique na tag de família/categoria)
const [linhaClassificar, setLinhaClassificar] = useState<any | null>(null);
// Classificar → cadastro rápido: leva a família/categoria escolhida
const [classificacaoParaCadastro, setClassificacaoParaCadastro] = useState<ClassificacaoItem | null>(null);

// Nomes de famílias/categorias (itens novos) e classificação atual dos itens já cadastrados (vínculos)
const [nomesCatalogo, setNomesCatalogo] = useState<NomesCatalogo>({ familias: new Map(), categorias: new Map() });
const [classificacaoCatalogo, setClassificacaoCatalogo] = useState<Record<string, ClassificacaoCatalogo>>({});
useEffect(() => {
carregarFamiliasECategorias()
.then(r => setNomesCatalogo({
familias: new Map(r.familias.map(f => [f.id, { nome: f.nome, status: f.status, categoriaId: f.categoriaId }])),
categorias: new Map(r.categorias.map(c => [c.id, c.caminho])),
}))
.catch(() => { /* sem nomes: a tag mostra o id */ });
}, []);
const idsVinculados = useMemo(() => [...new Set(localItems
.filter(i => !linhaItemNovo(i) && !linhaSemVinculo(i) && Number((i as any).produtoIdSistema) > 0)
.map(i => Number((i as any).produtoIdSistema)))].sort((a, b) => a - b).join(','), [localItems]);
useEffect(() => {
if (!idsVinculados) return;
let ativo = true;
buscarClassificacaoItens(idsVinculados.split(',').map(Number))
.then(r => { if (ativo) setClassificacaoCatalogo(r); })
.catch(() => { /* sem classificação: a tag não aparece */ });
return () => { ativo = false; };
}, [idsVinculados]);

const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
const [selectedItemForBarcode, setSelectedItemForBarcode] = useState<any>(null);

const [inputValue, setInputValue] = useState('');
// Abre o modal e guarda qual item está sendo editado
const openBarcodeInputModal = (record: any) => {
if (readOnly) return;
setSelectedItemForBarcode(record);
// Já abre com o GTIN atual (manual ou do XML) para permitir correção
setInputValue(gtinEfetivo(record.customGtin, (record.prod || record).cEAN) || '');
setBarcodeModalVisible(true);
};

// Salva o código de barras no item correspondente no estado da tabela
const handleSaveCustomGtin = () => {
const valor = normalizarGtin(inputValue);
if (!valor) {
// Campo vazio: remove a correção manual e volta a valer o GTIN do XML
if (selectedItemForBarcode?.customGtin) {
onChangeGtin?.(selectedItemForBarcode.tempId, '');
setBarcodeModalVisible(false);
return;
}
message.warning("Digite ou bipe um código de barras.");
return;
}
if (!validarGtin(valor)) {
message.error("GTIN inválido: confira os dígitos (tamanho 8, 12, 13 ou 14 e dígito verificador).");
return;
}
setInputValue(valor);

// O pai guarda o GTIN no item, grava na staging e desfaz a conferência
onChangeGtin?.(selectedItemForBarcode.tempId, valor);
setBarcodeModalVisible(false);
};

// --- Adicione estes states junto aos outros do seu componente ---
const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
const [itemsToMapQueue, setItemsToMapQueue] = useState<any[]>([]);

// Modal de Detalhes do Item (clique no 'i')
const [isItemDetailsModalOpen, setIsItemDetailsModalOpen] = useState(false);
const [itemForDetails, setItemForDetails] = useState<Item | null>(null);

useEffect(() => { setLocalItems(initialItems || []); }, [initialItems]);


// Adicione este useMemo junto aos outros no topo do componente:
const calculatedTotalAmount = useMemo(() => {
return localItems.reduce((acc, record: any) => {
const prodData = record.prod || record;
const imposto = record.imposto || {};
const valorProd = Number(prodData.vProd || 0);
const freightVal = Number(record.freightAdded ?? record.freightDistributed ?? prodData.vFrete ?? 0);
const ipiVal = Number(imposto.ipi?.vIPI || prodData.vIPI || 0);
const stObj = imposto.icmsSt || imposto.ICMSST || imposto.icms || {};
const stVal = Number(stObj.vICMSST || stObj.VICMSST || stObj.vST || imposto.vBCST || prodData.vST || 0);

// valorTotal vem calculado do pai (produtos - desconto + acréscimos + frete aplicado)
if (record.valorTotal !== undefined) return acc + Number(record.valorTotal || 0);
return acc + valorProd + freightVal + ipiVal + stVal;
}, 0);
}, [localItems]);

// Se precisar notificar o pai com esse valor, use um useEffect limpo:
useEffect(() => {
onSendTotal?.(calculatedTotalAmount);
}, [calculatedTotalAmount, onSendTotal]);

const pendingItems = useMemo(() => localItems.filter(i => !i.isConfirmed && !i.confirmed), [localItems]);
const confirmedItems = useMemo(() => localItems.filter(i => i.isConfirmed || i.confirmed), [localItems]);
const divergentItems = useMemo(() => localItems.filter(i => (i.difference ?? 0) !== 0), [localItems]);
const unmappedItems = useMemo(() => localItems.filter(i => !i.mappedId && !i.sku), [localItems]);

// Filtragem reativa baseada nas abas
const filteredItems = useMemo(() => {
const porSituacao = (() => {
switch (filter) {
case 'pending': return pendingItems;
case 'confirmed': return confirmedItems;
case 'divergent': return divergentItems;
case 'unmapped': return unmappedItems;
default: return localItems;
}
})();
return tipoFiltro ? porSituacao.filter(i => (i.tipoRecurso || TIPO_RECURSO_PADRAO) === tipoFiltro) : porSituacao;
}, [filter, tipoFiltro, localItems, pendingItems, confirmedItems, divergentItems, unmappedItems]);

// Tipos de entrada presentes na nota (venda, consumo, ativo...) com a quantidade de linhas
const tiposNaNota = useMemo(() => {
const contagem = new Map<string, number>();
for (const i of localItems) {
const t = i.tipoRecurso || TIPO_RECURSO_PADRAO;
contagem.set(t, (contagem.get(t) || 0) + 1);
}
return TIPOS_RECURSO.filter(t => contagem.has(t.value)).map(t => ({ ...t, linhas: contagem.get(t.value) || 0 }));
}, [localItems]);
// SKU Customizado repetido entre itens novos: bloqueia até confirmar que é o mesmo produto (agrupa) ou mudar o SKU
const skusRepetidos = useMemo(() => situacaoSkusNovos(localItems), [localItems]);
const [grupoSku, setGrupoSku] = useState<string | null>(null);
const grupoAberto = grupoSku ? skusRepetidos.get(grupoSku) : undefined;
const progressoConferencia = localItems.length > 0 ? Math.round((confirmedItems.length / localItems.length) * 100) : 0;

const formatCurrency = (val: number) =>
val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Função para validar se o item possui os dados preenchidos necessários para ser conferido
const isItemValidForConference = (record: Item): boolean => {
const hasQuantity = (record.receivedQuantity ?? record.quantidade ?? 0) >= 0;
return hasQuantity && hasCodigoInterno(record);
};

const handleOpenItemDetails = (item: Item) => {
setItemForDetails(item);
setIsItemDetailsModalOpen(true);
};

// Função para abrir o modal com um ou múltiplos itens (fila)
const handleOpenMappingModal = (ids: (string | number)[]) => {
if (readOnly) return;
// Filtra os itens locais correspondentes aos IDs selecionados ou passados
const itemsToProcess = localItems.filter(item =>
ids.includes(item.tempId) || ids.includes(item.nItem as any)
);

if (itemsToProcess.length === 0) return;

setItemsToMapQueue(itemsToProcess);
setIsMappingModalOpen(true);
};

// Função executada quando o mapeamento de um item da fila é confirmado
const handleConfirmMappingItem = (tempId: number | string, mappingData: MappingPayload) => {
// Repassa ao pai (StockEntryForm), que guarda o mapeamento nos items e persiste na staging
onItemMapped?.(tempId, mappingData);

// Reflexo imediato na tabela local (o pai também devolve mappedId nos items)
setLocalItems(prev => prev.map(item => {
if (item.tempId === tempId || item.nItem === tempId) {
return { ...item, mappedId: getMappedId(mappingData), isMapped: true };
}
return item;
}));
};

// Unidades da nota: tradução pelo dicionário (M → MT) e pergunta das siglas desconhecidas
const siglasDaNota = useMemo(() => localItems.map((i: any) => normalizarSiglaNota(i.unidade || i.prod?.uCom)), [localItems]);
const unidadesNota = useUnidadesEntrada(cnpjFornecedor, siglasDaNota);
const [siglaDefinindo, setSiglaDefinindo] = useState<string | null>(null);

// Seleção de linhas como planilha (clique, Ctrl, Shift, arrastar, Ctrl+A, Esc)
const chavesVisiveis = useMemo(() => filteredItems.map(i => i.tempId as React.Key), [filteredItems]);
const selecaoPlanilha = useSelecaoPlanilha(chavesVisiveis, selectedRowKeys, setSelectedRowKeys);

// 📋 DEFINIÇÃO DE COLUNAS
const columns: ColumnsType<Item> = [
{
title: (
<Space size={8}>
<Checkbox
indeterminate={
selectedRowKeys.length > 0 && selectedRowKeys.length < filteredItems.length
}
checked={
filteredItems.length > 0 && selectedRowKeys.length === filteredItems.length
}
onChange={(e) => {
if (e.target.checked) {
setSelectedRowKeys(filteredItems.map(i => i.tempId));
} else {
setSelectedRowKeys([]);
}
}}
/>
<span>#</span>
<span>Item</span>
</Space>
),
key: 'itemCombined',
width: 80,
render: (_, record) => {
const isSelected = selectedRowKeys.includes(record.tempId);

const tipoRecurso = record.tipoRecurso || record.tipo_recurso || TIPO_RECURSO_PADRAO;
const currentTag = getTipoRecursoConfig(tipoRecurso);
return (
<Space size={8} align="center">
<Checkbox
checked={isSelected}
onChange={(e) => selecaoPlanilha.onCaixa(record.tempId, e)}
/>
<span style={{ fontWeight: 'bold' }}>
{record.nItem || record.tempId}
</span>

<Dropdown
trigger={['click']}
disabled={readOnly}
menu={{
selectedKeys: [tipoRecurso],
items: TIPOS_RECURSO.map(t => ({ key: t.value, label: t.label })),
onClick: ({ key }) => onChangeTipoRecurso?.([record.tempId], key as TipoRecurso),
}}
>
<Tooltip title={`Tipo de entrada: ${currentTag.label} (clique para alterar)`}>
<Tag color={currentTag.color} style={{ margin: 0, fontSize: '10px', padding: '0 4px', cursor: 'pointer' }}>
{currentTag.short}
</Tag>
</Tooltip>
</Dropdown>
</Space>
);
}
},
{
title: 'SKU Customizado',
width: 120,
dataIndex: 'mappedId',
key: 'mappedId',
render: (text, record) => text ? (
text === SKU_A_GERAR ? (
<Tooltip title="Item novo sem SKU Customizado digitado: recebe a sequência do banco na aprovação (ex.: IT-000123).">
<Tag style={{ margin: 0, color: '#8c8c8c', borderStyle: 'dashed' }}>gerado na aprovação</Tag>
</Tooltip>
) : skusRepetidos.has(String(text).trim().toUpperCase()) && linhaItemNovo(record) ? (() => {
const sku = String(text).trim().toUpperCase();
const grupo = skusRepetidos.get(sku)!;
const [cor, rotulo, dica] = grupo.confirmado
? ['gold', 'agrupado', 'Confirmado como o mesmo produto: as linhas entram como um único item, com as quantidades somadas. Clique para revisar.']
: grupo.mesmoProduto
? ['orange', 'repetido · confirmar', 'Outra linha da nota usa o mesmo SKU e parece o mesmo produto. A aprovação fica bloqueada até você confirmar. Clique para revisar.']
: ['red', 'repetido · confirmar', 'Outra linha da nota usa o mesmo SKU, mas código e descrição do fornecedor são diferentes. A aprovação fica bloqueada até você decidir. Clique para revisar.'];
return (
<Tooltip title={dica}>
<Tag color={cor} style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }} onClick={() => setGrupoSku(sku)}>{text} · {rotulo}</Tag>
</Tooltip>
);
})() : (
<Tag color="blue" style={{ margin: 0 }}>{text}</Tag>
)
) : (
<Button size="small" type="link" icon={<LinkOutlined />} disabled={readOnly} onClick={() => handleOpenMappingModal([record.tempId])}>
Vincular
</Button>
)
},

{
title: 'Código / EAN',
key: 'productInfo',
width: 150,
render: (_, record: any) => {
const prodData = record.prod || record;
// GTIN efetivo: o informado manualmente tem prioridade sobre o do XML
const gtin = gtinEfetivo(record.customGtin, prodData.cEAN);
const origem = record.customGtin ? 'Manual' : 'XML';
const situacao = situacaoGtin(gtin);

return (
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
<Text type="secondary" style={{ fontSize: 10 }}>Cód: {prodData.cProd}</Text>
<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
{situacao === 'AUSENTE' ? (
<Tag
color="warning"
style={{ fontSize: 10, margin: 0, cursor: 'pointer' }}
onClick={() => openBarcodeInputModal(record)}
>
⚠️ Sem GTIN (Clique para bipar)
</Tag>
) : (
<Tooltip title={situacao === 'VALIDO' ? 'Clique para corrigir' : 'Dígito verificador não confere. Clique para corrigir.'}>
<Tag
color={situacao === 'INVALIDO' ? 'error' : origem === 'Manual' ? 'success' : 'blue'}
style={{ fontSize: 10, margin: 0, cursor: 'pointer' }}
onClick={() => openBarcodeInputModal(record)}
>
{situacao === 'INVALIDO' ? '❌ ' : ''}GTIN ({origem}): {gtin}
</Tag>
</Tooltip>
)}
</div>
</div>
);
}
},

{
title: 'Produto / Destino',
dataIndex: 'descricao',
key: 'descricao',
width: 400,
render: (_, record) => {
const recebida = Number(record.receivedQuantity ?? record.quantidade) || 0;
return (
<Space direction="vertical" size={2}>
<Text strong style={{ fontSize: 13 }}>{record.nome || record.descricao}</Text>
<ClassificacaoTag
item={record}
nomes={nomesCatalogo}
catalogo={classificacaoCatalogo[String((record as any).produtoIdSistema)]}
readOnly={readOnly}
onEditar={() => setLinhaClassificar(record)}
/>
<Space size={4} wrap>
<DestinosEditor
destinos={record.destinos}
recebida={recebida}
unidade={record.unidade}
tipoRecurso={record.tipoRecurso}
readOnly={readOnly}
onChange={(destinos) => onChangeDestinos?.(record.tempId, destinos)}
/>
{record.vinculoSugerido && (
<Tooltip title={record.vinculoSugerido === 'FORNECEDOR'
? 'Vínculo reconhecido pelo código deste fornecedor em notas anteriores. Confira antes de dar entrada.'
: 'Vínculo reconhecido pelo código de barras (GTIN). Confira antes de dar entrada.'}>
<Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>
Sugerido ({record.vinculoSugerido === 'FORNECEDOR' ? 'cód. fornecedor' : 'GTIN'})
</Tag>
</Tooltip>
)}
</Space>
</Space>
);
}
},
{
title: 'Qtd. Conferência',
key: 'quantitiesConference',
align: 'center',
width: 130,
render: (_, record) => {
const nfQty = record.quantidade || 0;
const receivedQty = record.receivedQuantity !== undefined ? record.receivedQuantity : nfQty;
const diff = record.difference ?? (receivedQty - nfQty);
const UOM = record.unidade

return (
<div style={{ background: '#fcfcfc', padding: '1px 2px', borderRadius: 4, border: '1px solid #f0f0f0' }}>
<Space size={4} align="center">
<div style={{ textAlign: 'center' }}>
<Text type="secondary" style={{ fontSize: 9, display: 'block', lineHeight: 1 }}>NF</Text>
<Text strong >{nfQty}</Text>
</div>
<div style={{ textAlign: 'center' }}>
<Text type="secondary" style={{ fontSize: 10, display: 'block', lineHeight: 1 }}>Rec.</Text>
<InputNumber
size="small"
min={0}
disabled={readOnly}
value={receivedQty}
onChange={(newVal) => newVal !== null && onQuantityChange?.(record.tempId, newVal)}
style={{ width: 55 }}
/>
</div>
<div style={{ textAlign: 'center', minWidth: 28 }}>
<Text type="secondary" style={{ fontSize: 9, display: 'block', lineHeight: 1 }}>Dif.</Text>
{diff > 0 ? (
<Tag color="orange" style={{ margin: 0 }}>+{diff}</Tag>
) : diff < 0 ? (
<Tag color="red" style={{ margin: 0 }}>{diff}</Tag>
) : (
<Tag color="green" style={{ margin: 0 }}>0</Tag>
)}
</div>
</Space>

<UnidadeNotaTag sigla={UOM} resolucao={unidadesNota.resolucoes[normalizarSiglaNota(UOM)]} readOnly={readOnly} onDefinir={setSiglaDefinindo} />
</div>
);
}
},
{
title: 'Composição',
key: 'costComposition',
width: 150,
render: (_, record: any) => {
const prodData = record.prod || record;
const quantidade = Number(prodData.qCom || record.quantidade || 1);
const valorProd = Number(prodData.vProd || 0);
const unitBase = quantidade > 0 ? valorProd / quantidade : 0;

const imposto = record.imposto || {};

const freightOriginal = Number(record.freightOriginal ?? prodData.vFrete ?? 0);
const freightDistributed = Number(record.freightDistributed || 0);
const freightVal = Number(record.freightAdded ?? (freightDistributed || freightOriginal));
const quantidadeSegura = quantidade > 0 ? quantidade : 1;
const freightUnit = freightVal / quantidadeSegura;

const ipiVal = Number(imposto.ipi?.vIPI || prodData.vIPI || 0);
const ipiUnit = quantidade > 0 ? ipiVal / quantidade : 0;

const stObj = imposto.icmsSt || imposto.ICMSST || imposto.icms || {};
const stVal = Number(stObj.vICMSST || stObj.VICMSST || stObj.vST || imposto.vBCST || prodData.vST || 0);
const stUnit = quantidade > 0 ? stVal / quantidade : 0;

return (
<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
<span style={{ color: '#8c8c8c' }}>Base:</span>
<Text style={{ fontSize: 11 }}>{formatCurrency(unitBase)}</Text>
</div>
<Tooltip 
title={
<div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
<div>Original: {formatCurrency(freightOriginal / quantidadeSegura)}</div>
<div>
Distribuido: {freightDistributed > 0 ? `+${formatCurrency(freightDistributed / quantidadeSegura)}` : '—'}
</div>
</div>
}
>
<div 
style={{ 
display: 'flex', 
justifyContent: 'space-between', 
alignItems: 'center',
fontSize: 11,
border: '1px solid #f0f0f0',
borderRadius: 6,
backgroundColor: '#fafafa',
cursor: 'help' // Indica visualmente que há mais informações ao passar o mouse
}}
>
<span style={{ color: '#8c8c8c' }}>Frete considerado:</span>
<Text strong style={{ fontSize: 11 }}>{formatCurrency(freightUnit)}</Text>
</div>
</Tooltip>

{ipiUnit > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
<span style={{ color: '#8c8c8c' }}>IPI:</span>
<Text type="warning" style={{ fontSize: 11 }}>+{formatCurrency(ipiUnit)}</Text>
</div>
)}

{stUnit > 0 && (
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
<span style={{ color: '#8c8c8c' }}>ST:</span>
<Text type="secondary" style={{ fontSize: 11 }}>+{formatCurrency(stUnit)}</Text>
</div>
)}
</div>
);
}
},
{
title: 'Custo & Total',
key: 'costAndTotal',
width: 130,
render: (_, record: any) => {
const prodData = record.prod || record;
const imposto = record.imposto || {};
const nfQty = Number(prodData.qCom || record.quantidade || 1);
const valorProd = Number(prodData.vProd || 0);
const unitBase = nfQty > 0 ? valorProd / nfQty : 0;
const freightUnit = Number(record.freightAdded ?? record.freightDistributed ?? prodData.vFrete ?? 0) / nfQty;
const ipiUnit = (Number(imposto.ipi?.vIPI || prodData.vIPI || 0)) / nfQty;
const stUnit = (Number(imposto.icmsSt?.vICMSST || imposto.ICMSST?.vICMSST || imposto.icms?.vICMSST || imposto.vBCST || prodData.vST || 0)) / nfQty;
// valorUnitario vem calculado do pai; o cálculo local fica só como fallback
const finalUnitCost = record.valorUnitario !== undefined
? Number(record.valorUnitario || 0)
: unitBase + freightUnit + ipiUnit + stUnit;
const activeQty = record.receivedQuantity ?? nfQty;
const totalItemAmount = finalUnitCost * activeQty;

return (
<div style={{ lineHeight: '1.3' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
<span style={{ fontSize: 10, color: '#8c8c8c' }}>UN:</span>
<Text strong style={{ color: '#52c41a', fontSize: 12 }}>{formatCurrency(finalUnitCost)}</Text>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 2 }}>
<span style={{ fontSize: 10, color: '#8c8c8c' }}>Tot ({activeQty}):</span>
<Text strong style={{ fontSize: 12 }}>{formatCurrency(totalItemAmount)}</Text>
</div>
</div>
);
}
},
{
title: 'Ações',
key: 'status',
align: 'center',
width: 50,
render: (_, record) => {
const isConf = record.isConfirmed || record.confirmed;
const diff = record.difference || 0;

const podeConferir = isItemValidForConference(record);

const handleToggleConference = (newConfirmedState: boolean) => {
if (readOnly) return;
if (newConfirmedState && !podeConferir) {
message.warning(MSG_SEM_CODIGO_INTERNO);
return;
}
onToggleItem?.(record.tempId, newConfirmedState);
};

return (
<Space size={4} align="center">
{/* Botão de Status (Conferido / Pendente) */}
{isConf ? (
<Tooltip title="Item conferido. Clique para desbloquear/desfazer">
<Button
type="text"
size="small"
icon={<CheckOutlined style={{ color: '#52c41a' }} />}
disabled={readOnly}
onClick={() => handleToggleConference(false)}
/>
</Tooltip>
) : (
<Tooltip title={podeConferir ? 'Marcar como conferido' : MSG_SEM_CODIGO_INTERNO}>
<Button
type="text"
size="small"
disabled={readOnly || !podeConferir}
icon={<PaperClipOutlined style={{ color: !podeConferir ? '#d9d9d9' : diff !== 0 ? '#faad14' : '#bfbfbf' }} />}
onClick={() => handleToggleConference(true)}
/>
</Tooltip>
)}

{/* Botão de Detalhes */}
<Tooltip title="Ver detalhes completos de custos e impostos">
<Button
type="text"
size="small"
icon={<InfoCircleOutlined style={{ color: '#1890ff' }} />}
onClick={() => handleOpenItemDetails(record)}
/>
</Tooltip>
</Space>
);
}
}
];

return (
<div style={{ background: '#fff', padding: 0, borderRadius: 8 }}>

{/* HEADER CONTROL AREA */}
<Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
<Col>
<Space size={10} wrap align="center">
<Title level={4} style={{ margin: 0 }}>Conferência de Itens ({localItems.length})</Title>



</Space>
</Col>
<Col>
<Space>

<Space orientation='horizontal' style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 6, border: '1px solid #d9d9d9' }}>

   <Col xs={24} xl={7}>
                                
                               
                       
                    </Col>
    
<Radio.Group value={filter} onChange={(e) => setFilter(e.target.value)} size="small">
<Radio.Button value="all">Todos  <Space size="small">
                                    <Badge count={(localItems.length)} showZero style={{ backgroundColor: '#bfbfbf' }} />
                                </Space></Radio.Button>
<Radio.Button value="pending">Pendentes  <Space size="small">
                                    <Badge count={(pendingItems.length)} showZero style={{ backgroundColor: '#faad14' }} />
                                </Space></Radio.Button>
<Radio.Button value="confirmed">Conferidos  <Space size="small">
                                    <Badge count={confirmedItems.length } showZero style={{ backgroundColor: '#52c41a' }} />
                                </Space></Radio.Button>
<Radio.Button value="divergent">Divergências   <Space size="small">
                                    <Badge count={divergentItems.length} showZero style={{ backgroundColor: '#ff4d4f' }} />
                                </Space></Radio.Button>
{/* <Radio.Button value="unmapped">Sem Vínculo  <Space size="small">
                                    <Badge count={unmappedItems.length} showZero style={{ backgroundColor: '#4f4f4f' }} />
                                </Space></Radio.Button> */}
</Radio.Group>
</Space>
</Space>
</Col>
</Row>

<AvisoUnidadesNaoReconhecidas siglas={unidadesNota.naoReconhecidas} readOnly={readOnly} onDefinir={setSiglaDefinindo} />

{/* FILTROS E AÇÕES COLETIVAS */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
<Space wrap style={{ background: '#fafafa', padding: 6, borderRadius: 6, border: '1px solid #f0f0f0', justifyContent: 'space-between' }}>
<Space wrap>
<Tooltip title={<span>Clique na linha: seleciona só ela<br />Ctrl + clique: inclui/tira a linha<br />Shift + clique: seleciona o intervalo<br />Clicar e arrastar: várias linhas seguidas<br />Ctrl+A: todas · Esc: limpa</span>}>
<Text strong style={{ cursor: 'help' }}>{`${selectedRowKeys.length} selecionado(s)`}</Text>
</Tooltip>
<Button size="small" type="primary" icon={<CheckOutlined />} disabled={readOnly || selectedRowKeys.length === 0} onClick={() => { onConfirmItems?.(selectedRowKeys as (string | number)[]); setSelectedRowKeys([]); }}>Conferir</Button>
<Button size="small" icon={<UndoOutlined />} disabled={readOnly || selectedRowKeys.length === 0} onClick={() => { onUnconfirmItems?.(selectedRowKeys as (string | number)[]); setSelectedRowKeys([]); }}>Desfazer</Button>
<Button
size="small"
icon={<LinkOutlined />}
disabled={readOnly || selectedRowKeys.length === 0}
onClick={() => handleOpenMappingModal(selectedRowKeys as (string | number)[])}
>
Vincular Selecionados
</Button>
<Tooltip title="Linhas sem vínculo viram itens novos com os dados da nota e um markup único">
<Button size="small" icon={<ThunderboltFilled />} disabled={readOnly || selectedRowKeys.length === 0} onClick={() => setLoteAberto('cadastro')}>Cadastro rápido</Button>
</Tooltip>
<Tooltip title="Família/categoria e, se quiser, valores de atributos nos itens novos selecionados">
<Button size="small" icon={<ApartmentOutlined />} disabled={readOnly || selectedRowKeys.length === 0} onClick={() => setLoteAberto('classificar')}>Classificar</Button>
</Tooltip>

 <div style={{ width: 120, display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: -2 }}>
                                        <Text type="secondary" style={{ fontSize: 9 }}>Progresso</Text>
                                        <Text strong style={{ fontSize: 9, color:  '#1890ff' }}>{progressoConferencia}%</Text>
                                    </div>
                                    <Progress percent={progressoConferencia} showInfo={false} strokeColor={ '#1890ff'} size="small" />
                                </div>
</Space>

{/* <Radio.Group value={filter} onChange={(e) => setFilter(e.target.value)} size="small">
<Radio.Button value="all">Todos ({localItems.length})</Radio.Button>
<Radio.Button value="pending">Pendentes ({pendingItems.length})</Radio.Button>
<Radio.Button value="confirmed">Conferidos ({confirmedItems.length})</Radio.Button>
<Radio.Button value="divergent">Divergências ({divergentItems.length})</Radio.Button>
<Radio.Button value="unmapped">Sem Vínculo ({unmappedItems.length})</Radio.Button>
</Radio.Group> */}






<Col>
<Space size={10} wrap align="center">
<Space size={4} wrap>
{tiposNaNota.map(t => (
<Tooltip key={t.value} title={tipoFiltro === t.value ? 'Clique para mostrar todos os tipos' : `Mostrar só ${t.label}`}>
<Tag
color={t.color}
onClick={() => setTipoFiltro(tipoFiltro === t.value ? null : t.value)}
style={{ margin: 0, cursor: 'pointer', fontWeight: tipoFiltro === t.value ? 700 : 400, outline: tipoFiltro === t.value ? '2px solid #1677ff' : undefined }}
>
{t.label}: {t.linhas}
</Tag>
</Tooltip>
))}
</Space>
<Dropdown
trigger={['click']}
disabled={readOnly || selectedRowKeys.length === 0}
menu={{
items: TIPOS_RECURSO.map(t => ({
key: t.value,
label: <Space size={6}><Tag color={t.color} style={{ margin: 0, minWidth: 64, textAlign: 'center' }}>{t.short}</Tag>{t.label}</Space>,
})),
onClick: ({ key }) => { onChangeTipoRecurso?.(selectedRowKeys as (string | number)[], key as TipoRecurso); setSelectedRowKeys([]); },
}}
>
<Tooltip title={selectedRowKeys.length === 0 ? 'Selecione linhas para mudar o tipo de entrada' : `Mudar o tipo de ${selectedRowKeys.length} linha(s): o destino no estoque acompanha o tipo`}>
<Button size="small" icon={<SwapOutlined />} disabled={readOnly || selectedRowKeys.length === 0}>Tipo de entrada</Button>
</Tooltip>
</Dropdown>
</Space>
</Col>
</Space>
</div>

{/* DATA TABLE */}
<style>{`.conferencia-linha-selecionada > td { background: #e6f4ff !important; } .conferencia-tabela .ant-table-tbody > tr { cursor: default; }`}</style>
<div className="conferencia-tabela" {...selecaoPlanilha.propsContainer}>
<Table
columns={columns}
dataSource={filteredItems}
rowKey="tempId"
size="small"
bordered
onRow={(record) => selecaoPlanilha.propsLinha(record.tempId)}
rowClassName={(record) => (selectedRowKeys.includes(record.tempId) ? 'conferencia-linha-selecionada' : '')}
pagination={{ pageSize: 50, showSizeChanger: true }}
summary={() => {
if (filteredItems.length === 0) return null;

const totals = filteredItems.reduce(
(acc, record: any) => {
const prodData = record.prod || record;
const imposto = record.imposto || {};
const nfQty = Number(prodData.qCom || record.quantidade || 1);
const receivedQty = record.receivedQuantity !== undefined ? record.receivedQuantity : nfQty;
const diff = record.difference ?? (receivedQty - nfQty);
const valorProd = Number(prodData.vProd || 0);
const totalNfAmount = valorProd;
// Captura dos totais da linha
const freightVal = Number(record.freightAdded ?? record.freightDistributed ?? prodData.vFrete ?? 0);
const ipiVal = Number(imposto.ipi?.vIPI || prodData.vIPI || 0);
const stObj = imposto.icmsSt || imposto.ICMSST || imposto.icms || {};
const stVal = Number(stObj.vICMSST || stObj.VICMSST || stObj.vST || imposto.vBCST || prodData.vST || 0);

return {
nfQty: acc.nfQty + nfQty,
recQty: acc.recQty + receivedQty,
diff: acc.diff + diff,
totalNfAmount: acc.totalNfAmount + totalNfAmount,
totalFrete: acc.totalFrete + freightVal,
totalEncargos: acc.totalEncargos + ipiVal,
totalIcmsSt: acc.totalIcmsSt + stVal,
count: acc.count + 1,
};
},
{
nfQty: 0,
recQty: 0,
diff: 0,
totalNfAmount: 0,
totalFrete: 0,
totalEncargos: 0,
totalIcmsSt: 0,
count: 0
}
);

return (
<Table.Summary fixed>
<Table.Summary.Row style={{ backgroundColor: '#fafafa', fontWeight: 'bold' }}>
{/* 1. Item */}
<Table.Summary.Cell index={0}>
<Text style={{ fontSize: 11 }}>Totais ({totals.count})</Text>
</Table.Summary.Cell>

{/* 2. Cod. Interno */}
<Table.Summary.Cell index={1} />

{/* 3. EAN / SKU */}
<Table.Summary.Cell index={2} />

{/* 4. Produto / Nome */}
<Table.Summary.Cell index={3}>
<Text type="secondary" style={{ fontSize: 11 }}>Soma da Seleção:</Text>
</Table.Summary.Cell>


{/* 6. Qtd. Conferência (NF / Rec / Dif) */}
<Table.Summary.Cell index={5} align="center">
<div style={{ fontSize: 10, display: 'flex', justifyContent: 'space-between', gap: 4 }}>
<span>NF: {totals.nfQty}</span>
<span>Rec: {totals.recQty}</span>
<span style={{ color: totals.diff !== 0 ? '#fa8c16' : '#52c41a' }}>
Dif: {totals.diff > 0 ? `+${totals.diff}` : totals.diff}
</span>
</div>
</Table.Summary.Cell>

{/* 7. Composição */}
<Table.Summary.Cell index={6}>
<Text type="secondary" style={{ fontSize: 10 }}>Total Produtos:</Text>
<div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalNfAmount)}</div>

{totals.totalFrete > 0 && (
<>
<Text type="secondary" style={{ fontSize: 10 }}>Total Frete:</Text>
<div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalFrete)}</div>
</>
)}

{totals.totalEncargos > 0 && (
<>
<Text type="secondary" style={{ fontSize: 10 }}>Total IPI:</Text>
<div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalEncargos)}</div>
</>
)}

{totals.totalIcmsSt > 0 && (
<>
<Text type="secondary" style={{ fontSize: 10 }}>Total ICMS-ST:</Text>
<div style={{ fontSize: 11, color: '#595959' }}>{formatCurrency(totals.totalIcmsSt)}</div>
</>
)}
</Table.Summary.Cell>

{/* 8. Custo & Total */}
<Table.Summary.Cell index={7}>
<Text type="secondary" style={{ fontSize: 10 }}>Total Final (Rec):</Text>
<div style={{ fontSize: 12, color: '#52c41a', fontWeight: 'bold' }}>
{formatCurrency(totals.totalNfAmount + totals.totalFrete + totals.totalEncargos + totals.totalIcmsSt)}
</div>
</Table.Summary.Cell>




{/* 9. Ações */}
<Table.Summary.Cell index={8} />
</Table.Summary.Row>
</Table.Summary>
);
}}
/>
</div>

{/* ================= MODAL: DETALHES DE COMPOSIÇÃO DE CUSTO E TRIBUTOS ================= */}
<Modal
title="Vincular Código de Barras (GTIN)"
open={barcodeModalVisible}
onOk={handleSaveCustomGtin}
onCancel={() => setBarcodeModalVisible(false)}
okText="Vincular"
cancelText="Cancelar"
destroyOnClose
>
<div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
<div>
<Text type="secondary">Produto:</Text>
<div>
<Text strong>
{selectedItemForBarcode?.dados_xml?.descricao || 
selectedItemForBarcode?.prod?.xProd || 
selectedItemForBarcode?.xProd || 
'Produto não identificado'}
</Text>
</div>
</div>

<div>
<Text type="secondary">Código do fornecedor (XML):</Text>
<div>
<Text>
{selectedItemForBarcode?.dados_xml?.sku_original || 
selectedItemForBarcode?.prod?.cProd || 
selectedItemForBarcode?.cProd || 
'-'}
</Text>
</div>
</div>

<div>
<Text strong>Bipe ou digite o código de barras da caixa:</Text>
<Input
autoFocus
placeholder="Ex: 7891023456789"
value={inputValue}
onChange={(e) => setInputValue(e.target.value)}
onPressEnter={handleSaveCustomGtin}
style={{ marginTop: 6 }}
/>
</div>
</div>
</Modal>
<Modal
title={
<Space>
<DollarOutlined style={{ color: '#52c41a' }} />
<span>Composição Detalhada do Custo — Item #{itemForDetails?.nItem || itemForDetails?.tempId}</span>
</Space>
}
open={isItemDetailsModalOpen}
onCancel={() => setIsItemDetailsModalOpen(false)}
footer={[
<Button key="close" type="primary" onClick={() => setIsItemDetailsModalOpen(false)}>
Fechar
</Button>
]}
width={880}
destroyOnClose
>
{itemForDetails && (() => {
const prod = (itemForDetails as any).prod || itemForDetails;
const imposto = (itemForDetails as any).imposto || {};
const qtd = Number(prod.qCom || itemForDetails.quantidade || 1);
const totalProd = Number(prod.vProd || 0);
const unitBase = qtd > 0 ? totalProd / qtd : 0;
const freightOriginal = Number(itemForDetails.freightOriginal ?? prod.vFrete ?? 0);
const freightDistributed = Number(itemForDetails.freightDistributed || 0);
const freightPortion = Number(itemForDetails.freightAdded ?? (freightDistributed || freightOriginal));
const freightUnit = qtd > 0 ? freightPortion / qtd : 0;
const ipiObj = imposto.ipi?.IPITrib || imposto.ipi || {};
const ipiPortion = Number(ipiObj.vIPI || prod.vIPI || 0);
const ipiUnit = qtd > 0 ? ipiPortion / qtd : 0;
const stObj = imposto.icmsSt || imposto.ICMSST || imposto.icms || {};
const stPortion = Number(stObj.vICMSST || stObj.VICMSST || imposto.vBCST || prod.vST || 0);
const stUnit = qtd > 0 ? stPortion / qtd : 0;
const finalUnitCost = unitBase + freightUnit + ipiUnit + stUnit;
const icmsKey = Object.keys(imposto.icms || imposto.ICMS || {})[0];
const icmsData = imposto.icms?.[icmsKey] || imposto.ICMS?.[icmsKey] || imposto.icms || {};
const pisData = imposto.pis?.PISAliq || imposto.PIS?.pisaliq || imposto.pis || {};
const cofinsData = imposto.cofins?.COFINSAliq || imposto.COFINS?.cofinsaliq || imposto.cofins || {};
const ibsData = imposto.ibsCbs?.gIBSCBS || imposto.IBSCBS?.gIBSCBS || imposto.ibsCbs || {};

return (
<div>
<Alert
message={<Text strong style={{ fontSize: 14 }}>{prod.xProd || itemForDetails.descricao}</Text>}
description={
<Space size="large" style={{ marginTop: 6 }} wrap>
<Text type="secondary">SKU: <Text strong>{prod.cProd || itemForDetails.sku || 'N/A'}</Text></Text>
<Text type="secondary">EAN: <Text strong>{prod.cEAN || itemForDetails.ean || 'N/A'}</Text></Text>
<Text type="secondary">NCM: <Text strong>{prod.NCM || itemForDetails.ncm || 'N/A'}</Text></Text>
{prod.CEST && <Text type="secondary">CEST: <Text strong>{prod.CEST}</Text></Text>}
{prod.CFOP && <Text type="secondary">CFOP: <Text strong>{prod.CFOP}</Text></Text>}
</Space>
}
type="info"
style={{ marginBottom: 16 }}
/>

<div style={{ background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #f0f0f0', marginBottom: 16 }}>
<Title level={5} style={{ marginTop: 0, marginBottom: 8, color: '#1890ff' }}>
📊 Composição do Custo Unitário
</Title>
<Row gutter={16}>
<Col span={6}>
<Statistic
title="Valor Base (NF)"
value={unitBase}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 14 }}
/>
</Col>
<Col span={6}>
<Statistic
title="(+) Frete Rateado"
value={freightUnit}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 14, color: freightUnit > 0 ? '#1890ff' : undefined }}
/>
</Col>
<Col span={6}>
<Statistic
title="(+) Encargos (IPI/ST)"
value={ipiUnit + stUnit}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 14, color: (ipiUnit + stUnit) > 0 ? '#fa8c16' : undefined }}
/>
</Col>
<Col span={6}>
<Statistic
title="(=) Custo Unitário Final"
value={finalUnitCost}
precision={2}
prefix="R$"
valueStyle={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a' }}
/>
</Col>
</Row>
</div>

<Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
<Descriptions.Item label="Quantidade Comercializada">
<Tag color="blue">{qtd} {prod.uCom || itemForDetails.unidade || 'UN'}</Tag> (vUnCom: {Number(prod.vUnCom || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
</Descriptions.Item>
<Descriptions.Item label="Quantidade Tributável">
<Tag color="cyan">{prod.qTrib || qtd} {prod.uTrib || prod.uCom || 'UN'}</Tag> (vUnTrib: {Number(prod.vUnTrib || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
</Descriptions.Item>
<Descriptions.Item label="Valor Bruto dos Produtos (vProd)">
{Number(totalProd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Valor Total da Tag do Item (vItem)">
{Number(itemForDetails.valorTotal || itemForDetails.vItem || totalProd).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Frete Alocado ao Item">
{Number(freightPortion).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Frete Original (XML)">
{freightOriginal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Frete Distribuído">
{freightDistributed.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="IPI (Trib / Enq)">
{Number(ipiPortion).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} <Text type="secondary">(CST: {ipiObj.CST || 'N/A'} | Alíq: {ipiObj.pIPI ? `${ipiObj.pIPI}%` : '0%'})</Text>
</Descriptions.Item>
<Descriptions.Item label="Substituição Tributária (ST)">
{Number(stPortion).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
<Descriptions.Item label="Código EAN Tributável">
{prod.cEANTrib || prod.cEAN || 'N/A'}
</Descriptions.Item>
{prod.vDesc ? (
<Descriptions.Item label="Desconto Aplicado" span={2}>
{Number(prod.vDesc).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
</Descriptions.Item>
) : null}
{prod.infAdProd ? (
<Descriptions.Item label="Informações Adicionais do Item" span={2}>
<Text italic>{prod.infAdProd}</Text>
</Descriptions.Item>
) : null}
</Descriptions>

<Title level={5} style={{ marginBottom: 8, fontSize: 13, color: '#595959' }}>
🛡️ Detalhamento Tributário e Fiscais Detectados no XML
</Title>
<Descriptions bordered size="small" column={1}>
<Descriptions.Item label="ICMS">
{icmsData.CST || icmsData.CSOSN ? (
<Space wrap>
<Tag color="purple">CST/CSOSN: {icmsData.CST || icmsData.CSOSN}</Tag>
<Tag>Origem: {icmsData.orig ?? '0'}</Tag>
<Tag>Base (vBC): {Number(icmsData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
<Tag>Alíquota: {icmsData.pICMS ? `${icmsData.pICMS}%` : '0%'}</Tag>
<Tag color="green">Valor (vICMS): {Number(icmsData.vICMS || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
</Space>
) : (
<Text type="secondary">Nenhum detalhe de ICMS mapeado para este item.</Text>
)}
</Descriptions.Item>

<Descriptions.Item label="PIS / COFINS">
<Space wrap>
{pisData.vPIS || pisData.CST ? (
<Tag color="blue">PIS - CST: {pisData.CST || 'N/A'} | Base: {Number(pisData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Vl: {Number(pisData.vPIS || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
) : null}
{cofinsData.vCOFINS || cofinsData.CST ? (
<Tag color="geekblue">COFINS - CST: {cofinsData.CST || 'N/A'} | Base: {Number(cofinsData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Vl: {Number(cofinsData.vCOFINS || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
) : null}
{!pisData.vPIS && !cofinsData.vPIS && <Text type="secondary">Sem dados de PIS/COFINS estruturados no item.</Text>}
</Space>
</Descriptions.Item>

{Object.keys(ibsData).length > 0 && (
<Descriptions.Item label="IBS / CBS (Reforma Tributária)">
<Space wrap>
<Tag color="volcano">CST: {imposto.IBSCBS?.CST || '000'} | vBC: {Number(ibsData.vBC || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>
{ibsData.vCBS && <Tag>vCBS: {Number(ibsData.vCBS).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>}
{ibsData.vIBS && <Tag>vIBS: {Number(ibsData.vIBS).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>}
{ibsData.vIBSUF && <Tag>vIBS UF: {Number(ibsData.vIBSUF).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Tag>}
</Space>
</Descriptions.Item>
)}
</Descriptions>
</div>
);
})()}
</Modal>

{/* ================= AÇÕES EM LOTE ================= */}
<ModalCadastroRapido
open={loteAberto === 'cadastro'}
itens={itensSelecionados}
classificacaoInicial={classificacaoParaCadastro}
onClose={() => { setLoteAberto(null); setClassificacaoParaCadastro(null); }}
onConfirmar={(linhas, opcoes) => { onCadastroRapidoLote?.(linhas, opcoes); setLoteAberto(null); setClassificacaoParaCadastro(null); setSelectedRowKeys([]); }}
/>
<ModalClassificarLote
open={loteAberto === 'classificar'}
itens={itensSelecionados}
onClose={() => setLoteAberto(null)}
onConfirmar={(linhas, classificacao, porItem) => { onClassificarLote?.(linhas, classificacao, false, porItem); setLoteAberto(null); setSelectedRowKeys([]); }}
onCadastroRapido={c => { setClassificacaoParaCadastro(c); setLoteAberto('cadastro'); }}
/>
<ModalClassificarLote
open={Boolean(linhaClassificar)}
itens={linhaClassificar ? [linhaClassificar] : []}
inicial={linhaClassificar?.mapeamento?.draftIdentity ? {
familiaId: linhaClassificar.mapeamento.draftIdentity.familia_id ?? null,
categoriaId: linhaClassificar.mapeamento.draftIdentity.categoria_id ?? null,
atributos: linhaClassificar.mapeamento.draftIdentity.atributos ?? null,
} : null}
onClose={() => setLinhaClassificar(null)}
onConfirmar={(linhas, classificacao) => { onClassificarLote?.(linhas, classificacao, true); setLinhaClassificar(null); }}
/>

<ModalDefinirUnidade
sigla={siglaDefinindo}
cnpj={cnpjFornecedor}
fornecedorCadastrado={unidadesNota.idFornecedor !== null}
unidades={unidadesNota.unidades}
atual={siglaDefinindo ? unidadesNota.resolucoes[siglaDefinindo] : undefined}
onFechar={() => setSiglaDefinindo(null)}
onSalvo={() => { setSiglaDefinindo(null); unidadesNota.recarregar(); }}
/>

{/* Linhas novas com o mesmo SKU: confirmar agrupamento ou reclassificar */}
<Modal
open={!!grupoAberto}
onCancel={() => setGrupoSku(null)}
title={`SKU ${grupoSku} em ${grupoAberto?.linhas.length || 0} linhas: estes itens são o mesmo produto?`}
width={760}
destroyOnHidden
footer={grupoAberto ? [
<Button key="v" onClick={() => setGrupoSku(null)}>Voltar</Button>,
grupoAberto.confirmado
? <Button key="d" danger disabled={readOnly} onClick={() => { onConfirmarAgrupamento?.(grupoAberto.linhas.map(l => l.tempId), null); setGrupoSku(null); }}>Desfazer agrupamento</Button>
: <Button key="c" type="primary" disabled={readOnly} onClick={() => { onConfirmarAgrupamento?.(grupoAberto.linhas.map(l => l.tempId), grupoSku); setGrupoSku(null); }}>Sim, são o mesmo produto (agrupar)</Button>,
] : null}
>
{grupoAberto && (
<Space direction="vertical" style={{ width: '100%' }}>
{!grupoAberto.mesmoProduto && (
<Alert type="error" showIcon message="Código e descrição do fornecedor são diferentes entre as linhas: confira com cuidado antes de agrupar." />
)}
<Table
size="small"
rowKey="tempId"
pagination={false}
dataSource={grupoAberto.linhas}
columns={[
{ title: 'Linha', dataIndex: 'nItem', width: 55 },
{ title: 'Código forn.', dataIndex: 'sku', width: 110 },
{ title: 'Descrição do fornecedor', dataIndex: 'descricao' },
{ title: 'Qtd', key: 'q', width: 90, align: 'right' as const, render: (_: unknown, l: Item) => `${Number(l.quantidade).toLocaleString('pt-BR')} ${l.unidadeMedida || ''}` },
{ title: 'Unit.', key: 'u', width: 90, align: 'right' as const, render: (_: unknown, l: Item) => formatCurrency(Number(l.valorUnitario) || 0) },
{
title: '', key: 'r', width: 110,
render: (_: unknown, l: Item) => (
<Button size="small" disabled={readOnly} onClick={() => { setGrupoSku(null); handleOpenMappingModal([l.tempId]); }}>Reclassificar</Button>
),
},
]}
/>
<Text type="secondary" style={{ fontSize: 12 }}>
Mesmo produto: as linhas entram como um único item no catálogo e as quantidades somam no estoque (vale o cadastro da primeira linha).
Produtos diferentes: clique em Reclassificar na linha errada e mude o SKU Customizado ou vincule a outro item.
</Text>
</Space>
)}
</Modal>

{/* ================= MODAL DE MAPEAMENTO EM FILA ================= */}
{isMappingModalOpen && (
<ProductMappingModal
items={itemsToMapQueue}
supplierCnpj="00.000.000/0001-00" // Ajuste conforme a prop de CNPJ do seu componente pai se disponível
onMap={(tempId, data) => handleConfirmMappingItem(tempId, data)}
onClose={() => {
setIsMappingModalOpen(false);
setItemsToMapQueue([]);
setSelectedRowKeys([]); // Limpa a seleção após concluir o lote
}}
/>
)}

</div>
);
};

export default ItemsConference;