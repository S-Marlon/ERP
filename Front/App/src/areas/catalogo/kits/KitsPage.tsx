// Kits de venda: item do catálogo montado com outros itens (ex.: mangueira + terminais).
// Custo pela soma dos componentes, estoque possível, mais vendidos e o que comprar para montar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, Empty, Input, Popconfirm, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { atualizarCustosKits, desfazerKit, Kit, listarKits, relatorioKits, RelatorioKits } from './kitsApi';
import KitEditorDrawer from './KitEditorDrawer';
import { corCobertura } from './kitsCalculo';
import { margemLiquidaPct, useTaxaPreco } from '../../../shared/core/precos/taxaPreco';

const { Title, Text } = Typography;
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const PERIODOS = [
  { label: '30 dias', value: 30 },
  { label: '90 dias', value: 90 },
  { label: '6 meses', value: 180 },
  { label: '1 ano', value: 365 },
];

const KitsPage: React.FC = () => {
  useTaxaPreco();
  const [dias, setDias] = useState(90);
  const [kits, setKits] = useState<Kit[]>([]);
  const [relatorio, setRelatorio] = useState<RelatorioKits | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [editor, setEditor] = useState<{ aberto: boolean; kit: Kit | null }>({ aberto: false, kit: null });
  const [atualizandoCustos, setAtualizandoCustos] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [k, r] = await Promise.all([listarKits(dias), relatorioKits(dias)]);
      setKits(k);
      setRelatorio(r);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar os kits.');
    } finally {
      setCarregando(false);
    }
  }, [dias]);
  useEffect(() => { carregar(); }, [carregar]);

  const visiveis = useMemo(() => {
    const t = filtro.trim().toUpperCase();
    return !t ? kits : kits.filter(k => k.nome.toUpperCase().includes(t) || k.sku.toUpperCase().includes(t)
      || k.componentes.some(c => c.nome.toUpperCase().includes(t) || c.sku.toUpperCase().includes(t)));
  }, [kits, filtro]);

  const totais = useMemo(() => ({
    kits: kits.filter(k => k.status === 'ATIVO').length,
    vendidos: kits.reduce((a, k) => a + k.vendidos, 0),
    faturamento: kits.reduce((a, k) => a + k.faturamento, 0),
    semEstoque: kits.filter(k => k.status === 'ATIVO' && k.estoquePossivel === 0).length,
  }), [kits]);

  const desfazer = async (k: Kit) => {
    try {
      await desfazerKit(k.idItem);
      message.success(`Kit ${k.sku} desfeito (o item ficou inativo).`);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao desfazer o kit.');
    }
  };

  const atualizarCustos = async () => {
    setAtualizandoCustos(true);
    try {
      const r = await atualizarCustosKits();
      message.success(r.alterados ? `Custo atualizado em ${r.alterados} kit(s).` : 'Os custos já estavam em dia.');
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao atualizar os custos.');
    } finally {
      setAtualizandoCustos(false);
    }
  };

  const colunasKits = [
    {
      title: 'Kit', key: 'kit', sorter: (a: Kit, b: Kit) => a.nome.localeCompare(b.nome),
      render: (_: unknown, k: Kit) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <Text strong>{k.sku}</Text>
            {k.status !== 'ATIVO' && <Tag>inativo</Tag>}
          </Space>
          <Text>{k.nome}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{k.componentes.length} item(ns): {k.componentes.map(c => `${num(c.quantidade)} ${c.unidade} ${c.sku}`).join(' + ')}</Text>
        </Space>
      ),
    },
    {
      title: 'Custo', dataIndex: 'custo', width: 110, align: 'right' as const, sorter: (a: Kit, b: Kit) => a.custo - b.custo,
      render: (v: number, k: Kit) => (
        <Tooltip title={Math.abs(k.custoGravado - v) >= 0.01 ? `No cadastro: ${brl(k.custoGravado)} (use "Atualizar custos")` : undefined}>
          <span>{brl(v)}{Math.abs(k.custoGravado - v) >= 0.01 && <Text type="warning"> *</Text>}</span>
        </Tooltip>
      ),
    },
    { title: 'Preço PDV', dataIndex: 'precoPdv', width: 110, align: 'right' as const, sorter: (a: Kit, b: Kit) => a.precoPdv - b.precoPdv, render: (v: number) => brl(v) },
    {
      title: 'Margem líq.', key: 'margem', width: 110, align: 'right' as const,
      sorter: (a: Kit, b: Kit) => margemLiquidaPct(a.precoPdv, a.custo) - margemLiquidaPct(b.precoPdv, b.custo),
      render: (_: unknown, k: Kit) => {
        if (!(k.precoPdv > 0)) return <Tag color="red">sem preço</Tag>;
        const m = margemLiquidaPct(k.precoPdv, k.custo);
        return <Tag color={m < 0 ? 'red' : m < 15 ? 'orange' : 'green'}>{m.toFixed(1)}%</Tag>;
      },
    },
    {
      title: 'Dá p/ montar', dataIndex: 'estoquePossivel', width: 120, align: 'right' as const,
      sorter: (a: Kit, b: Kit) => (a.estoquePossivel ?? 1e9) - (b.estoquePossivel ?? 1e9),
      render: (v: number | null, k: Kit) => (v === null ? '∞' : (
        <Tooltip title={k.limitante ? `Limitado por: ${k.limitante}` : undefined}>
          <Text type={v === 0 ? 'danger' : undefined} strong={v === 0}>{v}</Text>
        </Tooltip>
      )),
    },
    { title: `Vendidos (${dias}d)`, dataIndex: 'vendidos', width: 110, align: 'right' as const, defaultSortOrder: 'descend' as const, sorter: (a: Kit, b: Kit) => a.vendidos - b.vendidos, render: (v: number) => num(v) },
    { title: 'Faturamento', dataIndex: 'faturamento', width: 120, align: 'right' as const, sorter: (a: Kit, b: Kit) => a.faturamento - b.faturamento, render: (v: number) => brl(v) },
    {
      key: 'acoes', width: 90,
      render: (_: unknown, k: Kit) => (
        <Space size={0}>
          <Button type="text" icon={<EditOutlined />} onClick={() => setEditor({ aberto: true, kit: k })} />
          <Popconfirm
            title="Desfazer o kit?"
            description="A composição é apagada e o item fica inativo. Vendas antigas continuam certas."
            okText="Desfazer" okButtonProps={{ danger: true }} onConfirm={() => desfazer(k)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const componentesDoKit = (k: Kit) => (
    <Table
      size="small" rowKey="idItem" pagination={false} dataSource={k.componentes}
      columns={[
        { title: 'Item', key: 'i', render: (_: unknown, c: Kit['componentes'][number]) => <span>{c.nome} <Text type="secondary">{c.sku}</Text>{c.inativo && <Tag style={{ marginLeft: 6 }} color="red">inativo</Tag>}</span> },
        { title: 'Qtd.', key: 'q', width: 110, align: 'right' as const, render: (_: unknown, c: Kit['componentes'][number]) => `${num(c.quantidade)} ${c.unidade}` },
        { title: 'Saldo', key: 's', width: 110, align: 'right' as const, render: (_: unknown, c: Kit['componentes'][number]) => (c.servico ? 'serviço' : <Text type={c.saldo < c.quantidade ? 'danger' : undefined}>{num(c.saldo)} {c.unidade}</Text>) },
        { title: 'Custo un.', dataIndex: 'custoUnitario', width: 110, align: 'right' as const, render: (v: number) => brl(v) },
        { title: 'Custo', dataIndex: 'custoTotal', width: 110, align: 'right' as const, render: (v: number) => brl(v) },
      ]}
    />
  );

  const comps = relatorio?.componentes || [];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Kits de venda</Title>
          <Text type="secondary">Monte um kit com os itens usados: o custo sai da soma deles e, na venda, a baixa de estoque sai de cada item.</Text>
        </Col>
        <Col>
          <Space wrap>
            <Segmented options={PERIODOS} value={dias} onChange={v => setDias(Number(v))} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Tooltip title="Grava no cadastro o custo atual de cada kit (usado nas telas de preço)">
              <Button icon={<SyncOutlined />} loading={atualizandoCustos} onClick={atualizarCustos}>Atualizar custos</Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ aberto: true, kit: null })}>Novo kit</Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Kits ativos" value={totais.kits} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={`Kits vendidos (${dias}d)`} value={totais.vendidos} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Faturamento com kits" value={totais.faturamento} precision={2} prefix="R$" /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Sem estoque p/ montar" value={totais.semEstoque} valueStyle={{ color: totais.semEstoque ? '#cf1322' : undefined }} /></Card></Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: 'kits', label: `Kits (${kits.length})`,
              children: (
                <>
                  <Input.Search allowClear placeholder="Filtrar por kit, SKU ou item usado" style={{ maxWidth: 360, marginBottom: 12 }} value={filtro} onChange={e => setFiltro(e.target.value)} />
                  <Table
                    rowKey="idItem" size="middle" loading={carregando} dataSource={visiveis} columns={colunasKits}
                    expandable={{ expandedRowRender: componentesDoKit }}
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    locale={{ emptyText: <Empty description="Nenhum kit ainda: clique em Novo kit" /> }}
                  />
                </>
              ),
            },
            {
              key: 'compras', label: 'O que comprar',
              children: (
                <>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                    Itens usados nos kits: quanto saiu pelas vendas de kits nos últimos {dias} dias, o saldo e em quantos dias acaba nesse ritmo.
                  </Text>
                  <Table
                    rowKey="idItem" size="small" loading={carregando} dataSource={comps} pagination={{ pageSize: 30, showSizeChanger: false }}
                    columns={[
                      { title: 'Item', key: 'i', render: (_: unknown, c: typeof comps[number]) => <span>{c.nome} <Text type="secondary">{c.sku}</Text></span> },
                      { title: 'Saldo', key: 's', width: 110, align: 'right' as const, sorter: (a: typeof comps[number], b: typeof comps[number]) => a.saldo - b.saldo, render: (_: unknown, c: typeof comps[number]) => `${num(c.saldo)} ${c.unidade}` },
                      { title: `Saiu em kits (${dias}d)`, key: 'c', width: 140, align: 'right' as const, sorter: (a: typeof comps[number], b: typeof comps[number]) => a.consumido - b.consumido, render: (_: unknown, c: typeof comps[number]) => `${num(c.consumido)} ${c.unidade}` },
                      { title: 'Por mês', key: 'm', width: 100, align: 'right' as const, render: (_: unknown, c: typeof comps[number]) => num(c.consumoMensal) },
                      {
                        title: 'Acaba em', key: 'd', width: 110, align: 'right' as const,
                        sorter: (a: typeof comps[number], b: typeof comps[number]) => (a.diasCobertura ?? 1e9) - (b.diasCobertura ?? 1e9),
                        render: (_: unknown, c: typeof comps[number]) => (c.diasCobertura === null ? <Text type="secondary">sem giro</Text> : <Tag color={corCobertura(c.diasCobertura)}>{c.diasCobertura} dias</Tag>),
                      },
                      {
                        title: 'Kits', key: 'k',
                        render: (_: unknown, c: typeof comps[number]) => (
                          <Space size={[4, 4]} wrap>
                            {c.kits.map(s => <Tag key={s} color={c.travaKits.includes(s) ? 'red' : undefined}>{s}</Tag>)}
                          </Space>
                        ),
                      },
                    ]}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>Em vermelho: kits que não dá para montar por falta deste item.</Text>
                </>
              ),
            },
            {
              key: 'populares', label: 'Mais vendidos',
              children: (
                <Table
                  rowKey="idItem" size="small" loading={carregando}
                  dataSource={(relatorio?.kits || []).filter(k => k.vendidos > 0)}
                  pagination={false}
                  locale={{ emptyText: <Empty description={`Nenhum kit vendido nos últimos ${dias} dias`} /> }}
                  columns={[
                    { title: '#', key: 'pos', width: 50, render: (_: unknown, __: unknown, i: number) => i + 1 },
                    { title: 'Kit', key: 'k', render: (_: unknown, k: RelatorioKits['kits'][number]) => <span><Text strong>{k.sku}</Text> {k.nome}</span> },
                    { title: 'Vendidos', dataIndex: 'vendidos', width: 100, align: 'right' as const, render: (v: number) => num(v) },
                    { title: 'Vendas', dataIndex: 'vendas', width: 90, align: 'right' as const },
                    { title: 'Faturamento', dataIndex: 'faturamento', width: 130, align: 'right' as const, render: (v: number) => brl(v) },
                    { title: 'Lucro bruto est.', dataIndex: 'lucroEstimado', width: 140, align: 'right' as const, render: (v: number) => <Text type={v < 0 ? 'danger' : undefined}>{brl(v)}</Text> },
                    { title: 'Última venda', dataIndex: 'ultimaVenda', width: 150, render: (v: string | null) => (v ? v.split(' ')[0].split('-').reverse().join('/') : '—') },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>

      <KitEditorDrawer
        aberto={editor.aberto}
        kit={editor.kit}
        onFechar={() => setEditor({ aberto: false, kit: null })}
        onSalvo={() => { setEditor({ aberto: false, kit: null }); carregar(); }}
      />
    </div>
  );
};

export default KitsPage;
