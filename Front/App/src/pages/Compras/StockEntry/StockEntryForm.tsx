import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
Table,
message,
notification
} from 'antd';
import {
CheckCircleOutlined,
DollarOutlined,
InfoCircleOutlined,
SettingOutlined
} from '@ant-design/icons';
import { getMappedId, type MappingPayload } from './ItemsConference/ProductMappingModal';
import NfeCards from './nfeCards/NfeCards';
import { ItemsConference } from './ItemsConference/ItemsConference';
import { SupplierModal } from './SupplierModal';
import RevisaoFinalModal from './RevisaoFinalModal';
import { gerarHtmlDanfe } from './danfe/gerarDanfe';
import { imprimirHtml } from '../../../core/impressao/saida';
import { getPendenciasPim } from '../../Catalogo/pages/PendenciasPim/pendenciasApi';
import { parseNfeComplete, NfeDataFromXML } from './xml/utils/nfeParser';
import { reconcileFreight } from './freightReconciliation';
import { reconcileFinancial } from './financialReconciliation';
import { distributeFreight, FreightMode, FREIGHT_MODE_LABELS } from './freightDistribution';
import { TipoRecurso, TIPO_RECURSO_PADRAO, getTipoRecursoConfig } from './tipoRecurso';
import { applyConfirmation, applyItemEdit, ItemId, MSG_SEM_CODIGO_INTERNO } from './conferencia';
import { StockEntryHeader } from './StockEntryHeader';
import { sincronizarLoteXMLCompleto, buscarEstadoLote, sugerirVinculos, aprovarLoteStaging } from '../api/comprasApi';
import { aplicarSugestoes, chaveDaLinha } from './vinculoSugerido';
import { DestinoLinha } from './depositos';
import { aplicarClassificacao, mapeamentoRapido } from './edicaoLote';
import type { ClassificacaoItem } from './ItemsConference/ClassificacaoPim';
import type { ValoresPorItem } from './ItemsConference/ModaisLote';
import { restaurarItensDoStaging, lerFreteAdicionalSalvo } from './stagingRestore';

const { Text } = Typography;

// Monta o item no formato esperado por /compras/lotes/sincronizar-xml (upsert por item_nfe_seq)
const buildStagingItem = (item: any) => ({
  nItem: item.nItem,
  cProd: item.sku,
  cEan: item.ean,
  xProd: item.descricao,
  ncm: item.ncm,
  cest: item.prod?.CEST || null,
  uCom: item.unidade,
  quantidade: item.quantidade,
  receivedQuantity: item.receivedQuantity,
  difference: item.difference ?? 0,
  isConfirmed: item.isConfirmed ? 1 : 0,
  gtinManual: item.customGtin || null,
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
  // Dados de mapeamento (ProductMappingModal)
  produtoIdSistema: item.produtoIdSistema || null,
  skuSistema: item.skuSistema || null,
  skuSugerido: item.skuSugerido || null,
  nomeItemSugerido: item.nomeItemSugerido || null,
  familia: item.familia || null,
  tipoEntrada: item.tipoEntrada || 'COMPRA_NORMAL',
  tipoRecurso: item.tipoRecurso || TIPO_RECURSO_PADRAO,
  mapeamento: item.mapeamento || null,
  // Depósitos de destino (null = padrão pelo tipo do item)
  destinos: item.destinos ?? null
});

const FRETE_ADICIONAL_INICIAL = { valor: 0, metodo: 'Correios - PAC', observacao: '' };

