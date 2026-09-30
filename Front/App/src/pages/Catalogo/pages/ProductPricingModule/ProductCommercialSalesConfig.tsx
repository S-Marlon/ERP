import {
Card,
Input,
InputNumber,
Select,
Button,
Row,
Col,
Space,
Divider,
Typography,
Modal,
message,
Tabs,
Tag,
Alert,
Switch,
Radio,
Spin,
Empty
} from 'antd';
import {
AppstoreAddOutlined,
DeleteOutlined,
PlusOutlined,
SettingOutlined,
CalculatorOutlined,
CodeOutlined,
DollarOutlined,
EditOutlined,
RightOutlined,
LockOutlined
} from '@ant-design/icons';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
atualizarCustoGerencial,
buscarItens,
carregarConfigVendas,
salvarConfigVendas,
ConfigVendasApi,
CustosApi,
ItemBusca,
SalvarConfigPayload
} from './configVendas.api';
import {
configParaEstado,
estadoParaPayload,
sincronizarRascunho,
RascunhoVendas,
SaleUnitConfig,
TierRuleRecord
} from './configVendas.mapper';
import { validarGtin } from '../../../Compras/StockEntry/gtin';

const { Title, Text, Paragraph } = Typography;

interface ProductCommercialSalesConfigProps {
// Item do catálogo (itens_core.id_item). Sem ele, o componente mostra a busca de produto.
idItem?: number;
// Modo rascunho: item ainda não existe (mapeamento da NF). Nada é gravado aqui; a configuração
// é devolvida por onRascunhoChange e aplicada na aprovação da Staging.
rascunho?: RascunhoVendas & { nomeItem?: string };
onRascunhoChange?: (payload: SalvarConfigPayload) => void;
}

