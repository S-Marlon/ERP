// Margem abaixo do alvo: o preço acompanha a concorrência, mas o lucro sobre o custo ficou baixo. Mostra o
// custo-alvo (quanto pagar para chegar no alvo sem mexer no preço), a melhor oferta conhecida (notas e cotações)
// e manda para a lista de trabalho como "Comprar" para negociar na próxima cotação.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Flex, Input, InputNumber, Row, Segmented, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { HistoryOutlined, ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { compraInteligenteApi, ItemMargemBaixa } from './compraInteligenteApi';
import HistoricoPrecosDrawer from './HistoricoPrecosDrawer';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';

const { Text } = Typography;
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const pct = (v: number) => `${(Number(v) || 0).toFixed(1).replace('.', ',')}%`;
const num = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const CHAVE_ALVO = 'erp.compras.alvoPadrao';
const lerAlvo = () => { try { const v = Number(localStorage.getItem(CHAVE_ALVO)); return v > 0 ? v : 30; } catch { return 30; } };

const MargemAbaixoAlvo: React.FC<{ dias: number }> = ({ dias }) => {
  const lista = useListaTrabalho();
  const [alvoPadrao, setAlvoPadrao] = useState<number>(lerAlvo);
  const [dados, setDados] = useState<{ taxaReferencia: number; itens: ItemMargemBaixa[] } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [soComGiro, setSoComGiro] = useState(false);
  const [filtro, setFiltro] = useState<'TODOS' | 'OFERTA' | 'BUSCAR'>('TODOS');
  const [marcados, setMarcados] = useState<React.Key[]>([]);
  const [historico, setHistorico] = useState<ItemMargemBaixa | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setDados(await compraInteligenteApi.margemAbaixoAlvo(alvoPadrao, dias)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [alvoPadrao, dias]);
  useEffect(() => { carregar(); }, [carregar]);

  const itens = useMemo(() => (dados?.itens || []).filter(i => {
    if (soComGiro && !(i.vendido > 0)) return false;
    if (filtro === 'OFERTA' && !i.melhorOferta) return false;
    if (filtro === 'BUSCAR' && i.melhorOferta) return false;
    const t = busca.trim().toUpperCase();
    return !t || i.nome.toUpperCase().includes(t) || i.sku.toUpperCase().includes(t) || i.familia.toUpperCase().includes(t);
  }), [dados, soComGiro, filtro, busca]);

  const todos = dados?.itens || [];
  const resumo = {
    itens: todos.length,
    prejuizo: todos.filter(i => i.prejuizo).length,
    oferta: todos.filter(i => i.melhorOferta).length,
    perda: todos.reduce((a, i) => a + i.perdaNoPeriodo, 0),
  };

  const marcarParaComprar = () => {
    const escolhidos = itens.filter(i => marcados.includes(i.idItem));
    for (const i of escolhidos) {
      lista.adicionar({ idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade }, {
        tags: ['COMPRAR'],
        origem: 'Margem abaixo do alvo',
        observacao: `Negociar custo: alvo ${brl(i.custoAlvo)} (hoje ${brl(i.custo)})${i.melhorOferta ? ` · ${i.melhorOferta.fornecedor} fez ${brl(i.melhorOferta.precoBase)}` : ''}`,
      });
    }
    message.success(`${escolhidos.length} item(ns) na lista de trabalho como "Comprar", com o custo-alvo na observação.`);
    setMarcados([]);
  };

  const colunas = [
    {
      title: 'Item', key: 'item',
      render: (_: unknown, i: ItemMargemBaixa) => (
        <Space direction="vertical" size={0}>
          <Text strong>{i.nome}</Text>
          <Space size={4} wrap>
            <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}</Text>
            {i.familia && <Text type="secondary" style={{ fontSize: 11 }}>· {i.familia}</Text>}
            {lista.temItem(i.idItem, 'COMPRAR') && <Tag color="orange" style={{ fontSize: 10 }}>na lista: comprar</Tag>}
          </Space>
        </Space>
      ),
    },
    { title: 'Preço', dataIndex: 'preco', width: 100, align: 'right' as const, render: (v: number) => brl(v) },
    { title: 'Custo', dataIndex: 'custo', width: 100, align: 'right' as const, render: (v: number) => brl(v) },
    {
      title: <Tooltip title="Lucro líquido (depois da taxa da maquininha) sobre o custo. Ao lado, a margem sobre o preço.">Lucro s/ custo</Tooltip>,
      key: 'lucro', width: 130, align: 'right' as const, sorter: (a: ItemMargemBaixa, b: ItemMargemBaixa) => a.lucroSobreCustoPct - b.lucroSobreCustoPct,
      render: (_: unknown, i: ItemMargemBaixa) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <Tag color={i.prejuizo ? 'red' : 'orange'} style={{ margin: 0 }}>{pct(i.lucroSobreCustoPct)}</Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>{brl(i.lucro)} · {pct(i.margemSobrePrecoPct)} do preço</Text>
        </Space>
      ),
    },
    {
      title: 'Alvo', key: 'alvo', width: 90, align: 'right' as const,
      render: (_: unknown, i: ItemMargemBaixa) => (
        <Tooltip title={i.origemAlvo === 'FAMILIA' ? 'Margem mínima da família' : 'Alvo padrão (família sem margem mínima)'}>
          <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
            <Text>{pct(i.alvoPct)}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>{i.origemAlvo === 'FAMILIA' ? 'da família' : 'padrão'}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: <Tooltip title="Quanto pagar ao fornecedor para chegar no alvo sem mexer no preço">Custo-alvo</Tooltip>,
      key: 'custoAlvo', width: 120, align: 'right' as const, sorter: (a: ItemMargemBaixa, b: ItemMargemBaixa) => a.reducaoCustoPct - b.reducaoCustoPct,
      render: (_: unknown, i: ItemMargemBaixa) => (
        <Tooltip title={`Com o custo atual, o preço para o alvo seria ${brl(i.precoAlvo)}`}>
          <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
            <Text strong style={{ color: '#1677ff' }}>{brl(i.custoAlvo)}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>-{pct(i.reducaoCustoPct)}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Melhor oferta conhecida', key: 'oferta', width: 190,
      render: (_: unknown, i: ItemMargemBaixa) => (i.melhorOferta ? (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: i.melhorOferta.precoBase <= i.custoAlvo ? '#389e0d' : undefined }}>{brl(i.melhorOferta.precoBase)}/{i.unidade || 'un'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{i.melhorOferta.fornecedor} · {i.melhorOferta.origem === 'COTACAO' ? `cotação ${String(i.melhorOferta.data).split('-').reverse().join('/')}` : 'última nota'}</Text>
        </Space>
      ) : <Tag style={{ margin: 0 }}>buscar fornecedor</Tag>),
    },
    {
      title: `Vendido (${dias}d)`, key: 'vendido', width: 120, align: 'right' as const,
      sorter: (a: ItemMargemBaixa, b: ItemMargemBaixa) => a.perdaNoPeriodo - b.perdaNoPeriodo,
      render: (_: unknown, i: ItemMargemBaixa) => (i.vendido > 0 ? (
        <Tooltip title="Quanto deixou de ganhar no período, pelo giro, por estar acima do custo-alvo">
          <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
            <Text>{num(i.vendido)} {i.unidade}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>-{brl(i.perdaNoPeriodo)}</Text>
          </Space>
        </Tooltip>
      ) : <Text type="secondary">sem giro</Text>),
    },
    { key: 'h', width: 40, render: (_: unknown, i: ItemMargemBaixa) => <Tooltip title="Memória de preços"><Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setHistorico(i)} /></Tooltip> },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert type="info" showIcon
        message="Preço de mercado, custo a negociar"
        description="Itens em que o preço (que acompanha a concorrência) deixa o lucro sobre o custo abaixo do alvo. O alvo é a margem mínima da família; sem ela, o alvo padrão. O custo-alvo é o que pagar ao fornecedor para chegar no alvo sem mexer no preço." />
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Abaixo do alvo" value={resumo.itens} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Com prejuízo" value={resumo.prejuizo} valueStyle={{ color: resumo.prejuizo ? '#cf1322' : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Com oferta melhor conhecida" value={resumo.oferta} valueStyle={{ color: resumo.oferta ? '#389e0d' : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Tooltip title={`No período de ${dias} dias, pelo giro`}><Statistic title="Deixou de ganhar" value={resumo.perda} precision={2} prefix="R$" /></Tooltip></Card></Col>
      </Row>
      <Card size="small">
        <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
          <Tooltip title="Para itens cuja família não tem margem mínima (Famílias › Editar dados › Comercial)">
            <InputNumber min={1} max={1000} value={alvoPadrao} addonBefore="Alvo padrão" addonAfter="% s/ custo" style={{ width: 230 }}
              onChange={v => { const n = Number(v) || 30; setAlvoPadrao(n); try { localStorage.setItem(CHAVE_ALVO, String(n)); } catch { /* sem armazenamento */ } }} />
          </Tooltip>
          <Segmented value={filtro} onChange={v => setFiltro(v as typeof filtro)} options={[
            { value: 'TODOS', label: 'Todos' }, { value: 'OFERTA', label: 'Com oferta melhor' }, { value: 'BUSCAR', label: 'Buscar fornecedor' },
          ]} />
          <Space size={4}><Switch size="small" checked={soComGiro} onChange={setSoComGiro} /><Text style={{ fontSize: 12 }}>Só com venda</Text></Space>
          <Input.Search allowClear placeholder="Buscar item ou família" style={{ width: 220 }} value={busca} onChange={e => setBusca(e.target.value)} />
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
          <Button type="primary" icon={<ShoppingCartOutlined />} disabled={!marcados.length} onClick={marcarParaComprar} style={{ marginLeft: 'auto' }}>
            Marcar para comprar ({marcados.length})
          </Button>
        </Flex>
        <Table<ItemMargemBaixa>
          size="small" rowKey="idItem" loading={carregando} dataSource={itens} columns={colunas}
          rowSelection={{ selectedRowKeys: marcados, onChange: setMarcados }}
          pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="Nenhum item abaixo do alvo" /> }}
        />
        {dados && <Text type="secondary" style={{ fontSize: 12 }}>Taxa da maquininha de referência: {pct(dados.taxaReferencia)} (descontada do preço antes de calcular o lucro).</Text>}
      </Card>
      <HistoricoPrecosDrawer item={historico ? { idItem: historico.idItem, sku: historico.sku, nome: historico.nome, unidade: historico.unidade } : null} onFechar={() => setHistorico(null)} />
    </Space>
  );
};

export default MargemAbaixoAlvo;