const StockEntryForm: React.FC = () => {
const navigate = useNavigate();
// NF já importada/descartada na Staging: a tela abre só para consulta
const [modoVisualizacao, setModoVisualizacao] = useState<{ loteId: number; status: string } | null>(null);
const MSG_SOMENTE_LEITURA = 'NF já finalizada na Staging: modo visualização, nenhuma alteração é permitida.';

// Função para limpar os dados da tela e reiniciar a importação
const onReset = () => {
setRawXmlString('');
setItems([]);
setLoteId(null);
setModoVisualizacao(null);
setAppliedFreightMode('original');
setFreteAdicionalInfo(FRETE_ADICIONAL_INICIAL);
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

const [isConferenceModalOpen, setIsConferenceModalOpen] = useState<boolean>(false);
const [aprovando, setAprovando] = useState<boolean>(false);
const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
const [isTotalDetailsModalOpen, setIsTotalDetailsModalOpen] = useState<boolean>(false);

// Estado para o Modal de Distribuição de Frete
const [isFreightModalOpen, setIsFreightModalOpen] = useState<boolean>(false);
// Modo de rateio aplicado nos itens e o modo em edição no modal (só vira aplicado ao confirmar)
const [appliedFreightMode, setAppliedFreightMode] = useState<FreightMode>('original');
const [freightDistributionMode, setFreightDistributionMode] = useState<FreightMode>('original');

// Estado para controlar o frete adicional (pago por fora / Correios / Carreto)
const [freteAdicionalInfo, setFreteAdicionalInfo] = useState(FRETE_ADICIONAL_INICIAL);


// Estados temporários para criação de fornecedor
const [supplierCreationName, setSupplierCreationName] = useState<string>('');
const [salvandoFornecedor, setSalvandoFornecedor] = useState<boolean>(false);

// Cadastra o fornecedor da nota (dados do XML + nome de exibição) e confere de novo o status do card
const handleSalvarFornecedor = async () => {
const emit = parsedNfe?.emitente;
if (!emit?.cnpj) { message.error('A nota não tem CNPJ do emitente.'); return; }
setSalvandoFornecedor(true);
try {
const r = await createSupplier({
cnpj: emit.cnpj,
name: supplierCreationName || emit.nome || '',
fantasyName: supplierCreationFantasyName.trim() || emit.nomeFantasia || emit.nome || '',
stateRegistration: emit.ie,
phone: emit.fone,
endereco: {
logradouro: emit.logradouro, numero: emit.numeroEnd, complemento: emit.complemento,
bairro: emit.bairro, cidade: emit.municipio, estado: emit.uf, cep: emit.cep,
},
});
const confere = await checkSupplier(emit.cnpj.replace(/\D/g, ''), 1);
setSupplierStatus({ exists: Boolean(confere.exists), isChecking: false, supplier: confere.supplier });
if (confere.exists) {
message.success(r.message || 'Fornecedor cadastrado.');
setIsSupplierModalOpen(false);
} else {
message.error('O cadastro foi feito, mas o fornecedor ainda não aparece como fornecedor. Confira o cadastro em Parceiros.');
}
} catch (e: any) {
message.error(e.message || 'Erro ao cadastrar o fornecedor.');
} finally {
setSalvandoFornecedor(false);
}
};
const [supplierCreationFantasyName, setSupplierCreationFantasyName] = useState<string>('');

const [isPayloadModalOpen, setIsPayloadModalOpen] = useState<boolean>(false);


// Grava os itens alterados na staging (upsert por item_nfe_seq no backend)
const persistItemsToStaging = async (
itemsToSave: any[],
freteAdicional: typeof freteAdicionalInfo = freteAdicionalInfo,
modoRateio: FreightMode = appliedFreightMode
) => {
if (!loteId || itemsToSave.length === 0) return;
try {
await sincronizarLoteXMLCompleto({
tenant_id: 1,
lote_importacao_id: loteId,
// O frete adicional vai para o lote: o pente-fino da Staging compara com o total dos itens
frete_adicional: { ...freteAdicional, modo_rateio: modoRateio },
itens: itemsToSave.map(buildStagingItem)
});
} catch (err: any) {
console.error('Erro ao salvar itens na staging:', err);
message.error('Erro ao salvar itens na staging: ' + err.message);
}
};

// Aplica uma alteração nos itens: todo item alterado volta para pendente de conferência
const commitItemEdit = (
ids: ItemId[],
patch: (item: any) => Record<string, unknown> | null,
{ persist = true }: { persist?: boolean } = {}
) => {
if (modoVisualizacao) {
message.warning(MSG_SOMENTE_LEITURA);
return { items, changed: [], reopened: 0 };
}
const result = applyItemEdit(items, ids, patch);
if (result.changed.length === 0) return result;
setItems(result.items);
if (persist) persistItemsToStaging(result.changed);
if (result.reopened > 0) {
message.info(`${result.reopened} item(ns) alterado(s) voltou(aram) para pendente de conferência.`);
}
return result;
};

// Recebe o mapeamento confirmado no ProductMappingModal, guarda no item e persiste na staging
const handleItemMapped = (tempId: string | number, mapping: MappingPayload) => {
const target = items.find(i => i.tempId === tempId || i.nItem === tempId);
if (!target) return;

if (!loteId) {
message.warning('Lote de staging ainda não criado: o mapeamento ficou apenas na tela.');
}

commitItemEdit([target.tempId], item => patchDoMapeamento(item, mapping));
};

// Módulos (ex.: Rolamentos): vínculo/cadastro pronto em várias linhas de uma vez
const handleAplicarMapeamentos = (lista: Array<{ tempId: ItemId; mapping: MappingPayload }>) => {
const porLinha = new Map(lista.map(l => [l.tempId, l.mapping]));
const result = commitItemEdit(lista.map(l => l.tempId), item => {
const mapping = porLinha.get(item.tempId);
return mapping ? patchDoMapeamento(item, mapping) : null;
});
if (result.changed.length > 0) message.success(`${result.changed.length} linha(s) preenchida(s). Confira e dê entrada.`);
};

// Confirma (ou desfaz) que linhas com o mesmo SKU são o mesmo produto: não reabre a conferência
const handleConfirmarAgrupamento = (ids: ItemId[], sku: string | null) => {
if (modoVisualizacao) {
message.warning(MSG_SOMENTE_LEITURA);
return;
}
const alvo = new Set(ids);
const changed: typeof items = [];
const novos = items.map(item => {
if (!alvo.has(item.tempId) || !item.mapeamento) return item;
const next = { ...item, mapeamento: { ...item.mapeamento, agrupamentoConfirmado: sku } };
changed.push(next);
return next;
});
if (changed.length === 0) return;
setItems(novos);
persistItemsToStaging(changed);
message.success(sku ? `${changed.length} linhas agrupadas como o mesmo produto.` : 'Agrupamento desfeito.');
};

// Campos da linha que acompanham o mapeamento (modal, cadastro rápido ou classificação em lote)
const patchDoMapeamento = (item: any, mapping: MappingPayload) => ({
mapeamento: mapping,
produtoIdSistema: mapping.mode === 'EXISTING_DIRECT' ? mapping.existingProductId : null,
skuSistema: mapping.existingProduct?.sku || null,
skuSugerido: mapping.draftIdentity?.sku_interno || null,
// Vinculado: herda o tipo do item do catálogo; novo: o tipo escolhido no modal
tipoRecurso: mapping.existingProduct?.tipo_recurso || mapping.draftIdentity?.tipo_recurso || item.tipoRecurso || TIPO_RECURSO_PADRAO,
nomeItemSugerido: mapping.draftIdentity?.nome_interno || null,
mappedId: getMappedId(mapping),
isMapped: true,
vinculoSugerido: null
});

// Lote: linhas sem vínculo viram itens novos com os dados da nota (uma única gravação na staging)
const handleCadastroRapidoLote = (linhas: any[], opcoes: { markup: number; classificacao: ClassificacaoItem; porItem: ValoresPorItem | null }) => {
const ids = new Set(linhas.map(l => l.tempId));
const result = commitItemEdit([...ids], item => (item.mapeamento || item.mappedId || item.produtoIdSistema)
? null
: patchDoMapeamento(item, mapeamentoRapido(item, {
markup: opcoes.markup,
// Valores de atributos preenchidos linha a linha na tabela do modal
classificacao: opcoes.porItem ? { ...opcoes.classificacao, atributos: opcoes.porItem[String(item.tempId)] || null } : opcoes.classificacao,
})));
if (result.changed.length > 0) message.success(`${result.changed.length} item(ns) novo(s) cadastrado(s) na nota. Confira e dê entrada.`);
};

// Lote: família/categoria (e valores de atributos) nos itens novos
const handleClassificarLote = (linhas: any[], classificacao: ClassificacaoItem, substituir = false, porItem: ValoresPorItem | null = null) => {
const result = commitItemEdit(linhas.map(l => l.tempId), item => {
// Tabela por item: cada linha recebe exatamente os valores dela (a tabela já começa com o que ela tinha)
const novo = porItem
? aplicarClassificacao(item.mapeamento, { ...classificacao, atributos: porItem[String(item.tempId)] || null }, { substituir: true })
: aplicarClassificacao(item.mapeamento, classificacao, { substituir });
return novo ? { mapeamento: novo } : null;
});
if (result.changed.length > 0) message.success(`${result.changed.length} item(ns) classificado(s).`);
};

// Destino da linha no estoque (depósitos). Um depósito só acompanha a quantidade recebida.
const handleChangeDestinos = (tempId: ItemId, destinos: DestinoLinha[] | null) => {
commitItemEdit([tempId], item => (JSON.stringify(item.destinos ?? null) === JSON.stringify(destinos) ? null : { destinos }));
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
// Itens carregam frete da NF + frete adicional, então a referência é a soma dos dois
return reconcileFreight(nfeFreightValue + (Number(freteAdicionalInfo.valor) || 0), items);
}, [nfeFreightValue, freteAdicionalInfo, items]);

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
// A conferência financeira é contra a NF: desconta o frete adicional embutido nos itens
}, items.map(item => ({ ...item, freightAdded: (Number(item.freightAdded) || 0) - (Number(item.freightExtra) || 0) })));
}, [parsedNfe, items]);

