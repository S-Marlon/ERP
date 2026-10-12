// Pedidos de compra e cotações: o pedido enviado ao fornecedor recebe os preços da resposta (cotação),
// que ficam como referência de preço do item mesmo que a compra não aconteça.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, DatePicker, Drawer, Empty, InputNumber, Popconfirm, Segmented, Space, Statistic, Table, Tag, Typography, message,
} from 'antd';
import { CopyOutlined, DeleteOutlined, ReloadOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { compraInteligenteApi, PedidoDetalhe, PedidoResumo, StatusPedido } from './compraInteligenteApi';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dataBr = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

export const COR_STATUS: Record<StatusPedido, { cor: string; rotulo: string }> = {
  RASCUNHO: { cor: 'default', rotulo: 'Rascunho' },
  ENVIADO: { cor: 'processing', rotulo: 'Enviado' },
  COTADO: { cor: 'blue', rotulo: 'Cotado' },
  COMPRADO: { cor: 'green', rotulo: 'Comprado' },
  CANCELADO: { cor: 'red', rotulo: 'Cancelado' },
};

export const copiarTexto = async (texto: string) => {
  try {
    await navigator.clipboard.writeText(texto);
    message.success('Copiado: cole no WhatsApp ou e-mail do fornecedor.');
  } catch {
    message.error('Não foi possível copiar (o navegador bloqueou).');
  }
};

const PedidoDrawer: React.FC<{ id: number | null; onFechar: () => void; onAlterado: () => void }> = ({ id, onFechar, onAlterado }) => {
  const [p, setP] = useState<PedidoDetalhe | null>(null);
  const [precos, setPrecos] = useState<Record<number, number | null>>({});
  const [validade, setValidade] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const aplicar = (d: PedidoDetalhe) => {
    setP(d);
    setPrecos(Object.fromEntries(d.itens.map(i => [i.idPedidoItem, i.precoCotado])));
    setValidade(d.validadeCotacao);
  };
  useEffect(() => {
    if (!id) { setP(null); return; }
    compraInteligenteApi.pedido(id).then(aplicar).catch(e => message.error(e.message));
  }, [id]);

  const executar = async (fn: () => Promise<PedidoDetalhe>, ok: string) => {
    setSalvando(true);
    try { aplicar(await fn()); message.success(ok); onAlterado(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setSalvando(false); }
  };

  const totalCotado = p ? p.itens.reduce((a, i) => a + (precos[i.idPedidoItem] != null ? Math.round(i.quantidade * Number(precos[i.idPedidoItem]) * 100) / 100 : 0), 0) : 0;

  return (
    <Drawer
      open={!!id}
      onClose={onFechar}
      width={980}
      destroyOnHidden
      title={p ? <Space>Pedido {p.idPedido} · {p.fornecedor} <Tag color={COR_STATUS[p.status].cor}>{COR_STATUS[p.status].rotulo}</Tag></Space> : 'Pedido'}
      extra={p && (
        <Space wrap>
          <Button icon={<CopyOutlined />} onClick={() => copiarTexto(p.texto)}>Copiar texto</Button>
          {p.status === 'RASCUNHO' && (
            <Button icon={<SendOutlined />} loading={salvando} onClick={() => executar(() => compraInteligenteApi.status(p.idPedido, 'ENVIADO'), 'Marcado como enviado.')}>Marcar enviado</Button>
          )}
          {['ENVIADO', 'COTADO', 'RASCUNHO'].includes(p.status) && (
            <Button type="primary" icon={<SaveOutlined />} loading={salvando}
              onClick={() => executar(() => compraInteligenteApi.cotacao(p.idPedido, p.itens.map(i => ({ idPedidoItem: i.idPedidoItem, precoCotado: precos[i.idPedidoItem] ?? null })), validade), 'Cotação guardada.')}>
              Guardar cotação
            </Button>
          )}
          {p.status === 'COTADO' && (
            <Button loading={salvando} onClick={() => executar(() => compraInteligenteApi.status(p.idPedido, 'COMPRADO'), 'Marcado como comprado.')}>Marcar comprado</Button>
          )}
          {!['CANCELADO', 'COMPRADO'].includes(p.status) && (
            <Popconfirm title="Cancelar o pedido?" description="Os preços já cotados continuam na memória de preços." onConfirm={() => executar(() => compraInteligenteApi.status(p.idPedido, 'CANCELADO'), 'Pedido cancelado.')}>
              <Button danger>Cancelar</Button>
            </Popconfirm>
          )}
        </Space>
      )}
    >
      {p && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space size={32} wrap>
            <Statistic title="Estimado (último preço)" value={p.totalEstimado} precision={2} prefix="R$" />
            <Statistic title="Cotado" value={totalCotado} precision={2} prefix="R$" valueStyle={{ color: '#1677ff' }} />
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Cotação válida até</Text>
              <DatePicker format="DD/MM/YYYY" value={validade ? dayjs(validade) : null} onChange={d => setValidade(d ? d.format('YYYY-MM-DD') : null)} />
            </div>
            <Text type="secondary" style={{ maxWidth: 360, fontSize: 12 }}>
              Digite o preço que o fornecedor respondeu (por unidade de compra). Fica guardado como referência do item, mesmo que você não compre.
            </Text>
          </Space>
          <Table
            size="small"
            rowKey="idPedidoItem"
            pagination={false}
            dataSource={p.itens}
            columns={[
              { title: 'Cód. fornecedor', dataIndex: 'codigoFornecedor', width: 130, render: (v: string | null) => v || <Text type="warning">sem código</Text> },
              {
                title: 'Item', key: 'item',
                render: (_, i) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{i.nomeCatalogo}</Text>
                    {i.nome !== i.nomeCatalogo && <Text type="secondary" style={{ fontSize: 11 }}>como o fornecedor escreve: {i.nome}</Text>}
                  </Space>
                ),
              },
              { title: 'Qtd', key: 'q', width: 90, align: 'right' as const, render: (_, i) => `${i.quantidade.toLocaleString('pt-BR')} ${i.unidadeCompra}` },
              { title: 'Estimado', dataIndex: 'precoEstimado', width: 100, align: 'right' as const, render: (v: number) => brl(v) },
              {
                title: 'Preço cotado', key: 'c', width: 140,
                render: (_, i) => (
                  <InputNumber size="small" min={0} step={0.01} precision={4} style={{ width: '100%' }} prefix="R$"
                    value={precos[i.idPedidoItem] ?? null} disabled={p.status === 'CANCELADO'}
                    onChange={v => setPrecos(x => ({ ...x, [i.idPedidoItem]: v === null ? null : Number(v) }))} />
                ),
              },
              {
                title: 'Dif.', key: 'd', width: 80, align: 'right' as const,
                render: (_, i) => {
                  const c = precos[i.idPedidoItem];
                  if (c == null || !(i.precoEstimado > 0)) return '';
                  const pct = ((c - i.precoEstimado) / i.precoEstimado) * 100;
                  return <Text type={pct > 0.5 ? 'danger' : pct < -0.5 ? 'success' : 'secondary'}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</Text>;
                },
              },
            ]}
          />
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Texto enviado ao fornecedor</Text>
            <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, whiteSpace: 'pre-wrap', margin: 0 }}>{p.texto}</pre>
          </div>
        </Space>
      )}
    </Drawer>
  );
};

