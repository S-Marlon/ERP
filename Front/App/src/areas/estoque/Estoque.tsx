// Painel de Estoque: situação por depósito (Venda, Almoxarifado, Patrimônio), o que precisa de atenção
// (negativos, zerados, abaixo do mínimo), movimentações recentes e as telas de trabalho.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Empty, Row, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  ArrowRightOutlined, AuditOutlined, BarcodeOutlined, FileTextOutlined, HistoryOutlined, InboxOutlined, ReloadOutlined,
  SearchOutlined, SwapOutlined, WarningOutlined,
} from '@ant-design/icons';
import {
  Deposito, DEPOSITOS_ESTOQUE, getMovimentos, getSaldos, Movimento, ORIGENS_MOVIMENTO, ResumoSaldos,
} from './api/estoqueItensApi';
import { useListaTrabalho } from '../../shared/core/listaTrabalho/ListaTrabalhoContext';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const DEPOSITOS = Object.keys(DEPOSITOS_ESTOQUE) as Deposito[];

const Estoque: React.FC = () => {
  const navigate = useNavigate();
  const lista = useListaTrabalho();
  const [resumos, setResumos] = useState<Partial<Record<Deposito, ResumoSaldos>>>({});
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    const [saldos, movs] = await Promise.all([
      Promise.allSettled(DEPOSITOS.map(d => getSaldos({ deposito: d, page: 1, limit: 1 }))),
      getMovimentos({ page: 1, limit: 10 }).catch(e => { message.error(e.message); return null; }),
    ]);
    const proximo: Partial<Record<Deposito, ResumoSaldos>> = {};
    saldos.forEach((r, i) => { if (r.status === 'fulfilled') proximo[DEPOSITOS[i]] = r.value.resumo; });
    if (saldos.every(r => r.status === 'rejected')) message.error('Não foi possível carregar os saldos.');
    setResumos(proximo);
    setMovimentos(movs?.data || []);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  const venda = resumos.VENDA;
  const valorTotal = DEPOSITOS.reduce((a, d) => a + (resumos[d]?.valorTotal || 0), 0);
  const etiquetar = lista.comTag('ETIQUETAR').length;
  const conferir = lista.comTag('CONFERIR').length;

  const indicador = (titulo: string, valor: React.ReactNode, rodape: React.ReactNode, onClick?: () => void, cor?: string, icone?: React.ReactNode) => (
    <Card size="small" hoverable={Boolean(onClick)} onClick={onClick} style={{ height: '100%' }} styles={{ body: { padding: '10px 14px' } }}>
      <Space size={6}><span style={{ color: cor || '#8c8c8c' }}>{icone}</span><Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text></Space>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: cor }}>{valor}</div>
      <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>{rodape}</div>
    </Card>
  );

  const telas = [
    { titulo: 'Consulta de Saldo', descricao: 'Saldo, custo e mínimo por depósito; ajuste, inventário, transferência e consumo interno.', rota: '/estoque/consulta', icone: <SearchOutlined /> },
    { titulo: 'Movimentações', descricao: 'Extrato de entradas e saídas por período, origem, depósito e item.', rota: '/estoque/operacoes', icone: <HistoryOutlined /> },
    { titulo: 'Etiquetagem', descricao: 'Imprimir etiquetas de preço e código de barras (lista de trabalho).', rota: '/estoque/etiquetagem', icone: <BarcodeOutlined /> },
    { titulo: 'Entrada de NF-e', descricao: 'Recebimento de mercadorias pela nota do fornecedor.', rota: '/compras/entrada-nfe', icone: <FileTextOutlined /> },
    { titulo: 'Notas de Entrada', descricao: 'O que entrou por nota, em qual depósito, e correção de entradas erradas.', rota: '/compras/notas', icone: <AuditOutlined /> },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Estoque</Title>
            <Text type="secondary">Saldos por depósito, o que precisa de atenção e as últimas movimentações.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={() => navigate('/estoque/consulta')}>Consulta de saldo</Button>
          </Space>
        </div>

        {/* Atenção (depósito Venda, o que aparece no PDV) */}
        <Row gutter={[10, 10]}>
          <Col xs={12} lg={6}>
            {indicador('Valor em estoque', brl(valorTotal), 'soma dos depósitos pelo custo médio', () => navigate('/estoque/consulta'), undefined, <InboxOutlined />)}
          </Col>
          <Col xs={12} lg={6}>
            {indicador('Estoque negativo', venda?.negativos ?? '—', 'venda sem saldo ou ajuste pendente', () => navigate('/estoque/consulta'),
              venda?.negativos ? '#cf1322' : '#389e0d', <WarningOutlined />)}
          </Col>
          <Col xs={12} lg={6}>
            {indicador('Abaixo do mínimo', venda?.abaixoMinimo ?? '—', 'veja o que repor no painel de Compras', () => navigate('/compras'),
              venda?.abaixoMinimo ? '#d48806' : '#389e0d', <WarningOutlined />)}
          </Col>
          <Col xs={12} lg={6}>
            {indicador('Zerados', venda?.zerados ?? '—', venda ? `de ${venda.itens} itens no depósito Venda` : '', () => navigate('/estoque/consulta'),
              venda?.zerados ? '#d48806' : undefined, <InboxOutlined />)}
          </Col>
        </Row>

        <Row gutter={[14, 14]}>
          {/* Por depósito */}
          <Col xs={24} xl={10}>
            <Card size="small" title={<Space><SwapOutlined /> Por depósito</Space>} style={{ height: '100%' }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {DEPOSITOS.map(d => {
                  const r = resumos[d];
                  return (
                    <div key={d} onClick={() => navigate('/estoque/consulta')}
                      style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tooltip title={DEPOSITOS_ESTOQUE[d].ajuda}><Tag color={DEPOSITOS_ESTOQUE[d].color} style={{ margin: 0 }}>{DEPOSITOS_ESTOQUE[d].label}</Tag></Tooltip>
                        <b>{r ? brl(r.valorTotal) : '—'}</b>
                      </div>
                      {r && (
                        <Space size={10} wrap style={{ fontSize: 12, color: '#595959', marginTop: 4 }}>
                          <span>{r.comSaldo} com saldo</span>
                          {r.zerados > 0 && <span>{r.zerados} zerados</span>}
                          {r.negativos > 0 && <Text type="danger" style={{ fontSize: 12 }}>{r.negativos} negativos</Text>}
                          {r.abaixoMinimo > 0 && <Text type="warning" style={{ fontSize: 12 }}>{r.abaixoMinimo} abaixo do mínimo</Text>}
                        </Space>
                      )}
                    </div>
                  );
                })}
                {(etiquetar > 0 || conferir > 0) && (
                  <div style={{ fontSize: 12 }}>
                    Lista de trabalho:{' '}
                    {etiquetar > 0 && <Tag color="blue" style={{ cursor: 'pointer' }} onClick={() => navigate('/estoque/etiquetagem')}>{etiquetar} para etiquetar</Tag>}
                    {conferir > 0 && <Tag color="purple">{conferir} para conferir</Tag>}
                  </div>
                )}
              </Space>
            </Card>
          </Col>

          {/* Movimentações recentes */}
          <Col xs={24} xl={14}>
            <Card
              size="small"
              title={<Space><HistoryOutlined /> Últimas movimentações</Space>}
              extra={<Button size="small" type="link" onClick={() => navigate('/estoque/operacoes')}>Ver todas <ArrowRightOutlined /></Button>}
              style={{ height: '100%' }}
            >
              <Table<Movimento>
                size="small"
                rowKey="idMovimento"
                pagination={false}
                dataSource={movimentos}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma movimentação" /> }}
                columns={[
                  {
                    title: 'Quando', dataIndex: 'criadoEm', width: 95,
                    render: (v: string) => <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>,
                  },
                  {
                    title: 'Item', key: 'item',
                    render: (_, m) => (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{m.sku}</Text>
                      </div>
                    ),
                  },
                  {
                    title: 'Origem', key: 'origem', width: 150,
                    render: (_, m) => (
                      <Space size={4} wrap>
                        <Tag color={ORIGENS_MOVIMENTO[m.origem]?.color} style={{ margin: 0, fontSize: 11 }}>{ORIGENS_MOVIMENTO[m.origem]?.label || m.origemRotulo || m.origem}</Tag>
                        <Tag color={DEPOSITOS_ESTOQUE[m.deposito]?.color} style={{ margin: 0, fontSize: 10 }}>{DEPOSITOS_ESTOQUE[m.deposito]?.label || m.deposito}</Tag>
                      </Space>
                    ),
                  },
                  {
                    title: 'Qtd', key: 'q', width: 90, align: 'right' as const,
                    render: (_, m) => (
                      <b style={{ color: m.tipo === 'ENTRADA' ? '#389e0d' : '#cf1322' }}>
                        {m.tipo === 'ENTRADA' ? '+' : '−'}{qtd(m.quantidade)} {m.unidade}
                      </b>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {/* Telas */}
        <div>
          <Text strong style={{ fontSize: 15 }}>Telas de estoque</Text>
          <Row gutter={[10, 10]} style={{ marginTop: 6 }}>
            {telas.map(t => (
              <Col key={t.titulo} xs={24} md={12} xl={8}>
                <Card size="small" hoverable onClick={() => navigate(t.rota)} style={{ height: '100%' }} styles={{ body: { padding: '10px 12px' } }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ fontSize: 20, color: '#1677ff', lineHeight: 1 }}>{t.icone}</div>
                    <div>
                      <Text strong>{t.titulo}</Text>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{t.descricao}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Space>
    </div>
  );
};

export default Estoque;