// Função para lidar com o upload do arquivo XML
// Função para lidar com o upload do arquivo XML atualizada
// Carrega a NF a partir do conteúdo do XML (upload de arquivo ou retomada de um lote da Staging)
const processarXmlConteudo = async (content: string) => {
setIsProcessingItems(true);
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

const vIpiItem = Number(item.imposto?.ipi?.vIPI) || 0;
// Só o valor do ICMS-ST entra no custo (vBCST é a BASE de cálculo, não imposto)
const vStItem = Number(item.imposto?.icms?.vICMSST) || 0;

const discountItem = parseFloat(item.prod.vDesc || '0') || 0;

const totalAcrescimosItem = freightItem + otherExpenses + insuranceItem + vIpiItem + vStItem;
// Mesma composição do vNF: produtos - desconto + acréscimos
const valorTotalRealItem = vlrProd - discountItem + totalAcrescimosItem;
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
desconto: discountItem,
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
tipoRecurso: TIPO_RECURSO_PADRAO,
};
});

// Retomada: se a NF já tem lote na staging, recupera o que foi feito (mapeamento, conferência, frete...)
let itensDaNota: any[] = initialItems;
let freteDaNota = FRETE_ADICIONAL_INICIAL;
let modoFreteDaNota: FreightMode = 'original';
let podeSincronizar = true;