const formatBRL = (v: number | null | undefined) =>
Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const ProductCommercialSalesConfig: React.FC<ProductCommercialSalesConfigProps> = ({ idItem, rascunho, onRascunhoChange }) => {
const modoRascunho = Boolean(rascunho);

// Item carregado do banco e situação do custo (defasagem frente às últimas NFs)
const [selectedItem, setSelectedItem] = useState<ConfigVendasApi['item'] | null>(null);
const [custos, setCustos] = useState<CustosApi | null>(null);
const [defasagemIgnorada, setDefasagemIgnorada] = useState(false);
const [loadingConfig, setLoadingConfig] = useState(false);
const [saving, setSaving] = useState(false);
const [itemOptions, setItemOptions] = useState<ItemBusca[]>([]);
const [searchingItems, setSearchingItems] = useState(false);
const searchAbort = useRef<AbortController | null>(null);

// Custo gerencial (por unidade base): referência do preço de venda
const [purchaseCost, setPurchaseCost] = useState<number>(0);
const [unitsConfig, setUnitsConfig] = useState<SaleUnitConfig[]>([]);

const [simUnitKey, setSimUnitKey] = useState<string>('');
const [simQuantity, setSimQuantity] = useState<number>(1);

const [activeTabKey, setActiveTabKey] = useState<string>('');
const [isPayloadModalVisible, setIsPayloadModalVisible] = useState<boolean>(false);

const [isUnitModalVisible, setIsUnitModalVisible] = useState<boolean>(false);
const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
const [editingUnitKey, setEditingUnitKey] = useState<string | null>(null);

const [formUnitKey, setFormUnitKey] = useState<string>('');
const [formUnitName, setFormUnitName] = useState<string>('');
const [formConversionFactor, setFormConversionFactor] = useState<number>(150);
const [formRetailMarkup, setFormRetailMarkup] = useState<number>(1.8);
const [formAllowWholesale, setFormAllowWholesale] = useState<boolean>(true);
const [formEnabled, setFormEnabled] = useState<boolean>(true);
const [formGtin, setFormGtin] = useState<string>('');

const [tierRules, setTierRules] = useState<TierRuleRecord[]>([]);

const baseUnit = useMemo(() => unitsConfig.find(u => u.isBase) || null, [unitsConfig]);
const baseLabel = baseUnit ? baseUnit.unitKey : (selectedItem?.sigla_base || 'base');
const precoVarejoBase = baseUnit ? (tierRules.find(t => t.unitKey === baseUnit.unitKey)?.unitPrice ?? 0) : 0;
// Unidade em edição/criação é a base? (fator travado em 1)
const formIsBase = modalMode === 'edit'
? Boolean(unitsConfig.find(u => u.unitKey === editingUnitKey)?.isBase)
: !baseUnit;

const aplicarConfig = (config: ConfigVendasApi) => {
const estado = configParaEstado(config);
setSelectedItem(config.item);
setCustos(config.custos);
setDefasagemIgnorada(false);
setPurchaseCost(estado.custo);
setUnitsConfig(estado.units);
setTierRules(estado.tiers);
const primeira = estado.units.find(u => u.isBase) || estado.units[0];
setActiveTabKey(primeira?.unitKey || '');
setSimUnitKey(primeira?.unitKey || '');
};

const carregarItem = async (id: number) => {
setLoadingConfig(true);
try {
aplicarConfig(await carregarConfigVendas(id));
} catch (err: any) {
message.error(err.message || 'Erro ao carregar a configuração de vendas.');
} finally {
setLoadingConfig(false);
}
};

useEffect(() => {
if (idItem) carregarItem(idItem);
}, [idItem]);

// Rascunho: unidade base, unidade da NF (com fator) e custo base sempre coerentes com a conversão de compra
useEffect(() => {
if (!rascunho) return;
const sincronizado = sincronizarRascunho(unitsConfig, tierRules, rascunho);
setUnitsConfig(sincronizado.units);
setTierRules(sincronizado.tiers);
setPurchaseCost(sincronizado.custo);
if (!sincronizado.units.some(u => u.unitKey === activeTabKey)) {
setActiveTabKey(sincronizado.units[0]?.unitKey || '');
setSimUnitKey(sincronizado.units[0]?.unitKey || '');
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [rascunho?.unidadeBase, rascunho?.unidadeCompra, rascunho?.fatorCompra, rascunho?.custoUnidadeCompra]);

useEffect(() => {
if (modoRascunho && unitsConfig.length > 0) {
onRascunhoChange?.(estadoParaPayload(unitsConfig, tierRules, purchaseCost));
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [modoRascunho, unitsConfig, tierRules, purchaseCost]);

const handleSearchItems = (termo: string) => {
searchAbort.current?.abort();
if (termo.trim().length < 2) {
setItemOptions([]);
return;
}
const controller = new AbortController();
searchAbort.current = controller;
setSearchingItems(true);
buscarItens(termo.trim(), 1, controller.signal)
.then(setItemOptions)
.catch(err => { if (err.name !== 'AbortError') message.error(err.message); })
.finally(() => { if (!controller.signal.aborted) setSearchingItems(false); });
};

const handleSalvar = async () => {
if (!selectedItem) return;
if (!baseUnit) {
message.warning('Defina a unidade base do item (botão "Novo") antes de salvar.');
return;
}
setSaving(true);
try {
aplicarConfig(await salvarConfigVendas(selectedItem.id_item, estadoParaPayload(unitsConfig, tierRules, purchaseCost)));
message.success('Configuração de vendas salva.');
} catch (err: any) {
message.error(err.message || 'Erro ao salvar a configuração de vendas.');
} finally {
setSaving(false);
}
};

// Decisão do gestor diante da defasagem: atualiza o custo gerencial e recalcula as faixas (markup mantido)
const handleAtualizarCusto = async (novoCusto: number) => {
if (!selectedItem) return;
setSaving(true);
try {
const resp = await atualizarCustoGerencial(selectedItem.id_item, novoCusto);
aplicarConfig(resp);
message.success(resp.message || 'Custo atualizado.');
} catch (err: any) {
message.error(err.message || 'Erro ao atualizar o custo.');
} finally {
setSaving(false);
}
};

const enabledUnitsForSimulation = useMemo(() => unitsConfig.filter(u => u.enabled), [unitsConfig]);

// Se a aba ativa atual foi desativada, mantemos ela selecionada para o usuário ver o aviso de bloqueio, 
// mas se ele abrir o componente, garantimos que a aba inicial seja válida.
const activeUnitDef = useMemo(() => unitsConfig.find(u => u.unitKey === activeTabKey), [unitsConfig, activeTabKey]);

const marginIntelligence = useMemo(() => {
let lowestMargin = 100;
let highestMargin = 0;

const enrichedTiers = tierRules.map(tier => {
const unitDef = unitsConfig.find(u => u.unitKey === tier.unitKey);
if (!unitDef || !unitDef.enabled) return null;

const unitCost = purchaseCost * unitDef.conversionFactor;
const unitPrice = tier.unitPrice;
const profitPerUnit = unitPrice - unitCost;
const marginPercentage = unitPrice > 0 ? (profitPerUnit / unitPrice) * 100 : 0;

if (marginPercentage < lowestMargin) lowestMargin = marginPercentage;
if (marginPercentage > highestMargin) highestMargin = marginPercentage;

return {
...tier,
unitName: unitDef.unitName,
unitCost,
profitPerUnit,
marginPercentage
};
}).filter(Boolean);

const avgMargin = enrichedTiers.length > 0 
? enrichedTiers.reduce((acc, t) => acc + (t?.marginPercentage || 0), 0) / enrichedTiers.length 
: 0;

return {
enrichedTiers,
avgMargin,
lowestMargin: enrichedTiers.length > 0 ? lowestMargin : 0,
highestMargin: enrichedTiers.length > 0 ? highestMargin : 0,
};
}, [tierRules, unitsConfig, purchaseCost]);

const handleOpenCreateUnitModal = () => {
setModalMode('create');
setEditingUnitKey(null);
setFormUnitKey('');
setFormUnitName('');
setFormConversionFactor(150);
setFormRetailMarkup(1.8);
setFormAllowWholesale(true);
setFormEnabled(true);
setFormGtin('');
setIsUnitModalVisible(true);
};

const handleOpenEditUnitModal = (unit: SaleUnitConfig) => {
setModalMode('edit');
setEditingUnitKey(unit.unitKey);
setFormUnitKey(unit.unitKey);
setFormUnitName(unit.unitName);
setFormConversionFactor(unit.conversionFactor);
setFormRetailMarkup(unit.retailMarkup);
setFormAllowWholesale(unit.allowWholesale);
setFormEnabled(unit.enabled);
setFormGtin(unit.gtin || '');
setIsUnitModalVisible(true);
};

const handleSaveUnit = () => {
if (!formUnitKey || !formUnitName) {
message.error('Preencha a sigla e o nome da unidade!');
return;
}
if (formGtin && !validarGtin(formGtin)) {
message.error('GTIN inválido: confira os dígitos (tamanho 8, 12, 13 ou 14 e dígito verificador).');
return;
}
const gtinRepetido = unitsConfig.some(u => u.gtin && u.gtin === formGtin && u.unitKey !== editingUnitKey);
if (formGtin && gtinRepetido) {
message.error('Este GTIN já está em outra unidade deste item.');
return;
}

if (modalMode === 'create') {
if (unitsConfig.some(u => String(u.unitKey).toUpperCase() === formUnitKey.toUpperCase())) {
message.error('Já existe uma unidade com esta sigla cadastrada!');
return;
}

// A primeira unidade do item vira a base (fator 1); as demais são embalagens/frações sobre ela
const fatorNovo = formIsBase ? 1 : formConversionFactor;
const customUnit: SaleUnitConfig = {
unitKey: formUnitKey.toUpperCase(),
unitName: formUnitName,
enabled: formEnabled,
allowWholesale: formAllowWholesale,
conversionFactor: fatorNovo,
retailMarkup: formRetailMarkup,
isBase: formIsBase,
gtin: formGtin,
padraoPdv: formIsBase,
};

setUnitsConfig([...unitsConfig, customUnit]);

const newRulesList = [
...tierRules,
{
key: String(Date.now() + 1),
unitKey: customUnit.unitKey,
tierType: 'retail' as const,
minQuantity: 0,
maxQuantity: 'INF' as const,
markupOrDiscount: formRetailMarkup,
unitPrice: (purchaseCost * fatorNovo) * formRetailMarkup,
}
];

setTierRules(newRulesList);
setActiveTabKey(customUnit.unitKey);
message.success('Nova unidade criada com sucesso!');
} else {
setUnitsConfig(unitsConfig.map(u => {
if (u.unitKey === editingUnitKey) {
return {
...u,
unitName: formUnitName,
conversionFactor: u.isBase ? 1 : formConversionFactor,
retailMarkup: formRetailMarkup,
allowWholesale: formAllowWholesale,
enabled: formEnabled,
gtin: formGtin,
};
}
return u;
}));

setTierRules(tierRules.map(tier => {
if (tier.unitKey === editingUnitKey && tier.minQuantity === 0) {
return {
...tier,
markupOrDiscount: formRetailMarkup,
unitPrice: (purchaseCost * (formIsBase ? 1 : formConversionFactor)) * formRetailMarkup,
};
}
return tier;
}));

message.success('Unidade atualizada com sucesso!');
}

setIsUnitModalVisible(false);
};

const handleProductChange = (id: number) => {
carregarItem(id);
};

const handleCostChange = (val: number | null) => {
const newCost = val ?? 0;
setPurchaseCost(newCost);
setTierRules(
tierRules.map(tier => {
const unitDef = unitsConfig.find(u => u.unitKey === tier.unitKey);
const factor = unitDef ? unitDef.conversionFactor : 1;
return {
...tier,
unitPrice: (newCost * factor) * tier.markupOrDiscount,
};
})
);
};

const addTierRuleForUnit = (targetUnitKey: string) => {
const unitRules = tierRules.filter(t => t.unitKey === targetUnitKey);

if (unitRules.length >= 3) {
message.warning('Cada corrente pode ter no máximo 3 gomos.');
return;
}

const lastRule = unitRules[unitRules.length - 1];
let previousMaxNum = 10;
if (lastRule && lastRule.maxQuantity !== 'INF') {
previousMaxNum = Number(lastRule.maxQuantity);
}

const suggestedMin = previousMaxNum + 1;
const unitDef = unitsConfig.find(u => u.unitKey === targetUnitKey);
const factor = unitDef ? unitDef.conversionFactor : 1;
const defaultMarkup = 1.6;

const updatedTierRules = tierRules.map(rule => {
if (rule.key === lastRule?.key) {
return { ...rule, maxQuantity: previousMaxNum };
}
return rule;
});

const newRule: TierRuleRecord = {
key: String(Date.now()),
unitKey: targetUnitKey,
tierType: 'wholesale',
minQuantity: suggestedMin,
maxQuantity: 'INF',
markupOrDiscount: defaultMarkup,
unitPrice: (purchaseCost * factor) * defaultMarkup,
};

setTierRules([...updatedTierRules, newRule]);
message.success(`Novo gomo encadeado adicionado para ${targetUnitKey}`);
};

const removeTierRule = useCallback((key: string) => {
setTierRules((prev) => {
const targetRule = prev.find(item => item.key === key);
if (!targetRule) return prev;

const unitRules = prev.filter(item => item.unitKey === targetRule.unitKey);
const isFirst = unitRules[0]?.key === key;
const filtered = prev.filter((item) => item.key !== key);

if (isFirst) {
const remainingUnitRules = filtered.filter(item => item.unitKey === targetRule.unitKey);
if (remainingUnitRules.length > 0) {
const firstRemainingKey = remainingUnitRules[0].key;
return filtered.map(item => item.key === firstRemainingKey ? { ...item, minQuantity: 0 } : item);
}
}

const remainingUnitRules = filtered.filter(item => item.unitKey === targetRule.unitKey);
if (remainingUnitRules.length > 0) {
const lastRemaining = remainingUnitRules[remainingUnitRules.length - 1];
return filtered.map(item => item.key === lastRemaining.key ? { ...item, maxQuantity: 'INF' } : item);
}

return filtered;
});
}, []);

const handleUpdateTierLimit = (ruleKey: string, field: 'minQuantity' | 'maxQuantity', value: number | 'INF') => {
setTierRules(prevRules => {
const rulesCopy = [...prevRules];
const targetIndex = rulesCopy.findIndex(t => t.key === ruleKey);
if (targetIndex === -1) return prevRules;

const currentRule = rulesCopy[targetIndex];
const unitRules = rulesCopy.filter(t => t.unitKey === currentRule.unitKey);
const unitRuleIndex = unitRules.findIndex(t => t.key === ruleKey);

if (unitRuleIndex === 0 && field === 'minQuantity') {
value = 0;
}

rulesCopy[targetIndex] = { ...currentRule, [field]: value };

const currentMax = rulesCopy[targetIndex].maxQuantity;
const currentMin = rulesCopy[targetIndex].minQuantity;
if (currentMax !== 'INF' && currentMin > currentMax) {
if (field === 'minQuantity') {
rulesCopy[targetIndex].maxQuantity = currentMin;
} else {
rulesCopy[targetIndex].minQuantity = currentMin;
}
}

for (let i = unitRuleIndex; i < rulesCopy.length - 1; i++) {
const current = rulesCopy.find(r => r.key === unitRules[i]?.key);
const next = rulesCopy.find(r => r.key === unitRules[i + 1]?.key);

if (current && next && current.unitKey === next.unitKey) {
const nextIndex = rulesCopy.findIndex(r => r.key === next.key);
if (nextIndex !== -1 && current.maxQuantity !== 'INF') {
const expectedMin = Number(current.maxQuantity) + 1;
const nextMax = rulesCopy[nextIndex].maxQuantity;
rulesCopy[nextIndex] = {
...rulesCopy[nextIndex],
minQuantity: expectedMin,
maxQuantity: nextMax !== 'INF' ? Math.max(expectedMin, Number(nextMax)) : 'INF'
};
}
}
}

return rulesCopy;
});
};

const simulationResult = useMemo(() => {
const unitDef = unitsConfig.find(u => u.unitKey === simUnitKey);
if (!unitDef || !unitDef.enabled) return { error: 'Unidade inativa ou não encontrada' };

const applicableRules = tierRules.filter(t => t.unitKey === simUnitKey);
const matchedRule = applicableRules.find(r => {
const min = r.minQuantity;
const max = r.maxQuantity;
if (max === 'INF') return simQuantity >= min;
return simQuantity >= min && simQuantity <= Number(max);
});

if (!matchedRule) {
const fallbackRule = applicableRules[applicableRules.length - 1];
if (!fallbackRule) return { error: 'Nenhuma regra de faixa configurada' };

return {
unitName: unitDef.unitName,
channel: fallbackRule.tierType === 'wholesale' ? 'Atacado' : 'Varejo',
unitPrice: fallbackRule.unitPrice,
totalValue: fallbackRule.unitPrice * simQuantity,
baseStockImpact: simQuantity * unitDef.conversionFactor,
matchedRule: fallbackRule
};
}

return {
unitName: unitDef.unitName,
channel: matchedRule.tierType === 'wholesale' ? 'Atacado' : 'Varejo',
unitPrice: matchedRule.unitPrice,
totalValue: matchedRule.unitPrice * simQuantity,
baseStockImpact: simQuantity * unitDef.conversionFactor,
matchedRule
};
}, [simUnitKey, simQuantity, tierRules, unitsConfig]);

const generatePayloadJSON = () => {
if (!selectedItem) return '{}';
return JSON.stringify({
id_item: selectedItem.id_item,
sku: selectedItem.sku,
...estadoParaPayload(unitsConfig, tierRules, purchaseCost)
}, null, 2);
};

return (
<div style={{ padding: 0, background: '#f5f7fa' }}>

{/* CABEÇALHO UNIFICADO */}
<Card 
bordered={false} 
style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}
bodyStyle={{ padding: '4px' }}
>
<Row gutter={[2, 2]} align="middle">
<Col xs={24} md={8}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
<Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>Produto /as SKU</Text>
{modoRascunho ? (
<div>
<Text strong>{rascunho?.nomeItem || 'Novo item'}</Text>{' '}
<Tag color="processing" style={{ margin: 0 }}>Rascunho: gravado na aprovação da Staging</Tag>
</div>
) : (
<Select
style={{ width: '100%' }}
size="medium"
placeholder="Buscar produto por SKU ou nome..."
value={selectedItem?.id_item}
onChange={handleProductChange}
onSearch={handleSearchItems}
filterOption={false}
showSearch
disabled={Boolean(idItem)}
loading={searchingItems || loadingConfig}
notFoundContent={searchingItems ? <Spin size="small" /> : 'Digite ao menos 2 caracteres'}
options={[
...(selectedItem && !itemOptions.some(o => o.id === selectedItem.id_item)
? [{ value: selectedItem.id_item, label: `${selectedItem.sku} · ${selectedItem.nome}` }]
: []),
...itemOptions.map(o => ({ value: o.id, label: `${o.sku} · ${o.name}` }))
]}
/>
)}
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Text type="secondary" style={{fontSize: 11,  fontWeight: 500 }}>Custo Base ({baseLabel})</Text>
<InputNumber
size="medium"
prefix={<DollarOutlined style={{ color: '#bfbfbf' }} />}
value={purchaseCost}
precision={4}
disabled={modoRascunho}
onChange={handleCostChange}
/>
</div>  
</Col>

{/* <Col xs={24} sm={12} md={8}>


<Space orientation='vertical'>


<Col xs={24} sm={12} md={24}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Custo Base ({baseLabel})</Text>
<InputNumber
style={{ width: '100%' }}
size="large"
prefix={<DollarOutlined style={{ color: '#bfbfbf' }} />}
value={purchaseCost}
precision={2}
onChange={handleCostChange}
/>
</div>
</Col>

<Col xs={24} sm={12} md={24}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Preço de Venda ({baseLabel})</Text>
<InputNumber
style={{ width: '100%' }}
size="large"
prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
value={precoVarejoBase}
precision={2}
disabled
/>
</div>
</Col>

</Space>  
</Col> */}

<Col xs={24} md={9}>
<Space orientation='vertical' style={{ 
background: '#fafafa', 
border: '1px solid #f0f0f0', 
borderRadius: 8, 
padding: '10px 16px', 
display: 'flex', 
flexDirection: 'column', 
justifyContent: 'center',
gap: 6
}}>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

<Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>Preço de Venda ({baseLabel})</Text>
<InputNumber
size="medium"
prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
value={precoVarejoBase}
precision={2}
disabled
/>
</div>


<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>



<Text type="secondary" style={{ fontSize: 12 }}>Margem Média Geral</Text>
<Text strong style={{ color: marginIntelligence.avgMargin < 20 ? '#faad14' : '#3f8600', fontSize: 14 }}>
{marginIntelligence.avgMargin.toFixed(1)}%
</Text>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Text type="secondary" style={{ fontSize: 12 }}>Amplitude (Min / Máx)</Text>
<Text strong style={{ color: '#1890ff', fontSize: 12 }}>
{marginIntelligence.lowestMargin.toFixed(0)}% / {marginIntelligence.highestMargin.toFixed(0)}%
</Text>
</div>
</Space>

</Col>


<Col xs={24} md={7}>
<div style={{ 
background: '#fafafa', 
border: '1px solid #f0f0f0', 
borderRadius: 8, 
padding: '10px 16px', 
display: 'flex', 
flexDirection: 'column', 
justifyContent: 'center',
gap: 6
}}>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

<Space orientation='vertical'>
<Button size="small" icon={<CodeOutlined />} onClick={() => setIsPayloadModalVisible(true)}>
Visualizar JSON Payload
</Button>
<Button type="primary" size="small" icon={<AppstoreAddOutlined />} onClick={handleSalvar} loading={saving} disabled={!selectedItem || modoRascunho}>
Salvar Configuração
</Button>
</Space>



</div>
</div>
</Col>



</Row>
</Card>

{custos?.defasado && !defasagemIgnorada && (
<Alert
type="warning"
showIcon
style={{ margin: '6px 0' }}
message={custos.custoGerencial ? 'Custo desatualizado pelas últimas entradas de NF' : 'Item sem custo gerencial definido'}
description={
<Space size={16} wrap style={{ fontSize: 12 }}>
<span>Custo gerencial (preço atual): <b>{custos.custoGerencial ? formatBRL(custos.custoGerencial) : '—'}</b></span>
{custos.ultimoCusto !== null && (
<span>Último custo (NF): <b>{formatBRL(custos.ultimoCusto)}</b>{custos.variacaoUltimoPct !== null ? ` (${custos.variacaoUltimoPct > 0 ? '+' : ''}${custos.variacaoUltimoPct}%)` : ''}</span>
)}
{custos.custoMedio !== null && (
<span>Custo médio: <b>{formatBRL(custos.custoMedio)}</b>{custos.variacaoMedioPct !== null ? ` (${custos.variacaoMedioPct > 0 ? '+' : ''}${custos.variacaoMedioPct}%)` : ''}</span>
)}
</Space>
}
action={
<Space direction="vertical" size={4}>
{custos.ultimoCusto !== null && (
<Button size="small" type="primary" loading={saving} onClick={() => handleAtualizarCusto(custos.ultimoCusto as number)}>
Usar último custo
</Button>
)}
{custos.custoMedio !== null && (
<Button size="small" loading={saving} onClick={() => handleAtualizarCusto(custos.custoMedio as number)}>
Usar custo médio
</Button>
)}
<Button size="small" type="text" onClick={() => setDefasagemIgnorada(true)}>
Manter defasado
</Button>
</Space>
}
/>
)}

{!selectedItem && !modoRascunho ? (
<div style={{ padding: 32, background: '#fafafa', borderRadius: 6, marginTop: 6 }}>
<Spin spinning={loadingConfig}>
<Empty description="Selecione um produto do catálogo para configurar unidades de venda e preços." />
</Spin>
</div>
) : (
<Spin spinning={loadingConfig}>
{!baseUnit && (
<Alert
type="info"
showIcon
style={{ margin: '6px 0' }}
message="Item sem unidade base"
description='Cadastre a unidade base de estoque (ex: UN, MT, KG) pelo botão "Novo". As demais unidades (caixa, rolo...) são definidas como múltiplos dela.'
/>
)}
{/* SEÇÃO PRINCIPAL */}
<div style={{ borderRadius: 6 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
{/* <Space>
<SettingOutlined style={{ color: '#1890ff' }} />
<Text strong>1. Unidades de Comercialização e Correntes de Preço</Text>
</Space> */}
</div>

<Row gutter={2}>
{/* BARRA LATERAL ESQUERDA (Exibe ativas e inativas) */}
<Col xs={24} md={7} lg={24}>
<div style={{ background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px', display: 'flex', flexDirection: 'row', gap: 2, flexWrap: 'wrap' }}>
<div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, width: '100%' }}>
<Text type="secondary" strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
<CalculatorOutlined /> Unidades de Comercialização e Correntes de Preço
</Text>
<Space size={6}>
<Tag style={{ margin: 0 }}>{unitsConfig.length} total</Tag>
<Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenCreateUnitModal} size='small'>
Novo
</Button>
</Space>
</div>

<div style={{ display: 'flex', flexDirection: 'row', gap: 6, width: '100%', overflowX: 'auto', paddingBottom: 4 }}>
{unitsConfig.map((unit) => {
const factor = unit.conversionFactor;
const unitCost = purchaseCost * factor;
const unitRule = tierRules.find(t => t.unitKey === unit.unitKey);
const unitPrice = unitRule ? unitRule.unitPrice : unitCost * unit.retailMarkup;
const unitProfit = unitPrice - unitCost;
const unitMarginPct = unitPrice > 0 ? (unitProfit / unitPrice) * 100 : 0;
const isCurrentTab = activeTabKey === unit.unitKey;

return (
<div 
key={unit.unitKey}
onClick={() => setActiveTabKey(unit.unitKey)}
style={{ 
minWidth: 160,
background: unit.enabled ? (isCurrentTab ? '#ffffff' : '#f6ffed') : '#f5f5f5', 
border: isCurrentTab ? '2px solid #1890ff' : (unit.enabled ? '1px solid #b7eb8f' : '1px dashed #d9d9d9'), 
borderRadius: 6, 
padding: '6px 8px', 
display: 'flex',
flexDirection: 'column',
gap: 4,
cursor: 'pointer',
transition: 'all 0.2s',
opacity: unit.enabled ? 1 : 0.6,
boxShadow: isCurrentTab ? '0 2px 8px rgba(24, 144, 255, 0.15)' : 'none'
}}
>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Text strong style={{ color: unit.enabled ? (isCurrentTab ? '#096dd9' : '#262626') : '#8c8c8c', fontSize: 13 }}>
{unit.unitName} ({unit.unitKey})
</Text>
{unit.enabled ? (
isCurrentTab && <RightOutlined style={{ color: '#1890ff', fontSize: 12 }} />
) : (
<Tag color="default" style={{ margin: 0, fontSize: 10 }}>Inativo</Tag>
)}
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', color: '#8c8c8c', fontSize: 11 }}>
<span>Fator: <b>{factor}x</b></span>
{unit.enabled && <span>Margem: <b style={{ color: unitMarginPct < 15 ? '#ff4d4f' : '#52c41a' }}>{unitMarginPct.toFixed(1)}%</b></span>}
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', paddingTop: 3, marginTop: 2, fontSize: 11 }}>
<span>Varejo:</span>
<b style={{ color: unit.enabled ? '#3f8600' : '#8c8c8c' }}>R$ {unitPrice.toFixed(2)}</b>
</div>
</div>
);
})}
</div>
</div>
</Col>

{/* CONTEÚDO À DIREITA */}
<Col xs={24} md={17} lg={24} style={{ marginTop: 8 }}>
{!activeUnitDef ? (
<div style={{ textAlign: 'center', padding: '24px', background: '#fafafa', borderRadius: 6 }}>
<Text type="secondary">Selecione uma unidade ao lado.</Text>
</div>
) : (
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

{/* Banner de Aviso caso a unidade esteja desativada */}
{!activeUnitDef.enabled && (
<Alert
type="warning"
showIcon
icon={<LockOutlined />}
message="Método de Venda Bloqueado (Inativo)"
description="Esta unidade de comercialização está desativada no momento e não aparece no PDV. Você ainda pode gerenciar os parâmetros abaixo ou reativá-la clicando em 'Editar Parâmetros'."
action={
<Button size="small" type="primary" onClick={() => handleOpenEditUnitModal(activeUnitDef)}>
Reativar Unidade
</Button>
}
/>
)}

{/* Cabeçalho da Unidade Ativa */}
<div style={{ background: '#fafafa', padding: '10px 14px', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
<Space size={8} align="center">
<Text strong style={{ fontSize: 15, color: '#262626' }}>
{activeUnitDef.unitName} ({activeUnitDef.unitKey})
</Text>
</Space>

<Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => handleOpenEditUnitModal(activeUnitDef)}>
Editar Parâmetros
</Button>
</div>

<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 6, borderTop: '1px solid #f0f0f0' }}>
<Space size={4}>
<Text type="secondary" style={{ fontSize: 12 }}>Corrente de Gomos:</Text>
<Tag color="purple" style={{ margin: 0 }}>{tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).length} / 3</Tag>
</Space>

<Space size={10} wrap align="center">
<div style={{ background: '#ffffff', borderRadius: 6, border: '1px solid #e8e8e8', overflow: 'hidden', display: 'inline-block', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
<table style={{ borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
<thead>
<tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', color: '#8c8c8c' }}>
<th style={{ padding: '2px 6px', fontWeight: 500 }}>Custo 1x</th>
<th style={{ padding: '2px 6px', fontWeight: 500 }}>Fator {activeUnitDef.conversionFactor}x</th>
</tr>
</thead>
<tbody>
<tr>
<td style={{ padding: '3px 6px', color: '#595959' }}>R$ {purchaseCost.toFixed(2)}</td>
<td style={{ padding: '3px 6px', color: '#3f8600', fontWeight: 'bold' }}>R$ {(purchaseCost * activeUnitDef.conversionFactor).toFixed(2)}</td>
</tr>
</tbody>
</table>
</div>

<Tag color="blue" style={{ margin: 0, padding: '2px 8px' }}>Margem: {(() => {
const custoUnidade = purchaseCost * activeUnitDef.conversionFactor;
const precoVarejo = tierRules.find(t => t.unitKey === activeUnitDef.unitKey)?.unitPrice ?? 0;
return precoVarejo > 0 ? `${(((precoVarejo - custoUnidade) / precoVarejo) * 100).toFixed(1)}%` : '—';
})()}</Tag>
<Tag color="green" style={{ margin: 0, padding: '2px 8px' }}>Varejo ({activeUnitDef.unitKey}): R$ {((tierRules.find(t => t.unitKey === activeUnitDef.unitKey)?.unitPrice) ?? 0).toFixed(2)}</Tag>
</Space>
</div>
</div>

{/* Listagem de Gomos */}
<div style={{ opacity: activeUnitDef.enabled ? 1 : 0.65, pointerEvents: activeUnitDef.enabled ? 'auto' : 'none' }}>
{tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).length === 0 ? (
<div style={{ textAlign: 'center', padding: '20px', background: '#fafafa', borderRadius: 6, border: '1px dashed #d9d9d9' }}>
<Text type="secondary">Nenhum gomo configurado para esta unidade.</Text>
</div>
) : (
<Row gutter={[6, 6]}>
{tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).map((rule, idx, unitRulesArr) => {
const isFirstGomo = idx === 0;
const isLastGomo = idx === unitRulesArr.length - 1;
const unitCost = purchaseCost * activeUnitDef.conversionFactor;
const profit = rule.unitPrice - unitCost;

return (
<Col xs={24} sm={8} key={rule.key}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
<Tag color={rule.tierType === 'wholesale' ? 'orange' : 'cyan'} style={{ margin: 0, width: 'fit-content', padding: '0 4px', fontSize: 11 }}>
{isFirstGomo ? 'Varejo' : `Atacado #${idx + 1}`}
</Tag>

<div
style={{
borderRadius: 6,
padding: '6px',
border: rule.tierType === 'wholesale' ? '1px solid #ffa940' : '1px solid #91d5ff',
background: rule.tierType === 'wholesale' ? '#fff7e6' : '#f0f5ff',
display: 'flex',
flexDirection: 'column',
gap: 6,
boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
}}
>
{/* Cabeçalho do Card: Intervalo (De / Até) + Exclusão */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: 4 }}>
<Space size={4}>
<span style={{ color: '#8c8c8c', fontSize: 11 }}>De</span>
<InputNumber
min={1}
step={1}
precision={0}
size="small"
value={rule.minQuantity}
disabled={isFirstGomo}
style={{ width: 45 }}
onChange={(v) => handleUpdateTierLimit(rule.key, 'minQuantity', v ?? 0)}
/>

<span style={{ color: '#8c8c8c', fontSize: 11 }}>até</span>
{isLastGomo ? (
<span style={{ fontWeight: 'bold', padding: '0 4px', color: '#595959', fontSize: 12 }}>∞</span>
) : (
<InputNumber
min={1}
size="small"
value={typeof rule.maxQuantity === 'number' ? rule.maxQuantity : 0}
style={{ width: 45 }}
onChange={(v) => handleUpdateTierLimit(rule.key, 'maxQuantity', v ?? 10)}
/>
)}
</Space>

{!isFirstGomo && (
<Button 
type="text" 
size="small" 
danger 
icon={<DeleteOutlined />} 
onClick={() => removeTierRule(rule.key)} 
style={{ padding: '0 4px', height: 20 }} 
/>
)}
</div>

{/* Tabela Unificada de Parâmetros do Gomo (Markup, Modo, Venda e Lucro) */}
<div style={{ background: '#ffffff', borderRadius: 4, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
<thead>
<tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0', color: '#8c8c8c' }}>
<th style={{ padding: '3px 4px', fontWeight: 500, width: '25%' }}>Markup</th>
<th style={{ padding: '3px 4px', fontWeight: 500, width: '25%' }}>Modo</th>
</tr>
</thead>
<tbody>
<tr>
<td style={{ padding: '4px 2px' }}>
<InputNumber
min={0}
step={0.1}
precision={2}
size="small"
value={rule.markupOrDiscount}
style={{ width: '100%' }}
onChange={(v) => {
const markup = v ?? 1;
const updated = [...tierRules];
const targetIndex = tierRules.findIndex(t => t.key === rule.key);
if (targetIndex !== -1) {
const factor = activeUnitDef.conversionFactor;
updated[targetIndex].markupOrDiscount = markup;
updated[targetIndex].unitPrice = (purchaseCost * factor) * markup;
setTierRules(updated);
}
}}
/>
</td>
<td style={{ padding: '4px 2px' }}>
<Radio.Group 
buttonStyle="solid" 
size="small"
value={(rule as any).markupMode ?? 'multiplier'}
onChange={(e) => {
const mode = e.target.value;
const updated = [...tierRules];
const targetIndex = tierRules.findIndex(t => t.key === rule.key);
if (targetIndex !== -1) {
(updated[targetIndex] as any).markupMode = mode;
setTierRules(updated);
}
}}
>
<Radio.Button value="multiplier" style={{ padding: '0 4px', fontSize: 11 }}>X</Radio.Button>
<Radio.Button value="percentage" style={{ padding: '0 4px', fontSize: 11 }}>%</Radio.Button>
</Radio.Group>
</td>

</tr>
</tbody>
</table>
</div>

<div style={{ background: '#ffffff', borderRadius: 4, border: '1px solid #f0f0f0', overflow: 'hidden' }}>
<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
<thead>
<tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0', color: '#8c8c8c' }}>
<th style={{ padding: '3px 4px', fontWeight: 500, width: '25%' }}>Venda (R$)</th>
<th style={{ padding: '3px 4px', fontWeight: 500, width: '25%' }}>Lucro</th>
</tr>
</thead>
<tbody>
<tr>


<td style={{ padding: '4px 2px' }}>
<InputNumber
size="small"
min={0}
precision={2}
value={rule.unitPrice}
style={{ width: '100%', fontWeight: 'bold' }}
onChange={(newPrice) => {
const price = newPrice ?? 0;
const updated = [...tierRules];
const targetIndex = tierRules.findIndex(t => t.key === rule.key);
if (targetIndex !== -1) {
const baseCost = purchaseCost * activeUnitDef.conversionFactor;
const calculatedMarkup = baseCost > 0 ? price / baseCost : 1;

updated[targetIndex].unitPrice = price;
updated[targetIndex].markupOrDiscount = Number(calculatedMarkup.toFixed(2));
setTierRules(updated);
}
}}
/>
</td>
<td style={{ padding: '4px 2px', fontWeight: 'bold' }}>
<span style={{ color: '#1890ff', fontSize: 11 }}>+R$ {profit.toFixed(2)}</span>
</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>
</Col>
);
})}

{tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).length < 3 && (
<Col xs={24} sm={8}>
<div
onClick={() => addTierRuleForUnit(String(activeUnitDef.unitKey))}
style={{
borderRadius: 6,
height: '100%',
minHeight: 110,
display: 'flex',
flexDirection: 'column',
alignItems: 'center',
justifyContent: 'center',
background: '#fafafa',
border: '1px dashed #d9d9d9',
cursor: 'pointer',
gap: 6,
transition: 'all 0.3s'
}}
>
<PlusOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />
<Text type="secondary" style={{ fontSize: 12 }}>Adicionar Gomo</Text>
</div>
</Col>
)}
</Row>
)}
</div>

</div>
)}
</Col>
</Row>
</div>
</Spin>
)}

<Modal
title={modalMode === 'create' ? (formIsBase ? 'Definir Unidade Base' : 'Adicionar Fracionamento') : `Editar Unidade: ${formUnitKey}`}
open={isUnitModalVisible}
onOk={handleSaveUnit}
onCancel={() => setIsUnitModalVisible(false)}
okText={modalMode === 'create' ? 'Adicionar' : 'Salvar'}
cancelText="Cancelar"
>
<div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '8px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
<div>
<Text strong style={{ display: 'block' }}>Status da Unidade de Venda</Text>
<Text type="secondary">Se desativada, ficará bloqueada e oculta no PDV.</Text>
</div>
<Switch checked={formEnabled} onChange={setFormEnabled} />
</div>

<div>
<Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Sigla da Unidade (Ex: RL, CX):</Text>
<Input
placeholder="Ex: RL"
value={formUnitKey}
disabled={modalMode === 'edit'}
onChange={(e) => setFormUnitKey(e.target.value.toUpperCase())}
maxLength={5}
/>
</div>
<div>
<Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Nome Descritivo:</Text>
<Input
placeholder="Ex: Rolo com 150 metros"
value={formUnitName}
onChange={(e) => setFormUnitName(e.target.value)}
/>
</div>
<div>
<Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
{formIsBase ? 'Unidade base de estoque (fator fixo 1):' : `Fator de Conversão (1 ${formUnitKey || 'unidade'} = X ${baseLabel}):`}
</Text>
<InputNumber
style={{ width: '100%' }}
min={0.001}
step={1}
value={formIsBase ? 1 : formConversionFactor}
disabled={formIsBase || (modoRascunho && formUnitKey === rascunho?.unidadeCompra.toUpperCase())}
onChange={(v) => setFormConversionFactor(v ?? 1)}
/>
</div>
<div>
<Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>GTIN / Código de barras desta embalagem (opcional):</Text>
<Input
placeholder="Ex: 7891020304050"
value={formGtin}
maxLength={14}
onChange={(e) => setFormGtin(e.target.value.replace(/\D/g, ''))}
/>
</div>
<div>
<Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Markup Inicial de Varejo:</Text>
<InputNumber
style={{ width: '100%' }}
min={1}
step={0.1}
precision={2}
value={formRetailMarkup}
onChange={(v) => setFormRetailMarkup(v ?? 1.8)}
/>
</div>
</div>
</Modal>

<Modal
title="Payload da Corrente de Preços (API / Banco de Dados)"
open={isPayloadModalVisible}
onOk={() => setIsPayloadModalVisible(false)}
onCancel={() => setIsPayloadModalVisible(false)}
footer={[
<Button key="copy" type="primary" onClick={() => {
navigator.clipboard.writeText(generatePayloadJSON());
message.success('JSON copiado!');
}}>
Copiar JSON
</Button>,
<Button key="close" onClick={() => setIsPayloadModalVisible(false)}>
Fechar
</Button>
]}
width={700}
>
<pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 6, maxHeight: 400, overflow: 'auto' }}>
{generatePayloadJSON()}
</pre>
</Modal>
</div>
);
};

export default ProductCommercialSalesConfig;