// Gaveta "Produtos da marca" (Catálogo › Marcas): o que a marca vende, o que está parado, curva, estoque, preço e margem;
// abrir o preço do item e corrigir a marca de um item ligado à marca errada.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Flex, Input, Segmented, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DollarOutlined, SwapOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';
import ProductCommercialSalesConfig from '../precos/ProductCommercialSalesConfig';
import { TagMarca } from '../../../shared/components/TagMarca';
import type { Marca } from './services/comercialMarcas.service';

const { Text } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (v: number | null) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
const COR_CLASSE: Record<string, string> = { A: '#389e0d', B: '#d48806', C: '#8c8c8c', P: '#cf1322', N: '#1677ff', '-': '#bfbfbf' };

interface ItemMarca {
  idItem: number; sku: string; nome: string; unidade: string | null; categoria: string | null; receita: number; lucro: number; margem: number | null;
  quantidade: number; vendas: number; estoque: number; valorEstoque: number; custoUnitario: number; precoVenda: number; coberturaDias: number | null;
  ultimaVenda: string | null; situacao: string; classeVenda: string; classeEstoque: string | null; xyz: string | null; recomendacao: string | null;
  decisaoCompra: string | null; pelaFamilia: boolean;
}
interface Resposta {
  marca: { id: number; nome: string }; dias: number; diasDeHistorico: number; inativos: number;
  totais: { itens: number; vendidos: number; receita: number; lucro: number; estoque: number; parado: number }; itens: ItemMarca[];
}