try {
const estado = await buscarEstadoLote({ chave: parsed.chaveAcesso });
if (estado.lote && ['IMPORTADO', 'DESCARTADO'].includes(estado.lote.status)) {
// NF finalizada: mostra exatamente como foi aprovada/descartada, sem permitir alterações
const restauracao = restaurarItensDoStaging(initialItems, estado.itens);
const freteSalvo = lerFreteAdicionalSalvo(estado.lote.frete_adicional);
const freteVisual = freteSalvo
? { valor: freteSalvo.valor, metodo: freteSalvo.metodo || FRETE_ADICIONAL_INICIAL.metodo, observacao: freteSalvo.observacao }
: FRETE_ADICIONAL_INICIAL;
const modoVisual: FreightMode = freteSalvo?.modo_rateio || 'original';
const freteNota = parseFloat(parsed.totais?.icmsTot?.vFrete || '0') || 0;
setItems(distributeFreight(restauracao.items, modoVisual, freteNota, Number(freteVisual.valor) || 0));
setAppliedFreightMode(modoVisual);
setFreteAdicionalInfo(freteVisual);
setLoteId(null);
setModoVisualizacao({ loteId: estado.lote.id, status: estado.lote.status });
message.info(`NF ${estado.lote.status === 'IMPORTADO' ? 'já importada' : 'descartada'} (lote #${estado.lote.id}): aberta em modo visualização.`);
setIsProcessingItems(false);
return;
}
setModoVisualizacao(null);
if (estado.lote && estado.itens.length > 0) {
const restauracao = restaurarItensDoStaging(initialItems, estado.itens);
const freteSalvo = lerFreteAdicionalSalvo(estado.lote.frete_adicional);
if (freteSalvo) {
freteDaNota = { valor: freteSalvo.valor, metodo: freteSalvo.metodo || FRETE_ADICIONAL_INICIAL.metodo, observacao: freteSalvo.observacao };
modoFreteDaNota = freteSalvo.modo_rateio || 'original';
}
const freteNota = parseFloat(parsed.totais?.icmsTot?.vFrete || '0') || 0;
itensDaNota = distributeFreight(restauracao.items, modoFreteDaNota, freteNota, Number(freteDaNota.valor) || 0);
if (restauracao.restaurados > 0) {
message.info(`Conferência retomada do lote #${estado.lote.id}: ${restauracao.mapeados} item(ns) mapeado(s), ${restauracao.conferidos} conferido(s).`);
}
}
} catch (err: any) {
// Sem o estado salvo não sincroniza: evitaria sobrescrever a conferência já feita com dados zerados
podeSincronizar = false;
console.error('Erro ao buscar estado salvo da NF:', err);
message.warning('Não foi possível recuperar o estado salvo desta NF. Nada será gravado na Staging até recarregar o XML.');
}

// Reconhecimento automático: linhas sem vínculo recebem o item sugerido (código do fornecedor ou GTIN)
if (podeSincronizar) {
try {
const semVinculo = itensDaNota.filter(i => !i.mapeamento && !i.mappedId && !i.produtoIdSistema && !i.skuSugerido);
const resposta = await sugerirVinculos(
parsed.emitente?.cnpj || '',
semVinculo.map(i => ({ chave: chaveDaLinha(i), codigo: i.sku, ean: i.ean }))
);
const aplicado = aplicarSugestoes(itensDaNota, resposta.sugestoes || {});
if (aplicado.aplicadas > 0) {
itensDaNota = aplicado.itens;
message.info(`${aplicado.aplicadas} item(ns) reconhecido(s) automaticamente pelo código do fornecedor ou GTIN. Confira antes de dar entrada.`);
}
} catch (err) {
console.warn('Sem sugestões de vínculo:', err);
}
}

setItems(itensDaNota);
setAppliedFreightMode(modoFreteDaNota);
setFreteAdicionalInfo(freteDaNota);

// ==========================================
// SINCRONIZAÇÃO COMPLETA: XML Bruto + JSON + Itens
// ==========================================
const tenantId = 1;

const payloadItens = itensDaNota.map(buildStagingItem);

