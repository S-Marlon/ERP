import {
Card,
Input,
InputNumber,
Select,
Button,
Row,
Col,
Space,
Typography,
Modal,
message,
Tag,
Alert,
Switch,
Radio,
Spin,
Empty,
Tooltip
} from 'antd';
import {
AppstoreAddOutlined,
DeleteOutlined,
PlusOutlined,
CalculatorOutlined,
DollarOutlined,
EditOutlined,
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

const { Text } = Typography;

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


return (
<div style={{ padding: 0, background: '#f5f7fa' }}>

{/* CABEÇALHO: produto, custo base (de onde vem) e resultado (preço e margens) */}
<Card
bordered={false}
style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}
bodyStyle={{ padding: '8px 10px' }}
>
<Row gutter={[10, 8]} align="middle">
{!modoRascunho && (
<Col xs={24} md={9}>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
<Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>Produto / SKU</Text>
{modoRascunho ? (
<div>
<Text strong>{rascunho?.nomeItem || 'Novo item'}</Text>{' '}
<Tag color="processing" style={{ margin: 0 }}>Novo: gravado na aprovação da nota</Tag>
</div>
) : (
<Select
style={{ width: '100%' }}
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
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
<Tooltip title={modoRascunho
? 'Vem da nota: custo final (nota + IPI + frete/ST) ÷ fator de conversão. Para mudar, ajuste a conversão acima.'
: 'Custo gerencial: a referência sobre a qual o markup calcula o preço de venda.'}>
<Text type="secondary" style={{ fontSize: 11, fontWeight: 500, borderBottom: '1px dashed #d9d9d9', cursor: 'help' }}>
Custo base por {baseLabel}
</Text>
</Tooltip>
{modoRascunho ? (
<Text strong style={{ fontSize: 14, color: '#d4380d' }}>{formatBRL(purchaseCost)}</Text>
) : (
<InputNumber
prefix={<DollarOutlined style={{ color: '#bfbfbf' }} />}
value={purchaseCost}
precision={4}
onChange={handleCostChange}
/>
)}
</div>
</div>
</Col>
)}

<Col xs={24} md={modoRascunho ? 24 : 8}>
<div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Text type="secondary" style={{ fontSize: 12 }}>Preço de varejo por {baseLabel}</Text>
<Text strong style={{ color: '#3f8600', fontSize: 14 }}>{formatBRL(precoVarejoBase)}</Text>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Tooltip title="Média das margens (lucro ÷ preço) de todas as faixas das unidades ativas">
<Text type="secondary" style={{ fontSize: 12 }}>Margem média</Text>
</Tooltip>
<Text strong style={{ color: marginIntelligence.avgMargin < 20 ? '#faad14' : '#3f8600', fontSize: 13 }}>
{marginIntelligence.avgMargin.toFixed(1)}%
</Text>
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<Text type="secondary" style={{ fontSize: 12 }}>Menor / maior margem</Text>
<Text strong style={{ color: '#1890ff', fontSize: 12 }}>
{marginIntelligence.lowestMargin.toFixed(0)}% / {marginIntelligence.highestMargin.toFixed(0)}%
</Text>
</div>
</div>
</Col>

{!modoRascunho && (
<Col xs={24} md={6} style={{ textAlign: 'right' }}>
<Button type="primary" icon={<AppstoreAddOutlined />} onClick={handleSalvar} loading={saving} disabled={!selectedItem}>
Salvar Configuração
</Button>
</Col>
)}
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
{/* SEÇÃO PRINCIPAL: lateral de unidades + barra da unidade ativa + painel de faixas (layout em L) */}
<div style={{
display: 'grid',
gridTemplateColumns: 'minmax(170px, 210px) 1fr',
gridTemplateRows: 'auto 1fr',
gridTemplateAreas: '"lateral topo" "lateral painel"',
border: '1px solid #e8e8e8',
borderRadius: 8,
overflow: 'hidden',
background: '#fff',
marginTop: 6,
}}>

{/* LATERAL: unidades de comercialização (cresce para baixo) */}
<div style={{ gridArea: 'lateral', background: '#fafafa', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #e8e8e8', minHeight: 44 }}>
<Text strong style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
<CalculatorOutlined /> Unidades <Tag style={{ margin: 0, fontSize: 10 }}>{unitsConfig.length}</Tag>
</Text>
<Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenCreateUnitModal} size="small">Nova</Button>
</div>
<div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, overflowY: 'auto' }}>
{unitsConfig.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>Nenhuma unidade ainda.</Text>}
{unitsConfig.map((unit) => {
const factor = unit.conversionFactor;
const unitCost = purchaseCost * factor;
const unitRule = tierRules.find(t => t.unitKey === unit.unitKey);
const unitPrice = unitRule ? unitRule.unitPrice : unitCost * unit.retailMarkup;
const unitMarginPct = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : 0;
const ativa = activeTabKey === unit.unitKey;
return (
<div
key={unit.unitKey}
onClick={() => setActiveTabKey(unit.unitKey)}
style={{
background: ativa ? '#ffffff' : unit.enabled ? '#f6ffed' : '#f5f5f5',
border: ativa ? '2px solid #1677ff' : unit.enabled ? '1px solid #b7eb8f' : '1px dashed #d9d9d9',
borderRadius: 6,
padding: '6px 8px',
cursor: 'pointer',
opacity: unit.enabled ? 1 : 0.6,
boxShadow: ativa ? '0 2px 8px rgba(22, 119, 255, 0.15)' : 'none',
transition: 'all 0.2s',
}}
>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
<Text strong ellipsis style={{ color: !unit.enabled ? '#8c8c8c' : ativa ? '#0958d9' : '#262626', fontSize: 13 }}>
{unit.unitKey}{unit.unitName && unit.unitName !== unit.unitKey ? ` · ${unit.unitName}` : ''}
</Text>
{unit.isBase && <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>base</Tag>}
{!unit.enabled && <Tag style={{ margin: 0, fontSize: 10 }}>inativa</Tag>}
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
<span>×{factor}</span>
{unit.enabled && <span>margem <b style={{ color: unitMarginPct < 15 ? '#ff4d4f' : '#52c41a' }}>{unitMarginPct.toFixed(1)}%</b></span>}
</div>
<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, borderTop: '1px solid #f0f0f0', paddingTop: 2, marginTop: 2 }}>
<span>Varejo</span>
<b style={{ color: unit.enabled ? '#3f8600' : '#8c8c8c' }}>R$ {unitPrice.toFixed(2)}</b>
</div>
</div>
);
})}
</div>
</div>

