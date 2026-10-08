// Variações de uma família no Gerenciador de Catálogos: tabela ordenável (SKU por padrão), atributos de DNA/grade,
// e ações reais: editar o item, preço, mover para outra família, tirar da família e lista de trabalho.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Divider, Dropdown, Flex, Input, Modal, Space, Table, Tag, Tooltip, Typography, message, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClusterOutlined, DisconnectOutlined, DollarOutlined, DownOutlined, EditOutlined, SearchOutlined, SwapOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';
import { TAGS_LISTA, TagLista } from '../../../shared/core/listaTrabalho/listaTrabalho';
import { vincularItensFamilia } from '../familias/FamilyManager.api';
import type { SkuChildType } from './CatalogSku.types';
import type { Linha } from './catalogoVisoes';
import type { ItemParaMover } from './MoverParaFamiliaModal';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const porTexto = (a: unknown, b: unknown) => String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });

interface AtributoValor { nome: string; valor: unknown; sufixo?: string }
type Variacao = SkuChildType & { dna?: AtributoValor[]; grade?: AtributoValor[] };

interface Props {
  linha: Linha;
  onEditar: (idItem: number) => void;
  onPreco: (idItem: number) => void;
  onMover: (itens: ItemParaMover[]) => void;
  /** Algo mudou (ex.: itens saíram da família): recarregar a tela */
  onAlterado: () => void;
}