if (podeSincronizar) try {
// Chamada da API unificada que envia o XML cru e o objeto JSON de dados
const respostaLote = await sincronizarLoteXMLCompleto({
tenant_id: tenantId,
chave_acesso: parsed.chaveAcesso,
numero_nf: parsed.numero,
cnpj_fornecedor: parsed.emitente?.cnpj || '',
xml_conteudo: content, // <-- Aqui vai o XML inteiro em LONGTEXT
// Carga completa: o backend acha o lote pela chave de acesso e remove linhas que não existem no XML
sincronizacao_completa: true,
frete_adicional: { ...freteDaNota, modo_rateio: modoFreteDaNota },
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

const handleXmlUpload = (event: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
const file = event.target.files?.[0];
if (!file) return;
const reader = new FileReader();
reader.onload = (e) => { processarXmlConteudo(e.target?.result as string); };
reader.readAsText(file);
};

// Retomada vinda da tela de Staging: /compras/entrada-nfe?lote=ID
const [searchParams] = useSearchParams();
const loteRetomado = useRef<string | null>(null);
useEffect(() => {
const loteParam = searchParams.get('lote');
if (!loteParam || loteRetomado.current === loteParam) return;
loteRetomado.current = loteParam;

buscarEstadoLote({ loteId: Number(loteParam) })
.then(estado => {
if (!estado.lote?.xml_conteudo) {
message.error(`Lote #${loteParam} não tem o XML salvo para retomar a conferência.`);
return;
}
processarXmlConteudo(estado.lote.xml_conteudo);
})
.catch(err => message.error('Erro ao retomar o lote: ' + err.message));
}, [searchParams]);

const beforeUpload = (file: File) => {
handleXmlUpload({ target: { files: [file] } });
return false;
};


// Valor total do frete (XML + Frete Adicional informando pelo usuário)
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const totalFreightCombined = useMemo(() => {
const xmlFreight = nfeFreightValue;
const additionalFreight = Number(freteAdicionalInfo?.valor) || 0;
return xmlFreight + additionalFreight;
}, [nfeFreightValue, freteAdicionalInfo]);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////q


// Custo ajustado da entrada: total da NF (vNF) + frete adicional pago por fora
const custoAjustadoTotal = useMemo(() => {
const valorNota = parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0') || 0;
const freteAdicional = Number(freteAdicionalInfo?.valor) || 0;
return valorNota + freteAdicional;
}, [parsedNfe, freteAdicionalInfo]);

// Recalcula frete e custo de todos os itens (sempre a partir do vFrete original do XML, então é reversível)
const applyFreight = (
mode: FreightMode,
freteInfo: typeof freteAdicionalInfo = freteAdicionalInfo,
baseItems: any[] = items
) => {
if (modoVisualizacao) {
message.warning(MSG_SOMENTE_LEITURA);
return;
}
const recalculated = distributeFreight(baseItems, mode, nfeFreightValue, Number(freteInfo.valor) || 0);
setItems(recalculated);
setAppliedFreightMode(mode);
persistItemsToStaging(recalculated, freteInfo, mode);
};

const handleOpenFreightModal = () => {
if (modoVisualizacao) {
message.info(MSG_SOMENTE_LEITURA);
return;
}
setFreightDistributionMode(appliedFreightMode);
setIsFreightModalOpen(true);
};

const handleApplyFreightDistribution = () => {
applyFreight(freightDistributionMode);
setIsFreightModalOpen(false);
message.success(`Frete aplicado nos custos: ${FREIGHT_MODE_LABELS[freightDistributionMode]}.`);
};

// Prévia do modo selecionado no modal, sem alterar os itens
const freightPreview = useMemo(() => {
if (!isFreightModalOpen) return [];
return distributeFreight(items, freightDistributionMode, nfeFreightValue, Number(freteAdicionalInfo.valor) || 0);
}, [isFreightModalOpen, items, freightDistributionMode, nfeFreightValue, freteAdicionalInfo]);

// Conferência: só itens com código interno vinculado podem ser conferidos
const setItemsConfirmation = (ids: ItemId[], confirmed: boolean) => {
if (modoVisualizacao) {
message.warning(MSG_SOMENTE_LEITURA);
return;
}
const result = applyConfirmation(items, ids, confirmed);
if (result.blocked > 0) {
message.warning(`${result.blocked} item(ns) sem código interno não foi(ram) conferido(s). ${MSG_SEM_CODIGO_INTERNO}`);
}
if (result.changed.length === 0) return;
setItems(result.items);
persistItemsToStaging(result.changed);
if (confirmed) message.success(`${result.changed.length} item(ns) conferido(s).`);
};

const handleConfirmItems = (ids: ItemId[]) => setItemsConfirmation(ids, true);
const handleUnconfirmItems = (ids: ItemId[]) => setItemsConfirmation(ids, false);

// GTIN informado manualmente (item sem código de barras no XML)
const handleChangeGtin = (tempId: ItemId, gtin: string) => {
const valor = gtin.trim();
const result = commitItemEdit([tempId], item => (item.customGtin === valor ? null : { customGtin: valor }));
if (result.changed.length > 0) message.success('Código de barras vinculado ao item.');
};

// Itens não saem da NF: o operador só reclassifica o tipo de entrada (ex.: produto de limpeza -> CONSUMO)
const handleChangeTipoRecurso = (ids: (string | number)[], tipo: TipoRecurso) => {
const result = commitItemEdit(ids, item =>
(item.tipoRecurso || TIPO_RECURSO_PADRAO) === tipo ? null : { tipoRecurso: tipo, destinos: null }
);
if (result.changed.length > 0) {
message.success(`${result.changed.length} item(ns) marcado(s) como ${getTipoRecursoConfig(tipo).label}.`);
}
};

// Aprovação da entrada (a mesma da tela de Staging): estoque, itens novos e vínculos de fornecedor
const handleAprovarEntrada = async () => {
if (!loteId) return;
setAprovando(true);
try {
const r = await aprovarLoteStaging(loteId);
message.success(r.message || 'Entrada aprovada.');
setIsConferenceModalOpen(false);
// Itens desta nota com cadastro incompleto no PIM: aviso com atalho
try {
const p = await getPendenciasPim({ lote: loteId, tipo: 'TODOS', limit: 1 });
if (p.totalItensComPendencia > 0) {
notification.warning({
message: `${p.totalItensComPendencia} item(ns) desta nota com pendências no catálogo`,
description: p.criticos > 0 ? `${p.criticos} crítico(s): ficam fora do PDV ou sem preço até completar o cadastro.` : 'Cadastro incompleto (classificação, grade, código de barras...).',
duration: 0,
btn: <Button type="primary" size="small" onClick={() => { notification.destroy(); navigate(`/catalogo/pendencias?lote=${loteId}`); }}>Ver pendências</Button>,
});
}
} catch { /* aviso opcional */ }
navigate('/compras/notas');
} catch (e: any) {
Modal.error({ title: 'Entrada não aprovada', content: e.message });
} finally {
setAprovando(false);
}
};

// Quantidade recebida: altera o item (desfaz a conferência) e grava na staging com debounce,
// já que o InputNumber dispara a cada tecla
const quantityPersistTimers = useRef<Map<ItemId, ReturnType<typeof setTimeout>>>(new Map());

const handleQuantityChange = (tempId: ItemId, newReceivedQty: number) => {
const result = commitItemEdit([tempId], item => {
if (Number(item.receivedQuantity) === newReceivedQty) return null;
const patch: Record<string, unknown> = { receivedQuantity: newReceivedQty, difference: newReceivedQty - (Number(item.quantidade) || 0) };
const usoInterno = Array.isArray(item.destinos) ? (item.destinos.find((d: DestinoLinha) => d.deposito === 'ALMOXARIFADO')?.quantidade || 0) : 0;
if (usoInterno > 0 && newReceivedQty > usoInterno) {
patch.destinos = [{ deposito: 'VENDA', quantidade: Number((newReceivedQty - usoInterno).toFixed(4)) }, { deposito: 'ALMOXARIFADO', quantidade: usoInterno }];
} else if (Array.isArray(item.destinos) && item.destinos.length > 0) {
patch.destinos = null;
if (usoInterno > 0) message.warning('A quantidade ficou menor que a parte de uso interno: a linha voltou inteira para o depósito do tipo.');
}
return patch;
}, { persist: false });
const alterado = result.changed[0];
if (!alterado) return;

const timers = quantityPersistTimers.current;
clearTimeout(timers.get(tempId));
timers.set(tempId, setTimeout(() => {
timers.delete(tempId);
persistItemsToStaging([alterado]);
}, 600));
};

const totalDivergences = useMemo(() => items.filter(i => i.difference !== 0).length, [items]);
const totalConfirmed = useMemo(() => items.filter(i => i.isConfirmed).length, [items]);
const totalPhysicalItems = useMemo(() => items.reduce((acc, it) => acc + (it.receivedQuantity || 0), 0), [items]);
const progressPercent = useMemo(() => {
if (items.length === 0) return 0;
return Math.round((totalConfirmed / items.length) * 100);
}, [items.length, totalConfirmed]);

const isSubmitDisabled = items.length === 0 || totalConfirmed < items.length;

// DANFE montado do XML lido (todas as seções: emitente, chave com código de barras, destinatário,
// duplicatas, impostos, transporte, produtos e dados adicionais), impresso sem abrir pop-up
const handlePrintDanfeHtml = async () => {
if (!parsedNfe) return;
try {
await imprimirHtml(gerarHtmlDanfe(parsedNfe));
} catch (e: any) {
message.error(e?.message || 'Não foi possível gerar o DANFE.');
}
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


{modoVisualizacao && (
<Alert
type={modoVisualizacao.status === 'IMPORTADO' ? 'success' : 'warning'}
showIcon
message={`NF ${modoVisualizacao.status === 'IMPORTADO' ? 'já importada no estoque' : 'descartada'} · Lote #${modoVisualizacao.loteId}`}
description="Modo visualização: os dados abaixo são os que foram registrados na Staging. Nenhuma alteração é permitida."
action={
<Button size="small" onClick={() => navigate('/stagings')}>
Abrir na Staging
</Button>
}
/>
)}

{parsedNfe?.chaveAcesso && (
<NfeCards
key={parsedNfe.chaveAcesso}
loteId={loteId}
readOnly={Boolean(modoVisualizacao)}
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
// Reaplica o modo atual para incorporar o novo frete adicional nos custos
applyFreight(appliedFreightMode, novosDados);
message.success(`Frete adicional atualizado: R$ ${novosDados.valor.toFixed(2)} (${novosDados.metodo})`);
}}/>)}

{items.length > 0 && (
<Card bordered={false} style={{ borderRadius: 8 }}>
<ItemsConference
items={items.map((i, index) => ({ ...i, nItem: i.nItem || index + 1, confirmed: i.isConfirmed, isConfirmed: i.isConfirmed }))}
onConfirmItems={handleConfirmItems}
onUnconfirmItems={handleUnconfirmItems}
onItemMapped={handleItemMapped}
onConfirmarAgrupamento={handleConfirmarAgrupamento}
onAplicarMapeamentos={handleAplicarMapeamentos}
onChangeTipoRecurso={handleChangeTipoRecurso}
onToggleItem={(tempId, confirmed) => setItemsConfirmation([tempId], confirmed)}
onQuantityChange={handleQuantityChange}
onChangeGtin={handleChangeGtin}
onChangeDestinos={handleChangeDestinos}
onCadastroRapidoLote={handleCadastroRapidoLote}
onClassificarLote={handleClassificarLote}
readOnly={Boolean(modoVisualizacao)}
cnpjFornecedor={parsedNfe?.emitente?.cnpj || ''}
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
type={freightReconciliation.matches ? "success" : "error"}
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
onClick={handleOpenFreightModal}
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
<span style={{ color: '#8c8c8c' }}>Modo de rateio:</span>
<strong>{FREIGHT_MODE_LABELS[appliedFreightMode]}</strong>
</div>

<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<span style={{ color: '#8c8c8c' }}>Frete da NF-e:</span>
<strong>R$ {nfeFreightValue.toFixed(2)}</strong>
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
R$ {freightReconciliation.difference.toFixed(2)}
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
{(() => {
// Composição do total da nota a partir do XML (cada linha só aparece se tiver valor)
const t = parsedNfe.totais.icmsTot;
const v = (x?: string) => parseFloat(x || '0') || 0;
const st = v(t.vICMSST || t.vST);
const linhas: Array<[string, number, string]> = [
['(+) Frete', v(t.vFrete), '#1890ff'],
['(+) Seguro', v(t.vSeg), '#1890ff'],
['(+) Outras despesas', v(t.vOutro), '#1890ff'],
['(+) IPI', v(t.vIPI), '#1890ff'],
['(+) ICMS ST', st, '#1890ff'],
['(−) Desconto', -v(t.vDesc), '#cf1322'],
];
const total = v(t.vProd) + v(t.vFrete) + v(t.vSeg) + v(t.vOutro) + v(t.vIPI) + st - v(t.vDesc);
const fmt = (n: number) => Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
return (
<>
{linhas.filter(([, valor]) => Math.abs(valor) > 0.004).map(([rotulo, valor, cor]) => (
<div key={rotulo} style={{ display: 'flex', justifyContent: 'space-between', color: cor }}>
<span>{rotulo}:</span>
<span>R$ {fmt(valor)}</span>
</div>
))}
<div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderTop: '1px dashed #d9d9d9', marginTop: 4, paddingTop: 4 }}>
<span>(=) Total:</span>
<span>R$ {fmt(total)}</span>
</div>
</>
);
})()}
</div>
)}