const PedidosCompra: React.FC<{ versao: number }> = ({ versao }) => {
  const [status, setStatus] = useState<string>('');
  const [lista, setLista] = useState<PedidoResumo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await compraInteligenteApi.pedidos(status)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  }, [status]);
  useEffect(() => { carregar(); }, [carregar, versao]);

  const excluir = async (id: number) => {
    try { await compraInteligenteApi.excluir(id); message.success('Pedido excluído.'); carregar(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Segmented value={status} onChange={v => setStatus(String(v))} options={[
          { label: 'Todos', value: '' }, { label: 'Rascunho', value: 'RASCUNHO' }, { label: 'Enviados', value: 'ENVIADO' },
          { label: 'Cotados', value: 'COTADO' }, { label: 'Comprados', value: 'COMPRADO' }, { label: 'Cancelados', value: 'CANCELADO' },
        ]} />
        <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
      </Space>
      <Table<PedidoResumo>
        size="middle"
        rowKey="idPedido"
        loading={carregando}
        dataSource={lista}
        onRow={r => ({ onClick: () => setAberto(r.idPedido), style: { cursor: 'pointer' } })}
        locale={{ emptyText: <Empty description="Nenhum pedido ainda: monte um na aba Montar pedido" /> }}
        columns={[
          { title: 'Nº', dataIndex: 'idPedido', width: 70 },
          { title: 'Fornecedor', dataIndex: 'fornecedor' },
          { title: 'Situação', dataIndex: 'status', width: 110, render: (s: StatusPedido) => <Tag color={COR_STATUS[s].cor}>{COR_STATUS[s].rotulo}</Tag> },
          { title: 'Itens', dataIndex: 'itens', width: 70, align: 'right' as const },
          { title: 'Estimado', dataIndex: 'totalEstimado', width: 120, align: 'right' as const, render: (v: number) => brl(v) },
          { title: 'Cotado', dataIndex: 'totalCotado', width: 120, align: 'right' as const, render: (v: number | null) => brl(v) },
          { title: 'Criado', dataIndex: 'criadoEm', width: 110, render: (v: string) => dataBr(v) },
          { title: 'Validade', dataIndex: 'validadeCotacao', width: 100, render: (v: string | null) => (v ? dataBr(v) : '') },
          {
            key: 'x', width: 50,
            render: (_, r) => r.status === 'RASCUNHO' && (
              <span onClick={e => e.stopPropagation()}>
                <Popconfirm title="Excluir o rascunho?" onConfirm={() => excluir(r.idPedido)}>
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </span>
            ),
          },
        ]}
      />
      <PedidoDrawer id={aberto} onFechar={() => setAberto(null)} onAlterado={carregar} />
    </>
  );
};

export default PedidosCompra;
