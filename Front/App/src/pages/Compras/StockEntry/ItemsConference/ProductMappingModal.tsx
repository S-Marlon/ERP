// Mapeamento de uma linha da NF (ou de uma fila de linhas): vincular a um item do catálogo ou cadastrar item novo,
// e depois definir como a nota vira estoque (conversão), o custo base e, para item novo de venda, o preço.
import React, { useEffect, useRef, useState } from "react";
import {
  Alert, Button, Col, Empty, Input, InputNumber, Modal, Progress, Row, Space, Spin, Steps, Tag, Tooltip, Typography,
} from "antd";
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleFilled, CheckOutlined, FileAddOutlined, LinkOutlined,
  LockOutlined, RollbackOutlined, SearchOutlined, StepForwardOutlined,
} from "@ant-design/icons";
import { TIPO_RECURSO_PADRAO, getTipoRecursoConfig } from "../tipoRecurso";
import { buscarItensCatalogo, ItemCatalogoBusca } from "../../api/comprasApi";
import ProductCommercialSalesConfig from "../../../Catalogo/pages/ProductPricingModule/ProductCommercialSalesConfig";
import type { SalvarConfigPayload } from "../../../Catalogo/pages/ProductPricingModule/configVendas.api";
import { ClassificacaoPim, ClassificacaoItem, CLASSIFICACAO_VAZIA } from "./ClassificacaoPim";
import { classificacaoNoRascunho, foraDaVenda } from "../edicaoLote";
import { DEPOSITOS, depositoPadraoDoTipo } from "../depositos";

const { Text } = Typography;

// Formato real dos itens montados no StockEntryForm (initialItems)
interface ProductEntry {
  tempId: string | number;
  nItem?: string | number;
  sku?: string;
  ean?: string;
  descricao?: string;
  ncm?: string;
  unidade?: string;
  quantidade?: number;
  valorUnitario?: number;      // custo unitário efetivo (com frete/IPI/ST)
  valorBaseUnitario?: number;  // custo unitário da nota (vProd / qCom)
  valorTotal?: number;
  ipi?: number;
  tipoRecurso?: string;
  mapeamento?: MappingPayload | null;
  prod?: { CFOP?: string; [key: string]: unknown };
}

export interface MappingPayload {
  mode: "EXISTING_DIRECT" | "DRAFT" | null;
  existingProductId: number | null;
  existingProduct: { sku: string; nome: string; tipo_recurso: string } | null;
  supplierLinkData: {
    sku_fornecedor: string;
    ean_fornecedor: string | null;
    descricao_fornecedor: string;
  };
  salesUnits: SalesUnit[];
  // Como a unidade da NF vira estoque: 1 unidade_compra = fator x unidade_base
  conversaoCompra: {
    unidade_compra: string;
    unidade_base: string;
    fator: number;
  };
  // Item novo: unidades de venda e faixas de preço (gravadas na aprovação da Staging)
  configVendas: SalvarConfigPayload | null;
  draftIdentity: {
    tipo_recurso: string;
    familia_id: number | null;
    // Sem família: categoria escolhida direto (com família, a categoria vem dela)
    categoria_id?: number | null;
    // Valores de atributos preenchidos na entrada (opcional); null = completar no editor de catálogo
    atributos?: Record<number, unknown> | null;
    nome_comercial: string;
    nome_interno: string;
    // Chave da linha na staging (LINHA-n): agrupa linhas do mesmo item novo; nunca vira SKU
    sku_interno: string;
    sku_comercial: string;
    id_unidade: number | undefined;
    custo_unitario_base: number;
    unidade_xml: string | undefined;
  } | null;
}

// Marca de item novo cujo SKU Customizado será a sequência gerada na aprovação (com o id do banco)
export const SKU_A_GERAR = "(a gerar)";
export const chaveDaLinhaNova = (nItem: unknown) => `LINHA-${nItem}`;