<Divider style={{ margin: '14px 0' }} />

<Statistic
title={<Text strong style={{ fontSize: 13 }}>Custo Ajustado Total</Text>}
value={custoAjustadoTotal}
precision={2}
prefix="R$"
valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: 22 }}
/>
{Number(freteAdicionalInfo?.valor) > 0 && (
<Text type="secondary" style={{ fontSize: 11 }}>
Nota R$ {(parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0') || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
{' '}+ frete adicional R$ {Number(freteAdicionalInfo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
</Text>
)}

<Button
type="primary"
block
size="large"
icon={<CheckCircleOutlined />}
style={{ marginTop: 16, height: 46, background: isSubmitDisabled ? undefined : '#52c41a', border: 'none' }}
disabled={isSubmitDisabled || Boolean(modoVisualizacao) || !loteId}
onClick={() => setIsConferenceModalOpen(true)}
>
{items.length === 0 ? 'Aguardando XML...' : isSubmitDisabled ? `Confira todos os itens (${totalConfirmed}/${items.length})` : 'Revisar e dar entrada'}
</Button>

{/* Debug do payload da staging (desligado; para usar, descomente e importe BugFilled e CodeFilled de @ant-design/icons)
<Button
type="primary"
block
size="large"
icon={<BugFilled/>}
style={{ marginTop: 16, height: 46, background: 'black', border: 'none' }}
onClick={() => setIsPayloadModalOpen(true)}
>
<CodeFilled/> Debug
</Button>
*/}

</Card>
</Space>
</Col>
</Row>
</Spin>

{/* 3. MODAIS */}

<Modal
title="🚚 Configurar Distribuição de Frete"
open={isFreightModalOpen}
onCancel={() => setIsFreightModalOpen(false)}
onOk={handleApplyFreightDistribution}
okText="Aplicar no Custo"
cancelText="Cancelar"
width={760}
>
<div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 13 }}>
<span>Frete NF-e: <strong>R$ {nfeFreightValue.toFixed(2)}</strong></span>
<span>Frete adicional: <strong>R$ {(Number(freteAdicionalInfo.valor) || 0).toFixed(2)}</strong></span>
<span>Total: <strong>R$ {totalFreightCombined.toFixed(2)}</strong></span>
</div>
<p style={{ color: '#595959', fontSize: 13, marginBottom: 16 }}>
Escolha o critério de rateio. Você pode alternar entre os modos a qualquer momento, inclusive voltar ao valor original do XML.
Modo aplicado agora: <strong>{FREIGHT_MODE_LABELS[appliedFreightMode]}</strong>.
</p>

<Radio.Group
onChange={(e) => setFreightDistributionMode(e.target.value)}
value={freightDistributionMode}
style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
>

<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', background: '#fafafa', padding: '10px 12px', borderRadius: 6, border: '1px solid #f0f0f0' }}>
<Radio value="original" style={{ flex: 1 }}>
<Text strong>Valor Original (XML)</Text>
</Radio>
<Tooltip title="Cada item mantém o frete (vFrete) destacado no XML pelo fornecedor. Se houver frete adicional, ele é rateado proporcionalmente ao valor dos itens.">
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

<Divider style={{ margin: '16px 0 8px' }} />
<Text strong style={{ fontSize: 12 }}>Prévia do modo selecionado</Text>
<Table
size="small"
rowKey="tempId"
pagination={false}
scroll={{ y: 240 }}
style={{ marginTop: 8 }}
dataSource={freightPreview.map(preview => ({
...preview,
freteAtual: Number(items.find(i => i.tempId === preview.tempId)?.freightAdded) || 0,
}))}
columns={[
{ title: 'Item', dataIndex: 'descricao', ellipsis: true },
{ title: 'Frete XML', dataIndex: 'freightOriginal', width: 90, align: 'right', render: (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}` },
{ title: 'Frete atual', dataIndex: 'freteAtual', width: 90, align: 'right', render: (v: number) => `R$ ${v.toFixed(2)}` },
{
title: 'Frete novo', dataIndex: 'freightAdded', width: 90, align: 'right',
render: (v: number, row: any) => (
<span style={{ color: Math.abs(v - row.freteAtual) > 0.005 ? '#1677ff' : undefined, fontWeight: 600 }}>R$ {v.toFixed(2)}</span>
)
},
{ title: 'Custo unit. novo', dataIndex: 'valorUnitario', width: 110, align: 'right', render: (v: number) => `R$ ${(Number(v) || 0).toFixed(4)}` },
]}
/>
</Modal>

<RevisaoFinalModal
open={isConferenceModalOpen}
loteId={loteId}
items={items}
nota={{
numero: parsedNfe?.numero,
serie: parsedNfe?.serie,
fornecedor: parsedNfe?.emitente?.nomeFantasia || parsedNfe?.emitente?.nome,
valorNota: parseFloat(parsedNfe?.totais?.icmsTot?.vNF || '0') || 0,
freteAdicional: Number(freteAdicionalInfo?.valor) || 0,
custoAjustado: custoAjustadoTotal,
}}
aprovando={aprovando}
onClose={() => setIsConferenceModalOpen(false)}
onAprovar={handleAprovarEntrada}
/>

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
tipo_recurso: item.tipoRecurso || TIPO_RECURSO_PADRAO,
sku_sugerido: item.skuSugerido || null,
nome_item_sugerido: item.nomeItemSugerido || null,
mapeamento_json: item.mapeamento || null,
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
loading={salvandoFornecedor}
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
onSubmit={handleSalvarFornecedor}
/>
</div>
);
};

export default StockEntryForm;