export const SkuSubTable: React.FC<Props> = ({ linha, onEditar, onPreco, onMover, onAlterado }) => {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const trabalho = useListaTrabalho();
  const [variacoes, setVariacoes] = useState<Variacao[]>(linha.skus);
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<React.Key[]>([]);

  // Atributos (DNA e grade) de cada variação, buscados ao abrir a família
  useEffect(() => {
    let ativo = true;
    setVariacoes(linha.skus);
    Promise.all(linha.skus.map(async s => {
      try {
        const r = await fetch(`${API_URL}/api/catalogo/${encodeURIComponent(s.sku || String(s.id_item))}/atributos`);
        const d = await r.json();
        return { ...s, dna: d?.atributos?.dna || [], grade: d?.atributos?.grade || [] };
      } catch {
        return s;
      }
    })).then(lista => { if (ativo) setVariacoes(lista); });
    return () => { ativo = false; };
  }, [linha]);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return variacoes;
    return variacoes.filter(v => [v.sku, v.nome_item, v.marca, ...(v.grade || []).map(g => String(g.valor)), ...(v.dna || []).map(g => String(g.valor))]
      .some(x => String(x || '').toLowerCase().includes(t)));
  }, [variacoes, busca]);

  const selecionadas = variacoes.filter(v => marcados.includes(String(v.id_item)));
  const paraMover = (lista: Variacao[]): ItemParaMover[] => lista.map(v => ({
    idItem: Number(v.id_item), sku: v.sku, nome: v.nome_item || linha.nome_item, familiaId: linha.familia_id,
  }));

  const tirarDaFamilia = (lista: Variacao[]) => {
    if (!lista.length || !linha.familia_id) return;
    Modal.confirm({
      title: `Tirar ${lista.length} item(ns) da família "${linha.nome_item}"?`,
      content: 'Eles ficam sem família (avulsos) e guardam a categoria da família, para não ficarem sem classificação.',
      okText: 'Tirar da família', okButtonProps: { danger: true }, cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const r = await vincularItensFamilia(Number(linha.familia_id), lista.map(v => Number(v.id_item)), 'remover');
          message.success(`${r.alterados} item(ns) agora estão sem família.`);
          setMarcados([]);
          onAlterado();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Erro ao tirar da família.');
        }
      },
    });
  };

  const mandar = (lista: Variacao[], tag: TagLista) => {
    trabalho.adicionarVarios(lista.map(v => ({ idItem: Number(v.id_item), sku: v.sku, nome: v.nome_item || linha.nome_item, unidade: v.unidade || undefined })),
      { tags: [tag], origem: 'Gerenciador de Catálogos' });
    message.success(`${lista.length} item(ns) na lista de trabalho: ${TAGS_LISTA[tag].label}.`);
    setMarcados([]);
  };
  const menuTarefas = (lista: () => Variacao[]) => ({
    items: (Object.keys(TAGS_LISTA) as TagLista[]).map(t => ({ key: t, label: TAGS_LISTA[t].label, onClick: () => mandar(lista(), t) })),
  });

  const atributos = (v: Variacao) => [
    ...(v.dna || []).map((a, i) => <Tag key={`d${i}`} color="purple" style={{ margin: 0 }}>{a.nome}: {String(a.valor)}{a.sufixo ? ` ${a.sufixo}` : ''}</Tag>),
    ...(v.grade || []).map((a, i) => <Tag key={`g${i}`} color="cyan" style={{ margin: 0 }}>{a.nome}: {String(a.valor)}{a.sufixo ? ` ${a.sufixo}` : ''}</Tag>),
  ];

  const colunas: ColumnsType<Variacao> = [
    {
      title: 'SKU', dataIndex: 'sku', key: 'sku', width: 150,
      sorter: (a, b) => porTexto(a.sku, b.sku), defaultSortOrder: 'ascend',
      render: v => <Tag color="blue" style={{ margin: 0 }}>{v || '—'}</Tag>,
    },
    {
      title: 'Item', key: 'nome',
      sorter: (a, b) => porTexto(a.nome_item, b.nome_item),
      render: (_, v) => (
        <div>
          <div>{v.nome_item || linha.nome_item}</div>
          <Space size={[2, 2]} wrap style={{ marginTop: 2 }}>{atributos(v)}</Space>
        </div>
      ),
    },
    {
      title: 'Marca', dataIndex: 'marca', key: 'marca', width: 120,
      sorter: (a, b) => porTexto(a.marca, b.marca),
      render: v => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Preço', key: 'preco', width: 120, align: 'right',
      sorter: (a, b) => (Number(a.preco_venda) || 0) - (Number(b.preco_venda) || 0),
      render: (_, v) => (Number(v.preco_venda) > 0
        ? <span><Text strong>{brl(v.preco_venda)}</Text>{v.unidade && <Text type="secondary" style={{ fontSize: 11 }}> /{v.unidade}</Text>}</span>
        : <Tag color="red" style={{ margin: 0 }}>sem preço</Tag>),
    },
    {
      title: 'Estoque', key: 'estoque', width: 100, align: 'right',
      sorter: (a, b) => (Number(a.estoque) || 0) - (Number(b.estoque) || 0),
      render: (_, v) => (
        <span><Text strong type={Number(v.estoque) <= 0 ? 'danger' : undefined}>{qtd(v.estoque)}</Text> <Text type="secondary">{v.unidade || ''}</Text></span>
      ),
    },
    {
      title: '', key: 'acoes', width: 120, align: 'right',
      render: (_, v) => (
        <Space size={4}>
          <Tooltip title="Cadastro do item"><Button size="small" icon={<EditOutlined />} onClick={() => onEditar(Number(v.id_item))} /></Tooltip>
          <Tooltip title="Preço: unidades, fracionamento e atacado"><Button size="small" icon={<DollarOutlined />} onClick={() => onPreco(Number(v.id_item))} /></Tooltip>
          <Dropdown trigger={['click']} menu={{
            items: [
              ...menuTarefas(() => [v]).items.map(i => ({ ...i, label: `Lista de trabalho: ${i.label}` })),
              { type: 'divider' as const },
              { key: 'mover', icon: <SwapOutlined />, label: 'Mover para outra família', onClick: () => onMover(paraMover([v])) },
              { key: 'tirar', icon: <DisconnectOutlined />, danger: true, label: 'Tirar da família', onClick: () => tirarDaFamilia([v]) },
            ],
          }}>
            <Button size="small">⋯</Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  const estoqueTotal = variacoes.reduce((a, v) => a + (Number(v.estoque) || 0), 0);
  const precos = variacoes.map(v => Number(v.preco_venda) || 0).filter(p => p > 0);
  const unidades = [...new Set(variacoes.map(v => v.unidade).filter(Boolean))];

  return (
    <Flex gap={12} wrap align="flex-start">
      {/* Resumo da família */}
      <Card size="small" style={{ flex: '0 0 240px', background: token.colorFillQuaternary }}
        title={<span><ClusterOutlined /> {linha.nome_item}</span>}>
        <Flex vertical gap={4} style={{ fontSize: 12 }}>
          {linha.categoria && <span>Categoria: <b>{linha.categoria}</b></span>}
          <span>Variações: <b>{variacoes.length}</b></span>
          <span>Estoque total: <b>{qtd(estoqueTotal)}</b> {unidades.length === 1 ? unidades[0] : ''}</span>
          <span>Preço: <b>{precos.length ? (Math.min(...precos) === Math.max(...precos) ? brl(precos[0]) : `${brl(Math.min(...precos))} – ${brl(Math.max(...precos))}`) : '—'}</b></span>
          {variacoes.some(v => !(Number(v.preco_venda) > 0)) && <Tag color="red" style={{ margin: 0, width: 'fit-content' }}>{variacoes.filter(v => !(Number(v.preco_venda) > 0)).length} sem preço</Tag>}
          <Divider style={{ margin: '6px 0' }} />
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/catalogo/familias?familia=${linha.familia_id}`)}>
            Abrir a família
          </Button>
          <Text type="secondary" style={{ fontSize: 11 }}>Atributos, nomes e SKUs das variações são ajustados na família.</Text>
        </Flex>
      </Card>

      <Flex vertical gap={8} style={{ flex: '1 1 480px', minWidth: 0 }}>
        <Flex gap={8} wrap align="center">
          <Input size="small" allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="Filtrar SKU, nome, marca ou atributo"
            style={{ width: 280 }} value={busca} onChange={e => setBusca(e.target.value)} />
          <Text type="secondary" style={{ fontSize: 12 }}>{filtradas.length} de {variacoes.length}</Text>
          {selecionadas.length > 0 && (
            <Flex gap={6} wrap align="center" style={{ marginLeft: 'auto' }}>
              <Text strong style={{ fontSize: 12 }}>{selecionadas.length} marcada(s):</Text>
              <Button size="small" icon={<SwapOutlined />} onClick={() => onMover(paraMover(selecionadas))}>Mover para outra família</Button>
              <Button size="small" danger icon={<DisconnectOutlined />} onClick={() => tirarDaFamilia(selecionadas)}>Tirar da família</Button>
              <Dropdown trigger={['click']} menu={menuTarefas(() => selecionadas)}>
                <Button size="small" icon={<UnorderedListOutlined />}>Lista de trabalho <DownOutlined /></Button>
              </Dropdown>
              <Button size="small" type="text" onClick={() => setMarcados([])}>Limpar</Button>
            </Flex>
          )}
        </Flex>
        <Table<Variacao>
          size="small"
          rowKey={v => String(v.id_item)}
          columns={colunas}
          dataSource={filtradas}
          rowSelection={{ selectedRowKeys: marcados, onChange: setMarcados }}
          pagination={filtradas.length > 10 ? { pageSize: 10, size: 'small' } : false}
          showSorterTooltip={{ title: 'Clique para ordenar' }}
        />
      </Flex>
    </Flex>
  );
};

export default SkuSubTable;
