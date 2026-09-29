import {
Card,
Form,
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
Radio
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
import React, { useState, useCallback, useMemo } from 'react';

const { Title, Text, Paragraph } = Typography;

interface SaleUnitConfig {
unitKey: string;          
unitName: string;         
enabled: boolean;         
allowWholesale: boolean;  
conversionFactor: number; 
retailMarkup: number;     
}

interface TierRuleRecord {
key: string;
unitKey: string;          
tierType: 'retail' | 'wholesale'; 
minQuantity: number;
maxQuantity: number | 'INF';
markupOrDiscount: number;
unitPrice: number;
}

interface ProductMock {
id: string;
name: string;
category: string;
baseUnit: string;
purchaseCost: number;     
allowedUnits: SaleUnitConfig[];
}

const productsMock: ProductMock[] = [
{
id: '1',
name: 'Corda Náutica Polipropileno 10mm (Rolo de 150m)',
category: 'Cordas & Fios',
baseUnit: 'Metro (MT)',
purchaseCost: 0.15,
allowedUnits: [
{ unitKey: 'MT', unitName: 'Metro (Fracionado)', enabled: true, allowWholesale: true, conversionFactor: 1, retailMarkup: 2.2 },
{ unitKey: 'RL', unitName: 'Rolo Fechado (150m)', enabled: true, allowWholesale: true, conversionFactor: 150, retailMarkup: 1.8 },
],
},
{
id: '2',
name: 'Parafuso Sextavado 1/4',
category: 'Ferragens',
baseUnit: 'Unidade (UN)',
purchaseCost: 0.50,
allowedUnits: [
{ unitKey: 'UN', unitName: 'Unidade Avulsa', enabled: true, allowWholesale: false, conversionFactor: 1, retailMarkup: 2.5 },
{ unitKey: 'CX', unitName: 'Caixa Master (50 un)', enabled: true, allowWholesale: true, conversionFactor: 50, retailMarkup: 2.0 },
],
},
];

export const ProductCommercialSalesConfig: React.FC = () => {
const [form] = Form.useForm();

const [selectedProduct, setSelectedProduct] = useState<ProductMock>(productsMock[0]);
const [purchaseCost, setPurchaseCost] = useState<number>(productsMock[0].purchaseCost);
const [unitsConfig, setUnitsConfig] = useState<SaleUnitConfig[]>(productsMock[0].allowedUnits);

const [simUnitKey, setSimUnitKey] = useState<string>('MT');
const [simQuantity, setSimQuantity] = useState<number>(5);

const [activeTabKey, setActiveTabKey] = useState<string>('MT');
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

const [tierRules, setTierRules] = useState<TierRuleRecord[]>([
{ key: '1', unitKey: 'MT', tierType: 'retail', minQuantity: 0, maxQuantity: 3, markupOrDiscount: 2.2, unitPrice: 0.15 * 2.2 },
{ key: '2', unitKey: 'MT', tierType: 'wholesale', minQuantity: 4, maxQuantity: 10, markupOrDiscount: 1.8, unitPrice: 0.15 * 1.8 },
{ key: '3', unitKey: 'MT', tierType: 'wholesale', minQuantity: 11, maxQuantity: 'INF', markupOrDiscount: 2.0, unitPrice: 0.15 * 2.0 },

{ key: '4', unitKey: 'RL', tierType: 'retail', minQuantity: 0, maxQuantity: 2, markupOrDiscount: 1.8, unitPrice: (0.15 * 150) * 1.8 },
{ key: '5', unitKey: 'RL', tierType: 'wholesale', minQuantity: 3, maxQuantity: 'INF', markupOrDiscount: 1.4, unitPrice: (0.15 * 150) * 1.4 },
]);

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
setIsUnitModalVisible(true);
};

const handleSaveUnit = () => {
if (!formUnitKey || !formUnitName) {
message.error('Preencha a sigla e o nome da unidade!');
return;
}

if (modalMode === 'create') {
if (unitsConfig.some(u => String(u.unitKey).toUpperCase() === formUnitKey.toUpperCase())) {
message.error('Já existe uma unidade com esta sigla cadastrada!');
return;
}

const customUnit: SaleUnitConfig = {
unitKey: formUnitKey.toUpperCase(),
unitName: formUnitName,
enabled: formEnabled,
allowWholesale: formAllowWholesale,
conversionFactor: formConversionFactor,
retailMarkup: formRetailMarkup,
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
unitPrice: (purchaseCost * formConversionFactor) * formRetailMarkup,
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
conversionFactor: formConversionFactor,
retailMarkup: formRetailMarkup,
allowWholesale: formAllowWholesale,
enabled: formEnabled,
};
}
return u;
}));

