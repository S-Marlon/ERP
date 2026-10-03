// Histórico de caixas: abertura/fechamento, vendas, diferença do fechamento e o detalhe de cada caixa.
import React, { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Descriptions, Drawer, Space, Table, Tag, Typography, message } from 'antd';
import { PrinterOutlined, ReloadOutlined, UnlockOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Caixa, caixaApi, CaixaHistorico, LinhaConferencia, ResumoCaixa } from '../../caixa/caixaApi';
import { brl, imprimirFechamento, ListaMovimentosCaixa, TabelaResumoCaixa } from '../../caixa/CaixaPainel';
import { caixaStore } from '../../caixa/caixaStore';

const { Text, Title } = Typography;
const hora = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const CaixasHistorico: React.FC = () => {
  const [periodo, setPeriodo] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);
  const [lista, setLista] = useState<CaixaHistorico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [detalhe, setDetalhe] = useState<{ caixa: Caixa; resumo: ResumoCaixa; fechamento: LinhaConferencia[] } | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      setLista(await caixaApi.historico(periodo[0].format('YYYY-MM-DD'), periodo[1].format('YYYY-MM-DD')));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao listar os caixas.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, [periodo]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirDetalhe = async (idCaixa: number) => {
    try {
      setDetalhe(await caixaApi.detalhe(idCaixa));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar o caixa.');
    }
  };

  const diferencaTotal = detalhe ? Number(detalhe.fechamento.reduce((a, f) => a + f.diferenca, 0).toFixed(2)) : 0;

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Caixas</Title>
            <Text type="secondary">Abertura, fechamento e conferência de cada caixa do PDV.</Text>
          </div>
          <Space wrap>
            <DatePicker.RangePicker format="DD/MM/YYYY" value={periodo} allowClear={false}
              onChange={v => v && v[0] && v[1] && setPeriodo([v[0], v[1]])} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
            <Button type="primary" icon={<UnlockOutlined />} onClick={() => { caixaStore.recarregar(); caixaStore.mostrar('resumo'); }}>Caixa atual</Button>
          </Space>
        </div>

        <Card size="small">
          <Table<CaixaHistorico>
            size="small"
            rowKey="idCaixa"
            loading={carregando}
            dataSource={lista}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            onRow={c => ({ onClick: () => abrirDetalhe(c.idCaixa), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'Caixa', dataIndex: 'idCaixa', width: 70 },
              { title: 'Situação', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={s === 'ABERTO' ? 'green' : 'default'}>{s === 'ABERTO' ? 'Aberto' : 'Fechado'}</Tag> },
              { title: 'Abertura', key: 'ab', render: (_, c) => <span>{hora(c.abertoEm)} <Text type="secondary" style={{ fontSize: 11 }}>· {c.operador}</Text></span> },
              { title: 'Fechamento', key: 'fe', render: (_, c) => (c.fechadoEm ? <span>{hora(c.fechadoEm)} <Text type="secondary" style={{ fontSize: 11 }}>· {c.operadorFechamento}</Text></span> : '—') },
              { title: 'Vendas', key: 'v', align: 'right' as const, render: (_, c) => `${c.qtdVendas} · ${brl(c.totalVendas)}` },
              {
                title: 'Diferença', dataIndex: 'diferenca', align: 'right' as const, width: 120,
                render: (d: number | null) => (d === null ? '—' : <Text type={d < 0 ? 'danger' : d > 0 ? 'warning' : 'success'}>{d > 0 ? '+' : ''}{brl(d)}</Text>),
              },
            ]}
          />
        </Card>
      </Space>

      <Drawer open={Boolean(detalhe)} onClose={() => setDetalhe(null)} width={680}
        title={detalhe ? `Caixa ${detalhe.caixa.idCaixa} · ${detalhe.caixa.status === 'ABERTO' ? 'aberto' : 'fechado'}` : ''}
        extra={detalhe && detalhe.caixa.status === 'FECHADO' && (
          <Button icon={<PrinterOutlined />} onClick={() => imprimirFechamento(detalhe.caixa, detalhe.resumo, detalhe.fechamento, diferencaTotal)}>Imprimir</Button>
        )}>
        {detalhe && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered items={[
              { key: 'a', label: 'Abertura', children: `${hora(detalhe.caixa.abertoEm)} · ${detalhe.caixa.operador}` },
              { key: 'f', label: 'Fechamento', children: detalhe.caixa.fechadoEm ? `${hora(detalhe.caixa.fechadoEm)} · ${detalhe.caixa.operadorFechamento}` : '—' },
              { key: 't', label: 'Troco inicial', children: brl(detalhe.caixa.valorAbertura) },
              { key: 'v', label: 'Vendas', children: `${detalhe.resumo.vendas.concluidas} · ${brl(detalhe.resumo.vendas.total)}` },
              { key: 'c', label: 'Canceladas', children: detalhe.resumo.vendas.canceladas },
              { key: 'd', label: 'Diferença', children: detalhe.caixa.status === 'FECHADO' ? <b style={{ color: diferencaTotal < 0 ? '#cf1322' : diferencaTotal > 0 ? '#d48806' : '#389e0d' }}>{brl(diferencaTotal)}</b> : '—' },
              ...(detalhe.caixa.observacaoFechamento ? [{ key: 'o', label: 'Observação', span: 2, children: detalhe.caixa.observacaoFechamento }] : []),
            ]} />
            <div>
              <Text strong>Por forma de pagamento</Text>
              <TabelaResumoCaixa resumo={detalhe.resumo} fechamento={detalhe.caixa.status === 'FECHADO' ? detalhe.fechamento : undefined} />
            </div>
            <div>
              <Text strong>Movimentos</Text>
              <ListaMovimentosCaixa resumo={detalhe.resumo} />
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default CaixasHistorico;
