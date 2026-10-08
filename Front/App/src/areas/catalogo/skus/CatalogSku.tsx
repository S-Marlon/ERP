// Gerenciador de catálogos: central de ajustes do cadastro (dados, preço, família) com visões por tipo de item
// (venda, almoxarifado, patrimônio) e ligação com a lista de trabalho (precificar, etiquetar, conferir...).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Button, Card, Col, Drawer, Dropdown, Flex, Input, Row, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message, theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined, ClearOutlined, ClusterOutlined, DeleteOutlined, DollarOutlined, DownOutlined, EditOutlined, FolderAddOutlined, MoreOutlined,
  PictureOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { SkuSubTable } from './SkuSubTable';
import type { ItemParentType } from './CatalogSku.types';
import { getProdutos, updateProduto } from './CatalogSku.service';
import ProductDetailsDrawer from './ProductDetailsDrawer';
import CreateProductModal from './CreateProductModal';
import MoverParaFamiliaModal, { ItemParaMover } from './MoverParaFamiliaModal';
import ProductCommercialSalesConfig from '../precos/ProductCommercialSalesConfig';
import ExclusaoItensModal from './ExclusaoItensModal';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';
import { ListaTrabalhoDrawer } from '../../../shared/core/listaTrabalho/ListaTrabalhoDrawer';
import { TAGS_LISTA, TagLista } from '../../../shared/core/listaTrabalho/listaTrabalho';
import {
  agruparPorFamilia, contarSituacoes, ehDaVisao, Filtros, filtrarLinhas, itensDasLinhas, Linha, ROTULO_SITUACAO, Situacao, Visao, VISOES, visaoDoTipo,
} from './catalogoVisoes';

