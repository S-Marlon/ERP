import { useEffect, useState } from "react";
import { Card, Space, Input, Empty, Button, Tooltip, Alert, Select, Tag, Popconfirm, Modal, message } from "antd";
import {
  ShoppingCartOutlined,
  SearchOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  PlusOutlined,
  EditOutlined,
  DisconnectOutlined,
} from "@ant-design/icons";
import { buscarItensCatalogo, ItemCatalogoBusca } from "../../../Compras/api/comprasApi";
import { vincularItensFamilia } from "./FamilyManager.api";
import ProductDetailsDrawer from "../CatalogSkus/ProductDetailsDrawer";
import { updateProduto } from "../CatalogSkus/CatalogSku.service";

// Tipagens
interface Atributo {
  id?: string | number;
  nome: string;
}

interface ItemFamilia {
  id: string | number;
  sku: string;
  nome?: string;
  nomeItem?: string;
  nomeComercial?: string;
  nomeCalculado?: string;
  valoresAtributos?: Record<string, any>;
  atributosPendentes?: string[];
}

interface GrupoSelecionado {
  id: string | number;
  nome?: string;
  atributos?: Atributo[];
  [key: string]: any;
  marcaComportamento?: 'dna' | 'grade' | 'ficha' | string; // Adicionar esta linha
}

interface ItensFamiliaCardProps {
  brandColor?: string;
  grupoSelecionado: GrupoSelecionado | null;
  pesquisaItem: string;
  setPesquisaItem: (value: string) => void;
  itensFiltradosDoGrupo: ItemFamilia[];
  temAlteracoes?: boolean;
  gerarPreviewSku?: (grupo: GrupoSelecionado, atributos: Atributo[], valores: Record<string, any>) => string;
  gerarPreviewNome?: (grupo: GrupoSelecionado, valores: Record<string, any>) => string;
  handleEditarAtributosItem: (item: ItemFamilia) => void;
  handleNormalizarItemNome: (item: ItemFamilia) => void;
  handleNormalizarItemSku: (item: ItemFamilia) => void;
  handleTentarNormalizarIndividual: (item: ItemFamilia) => void;
  handleProcessarFormalizacaoLote: () => void;
  handlePadronizarNomesFamilia: () => void;
  handlePadronizarSkusFamilia: () => void;
  // Chamado depois de incluir/tirar itens ou editar a ficha de um item (recarrega a lista)
  onItensAlterados?: () => void;
}

