// Resultado real das vendas do ML por anúncio: tarifa e frete cobrados de verdade (lidos de cada pedido), custo do ERP
// gravado na venda e o lucro. O frete real fica ao lado da estimativa de hoje, para conferir a análise de preço.
import React, { useCallback, useEffect, useState } from 'react';
import { Card, Col, Empty, Row, Segmented, Space, Statistic, Table, Tooltip, Typography, message } from 'antd';
import { FundOutlined } from '@ant-design/icons';
import { anunciosApi, formatarMoeda, pedidosApi, ResultadoAnuncioMl, ResultadoVendasMl } from './mercadoLivreApi';

const { Text } = Typography;
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')}%`);
const cor = (v: number) => (v < 0 ? '#cf1322' : '#389e0d');

const ResultadoRealMl: React.FC<{ atualizar?: unknown }> = ({ atualizar }) => {
  const [dias, setDias] = useState(30);
  const [r, setR] = useState<ResultadoVendasMl | null>(null);
  const [estimado, setEstimado] = useState<Map<string, number>>(new Map());   // MLB -> frete estimado hoje
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await pedidosApi.resultado(dias);
      setR(res);
      if (res.anuncios.length) {
        const [lista, fin] = await Promise.all([anunciosApi.listar(), anunciosApi.financeiro()]);
        const porItem = new Map(fin.flatMap(a => a.itens.map(i => [`${a.id}|${i.idItem}`, i.frete] as const)));
        const m = new Map<string, number>();
        for (const a of lista) for (const i of a.itens) if (i.mlbId && porItem.has(`${a.id}|${i.idItem}`)) m.set(i.mlbId, porItem.get(`${a.id}|${i.idItem}`)!);
        setEstimado(m);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setCarregando(false);
    }
  }, [dias]);
  useEffect(() => { carregar(); }, [carregar, atualizar]);

  const t = r?.total;
  return (
    <Card
      size="small" style={{ marginBottom: 16 }} loading={carregando && !r}
      title={<Space><FundOutlined />Resultado real das vendas</Space>}
      extra={<Segmented size="small" value={dias} onChange={v => setDias(Number(v))} options={[{ value: 7, label: '7 dias' }, { value: 30, label: '30 dias' }, { value: 90, label: '90 dias' }]} />}
    >
      {!r || !r.pedidos ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={(
          <Text type="secondary">
            Nenhuma venda do ML nos últimos {dias} dias. Cada venda aparece aqui com a tarifa e o frete <b>cobrados de verdade</b>,
            o custo do ERP e o lucro, ao lado do frete estimado na aba Anúncios.
          </Text>
        )} />
      ) : t && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={4}><Statistic title={`Vendido (${r.pedidos} pedidos)`} value={formatarMoeda(t.receita)} /></Col>
            <Col xs={12} md={4}><Statistic title="Tarifas do ML" value={formatarMoeda(t.comissao)} valueStyle={{ color: '#8c8c8c' }} /></Col>
            <Col xs={12} md={4}><Statistic title="Frete pago por você" value={formatarMoeda(t.frete)} valueStyle={{ color: '#8c8c8c' }} /></Col>
            <Col xs={12} md={4}><Statistic title="Você recebeu" value={formatarMoeda(t.recebido)} /></Col>
            <Col xs={12} md={4}><Statistic title="Custo (ERP)" value={formatarMoeda(t.custo)} valueStyle={{ color: '#8c8c8c' }} /></Col>
            <Col xs={12} md={4}><Statistic title={`Lucro (${pct(t.lucroSobreCustoPct)} s/ custo)`} value={formatarMoeda(t.lucro)} valueStyle={{ color: cor(t.lucro) }} /></Col>
          </Row>
          <Table<ResultadoAnuncioMl>
            size="small" rowKey="mlbId" dataSource={r.anuncios} pagination={r.anuncios.length > 10 ? { pageSize: 10 } : false}
            scroll={{ x: 900 }}
            columns={[
              { title: 'Anúncio', render: (_, a) => <div><Text strong>{a.titulo}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{a.mlbId} · {a.pedidos} pedido(s) · {a.unidades} un.</Text></div></div> },
              { title: 'Vendido', dataIndex: 'receita', align: 'right', render: formatarMoeda },
              { title: 'Tarifas', dataIndex: 'comissao', align: 'right', render: (v: number) => <Text type="secondary">−{formatarMoeda(v)}</Text> },
              {
                title: <Tooltip title="Frete cobrado de verdade (média por pedido) e a estimativa de hoje na análise de preço">Frete (por pedido)</Tooltip>, align: 'right',
                render: (_, a) => {
                  const est = estimado.get(a.mlbId);
                  const longe = est !== undefined && a.fretePorPedido > 0 && Math.abs(a.fretePorPedido - est) > Math.max(1, est * 0.15);
                  return (
                    <div style={{ lineHeight: 1.25 }}>
                      <Text type="secondary">−{formatarMoeda(a.frete)}</Text>
                      <div>
                        <Text style={{ fontSize: 12, color: longe ? '#d46b08' : undefined }}>
                          {formatarMoeda(a.fretePorPedido)}/pedido{est !== undefined ? ` · estimado ${formatarMoeda(est)}` : ''}
                        </Text>
                      </div>
                    </div>
                  );
                },
              },
              { title: 'Recebido', dataIndex: 'recebido', align: 'right', render: (v: number) => <b>{formatarMoeda(v)}</b> },
              { title: 'Custo', dataIndex: 'custo', align: 'right', render: (v: number) => <Text type="secondary">−{formatarMoeda(v)}</Text> },
              { title: 'Lucro', dataIndex: 'lucro', align: 'right', render: (v: number) => <b style={{ color: cor(v) }}>{formatarMoeda(v)}</b> },
              { title: 'Sobre o custo', dataIndex: 'lucroSobreCustoPct', align: 'right', render: pct },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Só vendas que viraram venda no ERP (canceladas ficam fora). Pedido com vários anúncios: frete e custo divididos pelo valor de cada um.
            Frete em laranja: o real ficou longe da estimativa (vale revisar o preço na aba Anúncios).
          </Text>
        </Space>
      )}
    </Card>
  );
};

export default ResultadoRealMl;