setTierRules(tierRules.map(tier => {
if (tier.unitKey === editingUnitKey && tier.minQuantity === 0) {
return {
...tier,
markupOrDiscount: formRetailMarkup,
unitPrice: (purchaseCost * formConversionFactor) * formRetailMarkup,
};
}
return tier;
}));

message.success('Unidade atualizada com sucesso!');
}

setIsUnitModalVisible(false);
};

const handleProductChange = (productId: string) => {
const prod = productsMock.find((p) => p.id === productId);
if (prod) {
setSelectedProduct(prod);
setPurchaseCost(prod.purchaseCost);
setUnitsConfig(prod.allowedUnits);

const defaultTiers: TierRuleRecord[] = prod.allowedUnits.map((u, index) => ({
key: String(Date.now() + index),
unitKey: u.unitKey,
tierType: 'retail',
minQuantity: 0,
maxQuantity: 'INF',
markupOrDiscount: u.retailMarkup,
unitPrice: (prod.purchaseCost * u.conversionFactor) * u.retailMarkup,
}));
setTierRules(defaultTiers);
if (prod.allowedUnits.length > 0) {
setSimUnitKey(prod.allowedUnits[0].unitKey);
setActiveTabKey(prod.allowedUnits[0].unitKey);
}
form.setFieldsValue({ baseUnit: prod.baseUnit });
}
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
return JSON.stringify({
productId: selectedProduct.id,
productName: selectedProduct.name,
baseUnit: selectedProduct.baseUnit,
purchaseCost: purchaseCost,
unitsConfiguration: unitsConfig,
chainedPricingTiers: tierRules
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
<Select
style={{ width: '100%' }}
size="medium"
value={selectedProduct.id}
onChange={handleProductChange}
options={productsMock.map((p) => ({ value: p.id, label: `${p.category}: ${p.name}` }))}
optionFilterProp="label"
showSearch
/>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Text type="secondary" style={{fontSize: 11,  fontWeight: 500 }}>Custo Base ({selectedProduct.baseUnit})</Text>
<InputNumber
size="medium"
prefix={<DollarOutlined style={{ color: '#bfbfbf' }} />}
value={purchaseCost}
precision={2}
onChange={handleCostChange}
/>
</div>  
</Col>

{/* <Col xs={24} sm={12} md={8}>


<Space orientation='vertical'>


<Col xs={24} sm={12} md={24}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Custo Base ({selectedProduct.baseUnit})</Text>
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
<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Preço de Venda ({selectedProduct.baseUnit})</Text>
<InputNumber
style={{ width: '100%' }}
size="large"
prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
value={0}
precision={2}
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

<Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>Preço de Venda ({selectedProduct.baseUnit})</Text>
<InputNumber
size="medium"
prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
value={0}
precision={2}
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
<Button type="primary" size="small" icon={<AppstoreAddOutlined />} onClick={() => message.success('Corrente comercial salva com sucesso!')}>
Salvar Configuração
</Button>
</Space>



</div>
</div>
</Col>



</Row>
</Card>

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

<Tag color="blue" style={{ margin: 0, padding: '2px 8px' }}>Margem: {activeUnitDef.margin ?? '54.5%'}</Tag>
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



<Modal
title={modalMode === 'create' ? 'Adicionar Fracionamento' : `Editar Unidade: ${formUnitKey}`}
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
<Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Fator de Conversão para Base:</Text>
<InputNumber
style={{ width: '100%' }}
min={0.001}
step={1}
value={formConversionFactor}
onChange={(v) => setFormConversionFactor(v ?? 1)}
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