const carregar = async (id: string, dias: number): Promise<Resposta> => {
  const r = await fetch(`${API_URL}/api/catalogo/marcas/${id}/produtos?dias=${dias}`);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404 && !d.error) throw new Error('Rota não encontrada: reinicie o backend (rs).');
  if (!r.ok) throw new Error(d.error || 'Erro ao carregar os produtos da marca.');
  return d;
};
const trocarMarca = async (idItem: number, idMarca: number | null) => {
  const r = await fetch(`${API_URL}/api/catalogo/marcas/itens/${idItem}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idMarca }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erro ao trocar a marca.');
};

type Filtro = 'TODOS' | 'VENDEM' | 'PARADOS';

export const ProdutosDaMarcaDrawer: React.FC<{ marca: Marca | null; marcas: Marca[]; onFechar: () => void; onMudou: () => void }> = ({ marca, marcas, onFechar, onMudou }) => {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [dias, setDias] = useState(90);
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busca, setBusca] = useState('');
  const [preco, setPreco] = useState<ItemMarca | null>(null);
  const [trocando, setTrocando] = useState<number | null>(null);

  const recarregar = () => { if (marca) carregar(marca.id, dias).then(setDados).catch(e => message.error(e.message)); };
  useEffect(() => { setDados(null); setFiltro('TODOS'); setBusca(''); recarregar(); }, [marca?.id, dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (dados?.itens || [])
      .filter(i => filtro === 'TODOS' || (filtro === 'VENDEM' ? i.situacao === 'NORMAL' : i.situacao === 'PARADO'))
      .filter(i => !t || `${i.sku} ${i.nome} ${i.categoria || ''}`.toLowerCase().includes(t));
  }, [dados, filtro, busca]);

  if (!marca) return null;
  const t = dados?.totais;
  return (
    <Drawer open={!!marca} onClose={onFechar} width="min(1200px, 100vw)" destroyOnHidden loading={!dados}
      title={<Space>Produtos da marca <TagMarca marca={marca.nome} style={{ fontSize: 14, padding: '2px 10px' }} /></Space>}
      extra={<Segmented value={dias} onChange={v => setDias(Number(v))} options={[30, 90, 180, 365].map(d => ({ value: d, label: d === 365 ? '12 meses' : `${d} dias` }))} />}>
      {dados && t && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Flex gap={28} wrap>
            <Statistic title="Itens" value={t.itens} suffix={<Text type="secondary" style={{ fontSize: 12 }}>{t.vendidos} venderam</Text>} />
            <Statistic title={`Faturou (${dias} dias)`} value={brl0(t.receita)} />
            <Statistic title="Lucro" value={brl0(t.lucro)} suffix={t.receita ? <Text type="secondary" style={{ fontSize: 12 }}>{pct(t.lucro / t.receita)}</Text> : null} />
            <Statistic title="Estoque" value={brl0(t.estoque)} />
            <Statistic title="Parado" value={brl0(t.parado)} valueStyle={{ color: t.parado ? '#cf1322' : undefined }} />
          </Flex>
          {dados.diasDeHistorico < dias && <Text type="secondary" style={{ fontSize: 12 }}>Vendas registradas há {dados.diasDeHistorico} dias.</Text>}
          {dados.inativos > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{dados.inativos} item(ns) inativo(s) da marca não aparecem.</Text>}
          <Flex gap={8} wrap align="center">
            <Segmented value={filtro} onChange={v => setFiltro(v as Filtro)} options={[
              { value: 'TODOS', label: `Todos (${dados.itens.length})` },
              { value: 'VENDEM', label: `Vendem (${dados.itens.filter(i => i.situacao === 'NORMAL').length})` },
              { value: 'PARADOS', label: `Parados (${dados.itens.filter(i => i.situacao === 'PARADO').length})` },
            ]} />
            <Input.Search allowClear placeholder="Código, nome ou categoria" style={{ width: 260 }} value={busca} onChange={e => setBusca(e.target.value)} />
          </Flex>
          {dados.itens.some(i => i.pelaFamilia) && <Alert type="info" showIcon style={{ padding: '2px 10px' }} title='Itens marcados "pela família" não têm marca no próprio cadastro: a marca vem da família.' />}
          <Table<ItemMarca> size="small" rowKey="idItem" dataSource={visiveis} pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }} scroll={{ x: 1100 }}
            locale={{ emptyText: <Empty description="Nenhum produto neste filtro." /> }}
            columns={[
              {
                title: '', key: 'c', width: 44, render: (_, i) => (
                  <Tooltip title={i.situacao === 'PARADO' ? 'Parado: tem estoque e não vendeu' : `Curva de venda ${i.classeVenda}`}>
                    <Tag color={COR_CLASSE[i.classeVenda] || 'default'} style={{ margin: 0, minWidth: 22, textAlign: 'center', fontWeight: 600 }}>{i.classeVenda}</Tag>
                  </Tooltip>),
              },
              {
                title: 'Item', key: 'i', width: 320, render: (_, i) => <>
                  <Text strong style={{ fontSize: 13 }}>{i.nome}</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>{i.sku} · {i.categoria || 'sem categoria'}</Text>
                    {i.pelaFamilia && <Tag style={{ marginLeft: 6, fontSize: 10 }}>pela família</Tag>}
                    {i.decisaoCompra && <Tag color={i.decisaoCompra === 'PREFERIDO' ? 'green' : 'red'} style={{ marginLeft: 6, fontSize: 10 }}>{i.decisaoCompra === 'PREFERIDO' ? 'preferido' : 'não recomprar'}</Tag>}</div>
                </>,
              },
              { title: 'Vendas', key: 'v', width: 110, align: 'right' as const, sorter: (a, b) => a.receita - b.receita, render: (_, i) => (i.receita ? <>{brl(i.receita)}<div><Text type="secondary" style={{ fontSize: 11 }}>{qtd(i.quantidade)} {i.unidade} · {i.vendas}×</Text></div></> : '—') },
              { title: 'Estoque', key: 'e', width: 120, align: 'right' as const, sorter: (a, b) => a.valorEstoque - b.valorEstoque, render: (_, i) => <>{qtd(i.estoque)} {i.unidade}<div><Text type={i.situacao === 'PARADO' ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>{brl0(i.valorEstoque)}</Text></div></> },
              { title: 'Dura', dataIndex: 'coberturaDias', width: 70, align: 'right' as const, render: (v: number | null) => (v === null ? '—' : `${v} d`) },
              {
                title: 'Preço', key: 'p', width: 120, align: 'right' as const, render: (_, i) => <>{brl(i.precoVenda)}<div><Text type="secondary" style={{ fontSize: 11 }}>
                  margem {pct(i.precoVenda > 0 ? (i.precoVenda - i.custoUnitario) / i.precoVenda : null)}</Text></div></>,
              },
              { title: 'O que fazer', dataIndex: 'recomendacao', width: 200, render: (v: string | null) => (v ? <Text style={{ fontSize: 12 }}>{v}</Text> : '') },
              {
                title: '', key: 'a', width: trocando ? 260 : 90, fixed: 'right', render: (_, i) => trocando === i.idItem ? (
                  <Select size="small" autoFocus showSearch optionFilterProp="label" style={{ width: 240 }} placeholder="Nova marca" open
                    onBlur={() => setTrocando(null)}
                    options={[{ value: 0, label: '— sem marca —' }, ...marcas.filter(m => m.id !== marca.id).map(m => ({ value: Number(m.id), label: m.nome }))]}
                    onChange={async (v: number) => {
                      try { await trocarMarca(i.idItem, v || null); message.success('Marca do item trocada.'); setTrocando(null); recarregar(); onMudou(); }
                      catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
                    }} />
                ) : (
                  <Space size={2}>
                    <Tooltip title="Ajustar preço"><Button size="small" icon={<DollarOutlined />} onClick={() => setPreco(i)} /></Tooltip>
                    <Tooltip title="Trocar a marca deste item"><Button size="small" icon={<SwapOutlined />} onClick={() => setTrocando(i.idItem)} /></Tooltip>
                  </Space>
                ),
              },
            ]} />
        </Space>
      )}
      <Drawer open={!!preco} onClose={() => { setPreco(null); recarregar(); }} width="min(1100px, 100vw)" destroyOnHidden title={preco ? `Preço · ${preco.nome}` : ''}>
        {preco && <ProductCommercialSalesConfig idItem={preco.idItem} />}
      </Drawer>
    </Drawer>
  );
};

export default ProdutosDaMarcaDrawer;
