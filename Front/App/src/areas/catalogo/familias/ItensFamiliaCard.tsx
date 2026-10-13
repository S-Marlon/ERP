// Itens da família: incluir/tirar itens, ver a grade de cada variação e a situação calculada pelo servidor
// (pendente, nome/SKU vai mudar, ok). O ajuste de nomes e SKUs é feito no editor "Nomes e SKUs".
// Inativos (ex.: duplicados juntados em outro item) ficam escondidos, com a opção de ver e tirar da família.
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Flex, Input, Modal, Popconfirm, Select, Space, Switch, Tag, Tooltip, Typography, message } from "antd";
import { DisconnectOutlined, EditOutlined, PlusOutlined, SearchOutlined, SettingOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { buscarItensCatalogo, ItemCatalogoBusca } from "../../compras/api/comprasApi";
import { vincularItensFamilia } from "./FamilyManager.api";
import ProductDetailsDrawer from "../skus/ProductDetailsDrawer";
import { updateProduto } from "../skus/CatalogSku.service";

const { Text } = Typography;

interface Atributo { id?: string | number; nome: string; classificacao?: string }

interface ItemFamilia {
  id?: string | number;
  idItem?: string | number;
  sku?: string;
  nome?: string;
  nomeItem?: string;
  nomeComercial?: string;
  status?: string;
  juntadoEm?: string;
  valoresAtributos?: Record<string, any>;
  atributosPendentes?: Array<string | { nome?: string; motivo?: string }>;
  skuCalculado?: string | null;
  nomeCalculado?: string | null;
}

interface GrupoSelecionado { id: string | number; nome?: string; atributos?: Atributo[]; [key: string]: any }

interface ItensFamiliaCardProps {
  brandColor?: string;
  grupoSelecionado: GrupoSelecionado | null;
  pesquisaItem: string;
  setPesquisaItem: (value: string) => void;
  itensFiltradosDoGrupo: ItemFamilia[];
  temAlteracoes?: boolean;
  /** Engrenagem: atributos do item */
  handleEditarAtributosItem: (item: ItemFamilia) => void;
  /** Recarrega a lista depois de incluir/tirar itens ou editar a ficha */
  onItensAlterados?: () => void;
  /** Abre o editor "Nomes e SKUs" (padronizar nome e SKU das variações) */
  onAbrirNomesSkus?: () => void;
  // Fluxo antigo (os botões de corrigir/padronizar saíram: o editor de Nomes e SKUs faz isso)
  gerarPreviewSku?: unknown; gerarPreviewNome?: unknown; handleNormalizarItemNome?: unknown; handleNormalizarItemSku?: unknown;
  handleTentarNormalizarIndividual?: unknown; handleProcessarFormalizacaoLote?: unknown; handlePadronizarNomesFamilia?: unknown;
  handlePadronizarSkusFamilia?: unknown;
}

type Situacao = 'PENDENTE' | 'MUDA' | 'OK' | 'INATIVO';

const textoPendencia = (p: string | { nome?: string; motivo?: string }) => (typeof p === 'string' ? p : `${p.nome || ''}${p.motivo ? `: ${p.motivo}` : ''}`);

export default function ItensFamiliaCard({
  brandColor = "#1677ff", grupoSelecionado, pesquisaItem, setPesquisaItem, itensFiltradosDoGrupo = [], temAlteracoes = false,
  handleEditarAtributosItem, onItensAlterados, onAbrirNomesSkus,
}: ItensFamiliaCardProps) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ItemCatalogoBusca[]>([]);
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  const [conhecidos, setConhecidos] = useState<Record<number, ItemCatalogoBusca>>({});
  const [salvando, setSalvando] = useState(false);
  const [itemEditando, setItemEditando] = useState<ItemFamilia | null>(null);
  const [verInativos, setVerInativos] = useState(false);
  const [filtro, setFiltro] = useState<'TODOS' | 'PENDENTE' | 'MUDA'>('TODOS');
  const idFamilia = grupoSelecionado?.id;

  useEffect(() => { setEscolhidos([]); setTermo(""); setResultados([]); setVerInativos(false); setFiltro('TODOS'); }, [idFamilia]);

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

  // Situação calculada pelo servidor (o mesmo cálculo da gravação das variações)
  const situacao = (i: ItemFamilia): Situacao => {
    if (String(i.status || '').toUpperCase() === 'INATIVO') return 'INATIVO';
    if ((i.atributosPendentes || []).length > 0) return 'PENDENTE';
    const nomeAtual = i.nomeComercial || i.nome || '';
    if ((i.skuCalculado && i.skuCalculado !== i.sku) || (i.nomeCalculado && i.nomeCalculado !== nomeAtual)) return 'MUDA';
    return 'OK';
  };
  const todos = itensFiltradosDoGrupo ?? [];
  const ativos = todos.filter(i => situacao(i) !== 'INATIVO');
  const inativos = todos.filter(i => situacao(i) === 'INATIVO');
  const contagem = { PENDENTE: ativos.filter(i => situacao(i) === 'PENDENTE').length, MUDA: ativos.filter(i => situacao(i) === 'MUDA').length };
  const visiveis = useMemo(() => [
    ...ativos.filter(i => filtro === 'TODOS' || situacao(i) === filtro),
    ...(verInativos && filtro === 'TODOS' ? inativos : []),
  ], [todos, filtro, verInativos]); // eslint-disable-line react-hooks/exhaustive-deps

  const idsNaFamilia = new Set(todos.map((i) => String(i.id ?? i.idItem)));
  const grade = (grupoSelecionado?.atributos || []).filter(a => a.classificacao === 'grade');

  const incluir = async (ids: number[], mover = false) => {
    if (!idFamilia || ids.length === 0) return;
    setSalvando(true);
    try {
      const r = await vincularItensFamilia(idFamilia, ids, "adicionar", mover);
      if (r.alterados > 0) message.success(`${r.alterados} item(ns) incluído(s). Preencha a grade em "Nomes e SKUs" (ou na engrenagem do item).`);
      setEscolhidos([]);
      setTermo("");
      onItensAlterados?.();
      if (r.emOutraFamilia.length > 0) {
        Modal.confirm({
          title: `${r.emOutraFamilia.length} item(ns) já estão em outra família`,
          content: (
            <div>
              Mover para "{grupoSelecionado?.nome}"? Eles saem da família atual e passam a usar os atributos desta.
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{r.emOutraFamilia.map((i) => <li key={i.idItem}>{i.sku} (família {i.familia})</li>)}</ul>
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

  const tirar = async (lista: ItemFamilia[]) => {
    if (!idFamilia || !lista.length) return;
    try {
      await vincularItensFamilia(idFamilia, lista.map(i => Number(i.id ?? i.idItem)), "remover");
      message.success(lista.length === 1 ? `${lista[0].sku} saiu da família.` : `${lista.length} itens saíram da família.`);
      onItensAlterados?.();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Erro ao tirar da família.");
    }
  };

  const COR: Record<Situacao, string> = { PENDENTE: '#ef4444', MUDA: '#d97706', OK: '#22c55e', INATIVO: '#cbd5e1' };

  const linha = (item: ItemFamilia) => {
    const s = situacao(item);
    const nome = item.nomeComercial || item.nome || item.nomeItem || 'Produto sem nome';
    const valores = item.valoresAtributos || {};
    return (
      <div key={String(item.id ?? item.idItem)} style={{
        padding: '6px 8px 6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden',
        background: s === 'INATIVO' ? '#f8fafc' : '#fff', opacity: s === 'INATIVO' ? 0.75 : 1,
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: COR[s] }} />
        <Flex justify="space-between" align="center" gap={6}>
          <Space size={6} style={{ minWidth: 0 }}>
            <Text strong style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.sku}</Text>
            {s === 'PENDENTE' && (
              <Tooltip title={(item.atributosPendentes || []).map(textoPendencia).join(' · ')}>
                <Tag color="red" style={{ margin: 0, fontSize: 10 }}>pendente</Tag>
              </Tooltip>
            )}
            {s === 'MUDA' && (
              <Tooltip title={<div>Ao gravar em "Nomes e SKUs" fica:<br /><b>{item.skuCalculado}</b><br />{item.nomeCalculado}</div>}>
                <Tag color="gold" style={{ margin: 0, fontSize: 10 }}>nome/SKU muda</Tag>
              </Tooltip>
            )}
            {s === 'INATIVO' && <Tag style={{ margin: 0, fontSize: 10 }}>{item.juntadoEm ? `juntado em ${item.juntadoEm}` : 'inativo'}</Tag>}
          </Space>
          <Space size={0}>
            {s !== 'INATIVO' && (
              <>
                <Tooltip title="Atributos do item"><Button type="text" size="small" icon={<SettingOutlined />} onClick={() => handleEditarAtributosItem(item)} /></Tooltip>
                <Tooltip title="Ficha do item (preço, fiscal...)"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => setItemEditando(item)} /></Tooltip>
              </>
            )}
            <Popconfirm title="Tirar este item da família?" description="Ele fica sem família e mantém a categoria dela." okText="Tirar" cancelText="Cancelar" onConfirm={() => tirar([item])}>
              <Tooltip title="Tirar da família"><Button type="text" size="small" danger icon={<DisconnectOutlined />} /></Tooltip>
            </Popconfirm>
          </Space>
        </Flex>
        <Text style={{ fontSize: 11.5, color: '#334155', display: 'block', lineHeight: 1.35 }}>{nome}</Text>
        {grade.length > 0 && s !== 'INATIVO' && (
          <Flex gap={3} wrap style={{ marginTop: 3 }}>
            {grade.map(a => {
              const v = valores[String(a.id)] ?? valores[a.nome];
              const vazio = v === undefined || v === null || String(v).trim() === '';
              return (
                <Tooltip key={String(a.id)} title={a.nome}>
                  <Tag color={vazio ? 'red' : 'cyan'} style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>{vazio ? `${a.nome}?` : String(v)}</Tag>
                </Tooltip>
              );
            })}
          </Flex>
        )}
      </div>
    );
  };

  return (
    <Card
      title={(
        <Space size={6}>
          <ShoppingCartOutlined style={{ color: brandColor }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Itens da Família</span>
          {grupoSelecionado && <Tag style={{ margin: 0, fontSize: 10 }}>{ativos.length}</Tag>}
        </Space>
      )}
      style={{ borderRadius: 10, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)", height: "100%" }}
      styles={{
        header: { borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "8px 8px 0 0", minHeight: 24, padding: "0 6px" },
        body: { padding: 6 },
      }}
    >
      {grupoSelecionado ? (
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          {/* Incluir itens na família */}
          <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, padding: 6 }}>
            <Select
              mode="multiple" size="small" style={{ width: "100%" }} placeholder="+ Incluir itens: buscar SKU ou nome..."
              value={escolhidos} onChange={setEscolhidos} showSearch filterOption={false} searchValue={termo} onSearch={setTermo}
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
              <Button type="primary" size="small" block icon={<PlusOutlined />} loading={salvando}
                style={{ marginTop: 6, background: brandColor, borderColor: brandColor }} onClick={() => incluir(escolhidos)}>
                Incluir {escolhidos.length} item(ns) nesta família
              </Button>
            )}
          </div>

          <Input size="small" prefix={<SearchOutlined style={{ color: "#94a3b8" }} />} placeholder="Filtrar SKU ou nome..."
            value={pesquisaItem} onChange={(e) => setPesquisaItem(e.target.value)} allowClear style={{ borderRadius: 6 }} />

          {(contagem.PENDENTE > 0 || contagem.MUDA > 0) && (
            <Flex gap={4} wrap>
              <Tag.CheckableTag checked={filtro === 'TODOS'} onChange={() => setFiltro('TODOS')}>Todos ({ativos.length})</Tag.CheckableTag>
              {contagem.PENDENTE > 0 && <Tag.CheckableTag checked={filtro === 'PENDENTE'} onChange={() => setFiltro(f => (f === 'PENDENTE' ? 'TODOS' : 'PENDENTE'))}>Pendentes ({contagem.PENDENTE})</Tag.CheckableTag>}
              {contagem.MUDA > 0 && <Tag.CheckableTag checked={filtro === 'MUDA'} onChange={() => setFiltro(f => (f === 'MUDA' ? 'TODOS' : 'MUDA'))}>Nome/SKU muda ({contagem.MUDA})</Tag.CheckableTag>}
            </Flex>
          )}

          <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
            {visiveis.length > 0
              ? <Space direction="vertical" size={6} style={{ width: "100%" }}>{visiveis.map(linha)}</Space>
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 11, color: "#94a3b8" }}>Nenhum item</span>} />}
          </div>

          {inativos.length > 0 && (
            <Flex justify="space-between" align="center" style={{ fontSize: 12 }}>
              <Tooltip title="Duplicados já juntados em outro item (Itens duplicados) ou itens desativados. Não contam como variações.">
                <Space size={4}><Switch size="small" checked={verInativos} onChange={setVerInativos} /><Text type="secondary" style={{ fontSize: 12 }}>{inativos.length} inativo(s)</Text></Space>
              </Tooltip>
              <Popconfirm title={`Tirar ${inativos.length} inativo(s) da família?`} description="Eles ficam sem família (o histórico de vendas e notas continua neles)."
                okText="Tirar" onConfirm={() => tirar(inativos)}>
                <Button size="small" type="link" danger>Tirar da família</Button>
              </Popconfirm>
            </Flex>
          )}

          {(contagem.PENDENTE > 0 || contagem.MUDA > 0) && (
            <Alert type={contagem.PENDENTE ? 'warning' : 'info'} showIcon style={{ fontSize: 12, padding: '4px 8px' }}
              message={[contagem.PENDENTE && `${contagem.PENDENTE} com grade/atributo pendente`, contagem.MUDA && `${contagem.MUDA} com nome/SKU fora do modelo`].filter(Boolean).join(' · ')} />
          )}
          <Tooltip title={temAlteracoes ? 'A família tem alterações não salvas: o editor salva a família antes de gravar as variações' : 'Preencher a grade e padronizar nome e SKU de todas as variações'}>
            <Button block icon={<SettingOutlined />} onClick={onAbrirNomesSkus} disabled={!onAbrirNomesSkus}
              style={{ borderColor: brandColor, color: brandColor }}>
              Ajustar nomes e SKUs{contagem.PENDENTE + contagem.MUDA ? ` (${contagem.PENDENTE + contagem.MUDA} a revisar)` : ''}
            </Button>
          </Tooltip>
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ fontSize: 11, color: "#94a3b8" }}>Selecione uma família para ver os itens</span>} />
      )}

      <ProductDetailsDrawer
        open={Boolean(itemEditando)}
        product={itemEditando ? { id_item: itemEditando.id ?? itemEditando.idItem, sku: itemEditando.sku, nome: itemEditando.nome } : null}
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