// SKU Customizado exibido no pai: o do item vinculado ou, para item novo, o digitado (vazio = gerado na aprovação)
export const getMappedId = (mapping: MappingPayload): number | string | null =>
  mapping.mode === "EXISTING_DIRECT"
    ? mapping.existingProduct?.sku || mapping.existingProductId
    : mapping.mode === "DRAFT" ? (mapping.draftIdentity?.sku_comercial || SKU_A_GERAR) : null;

interface MappingModalProps {
  items: ProductEntry[];
  supplierCnpj: string;
  onMap: (tempId: string | number, data: MappingPayload) => void;
  onClose: () => void;
}

interface SalesUnit {
  type: "WHOLE" | "FRAC";
  unit: string;
  conversion: number;
  cost: number;
  markup: number;
  price: number;
}

type Modo = "EXISTING_DIRECT" | "DRAFT" | null;

const EMPTY_ITEM: ProductEntry = { tempId: "" };
const brl = (v: number, casas = 2) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: casas });
const qtd = (v: number) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });

const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#434343", display: "block", marginBottom: 4 };
const ajuda: React.CSSProperties = { fontSize: 11, color: "#8c8c8c", display: "block", marginTop: 3 };
const secao: React.CSSProperties = { border: "1px solid #f0f0f0", borderRadius: 8, padding: 12, background: "#fff" };