const { Title, Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const porTexto = (a: unknown, b: unknown) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
// Valores de ordenação de uma linha (família = menor SKU, soma do estoque, menor preço)
const skuDaLinha = (l: Linha) => (l.familiaReal ? [...l.skus.map(s => s.sku)].sort(porTexto)[0] : l.sku) || '';
const precoDaLinha = (l: Linha) => Math.min(...l.skus.map(s => Number(s.preco_venda) || 0).map(p => (p > 0 ? p : Infinity)));
const estoqueDaLinha = (l: Linha) => l.skus.reduce((a, s) => a + (Number(s.estoque) || 0), 0);
const marcaDaLinha = (l: Linha) => l.skus.map(s => s.marca).filter(Boolean).sort(porTexto)[0] || '';
const ROTULO_TIPO: Record<string, { label: string; color: string }> = {
  PRODUTO: { label: 'Venda', color: 'blue' }, SERVICO: { label: 'Serviço', color: 'cyan' }, CONSUMO: { label: 'Consumo', color: 'orange' },
  INSUMO: { label: 'Insumo', color: 'green' }, ATIVO: { label: 'Patrimônio', color: 'purple' },
};

const lerVisao = (): Visao => {
  try { return (localStorage.getItem('erp.catalogo.visao') as Visao) || 'VENDA'; } catch { return 'VENDA'; }
};

const FILTROS_INICIAIS: Filtros = { busca: '', categoriaId: null, marca: null, situacao: 'TODAS', estrutura: 'TODAS' };

export default function CatalogSku() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const trabalho = useListaTrabalho();

  const [itens, setItens] = useState<ItemParentType[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [visao, setVisaoEstado] = useState<Visao>(lerVisao);
  const setVisao = (v: Visao) => { setVisaoEstado(v); setSelecionados([]); try { localStorage.setItem('erp.catalogo.visao', v); } catch { /* sem armazenamento */ } };
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const filtrar = (patch: Partial<Filtros>) => setFiltros(f => ({ ...f, ...patch }));
  const [selecionados, setSelecionados] = useState<React.Key[]>([]);
  const [expandidas, setExpandidas] = useState<React.Key[]>([]);

  // Painéis
  const [novoAberto, setNovoAberto] = useState(false);
  const [editando, setEditando] = useState<ItemParentType | null>(null);
  const [precoDe, setPrecoDe] = useState<ItemParentType | null>(null);
  const [trabalhoAberto, setTrabalhoAberto] = useState(false);
  const [paraMover, setParaMover] = useState<ItemParaMover[]>([]);
  // Exclusão de itens sem histórico (itens de teste)
  const [paraApagar, setParaApagar] = useState<number[]>([]);
  const aoApagar = (ids: number[]) => {
    ids.forEach(id => trabalho.remover(id));
    // Tira também da lista de precificação guardada no navegador
    try {
      const chave = 'erp.precificacao.lista';
      const s = new Set(ids);
      const lista = JSON.parse(localStorage.getItem(chave) || '[]');
      localStorage.setItem(chave, JSON.stringify(lista.filter((l: { idItem: number }) => !s.has(l.idItem))));
    } catch { /* sem armazenamento */ }
    setParaApagar([]);
    setSelecionados([]);
    carregar();
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await getProdutos());
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Falha ao carregar o catálogo.');
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Visão por tipo → famílias agrupadas → filtros
  const contagemVisao = useMemo(() => {
    const c: Record<Visao, number> = { VENDA: 0, ALMOXARIFADO: 0, PATRIMONIO: 0, TODOS: itens.length };
    itens.forEach(i => { c[visaoDoTipo(i.tipo_recurso)]++; });
    return c;
  }, [itens]);
  const linhasDaVisao = useMemo(() => agruparPorFamilia(itens.filter(i => ehDaVisao(i.tipo_recurso, visao))), [itens, visao]);
  const linhas = useMemo(() => filtrarLinhas(linhasDaVisao, filtros), [linhasDaVisao, filtros]);
  const contagem = useMemo(() => contarSituacoes(linhasDaVisao), [linhasDaVisao]);
  const ehVenda = visao === 'VENDA' || visao === 'TODOS';

  // Opções de filtro a partir do que existe na visão (nada fixo no código)
  const categorias = useMemo(() => {
    const m = new Map<number, string>();
    linhasDaVisao.forEach(l => { if (l.categoria_id) m.set(Number(l.categoria_id), l.categoria || `Categoria ${l.categoria_id}`); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  }, [linhasDaVisao]);
  const marcas = useMemo(() => {
    const s = new Set<string>();
    linhasDaVisao.forEach(l => l.skus.forEach(x => { if (x.marca) s.add(x.marca); }));
    return [...s].sort().map(m => ({ value: m, label: m }));
  }, [linhasDaVisao]);

  // ---------------------------------------------------------------- lista de trabalho
  const linhasSelecionadas = linhas.filter(l => selecionados.includes(l.key));
  const mandar = (alvo: Linha[], tag: TagLista, irPara?: string) => {
    const lista = itensDasLinhas(alvo);
    if (!lista.length) return;
    trabalho.adicionarVarios(lista, { tags: [tag], origem: 'Gerenciador de Catálogos' });
    message.success(`${lista.length} item(ns) na lista de trabalho: ${TAGS_LISTA[tag].label}.`);
    setSelecionados([]);
    if (irPara) navigate(irPara);
  };
  const menuTarefas = (alvo: () => Linha[], comApagar = false) => ({
    items: [
      ...(Object.keys(TAGS_LISTA) as TagLista[])
        .filter(t => ehVenda || (t !== 'ETIQUETAR' && t !== 'PRECIFICAR'))
        .map(t => ({ key: t, label: `Lista de trabalho: ${TAGS_LISTA[t].label}`, onClick: () => mandar(alvo(), t) })),
      ...(comApagar ? [
        { type: 'divider' as const },
        { key: 'apagar', danger: true, icon: <DeleteOutlined />, label: 'Apagar item (só sem histórico)', onClick: () => setParaApagar(itensDasLinhas(alvo()).map(i => i.idItem)) },
      ] : []),
    ],
  });
  const naListaDeTrabalho = (l: Linha) => l.skus.some(s => trabalho.temItem(Number(s.id_item)));

  // ---------------------------------------------------------------- família em lote
  const definirFamilia = (alvo: Linha[]) => setParaMover(alvo.flatMap(l => l.skus.map(s => ({
    idItem: Number(s.id_item), sku: s.sku, nome: s.nome_item || l.nome_item, familiaId: l.familiaReal ? l.familia_id : null,
  }))));
  // Variação aberta pela sub-tabela da família: o cadastro completo do item está em `itens`
  const itemPorId = (id: number) => itens.find(i => Number(i.id_item) === id) || null;

  const salvarItem = async (idItem: string | number, campos: Record<string, unknown>) => {
    const id = Number(idItem);
    if (!Number.isFinite(id) || id <= 0) { message.error('Item inválido para atualização.'); return; }
    try {
      await updateProduto(id, campos);
      message.success('Item atualizado.');
      setEditando(null);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar o item.');
    }
  };

  // ---------------------------------------------------------------- tabela
  const colunas: ColumnsType<Linha> = [
    {
      title: '', key: 'foto', width: 56,
      render: (_, l) => <Avatar shape="square" size={40} src={l.skus[0]?.imagem_url || undefined} icon={<PictureOutlined style={{ color: '#bfbfbf' }} />} style={{ background: token.colorFillTertiary }} />,
    },
    {
      title: 'SKU', key: 'sku', width: 150,
      sorter: (a, b) => porTexto(skuDaLinha(a), skuDaLinha(b)), defaultSortOrder: 'ascend',
      render: (_, l) => <Text style={{ fontSize: 12 }}>{skuDaLinha(l)}{l.familiaReal && l.skus.length > 1 && <Text type="secondary" style={{ fontSize: 11 }}> +{l.skus.length - 1}</Text>}</Text>,
    },
    {
      title: 'Item', key: 'item',
      sorter: (a, b) => porTexto(a.nome_item, b.nome_item),
      render: (_, l) => (
        <div>
          <Flex gap={6} align="center" wrap>
            <Text strong>{l.nome_item}</Text>
            {l.familiaReal && <Tag color="purple" icon={<ClusterOutlined />} style={{ margin: 0 }}>Família · {l.skus.length}</Tag>}
            {visao === 'TODOS' && <Tag color={ROTULO_TIPO[String(l.tipo_recurso).toUpperCase()]?.color} style={{ margin: 0 }}>{ROTULO_TIPO[String(l.tipo_recurso).toUpperCase()]?.label || l.tipo_recurso}</Tag>}
            {naListaDeTrabalho(l) && <Tooltip title="Na lista de trabalho"><Tag icon={<UnorderedListOutlined />} style={{ margin: 0 }}>lista</Tag></Tooltip>}
          </Flex>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {l.familiaReal ? `${l.skus.length} variação(ões)` : l.sku}{l.categoria ? ` · ${l.categoria}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Marca', key: 'marca', width: 140,
      sorter: (a, b) => porTexto(marcaDaLinha(a), marcaDaLinha(b)),
      render: (_, l) => {
        const m = [...new Set(l.skus.map(s => s.marca).filter(Boolean))];
        return m.length ? <Space size={[2, 2]} wrap>{m.map(x => <Tag key={x} style={{ margin: 0 }}>{x}</Tag>)}</Space> : <Text type="secondary">—</Text>;
      },
    },
    ...(visao === 'VENDA' || visao === 'TODOS' ? [{
      title: 'Preço', key: 'preco', width: 150, align: 'right' as const,
      sorter: (a: Linha, b: Linha) => precoDaLinha(a) - precoDaLinha(b) || porTexto(skuDaLinha(a), skuDaLinha(b)),
      render: (_: unknown, l: Linha) => {
        if (visaoDoTipo(l.tipo_recurso) !== 'VENDA') return <Text type="secondary">não vende</Text>;
        const precos = l.skus.map(s => Number(s.preco_venda) || 0);
        const min = Math.min(...precos); const max = Math.max(...precos);
        if (max <= 0) return <Tag color="red" style={{ margin: 0 }}>sem preço</Tag>;
        const un = l.skus[0]?.unidade;
        return (
          <div>
            <Text strong>{min === max ? brl(min) : `${brl(min)} – ${brl(max)}`}</Text>{un && min === max && <Text type="secondary" style={{ fontSize: 11 }}> /{un}</Text>}
            {l.skus.some(s => !s.temPrecoFaixa && Number(s.preco_venda) > 0) && (
              <Tooltip title="Preço só no cadastro antigo (sem faixa de preço): ajuste na precificação"><div><Tag color="gold" style={{ margin: 0, fontSize: 10 }}>preço antigo</Tag></div></Tooltip>
            )}
          </div>
        );
      },
    }] : []),
    ...(visao === 'ALMOXARIFADO' || visao === 'PATRIMONIO' ? [{
      title: 'Custo', key: 'custo', width: 130, align: 'right' as const,
      sorter: (a: Linha, b: Linha) => Math.max(...a.skus.map(s => Number(s.custo_gerencial) || 0)) - Math.max(...b.skus.map(s => Number(s.custo_gerencial) || 0)),
      render: (_: unknown, l: Linha) => {
        const c = l.skus.map(s => Number(s.custo_gerencial) || 0);
        return Math.max(...c) > 0 ? <Text>{brl(Math.max(...c))}</Text> : <Text type="secondary">sem custo</Text>;
      },
    }] : []),
    {
      title: 'Estoque', key: 'estoque', width: 120, align: 'right' as const,
      sorter: (a, b) => estoqueDaLinha(a) - estoqueDaLinha(b),
      render: (_, l) => {
        const total = l.skus.reduce((a, s) => a + (Number(s.estoque) || 0), 0);
        const un = l.skus[0]?.unidade;
        return (
          <span>
            <Text strong type={total <= 0 ? 'danger' : total <= 5 ? 'warning' : undefined}>{qtd(total)}</Text>{' '}
            {un ? <Text type="secondary">{un}</Text> : <Tooltip title="Item sem unidade base: defina no editor de preço ou na lista de precificação"><Tag color="red" style={{ margin: 0, fontSize: 10 }}>sem unidade</Tag></Tooltip>}
          </span>
        );
      },
    },
    {
      title: 'Situação', key: 'sit', width: 130,
      render: (_, l) => (
        <Space size={[2, 2]} wrap>
          {String(l.status).toUpperCase() === 'INATIVO' ? <Tag color="red" style={{ margin: 0 }}>Inativo</Tag> : <Tag color="green" style={{ margin: 0 }}>Ativo</Tag>}
          {visaoDoTipo(l.tipo_recurso) === 'VENDA' && l.skus.some(s => s.publicavel === false) && (
            <Tooltip title={l.skus.flatMap(s => s.motivos_publicacao || []).join(' · ') || 'Não vai para o PDV'}>
              <Tag color="orange" style={{ margin: 0 }}>Não publicável</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '', key: 'acoes', width: 150, align: 'right' as const,
      render: (_, l) => {
        const venda = visaoDoTipo(l.tipo_recurso) === 'VENDA';
        return (
          <Space size={4}>
            {l.familiaReal ? (
              <Tooltip title="Abrir a família (atributos, grade, nomes e SKUs)">
                <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/catalogo/familias?familia=${l.familia_id}`)}>Família</Button>
              </Tooltip>
            ) : (
              <Tooltip title="Cadastro do item (dados, ficha técnica, anexos)">
                <Button size="small" icon={<EditOutlined />} onClick={() => setEditando(l)}>Editar</Button>
              </Tooltip>
            )}
            {venda && !l.familiaReal && (
              <Tooltip title="Preço: unidades, fracionamento e atacado">
                <Button size="small" icon={<DollarOutlined />} onClick={() => setPrecoDe(l)} />
              </Tooltip>
            )}
            <Dropdown trigger={['click']} menu={menuTarefas(() => [l], true)}>
              <Tooltip title="Lista de trabalho e mais ações"><Button size="small" icon={<MoreOutlined />} /></Tooltip>
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const card = (s: Situacao, titulo: string, cor?: string, ajuda?: string) => (
    <Col xs={12} md={8} xl={3} key={s}>
      <Tooltip title={ajuda}>
        <Card size="small" hoverable onClick={() => filtrar({ situacao: filtros.situacao === s ? 'TODAS' : s })}
          style={{ height: '100%', borderColor: filtros.situacao === s ? token.colorPrimary : undefined }} styles={{ body: { padding: '8px 12px' } }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text>
          <div style={{ fontSize: 22, fontWeight: 700, color: contagem[s] ? cor : undefined }}>{contagem[s]}</div>
        </Card>
      </Tooltip>
    </Col>
  );

  const temFiltro = filtros.busca || filtros.categoriaId || filtros.marca || filtros.situacao !== 'TODAS' || filtros.estrutura !== 'TODAS';

  return (
    <div style={{ padding: 16 }}>
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><AppstoreOutlined style={{ color: token.colorPrimary, marginRight: 8 }} />Gerenciador de Catálogos</Title>
          <Text type="secondary">Cadastro, preço e família dos itens; marque itens e mande para a lista de trabalho.</Text>
        </div>
        <Space wrap>
          <Badge count={trabalho.itens.length} size="small">
            <Button icon={<UnorderedListOutlined />} onClick={() => setTrabalhoAberto(true)}>Lista de trabalho</Button>
          </Badge>
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setNovoAberto(true)}>Adicionar Novo</Button>
        </Space>
      </Flex>

      {/* Visão por tipo de item */}
      <Segmented block value={visao} onChange={v => setVisao(v as Visao)} style={{ marginBottom: 12 }}
        options={VISOES.map(v => ({ value: v.value, label: <Tooltip title={v.descricao}><span>{v.label} ({contagemVisao[v.value]})</span></Tooltip> }))} />

      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        {card('COM_ESTOQUE', 'Com estoque', token.colorSuccess)}
        {card('ESGOTADO', 'Esgotado', token.colorError)}
        {card('CRITICO', 'Estoque crítico', token.colorWarning, 'Até 5 em estoque')}
        {card('SEM_UNIDADE', 'Sem unidade', token.colorError, 'Sem unidade base: não dá para dar preço nem estoque')}
        {card('SEM_CUSTO', 'Sem custo', token.colorWarning)}
        {ehVenda && card('SEM_PRECO', 'Sem preço', token.colorError, 'Itens de venda sem preço')}
        {ehVenda && card('NAO_PUBLICAVEL', 'Não publicáveis', token.colorWarning, 'Não podem ir ao PDV (família em rascunho, inativo, obrigatório sem valor...)')}
        {card('SEM_FAMILIA', 'Sem família', token.colorPrimary, 'Itens fora de qualquer família: marque e use "Definir família"')}
      </Row>

      <Card size="small">
        {/* Filtros */}
        <Flex gap={8} wrap align="center" style={{ marginBottom: 10 }}>
          <Input allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="Buscar por nome ou SKU" style={{ width: 260 }}
            value={filtros.busca} onChange={e => filtrar({ busca: e.target.value })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Categoria" style={{ width: 220 }} options={categorias}
            value={filtros.categoriaId ?? undefined} onChange={v => filtrar({ categoriaId: v ?? null })} />
          <Select allowClear showSearch optionFilterProp="label" placeholder="Marca" style={{ width: 160 }} options={marcas}
            value={filtros.marca ?? undefined} onChange={v => filtrar({ marca: v ?? null })} />
          <Select style={{ width: 190 }} value={filtros.situacao} onChange={v => filtrar({ situacao: v })}
            options={(Object.keys(ROTULO_SITUACAO) as Situacao[])
              .filter(s => ehVenda || (s !== 'SEM_PRECO' && s !== 'NAO_PUBLICAVEL'))
              .map(s => ({ value: s, label: `Situação: ${ROTULO_SITUACAO[s]}` }))} />
          <Segmented value={filtros.estrutura} onChange={v => filtrar({ estrutura: v as Filtros['estrutura'] })}
            options={[{ value: 'TODAS', label: 'Tudo' }, { value: 'FAMILIAS', label: 'Famílias' }, { value: 'AVULSOS', label: 'Avulsos' }]} />
          {temFiltro && <Button icon={<ClearOutlined />} onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</Button>}
          <Text type="secondary" style={{ marginLeft: 'auto' }}>{linhas.length} linha(s)</Text>
        </Flex>

        {/* Ações nos marcados */}
        {selecionados.length > 0 && (
          <Flex gap={8} wrap align="center" style={{ marginBottom: 10, padding: '8px 12px', borderRadius: token.borderRadiusLG, background: token.colorPrimaryBg, border: `1px solid ${token.colorPrimaryBorder}` }}>
            <Text strong>{selecionados.length} marcada(s) · {itensDasLinhas(linhasSelecionadas).length} item(ns)</Text>
            {ehVenda && (
              <Tooltip title="Marca como 'Precificar' na lista de trabalho e abre a Precificação">
                <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => mandar(linhasSelecionadas.filter(l => visaoDoTipo(l.tipo_recurso) === 'VENDA'), 'PRECIFICAR', '/catalogo/preco')}>Precificar</Button>
              </Tooltip>
            )}
            {ehVenda && (
              <Button size="small" icon={<PrinterOutlined />} onClick={() => mandar(linhasSelecionadas.filter(l => visaoDoTipo(l.tipo_recurso) === 'VENDA'), 'ETIQUETAR')}>Tirar etiqueta</Button>
            )}
            <Dropdown trigger={['click']} menu={menuTarefas(() => linhasSelecionadas)}>
              <Button size="small" icon={<UnorderedListOutlined />}>Lista de trabalho <DownOutlined /></Button>
            </Dropdown>
            <Tooltip title="Colocar os itens marcados numa família (ou criar uma)">
              <Button size="small" icon={<FolderAddOutlined />} onClick={() => definirFamilia(linhasSelecionadas)}>Definir família</Button>
            </Tooltip>
            <Tooltip title="Apaga de vez só os itens sem histórico (sem nota, estoque, venda...). Mostra a lista antes.">
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setParaApagar(itensDasLinhas(linhasSelecionadas).map(i => i.idItem))}>Apagar</Button>
            </Tooltip>
            <Button size="small" type="text" onClick={() => setSelecionados([])}>Limpar seleção</Button>
          </Flex>
        )}

        <Table<Linha>
          size="small"
          rowKey="key"
          loading={carregando}
          dataSource={linhas}
          columns={colunas}
          pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
          rowSelection={{ selectedRowKeys: selecionados, onChange: setSelecionados, preserveSelectedRowKeys: true }}
          scroll={{ x: 1150 }}
          showSorterTooltip={{ title: 'Clique para ordenar' }}
          expandable={{
            rowExpandable: l => l.familiaReal && l.skus.length > 0,
            expandedRowKeys: expandidas,
            onExpandedRowsChange: k => setExpandidas([...k]),
            expandedRowRender: l => (
              <SkuSubTable linha={l} onAlterado={carregar} onMover={setParaMover}
                onEditar={id => setEditando(itemPorId(id))} onPreco={id => setPrecoDe(itemPorId(id))} />
            ),
          }}
        />
      </Card>

      <CreateProductModal open={novoAberto} onClose={() => { setNovoAberto(false); }} />
      <ProductDetailsDrawer open={!!editando} product={editando} onClose={() => setEditando(null)} onSave={salvarItem} />
      <Drawer open={!!precoDe} size={1100} title={precoDe ? `Preço · ${precoDe.sku} · ${precoDe.nome_item}` : ''} destroyOnHidden
        onClose={() => { setPrecoDe(null); carregar(); }}>
        {precoDe && <ProductCommercialSalesConfig idItem={Number(precoDe.id_item)} />}
      </Drawer>
      <MoverParaFamiliaModal itens={paraMover} onFechar={() => setParaMover([])}
        onConcluido={() => { setParaMover([]); setSelecionados([]); carregar(); }} />
      <ExclusaoItensModal ids={paraApagar} onFechar={() => setParaApagar([])} onApagados={aoApagar} />
      <ListaTrabalhoDrawer open={trabalhoAberto} onClose={() => setTrabalhoAberto(false)}
        extra={(
          <Space>
            {trabalho.contagem.PRECIFICAR > 0 && <Button onClick={() => navigate('/catalogo/preco')}>Ir para Precificação ({trabalho.contagem.PRECIFICAR})</Button>}
            {trabalho.contagem.ETIQUETAR > 0 && <Button type="primary" onClick={() => navigate('/estoque/etiquetagem')}>Ir para Etiquetagem ({trabalho.contagem.ETIQUETAR})</Button>}
          </Space>
        )} />
    </div>
  );
}
