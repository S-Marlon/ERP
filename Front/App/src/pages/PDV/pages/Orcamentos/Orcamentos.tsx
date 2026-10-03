// Vendas › Orçamentos: válidos, vencidos e os que viraram venda; imprimir, vender (abre no PDV) e excluir.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Input, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, PrinterOutlined, ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { imprimirOrcamento, PedidoAbertoDetalhe, PedidoAbertoResumo, pedidosAbertosApi } from '../../services/pedidosAbertosApi';
import { SITUACAO_PEDIDO } from '../../components/PedidosAbertosPDV';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

const ItensDoOrcamento: React.FC<{ id: number }> = ({ id }) => {
  const [d, setD] = useState<PedidoAbertoDetalhe | null>(null);
  useEffect(() => { pedidosAbertosApi.detalhe(id).then(setD).catch(() => setD(null)); }, [id]);
  if (!d) return <Text type="secondary">Carregando...</Text>;
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={4}>
      <Table size="small" rowKey={(_, i) => String(i)} pagination={false} dataSource={d.itens} columns={[
        { title: 'Código', dataIndex: 'sku', width: 140 },
        { title: 'Item', dataIndex: 'nome' },
        { title: 'Qtd', key: 'q', align: 'right' as const, render: (_, i) => `${i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${i.unidade || ''}` },
        { title: 'Unitário', dataIndex: 'precoUnitario', align: 'right' as const, render: (v: number) => brl(v) },
        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <b>{brl(v)}</b> },
      ]} />
      {d.observacao && <Text type="secondary" style={{ fontSize: 12 }}>Observações: {d.observacao}</Text>}
    </Space>
  );
};

const Orcamentos: React.FC = () => {
  const navigate = useNavigate();
  const [situacao, setSituacao] = useState('ABERTOS');
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<PedidoAbertoResumo[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try { setLista(await pedidosAbertosApi.listar('ORCAMENTO', situacao, busca.trim())); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao listar.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [situacao]); // eslint-disable-line react-hooks/exhaustive-deps

  const imprimir = async (id: number) => {
    try { await imprimirOrcamento(await pedidosAbertosApi.detalhe(id)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao imprimir.'); }
  };
  const excluir = async (id: number) => {
    try { await pedidosAbertosApi.excluir(id); message.success('Orçamento excluído.'); carregar(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao excluir.'); }
  };

  const total = lista.reduce((a, o) => a + o.total, 0);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Orçamentos</Title>
            <Text type="secondary">Criados no PDV (botão Orçamento). Preços congelados até a validade; não mexem em estoque nem caixa.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/vendas/pdv')}>Novo no PDV</Button>
          </Space>
        </div>

        <Card size="small">
          <Space wrap style={{ marginBottom: 10, justifyContent: 'space-between', width: '100%' }}>
            <Space wrap>
              <Segmented value={situacao} onChange={v => setSituacao(String(v))} options={[
                { value: 'ABERTOS', label: 'Em aberto' }, { value: 'VALIDO', label: 'Válidos' }, { value: 'VENCIDO', label: 'Vencidos' },
                { value: 'CONVERTIDO', label: 'Viraram venda' }, { value: 'TODOS', label: 'Todos' },
              ]} />
              <Input.Search allowClear placeholder="Cliente, contato, item ou nº" style={{ width: 280 }}
                value={busca} onChange={e => setBusca(e.target.value)} onSearch={carregar} />
            </Space>
            <Text type="secondary">{lista.length} orçamento(s) · {brl(total)}</Text>
          </Space>
          <Table<PedidoAbertoResumo>
            size="small"
            rowKey="id"
            loading={carregando}
            dataSource={lista}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            expandable={{ expandedRowRender: o => <ItensDoOrcamento id={o.id} /> }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum orçamento" /> }}
            columns={[
              { title: 'Nº', dataIndex: 'id', width: 70 },
              { title: 'Emitido', dataIndex: 'criadoEm', width: 95, render: (v: string) => dataBr(String(v)) },
              {
                title: 'Cliente', key: 'c',
                render: (_, o) => (
                  <div style={{ lineHeight: 1.2 }}>
                    <div>{o.cliente}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{[o.contato, `${o.qtdItens} item(ns)`, o.operador].filter(Boolean).join(' · ')}</Text>
                  </div>
                ),
              },
              {
                title: 'Validade', key: 'v', width: 150,
                render: (_, o) => (
                  <Space size={4}>
                    <span>{dataBr(o.validade)}</span>
                    <Tag color={SITUACAO_PEDIDO[o.situacao].color} style={{ margin: 0 }}>{SITUACAO_PEDIDO[o.situacao].label}</Tag>
                  </Space>
                ),
              },
              {
                title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120,
                render: (v: number, o) => (
                  <Tooltip title={o.total > 0 ? `Margem bruta ${(((o.total - o.custo) / o.total) * 100).toFixed(1).replace('.', ',')}%` : undefined}><b>{brl(v)}</b></Tooltip>
                ),
              },
              {
                title: '', key: 'a', width: 200,
                render: (_, o) => (
                  <Space size={4}>
                    {o.situacao === 'CONVERTIDO'
                      ? <Button size="small" type="link" onClick={() => navigate('/vendas/do-dia')}>venda Nº {o.idVendaGerada}</Button>
                      : <Button size="small" type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate(`/vendas/pdv?orcamento=${o.id}`)}>Vender</Button>}
                    <Tooltip title="Imprimir"><Button size="small" icon={<PrinterOutlined />} onClick={() => imprimir(o.id)} /></Tooltip>
                    {o.situacao !== 'CONVERTIDO' && (
                      <Popconfirm title="Excluir o orçamento?" okText="Excluir" cancelText="Não" onConfirm={() => excluir(o.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Orcamentos;