const ProductMappingModal: React.FC<MappingModalProps> = ({ items = [], onMap, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isBatch = items.length > 1;
  const ultimo = currentIndex >= items.length - 1;
  const currentItem: ProductEntry = items[currentIndex] ?? EMPTY_ITEM;
  const unidadeNf = (currentItem.unidade || "UN").toUpperCase();
  const tipo = currentItem.tipoRecurso || TIPO_RECURSO_PADRAO;
  const tipoCfg = getTipoRecursoConfig(tipo);

  const [step, setStep] = useState(0);
  const [modo, setModo] = useState<Modo>(null);

  // Vincular a item existente
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<ItemCatalogoBusca | null>(null);
  const [resultados, setResultados] = useState<ItemCatalogoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const buscaRef = useRef<any>(null);

  // Item novo
  const [nome, setNome] = useState("");
  const [nomeComercial, setNomeComercial] = useState("");
  const [skuCustomizado, setSkuCustomizado] = useState("");
  const [classificacao, setClassificacao] = useState<ClassificacaoItem>(CLASSIFICACAO_VAZIA);

  // Conversão de compra (unidade da NF -> unidade base de estoque) e preço do item novo
  const [convUnidadeBase, setConvUnidadeBase] = useState<string>(unidadeNf);
  const [convFator, setConvFator] = useState<number>(1);
  const [configVendas, setConfigVendas] = useState<SalvarConfigPayload | null>(null);

  // Ao trocar de item da fila: começa do que já estava salvo na linha (reabrir para corrigir) ou do zero
  useEffect(() => {
    const m = currentItem.mapeamento;
    const d = m?.mode === "DRAFT" ? m.draftIdentity : null;
    setStep(0);
    setBusca("");
    setResultados([]);
    setConfigVendas(null);
    setModo(m?.mode ?? null);
    setSelecionado(m?.mode === "EXISTING_DIRECT" && m.existingProductId ? {
      id: m.existingProductId,
      sku: m.existingProduct?.sku || "",
      name: m.existingProduct?.nome || "",
      tipoRecurso: m.existingProduct?.tipo_recurso || tipo,
      unitOfMeasure: m.conversaoCompra?.unidade_base || "",
      variacao: "", marca: "", category: "", status: "ATIVO",
    } : null);
    // Nome do item = descrição da nota (travado); o nome comercial começa igual e é o que se edita
    setNome(currentItem.descricao || d?.nome_interno || "");
    setNomeComercial(d?.nome_comercial || currentItem.descricao || "");
    setSkuCustomizado(d ? d.sku_comercial : (foraDaVenda(tipo) ? "" : currentItem.sku || ""));
    setClassificacao(d ? {
      familiaId: d.familia_id ?? null, categoriaId: d.categoria_id ?? null, atributos: d.atributos ?? null,
    } : CLASSIFICACAO_VAZIA);
    setConvUnidadeBase((m?.conversaoCompra?.unidade_base || unidadeNf).toUpperCase());
    setConvFator(m?.conversaoCompra?.fator || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, currentItem.tempId]);

  useEffect(() => {
    if (modo === "EXISTING_DIRECT" && step === 0) setTimeout(() => buscaRef.current?.focus(), 50);
  }, [modo, step]);

  // Busca no catálogo com debounce
  useEffect(() => {
    if (modo !== "EXISTING_DIRECT") return;
    const termo = busca.trim();
    if (termo.length < 2) { setResultados([]); setErroBusca(null); setBuscando(false); return; }
    const controller = new AbortController();
    setBuscando(true);
    const timer = setTimeout(() => {
      buscarItensCatalogo(termo, 1, controller.signal)
        .then(r => { setResultados(r); setErroBusca(null); })
        .catch(err => { if (err.name !== "AbortError") { setResultados([]); setErroBusca(err.message || "Erro ao buscar itens."); } })
        .finally(() => { if (!controller.signal.aborted) setBuscando(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busca, modo]);

  const itemForaDaVenda = modo === "DRAFT" && foraDaVenda(tipo);
  const unidadeBaseTravada = modo === "EXISTING_DIRECT" && Boolean(selecionado?.unitOfMeasure);

  // Custo por unidade da NF (nota + IPI + frete/ST) e custo base por unidade de estoque
  const custoNota = currentItem.valorBaseUnitario || 0;
  const custoIpi = (currentItem.ipi || 0) / (currentItem.quantidade || 1);
  const custoFinal = currentItem.valorUnitario || 0;
  const custoOutros = Math.max(0, custoFinal - custoNota - custoIpi);
  const custoBase = convFator > 0 ? custoFinal / convFator : 0;
  const composicao = (
    <div style={{ fontSize: 12 }}>
      <div>Nota: {brl(custoNota, 4)}</div>
      <div>IPI: {brl(custoIpi, 4)}</div>
      <div>Frete/ST/outros rateados: {brl(custoOutros, 4)}</div>
    </div>
  );

  // SKU Customizado é único: avisa na hora se já existe no catálogo ou se usa o formato das sequências do sistema
  const [skuEmUso, setSkuEmUso] = useState<ItemCatalogoBusca | null>(null);
  const skuDigitado = skuCustomizado.trim();
  const skuReservado = /^(IT|CON|ATV|TMP)-\d+$/i.test(skuDigitado);
  useEffect(() => {
    setSkuEmUso(null);
    if (modo !== "DRAFT" || skuDigitado.length < 2 || skuReservado) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      buscarItensCatalogo(skuDigitado, 1, controller.signal)
        .then(r => setSkuEmUso(r.find(x => String(x.sku).trim().toUpperCase() === skuDigitado.toUpperCase()) || null))
        .catch(() => { /* a aprovação confere de novo */ });
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [skuDigitado, modo, skuReservado]);

  const passo1Ok = modo === "EXISTING_DIRECT"
    ? selecionado !== null
    : modo === "DRAFT" ? nome.trim() !== "" && !skuReservado && !skuEmUso : false;
  const passo2Ok = convFator > 0 && convUnidadeBase.trim() !== "" && (modo !== "DRAFT" || itemForaDaVenda || configVendas !== null);

  const escolherModo = (m: Modo) => {
    setModo(m);
    if (m === "DRAFT") { setSelecionado(null); setConvUnidadeBase(unidadeNf); }
  };

  const escolherExistente = (r: ItemCatalogoBusca) => {
    setSelecionado(r);
    setConvUnidadeBase((r.unitOfMeasure || unidadeNf).toUpperCase());
  };

  const avancarFila = () => (ultimo ? onClose() : setCurrentIndex(i => i + 1));

  const confirmar = () => {
    const payload: MappingPayload = {
      mode: modo,
      existingProductId: modo === "EXISTING_DIRECT" ? selecionado?.id ?? null : null,
      existingProduct: modo === "EXISTING_DIRECT" && selecionado
        ? { sku: selecionado.sku, nome: selecionado.name, tipo_recurso: selecionado.tipoRecurso }
        : null,
      supplierLinkData: {
        sku_fornecedor: currentItem.sku || "",
        ean_fornecedor: currentItem.ean || null,
        descricao_fornecedor: currentItem.descricao || "",
      },
      salesUnits: [],
      conversaoCompra: { unidade_compra: unidadeNf, unidade_base: convUnidadeBase.trim().toUpperCase(), fator: convFator },
      configVendas: modo === "DRAFT" && !itemForaDaVenda ? configVendas : null,
      draftIdentity: modo === "DRAFT" ? {
        tipo_recurso: tipo,
        ...classificacaoNoRascunho(classificacao),
        nome_interno: nome.trim(),
        nome_comercial: nomeComercial.trim() || nome.trim(),
        sku_interno: chaveDaLinhaNova(currentItem.nItem ?? currentIndex + 1),
        sku_comercial: skuCustomizado.trim(),
        id_unidade: 1,
        custo_unitario_base: custoFinal,
        unidade_xml: currentItem.unidade,
      } : null,
    };
    onMap(currentItem.tempId, payload);
    avancarFila();
  };

  // ---------------------------------------------------------------- partes da tela

  const cabecalhoItem = (
    <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 260 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>Item {currentItem.nItem ?? currentIndex + 1} da nota</Text>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{currentItem.descricao}</div>
        <Space size={10} wrap style={{ fontSize: 11, color: "#8c8c8c", marginTop: 2 }}>
          <span>Cód. forn.: <b style={{ color: "#595959" }}>{currentItem.sku || "—"}</b></span>
          <span>GTIN: <b style={{ color: "#595959" }}>{currentItem.ean && currentItem.ean !== "SEM GTIN" ? currentItem.ean : "—"}</b></span>
          <span>NCM: {currentItem.ncm || "—"}</span>
          {currentItem.prod?.CFOP && <span>CFOP: {String(currentItem.prod.CFOP)}</span>}
        </Space>
      </div>
      <div style={{ textAlign: "right" }}>
        <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Quantidade</Text>
        <b style={{ fontSize: 15 }}>{qtd(currentItem.quantidade || 0)} {unidadeNf}</b>
      </div>
      <Tooltip title={composicao}>
        <div style={{ textAlign: "right", cursor: "help" }}>
          <Text type="secondary" style={{ fontSize: 11, display: "block", borderBottom: "1px dashed #d9d9d9" }}>Custo final / {unidadeNf}</Text>
          <b style={{ fontSize: 15, color: "#d4380d" }}>{brl(custoFinal)}</b>
        </div>
      </Tooltip>
      <Tooltip title="Tipo de entrada da linha. Para mudar, use o botão 'Tipo de entrada' na conferência.">
        <Tag color={tipoCfg.color} style={{ margin: 0, padding: "2px 10px", fontSize: 12 }}>{tipoCfg.label}</Tag>
      </Tooltip>
    </div>
  );

  const opcao = (m: Exclude<Modo, null>, icone: React.ReactNode, titulo: string, descricao: string) => {
    const ativo = modo === m;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => escolherModo(m)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") escolherModo(m); }}
        style={{
          flex: 1, cursor: "pointer", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
          border: ativo ? "2px solid #1677ff" : "1px solid #d9d9d9", background: ativo ? "#f0f7ff" : "#fff", transition: "all .15s",
        }}
      >
        <div style={{ fontSize: 22, color: ativo ? "#1677ff" : "#8c8c8c", lineHeight: 1 }}>{icone}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{titulo}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{descricao}</Text>
        </div>
        {ativo && <CheckCircleFilled style={{ color: "#1677ff", fontSize: 16 }} />}
      </div>
    );
  };

  const linhaResultado = (r: ItemCatalogoBusca) => {
    const ativo = selecionado?.id === r.id;
    const t = getTipoRecursoConfig(r.tipoRecurso);
    return (
      <div
        key={r.id}
        onClick={() => escolherExistente(r)}
        style={{
          padding: "8px 10px", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", gap: 10,
          background: ativo ? "#e6f4ff" : undefined, border: ativo ? "1px solid #91caff" : "1px solid transparent",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong={ativo} ellipsis style={{ display: "block", fontSize: 13 }}>{r.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.sku}
            {r.variacao && r.variacao !== "Principal" ? ` · ${r.variacao}` : ""}
            {r.marca ? ` · ${r.marca}` : ""}
            {r.category ? ` · ${r.category}` : ""}
          </Text>
        </div>
        <Space size={4}>
          {r.unitOfMeasure && <Tag style={{ margin: 0 }}>{r.unitOfMeasure}</Tag>}
          {r.status !== "ATIVO" && <Tag color="red" style={{ margin: 0 }}>{r.status}</Tag>}
          <Tag color={t.color} style={{ margin: 0 }}>{t.short}</Tag>
          {ativo ? <CheckCircleFilled style={{ color: "#1677ff" }} /> : <span style={{ width: 14 }} />}
        </Space>
      </div>
    );
  };

  const painelVincular = (
    <div style={secao}>
      <Input
        ref={buscaRef}
        size="large"
        allowClear
        prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
        placeholder="Buscar no catálogo por SKU, nome, variação ou marca"
        value={busca}
        onChange={e => setBusca(e.target.value)}
      />
      {selecionado && !resultados.some(r => r.id === selecionado.id) && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Selecionado</Text>
          {linhaResultado(selecionado)}
        </div>
      )}
      <div style={{ maxHeight: 280, overflowY: "auto", marginTop: 8 }}>
        {buscando ? (
          <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>
        ) : erroBusca ? (
          <Alert type="error" showIcon message={erroBusca} />
        ) : resultados.length === 0 ? (
          busca.trim().length >= 2
            ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>Nada encontrado. Se o item ainda não existe, <a onClick={() => escolherModo("DRAFT")}>cadastre como novo</a>.</span>} />
            : !selecionado && <Text type="secondary" style={{ fontSize: 12, display: "block", padding: "12px 4px" }}>Digite ao menos 2 letras para buscar.</Text>
        ) : (
          resultados.map(linhaResultado)
        )}
      </div>
    </div>
  );

  const painelNovo = (
    <div style={secao}>
      <Row gutter={[16, 12]}>
        <Col span={14}>
          <span style={rotulo}>Nome do item <Text type="secondary" style={{ fontWeight: 400, fontSize: 11 }}>(da nota)</Text></span>
          <Tooltip title="Nome como veio na nota fiscal. Para o nome de exibição, edite o nome comercial.">
            <Input value={nome} disabled prefix={<LockOutlined style={{ color: "#bfbfbf" }} />} />
          </Tooltip>
        </Col>
        <Col span={10}>
          <span style={rotulo}>Nome comercial <Text type="secondary" style={{ fontWeight: 400, fontSize: 11 }}>(opcional)</Text></span>
          <Input value={nomeComercial} onChange={e => setNomeComercial(e.target.value)} placeholder="Igual ao nome do item" allowClear />
          {nomeComercial !== nome && (
            <a style={{ fontSize: 11 }} onClick={() => setNomeComercial(nome)}><RollbackOutlined /> igual ao nome da nota</a>
          )}
        </Col>
        <Col span={14}>
          <span style={rotulo}>SKU Customizado</span>
          <Input
            value={skuCustomizado}
            onChange={e => setSkuCustomizado(e.target.value)}
            status={skuReservado || skuEmUso ? "error" : undefined}
            placeholder={`Vazio = sequência gerada na aprovação (${foraDaVenda(tipo) ? (String(tipo).toUpperCase() === "ATIVO" ? "ATV" : "CON") : "IT"}-000123)`}
          />
          {skuEmUso ? (
            <span style={{ ...ajuda, color: "#cf1322" }}>
              Já existe no catálogo: {skuEmUso.name}.{" "}
              <a onClick={() => { setModo("EXISTING_DIRECT"); escolherExistente(skuEmUso); }}>Vincular a ele</a> ou use outro SKU.
            </span>
          ) : skuReservado ? (
            <span style={{ ...ajuda, color: "#cf1322" }}>Formato reservado às sequências do sistema: deixe vazio para gerar ou use outro código.</span>
          ) : (
            <span style={ajuda}>Código que aparece no catálogo e no PDV (único). O código interno é a sequência do banco.</span>
          )}
        </Col>
        <Col span={10}>
          <span style={rotulo}>Vai para</span>
          <Space size={6}>
            <Tag color={tipoCfg.color} style={{ margin: 0 }}>{tipoCfg.label}</Tag>
            <Tag color={DEPOSITOS[depositoPadraoDoTipo(tipo)].color} style={{ margin: 0 }}>{DEPOSITOS[depositoPadraoDoTipo(tipo)].label}</Tag>
          </Space>
          <span style={ajuda}>Tipo e destino são definidos na tabela da conferência.</span>
        </Col>
      </Row>

      <div style={{ borderTop: "1px solid #f0f0f0", margin: "14px 0 10px" }} />
      <span style={rotulo}>Classificação no catálogo <Text type="secondary" style={{ fontWeight: 400, fontSize: 11 }}>(opcional, dá para completar depois)</Text></span>
      <ClassificacaoPim value={classificacao} onChange={setClassificacao} />
    </div>
  );

  const painelConversaoECusto = (
    <Row gutter={8}>
      <Col span={12}>
        <div style={{ ...secao, height: "100%" }}>
          <span style={rotulo}>Como a nota vira estoque</span>
          <Space align="center" wrap>
            <Text>1 <b>{unidadeNf}</b> =</Text>
            <InputNumber min={0.000001} value={convFator} onChange={v => setConvFator(Number(v) || 0)} style={{ width: 100 }} />
            {unidadeBaseTravada ? (
              <Tooltip title="Unidade de estoque do item já cadastrado"><Tag color="purple" style={{ margin: 0, padding: "2px 10px" }}>{convUnidadeBase}</Tag></Tooltip>
            ) : (
              <Input value={convUnidadeBase} maxLength={10} onChange={e => setConvUnidadeBase(e.target.value.toUpperCase())} style={{ width: 80 }} placeholder="UN" />
            )}
          </Space>
          <span style={ajuda}>
            Esta nota: {qtd(currentItem.quantidade || 0)} {unidadeNf} → <b style={{ color: "#262626" }}>{qtd((currentItem.quantidade || 0) * convFator)} {convUnidadeBase || "?"}</b> no estoque
          </span>
        </div>
      </Col>
      <Col span={12}>
        <div style={{ ...secao, height: "100%", background: "#fffdf5", borderColor: "#ffe7ba" }}>
          <span style={rotulo}>Custo base por {convUnidadeBase || "?"}</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#d4380d", lineHeight: 1.2 }}>{brl(custoBase, 4)}</div>
          <Tooltip title={composicao}>
            <span style={{ ...ajuda, cursor: "help" }}>
              Custo final {brl(custoFinal, 4)} / {unidadeNf}{convFator !== 1 ? ` ÷ ${qtd(convFator)}` : ""}
              {" · "}{itemForaDaVenda ? "custo de entrada no estoque" : "o markup é aplicado sobre este valor"}
            </span>
          </Tooltip>
        </div>
      </Col>
    </Row>
  );

  const painelPreco = itemForaDaVenda ? (
    <Alert
      type="info"
      showIcon
      message="Fora da venda: não precisa de preço"
      description={`Entra no ${DEPOSITOS[depositoPadraoDoTipo(tipo)].label} pelo custo da nota e não aparece no PDV. Se um dia for vendido, mude o tipo e configure o preço no editor de catálogo.`}
    />
  ) : modo === "DRAFT" ? (
    <div style={secao}>
      <span style={rotulo}>Preço de venda</span>
      <ProductCommercialSalesConfig
        rascunho={{ unidadeBase: convUnidadeBase, unidadeCompra: unidadeNf, fatorCompra: convFator, custoUnidadeCompra: custoFinal, nomeItem: nomeComercial.trim() || nome }}
        onRascunhoChange={setConfigVendas}
      />
    </div>
  ) : (
    <Alert
      type="success"
      showIcon
      icon={<LinkOutlined />}
      message={<span>Vinculado a <b>{selecionado?.name}</b> <Text type="secondary">({selecionado?.sku})</Text></span>}
      description="O preço continua o já configurado no item. Se esta entrada mudar o custo, o item fica sinalizado como custo defasado para revisão de preço."
    />
  );

  // ---------------------------------------------------------------- modal

  return (
    <Modal
      open
      onCancel={onClose}
      width={1100}
      destroyOnClose
      styles={{ body: { paddingTop: 2 } }}
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 32, gap: 8 }}>
          <span>{modo === "DRAFT" ? "Cadastrar item da nota" : modo === "EXISTING_DIRECT" ? "Vincular item da nota" : "Vincular ou cadastrar item da nota"}</span>
          {isBatch && (
            <Space size={8}>
              <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>Item {currentIndex + 1} de {items.length}</Text>
              <Progress percent={Math.round((currentIndex / items.length) * 100)} showInfo={false} size="small" style={{ width: 120, margin: 0 }} />
            </Space>
          )}
        </div>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <Button onClick={onClose}>{isBatch ? "Fechar fila" : "Cancelar"}</Button>
            {isBatch && !ultimo && (
              <Tooltip title="Deixa esta linha como está e vai para a próxima">
                <Button icon={<StepForwardOutlined />} onClick={() => setCurrentIndex(i => i + 1)}>Pular</Button>
              </Tooltip>
            )}
          </Space>
          <Space>
            {step === 1 && <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(0)}>Voltar</Button>}
            {step === 0 ? (
              <Button type="primary" disabled={!passo1Ok} onClick={() => setStep(1)}>
                Próximo <ArrowRightOutlined />
              </Button>
            ) : (
              <Button type="primary" icon={<CheckOutlined />} disabled={!passo2Ok} onClick={confirmar}>
                {modo === "EXISTING_DIRECT" ? "Confirmar vínculo" : "Confirmar cadastro"}
                {isBatch ? (ultimo ? " e finalizar" : " e ir ao próximo") : ""}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {cabecalhoItem}

        <Steps
          size="small"
          current={step}
          onChange={s => { if (s === 0 || passo1Ok) setStep(s); }}
          items={[
            { title: modo === "EXISTING_DIRECT" ? "Item do catálogo" : modo === "DRAFT" ? "Dados do item" : "Vincular ou cadastrar" },
            { title: itemForaDaVenda ? "Estoque e custo" : modo === "EXISTING_DIRECT" ? "Estoque e custo" : "Estoque, custo e preço", disabled: !passo1Ok },
          ]}
        />

        {step === 0 && (
          <>
            <div style={{ display: "flex", gap: 12 }}>
              {opcao("EXISTING_DIRECT", <LinkOutlined />, "Vincular a um item do catálogo", "O item já existe: esta entrada soma ao estoque dele.")}
              {opcao("DRAFT", <FileAddOutlined />, "Cadastrar item novo", "O item é criado no catálogo quando a nota for aprovada.")}
            </div>
            {modo === "EXISTING_DIRECT" && painelVincular}
            {modo === "DRAFT" && painelNovo}
          </>
        )}

        {step === 1 && (
          <>
            {painelConversaoECusto}
            {painelPreco}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default ProductMappingModal;