export default function ItensFamiliaCard({
  brandColor = "#1677ff",
  grupoSelecionado,
  pesquisaItem,
  setPesquisaItem,
  itensFiltradosDoGrupo = [],
  temAlteracoes = false,
  gerarPreviewSku,
  gerarPreviewNome,
  handleEditarAtributosItem,
  handleNormalizarItemNome,
  handleNormalizarItemSku,
  handleTentarNormalizarIndividual,
  handleProcessarFormalizacaoLote,
  handlePadronizarNomesFamilia,
  handlePadronizarSkusFamilia,
  onItensAlterados,
}: ItensFamiliaCardProps) {
  // Incluir itens: busca no catálogo (vários de uma vez)
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ItemCatalogoBusca[]>([]);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [conhecidos, setConhecidos] = useState<Record<number, ItemCatalogoBusca>>({});
  const [salvando, setSalvando] = useState(false);
  const [itemEditando, setItemEditando] = useState<ItemFamilia | null>(null);
  const idFamilia = grupoSelecionado?.id;

  useEffect(() => { setEscolhidos([]); setTermo(""); setResultados([]); }, [idFamilia]);

  useEffect(() => {
    if (termo.trim().length < 2) { setResultados([]); return; }
    const controller = new AbortController();
    const t = setTimeout(() => {
      buscarItensCatalogo(termo, 1, controller.signal)
        .then((r) => {
          setResultados(r);
          setConhecidos((prev) => ({ ...prev, ...Object.fromEntries(r.map((i) => [i.id, i])) }));
        })
        .catch(() => setResultados([]));
    }, 300);
    return () => { clearTimeout(t); controller.abort(); };
  }, [termo]);

  const idsNaFamilia = new Set((itensFiltradosDoGrupo ?? []).map((i) => String(i.id)));

  const incluir = async (ids: number[], mover = false) => {
    if (!idFamilia || ids.length === 0) return;
    setSalvando(true);
    try {
      const r = await vincularItensFamilia(idFamilia, ids, "adicionar", mover);
      if (r.alterados > 0) {
        message.success(`${r.alterados} item(ns) incluído(s). Preencha os atributos de grade pela engrenagem de cada item.`);
      }
      setEscolhidos([]);
      setTermo("");
      onItensAlterados?.();
      if (r.emOutraFamilia.length > 0) {
        Modal.confirm({
          title: `${r.emOutraFamilia.length} item(ns) já estão em outra família`,
          content: (
            <div>
              Mover para "{grupoSelecionado?.nome}"? Eles saem da família atual e passam a usar os atributos desta.
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {r.emOutraFamilia.map((i) => <li key={i.idItem}>{i.sku} (família {i.familia})</li>)}
              </ul>
            </div>
          ),
          okText: "Mover para esta família",
          cancelText: "Deixar como está",
          onOk: () => incluir(r.emOutraFamilia.map((i) => i.idItem), true),
        });
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Erro ao incluir itens.");
    } finally {
      setSalvando(false);
    }
  };

  const tirar = async (item: ItemFamilia) => {
    if (!idFamilia) return;
    try {
      await vincularItensFamilia(idFamilia, [Number(item.id)], "remover");
      message.success(`${item.sku} saiu da família.`);
      onItensAlterados?.();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Erro ao tirar o item da família.");
    }
  };

  return (
      <Card
        title={
          <Space size={6}>
            <ShoppingCartOutlined style={{ color: brandColor }} />
            <span style={{ fontWeight: 700, fontSize: "14px" }}>
              Itens da Família
            </span>
            {grupoSelecionado && <Tag style={{ margin: 0, fontSize: 10 }}>{(itensFiltradosDoGrupo ?? []).length}</Tag>}
          </Space>
        }
        style={{
          borderRadius: 10,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          height: "100%",
        }}
        styles={{
          header: {
            borderBottom: "1px solid #f1f5f9",
            background: "#f8fafc",
            borderRadius: "8px 8px 0 0",
            minHeight: "24px",
            padding: "0 6px",
          },
          body: { padding: "6px" },
        }}
      >
        {grupoSelecionado ? (
          <Space direction="vertical" size={6} style={{ width: "100%" }}>
            {/* Incluir itens na família */}
            <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, padding: 6 }}>
              <Select
                mode="multiple"
                size="small"
                style={{ width: "100%" }}
                placeholder="+ Incluir itens: buscar SKU ou nome..."
                value={escolhidos}
                onChange={setEscolhidos}
                showSearch
                filterOption={false}
                searchValue={termo}
                onSearch={setTermo}
                maxTagCount="responsive"
                notFoundContent={termo.trim().length < 2 ? "Digite ao menos 2 letras" : "Nenhum item encontrado"}
                options={resultados.map((i) => {
                  const jaAqui = idsNaFamilia.has(String(i.id));
                  return {
                    value: i.id,
                    disabled: jaAqui,
                    label: (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 11 }}>{i.sku}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{i.name}</span>
                        {jaAqui ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>nesta família</Tag>
                          : i.category ? <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>{i.category}</Tag> : null}
                      </div>
                    ),
                  };
                })}
                labelRender={({ value }) => conhecidos[Number(value)]?.sku || String(value)}
              />
              {escolhidos.length > 0 && (
                <Button
                  type="primary"
                  size="small"
                  block
                  icon={<PlusOutlined />}
                  loading={salvando}
                  style={{ marginTop: 6, background: brandColor, borderColor: brandColor }}
                  onClick={() => incluir(escolhidos)}
                >
                  Incluir {escolhidos.length} item(ns) nesta família
                </Button>
              )}
            </div>

            <Input
              size="small"
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Filtrar SKU ou nome..."
              value={pesquisaItem}
              onChange={(e) => setPesquisaItem(e.target.value)}
              allowClear
              style={{ borderRadius: 6 }}
            />

            <div
              style={{
                maxHeight: "360px",
                overflowY: "auto",
                paddingRight: "6px",
              }}
            >
              {(itensFiltradosDoGrupo ?? []).length > 0 ? (
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  {(itensFiltradosDoGrupo ?? []).map((item) => {
                    const skuEsperado =
                      typeof gerarPreviewSku === "function"
                        ? gerarPreviewSku(
                            grupoSelecionado,
                            grupoSelecionado.atributos || [],
                            item.valoresAtributos || {}
                          )
                        : item.sku;

                    const nomeProcessado =
                      item.nomeCalculado ||
                      (typeof gerarPreviewNome === "function"
                        ? gerarPreviewNome(grupoSelecionado, item.valoresAtributos || {})
                        : item.nome);

                    const nomeEsperado =
                      nomeProcessado && !nomeProcessado.includes("[")
                        ? nomeProcessado
                        : item.nome;

                    const possuiAtributosFaltantes = Array.isArray(
                      item.atributosPendentes
                    )
                      ? item.atributosPendentes.length > 0
                      : (grupoSelecionado?.atributos || []).some((attr) => {
                          const valor = item.valoresAtributos?.[attr.id || attr.nome];
                          return !valor || String(valor).trim() === "";
                        });

                    const divergenciaSku = Boolean(
                      skuEsperado && item.sku !== skuEsperado
                    );
                    const divergenciaNome = Boolean(
                      nomeEsperado && item.nome !== nomeEsperado
                    );

                    let tipoDivergencia: string | null = null;
                    if (possuiAtributosFaltantes) {
                      tipoDivergencia = "Atributos não formalizados";
                    } else if (divergenciaSku && divergenciaNome) {
                      tipoDivergencia = "SKU e Nome divergentes";
                    } else if (divergenciaSku) {
                      tipoDivergencia = "SKU divergente";
                    } else if (divergenciaNome) {
                      tipoDivergencia = "Nome divergente";
                    }

                    const temAlerta = Boolean(tipoDivergencia);

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "12px",
                          backgroundColor: temAlerta ? "#fffbeb" : "#ffffff",
                          borderRadius: "8px",
                          border: `1px solid ${temAlerta ? "#fde68a" : "#e2e8f0"}`,
                          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.02)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: "4px",
                            backgroundColor: possuiAtributosFaltantes
                              ? "#ef4444"
                              : temAlerta
                              ? "#d97706"
                              : "#22c55e",
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingLeft: "6px",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "12px",
                              color: "#0f172a",
                              fontFamily: "monospace",
                            }}
                          >
                            {item.sku}
                          </span>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {temAlerta && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  backgroundColor: possuiAtributosFaltantes
                                    ? "#fee2e2"
                                    : "#fef3c7",
                                  color: possuiAtributosFaltantes
                                    ? "#991b1b"
                                    : "#b45309",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  border: `1px solid ${
                                    possuiAtributosFaltantes ? "#fca5a5" : "#fcd34d"
                                  }`,
                                }}
                              >
                                {tipoDivergencia}
                              </span>
                            )}

                            <Tooltip title="Alterar atributos do item">
                              <Button
                                type="text"
                                size="small"
                                icon={
                                  <SettingOutlined
                                    style={{ fontSize: "13px", color: "#64748b" }}
                                  />
                                }
                                style={{
                                  height: 22,
                                  width: 22,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  padding: 0,
                                }}
                                onClick={() => handleEditarAtributosItem(item)}
                              />
                            </Tooltip>
                            <Tooltip title="Abrir a ficha do item (nome, preço, fiscal...)">
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined style={{ fontSize: "13px", color: "#64748b" }} />}
                                style={{ height: 22, width: 22, padding: 0 }}
                                onClick={() => setItemEditando(item)}
                              />
                            </Tooltip>
                            <Popconfirm
                              title="Tirar este item da família?"
                              description="Ele fica sem família e mantém a categoria dela."
                              okText="Tirar"
                              cancelText="Cancelar"
                              onConfirm={() => tirar(item)}
                            >
                              <Tooltip title="Tirar da família">
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DisconnectOutlined style={{ fontSize: "13px" }} />}
                                  style={{ height: 22, width: 22, padding: 0 }}
                                />
                              </Tooltip>
                            </Popconfirm>
                          </div>
                        </div>

                        <div
                          style={{
                            paddingLeft: "6px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11.5px",
                              color: "#334155",
                              lineHeight: "1.4",
                              fontWeight: 500,
                            }}
                          >
                            Prod:{" "}
                            {item.nome ||
                              item.nomeItem ||
                              item.nomeComercial ||
                              "Produto sem nome"}
                          </span>
                        </div>

                        {temAlerta && !possuiAtributosFaltantes && (
                          <div
                            style={{
                              marginTop: "4px",
                              paddingTop: "8px",
                              borderTop: "1px dashed #fde68a",
                              display: "grid",
                              gridTemplateColumns: "repeat(3, 1fr)",
                              gap: "4px",
                            }}
                          >
                            <Button
                              size="small"
                              type="default"
                              disabled={temAlteracoes}
                              style={{
                                fontSize: "10px",
                                padding: "0 2px",
                                height: "24px",
                                color: "#b45309",
                                borderColor: "#fcd34d",
                                backgroundColor: "#fff",
                              }}
                              onClick={() => handleNormalizarItemNome(item)}
                            >
                              Corrigir Nome
                            </Button>

                            <Button
                              size="small"
                              type="default"
                              disabled={temAlteracoes}
                              style={{
                                fontSize: "10px",
                                padding: "0 2px",
                                height: "24px",
                                color: "#b45309",
                                borderColor: "#fcd34d",
                                backgroundColor: "#fff",
                              }}
                              onClick={() => handleNormalizarItemSku(item)}
                            >
                              Corrigir SKU
                            </Button>

                            <Button
                              size="small"
                              type="primary"
                              disabled={temAlteracoes}
                              style={{
                                fontSize: "10px",
                                padding: "0 2px",
                                height: "24px",
                                backgroundColor: "#d97706",
                                borderColor: "#d97706",
                              }}
                              onClick={() => handleTentarNormalizarIndividual(item)}
                            >
                              Padronizar Ambos
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </Space>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                      Nenhum SKU encontrado
                    </span>
                  }
                />
              )}
            </div>

            {/* Ações em Lote */}
            <Space
              direction="vertical"
              size={8}
              style={{ width: "100%", marginTop: "4px" }}
            >
              {temAlteracoes && (
                <Alert
                  type="warning"
                  showIcon
                  message="Salve as alterações da família antes de executar padronizações em lote."
                  style={{
                    fontSize: "11px",
                    padding: "4px 8px",
                    marginBottom: "4px",
                  }}
                />
              )}

              <Tooltip
                title={temAlteracoes ? "Salve as alterações pendentes primeiro" : ""}
              >
                <Button
                  type="dashed"
                  size="small"
                  block
                  disabled={temAlteracoes}
                  icon={<ThunderboltOutlined />}
                  style={{
                    borderColor: temAlteracoes ? "#d9d9d9" : brandColor,
                    color: temAlteracoes ? "rgba(0, 0, 0, 0.25)" : brandColor,
                    borderRadius: 6,
                    height: "30px",
                  }}
                  onClick={handleProcessarFormalizacaoLote}
                >
                  Formalizar / Gerar Lote SKU
                </Button>
              </Tooltip>

              <Tooltip
                title={temAlteracoes ? "Salve as alterações pendentes primeiro" : ""}
              >
                <Button
                  type="default"
                  size="small"
                  block
                  disabled={temAlteracoes}
                  onClick={handlePadronizarNomesFamilia}
                  style={{ height: "28px" }}
                >
                  Padronizar Nomes da Família (Lote)
                </Button>
              </Tooltip>

              <Tooltip
                title={temAlteracoes ? "Salve as alterações pendentes primeiro" : ""}
              >
                <Button
                  type="default"
                  size="small"
                  block
                  disabled={temAlteracoes}
                  onClick={handlePadronizarSkusFamilia}
                  style={{ height: "28px" }}
                >
                  Padronizar SKUs da Família (Lote)
                </Button>
              </Tooltip>
            </Space>
          </Space>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                Selecione uma família para ver os itens
              </span>
            }
          />
        )}

        <ProductDetailsDrawer
          open={Boolean(itemEditando)}
          product={itemEditando ? { id_item: itemEditando.id, sku: itemEditando.sku, nome: itemEditando.nome } : null}
          onClose={() => { setItemEditando(null); onItensAlterados?.(); }}
          onSave={async (id, campos) => {
            try {
              await updateProduto(Number(id), campos);
              message.success("Item atualizado.");
            } catch (e) {
              message.error(e instanceof Error ? e.message : "Erro ao salvar o item.");
            }
          }}
        />
      </Card>
  );
}