{/* TOPO: cabeçalho da unidade ativa (emenda com a lateral) */}
<div style={{ gridArea: 'topo', background: '#fafafa', borderBottom: '1px solid #e8e8e8', padding: '6px 12px', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
{!activeUnitDef ? (
<Text type="secondary">Selecione uma unidade ao lado.</Text>
) : (() => {
const custoUnidade = purchaseCost * activeUnitDef.conversionFactor;
const precoVarejo = tierRules.find(t => t.unitKey === activeUnitDef.unitKey)?.unitPrice ?? 0;
const margem = precoVarejo > 0 ? (((precoVarejo - custoUnidade) / precoVarejo) * 100).toFixed(1) + '%' : '—';
const faixas = tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).length;
const chip = (rotulo: string, valor: React.ReactNode, cor?: string) => (
<div style={{ lineHeight: 1.2 }}>
<div style={{ fontSize: 10, color: '#8c8c8c' }}>{rotulo}</div>
<div style={{ fontSize: 13, fontWeight: 600, color: cor }}>{valor}</div>
</div>
);
return (
<>
<Space size={8} align="center">
<Text strong style={{ fontSize: 15 }}>{activeUnitDef.unitName} ({activeUnitDef.unitKey})</Text>
{!activeUnitDef.enabled && <Tag color="warning" style={{ margin: 0 }}>inativa</Tag>}
</Space>
<Space size={18} wrap align="center">
{chip(`Custo base (${baseLabel})`, `R$ ${purchaseCost.toFixed(2)}`)}
{activeUnitDef.conversionFactor !== 1 && chip(`Custo ${activeUnitDef.unitKey} (×${activeUnitDef.conversionFactor})`, `R$ ${custoUnidade.toFixed(2)}`)}
{chip('Varejo', `R$ ${precoVarejo.toFixed(2)}`, '#3f8600')}
{chip('Margem', margem, '#1677ff')}
{chip('Faixas', `${faixas} / 3`, '#722ed1')}
<Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => handleOpenEditUnitModal(activeUnitDef)}>
Editar unidade
</Button>
</Space>
</>
);
})()}
</div>

{/* PAINEL: faixas de preço (varejo e atacado) da unidade ativa */}
<div style={{ gridArea: 'painel', padding: 10, minHeight: 180 }}>
{activeUnitDef && !activeUnitDef.enabled && (
<Alert
type="warning"
showIcon
icon={<LockOutlined />}
style={{ marginBottom: 8 }}
message="Unidade inativa: não aparece no PDV"
action={<Button size="small" type="primary" onClick={() => handleOpenEditUnitModal(activeUnitDef)}>Reativar</Button>}
/>
)}
{activeUnitDef && (
<div style={{
display: 'grid',
gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
gap: 8,
opacity: activeUnitDef.enabled ? 1 : 0.65,
pointerEvents: activeUnitDef.enabled ? 'auto' : 'none',
}}>
{tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).map((rule, idx, unitRulesArr) => {
const isFirstGomo = idx === 0;
const isLastGomo = idx === unitRulesArr.length - 1;
const unitCost = purchaseCost * activeUnitDef.conversionFactor;
const profit = rule.unitPrice - unitCost;

return (
<div key={rule.key}>
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
</div>
);
})}

{tierRules.filter(t => t.unitKey === activeUnitDef.unitKey).length < 3 && (
<div
onClick={() => addTierRuleForUnit(String(activeUnitDef.unitKey))}
style={{
borderRadius: 6,
minHeight: 150,
display: 'flex',
flexDirection: 'column',
alignItems: 'center',
justifyContent: 'center',
background: '#fafafa',
border: '1px dashed #d9d9d9',
cursor: 'pointer',
gap: 6,
}}
>
<PlusOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />
<Text type="secondary" style={{ fontSize: 12 }}>Adicionar faixa de atacado</Text>
</div>
)}
</div>
)}
</div>
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

</div>
);
};

export default ProductCommercialSalesConfig;