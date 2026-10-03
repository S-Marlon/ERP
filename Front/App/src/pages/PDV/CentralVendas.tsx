// Central de Vendas: faturamento, margem líquida (custo + taxas), comparação com o período anterior,
// formas de pagamento, vendas por hora/dia, mais vendidos, caixa, a receber e atalhos do módulo.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, DatePicker, Empty, Row, Segmented, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, CalculatorOutlined, CreditCardOutlined, DollarOutlined, FileTextOutlined, LockOutlined,
  ReloadOutlined, SafetyCertificateOutlined, ShoppingCartOutlined, UnlockOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { caixaStore } from './caixa/caixaStore';
import { ROTULO_FORMA } from './caixa/caixaApi';

const { Text, Title } = Typography;
const API = 'http://localhost:3001/api/vendas/painel';
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COR_FORMA: Record<string, string> = { DINHEIRO: '#52c41a', PIX: '#13c2c2', DEBITO: '#1677ff', CREDITO: '#722ed1', PRAZO: '#fa8c16', TRANSFERENCIA: '#8c8c8c' };

interface Painel {
  intervalo: { de: string; ate: string; anteriorDe: string; anteriorAte: string; dias: number; agrupamento: 'hora' | 'dia' };
  totais: {
    qtd: number; faturamento: number; bruto: number; descontos: number; custo: number; taxas: number; qtdCanceladas: number; canceladas: number;
    autorizadas: number; ticketMedio: number; lucroLiquido: number; margemLiquida: number | null;
  };
  anterior: { faturamento: number; qtd: number; ticketMedio: number; margemLiquida: number | null };
  variacao: { faturamento: number | null; qtd: number | null; ticketMedio: number | null };
  formas: Array<{ forma: string; total: number; qtd: number; taxas: number }>;
  serie: Array<{ chave: string; rotulo: string; total: number; qtd: number }>;
  maisVendidos: Array<{ idItem: number; sku: string; nome: string; quantidade: number; unidade: string; total: number; custo: number; vendas: number; margem: number | null }>;
  operadores: Array<{ operador: string; qtd: number; total: number }>;
  clientes: Array<{ idCliente: number; nome: string; qtd: number; total: number }>;
  ultimasVendas: Array<{ idVenda: number; status: string; cliente: string; total: number; criadoEm: string; operador: string | null; autorizado: boolean; formas: string[] }>;
  receber: { emAberto: number; vencido: number; qtdVencidos: number; proximos7: number };
  estoque: { negativos: number };
  caixa: { idCaixa: number; operador: string; abertoEm: string; dinheiroEsperado: number; vendas: number } | null;
}

const PERIODOS = [
  { value: 'hoje', label: 'Hoje' }, { value: 'ontem', label: 'Ontem' }, { value: '7dias', label: '7 dias' },
  { value: 'mes', label: 'Mês' }, { value: '30dias', label: '30 dias' },
];

const NOME_ANTERIOR: Record<string, string> = { hoje: 'ontem', ontem: 'anteontem', '7dias': '7 dias anteriores', mes: 'mesmo período do mês anterior', '30dias': '30 dias anteriores', personalizado: 'período anterior' };

const Variacao: React.FC<{ valor: number | null; sufixo: string }> = ({ valor, sufixo }) => {
  if (valor === null) return <Text type="secondary" style={{ fontSize: 11 }}>sem base para comparar</Text>;
  const cor = valor > 0 ? '#389e0d' : valor < 0 ? '#cf1322' : '#8c8c8c';
  return (
    <span style={{ fontSize: 11, color: cor }}>
      {valor > 0 ? <ArrowUpOutlined /> : valor < 0 ? <ArrowDownOutlined /> : null} {Math.abs(valor).toFixed(1).replace('.', ',')}% <Text type="secondary" style={{ fontSize: 11 }}>vs {sufixo}</Text>
    </span>
  );
};

// Barras simples (sem biblioteca de gráficos)
const GraficoBarras: React.FC<{ pontos: Painel['serie'] }> = ({ pontos }) => {
  const max = Math.max(1, ...pontos.map(p => p.total));
  const rotular = pontos.length <= 16 ? 1 : Math.ceil(pontos.length / 12);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 180, padding: '8px 0 0' }}>
      {pontos.map((p, i) => (
        <Tooltip key={p.chave} title={<span>{p.rotulo}: <b>{brl(p.total)}</b> · {p.qtd} venda(s)</span>}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', maxWidth: 34, height: `${Math.max(p.total > 0 ? 3 : 0, (p.total / max) * 140)}px`,
              background: p.total > 0 ? 'linear-gradient(180deg, #4096ff, #1677ff)' : 'transparent', borderRadius: '4px 4px 0 0',
            }} />
            <div style={{ height: 1, width: '100%', background: '#f0f0f0' }} />
            <Text type="secondary" style={{ fontSize: 10, marginTop: 4, visibility: i % rotular === 0 ? 'visible' : 'hidden', whiteSpace: 'nowrap' }}>{p.rotulo}</Text>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

const CentralVendas: React.FC = () => {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState('hoje');
  const [personalizado, setPersonalizado] = useState<[Dayjs, Dayjs] | null>(null);
  const [dados, setDados] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams({ periodo });
      if (periodo === 'personalizado' && personalizado) { qs.set('de', personalizado[0].format('YYYY-MM-DD')); qs.set('ate', personalizado[1].format('YYYY-MM-DD')); }
      const r = await fetch(`${API}?${qs}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || (r.status === 404 ? 'Rota não encontrada: reinicie o backend.' : 'Erro ao carregar o painel.'));
      setDados(d);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar o painel.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, [periodo, personalizado]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = dados?.totais;
  const comparacao = NOME_ANTERIOR[periodo];
  const totalFormas = (dados?.formas || []).reduce((a, f) => a + f.total, 0);

  const kpi = (titulo: string, valor: React.ReactNode, rodape: React.ReactNode, icone: React.ReactNode, cor?: string) => (
    <Card size="small" style={{ height: '100%' }} styles={{ body: { padding: '10px 14px' } }}>
      <Space size={6}><span style={{ color: cor || '#8c8c8c' }}>{icone}</span><Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text></Space>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: cor }}>{valor}</div>
      <div>{rodape}</div>
    </Card>
  );

  const atalhos = [
    { titulo: 'PDV', descricao: 'Vender no balcão', rota: '/vendas/pdv', icone: <ShoppingCartOutlined /> },
    { titulo: 'Vendas do Dia', descricao: 'Consultar e cancelar vendas', rota: '/vendas/do-dia', icone: <FileTextOutlined /> },
    { titulo: 'Orçamentos', descricao: 'Válidos, vencidos e convertidos', rota: '/vendas/orcamentos', icone: <FileTextOutlined /> },
    { titulo: 'Caixas', descricao: 'Abertura, fechamento e conferência', rota: '/vendas/caixas', icone: <UnlockOutlined /> },
    { titulo: 'Contas a Receber', descricao: 'Parcelas das vendas a prazo', rota: '/financeiro', icone: <DollarOutlined /> },
    { titulo: 'Taxas de pagamento', descricao: 'Maquininha, sem juros e simulador', rota: '/vendas/taxas', icone: <CalculatorOutlined /> },
    { titulo: 'Regras de venda', descricao: 'Limite de desconto e autorização', rota: '/vendas/regras', icone: <SafetyCertificateOutlined /> },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Central de Vendas</Title>
            <Text type="secondary">
              {dados ? (dados.intervalo.de === dados.intervalo.ate
                ? dayjs(dados.intervalo.de).format('DD/MM/YYYY')
                : `${dayjs(dados.intervalo.de).format('DD/MM')} a ${dayjs(dados.intervalo.ate).format('DD/MM/YYYY')}`) : 'Carregando...'}
            </Text>
          </div>
          <Space wrap>
            <Segmented value={periodo} onChange={v => setPeriodo(String(v))} options={[...PERIODOS, { value: 'personalizado', label: 'Período' }]} />
            {periodo === 'personalizado' && (
              <DatePicker.RangePicker format="DD/MM/YYYY" value={personalizado} allowClear={false}
                onChange={v => v && v[0] && v[1] && setPersonalizado([v[0], v[1]])} />
            )}
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={() => navigate('/vendas/pdv')}>Abrir PDV</Button>
          </Space>
        </div>

        <Spin spinning={carregando && !dados}>
          {!dados ? <Card><Empty description="Sem dados" /></Card> : (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              {/* Indicadores */}
              <Row gutter={[10, 10]}>
                <Col xs={12} lg={4}>{kpi('Faturamento', brl(t!.faturamento), <Variacao valor={dados.variacao.faturamento} sufixo={comparacao} />, <DollarOutlined />, '#1677ff')}</Col>
                <Col xs={12} lg={4}>{kpi('Vendas', t!.qtd, <Variacao valor={dados.variacao.qtd} sufixo={comparacao} />, <ShoppingCartOutlined />)}</Col>
                <Col xs={12} lg={4}>{kpi('Ticket médio', brl(t!.ticketMedio), <Variacao valor={dados.variacao.ticketMedio} sufixo={comparacao} />, <FileTextOutlined />)}</Col>
                <Col xs={12} lg={4}>
                  {kpi('Lucro líquido', brl(t!.lucroLiquido),
                    <Tooltip title="Faturamento menos custo das mercadorias e taxas de pagamento">
                      <Text type="secondary" style={{ fontSize: 11 }}>margem {t!.margemLiquida === null ? '—' : `${String(t!.margemLiquida).replace('.', ',')}%`}</Text>
                    </Tooltip>, <ArrowUpOutlined />, t!.lucroLiquido >= 0 ? '#389e0d' : '#cf1322')}
                </Col>
                <Col xs={12} lg={4}>
                  {kpi('Descontos', brl(t!.descontos),
                    <Text type="secondary" style={{ fontSize: 11 }}>{t!.autorizadas > 0 ? `${t!.autorizadas} com autorização` : 'nenhuma autorização'}</Text>,
                    <SafetyCertificateOutlined />, t!.descontos > 0 ? '#d48806' : undefined)}
                </Col>
                <Col xs={12} lg={4}>
                  {kpi('Taxas de pagamento', brl(t!.taxas),
                    <Text type="secondary" style={{ fontSize: 11 }}>{t!.faturamento > 0 ? `${((t!.taxas / t!.faturamento) * 100).toFixed(2).replace('.', ',')}% do faturamento` : '—'}</Text>,
                    <CreditCardOutlined />)}
                </Col>
              </Row>

              {/* Gráfico + formas */}
              <Row gutter={[14, 14]}>
                <Col xs={24} xl={16}>
                  <Card size="small" title={dados.intervalo.agrupamento === 'hora' ? 'Vendas por hora' : 'Vendas por dia'} style={{ height: '100%' }}>
                    {t!.qtd === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma venda no período" /> : <GraficoBarras pontos={dados.serie} />}
                  </Card>
                </Col>
                <Col xs={24} xl={8}>
                  <Card size="small" title="Formas de pagamento" style={{ height: '100%' }}>
                    {dados.formas.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="—" /> : (
                      <Space direction="vertical" style={{ width: '100%' }} size={10}>
                        {dados.formas.map(f => {
                          const pct = totalFormas > 0 ? (f.total / totalFormas) * 100 : 0;
                          return (
                            <div key={f.forma}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span><b>{ROTULO_FORMA[f.forma] || f.forma}</b> <Text type="secondary" style={{ fontSize: 11 }}>· {f.qtd} venda(s)</Text></span>
                                <span>{brl(f.total)}</span>
                              </div>
                              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: COR_FORMA[f.forma] || '#1677ff' }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8c8c8c' }}>
                                <span>{pct.toFixed(1).replace('.', ',')}%</span>
                                {f.taxas > 0 && <span>taxas {brl(f.taxas)}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </Space>
                    )}
                  </Card>
                </Col>
              </Row>

              {/* Mais vendidos + situação */}
              <Row gutter={[14, 14]}>
                <Col xs={24} xl={16}>
                  <Card size="small" title="Mais vendidos" style={{ height: '100%' }}>
                    <Table
                      size="small"
                      rowKey="idItem"
                      pagination={false}
                      dataSource={dados.maisVendidos}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item vendido no período" /> }}
                      columns={[
                        { title: '#', key: 'pos', width: 36, render: (_, __, i) => <Text type="secondary">{i + 1}</Text> },
                        {
                          title: 'Item', key: 'item',
                          render: (_, i) => (
                            <div style={{ lineHeight: 1.2 }}>
                              <div style={{ fontWeight: 600, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.nome}</div>
                              <Text type="secondary" style={{ fontSize: 11 }}>{i.sku} · {i.vendas} venda(s)</Text>
                            </div>
                          ),
                        },
                        { title: 'Qtd', key: 'q', align: 'right' as const, width: 100, render: (_, i) => `${i.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${i.unidade}` },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, width: 120, render: (v: number) => <b>{brl(v)}</b> },
                        {
                          title: <Tooltip title="Margem bruta (sem as taxas de pagamento)">Margem</Tooltip>, dataIndex: 'margem', align: 'right' as const, width: 90,
                          render: (v: number | null) => (v === null ? '—' : <Tag color={v < 0 ? 'red' : v < 20 ? 'orange' : 'green'} style={{ margin: 0 }}>{String(v).replace('.', ',')}%</Tag>),
                        },
                      ]}
                    />
                  </Card>
                </Col>
                <Col xs={24} xl={8}>
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    {/* Caixa */}
                    <Card size="small" title="Caixa">
                      {dados.caixa ? (
                        <Space direction="vertical" style={{ width: '100%' }} size={6}>
                          <Space><Tag color="green" icon={<UnlockOutlined />} style={{ margin: 0 }}>Caixa {dados.caixa.idCaixa} aberto</Tag>
                            <Text type="secondary" style={{ fontSize: 12 }}>{dados.caixa.operador} · desde {dayjs(dados.caixa.abertoEm).format('HH:mm')}</Text></Space>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Dinheiro na gaveta</Text><b>{brl(dados.caixa.dinheiroEsperado)}</b></div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Vendas do caixa</Text><span>{brl(dados.caixa.vendas)}</span></div>
                          <Button size="small" block onClick={() => { caixaStore.recarregar(); caixaStore.mostrar('resumo'); }}>Resumo, sangria e fechamento</Button>
                        </Space>
                      ) : (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Tag color="red" icon={<LockOutlined />} style={{ margin: 0 }}>Caixa fechado</Tag>
                          <Button size="small" type="primary" block onClick={() => caixaStore.mostrar('abrir')}>Abrir caixa</Button>
                        </Space>
                      )}
                    </Card>
                    {/* A receber */}
                    <Card size="small" title="A receber (vendas a prazo)" extra={<Button size="small" type="link" onClick={() => navigate('/financeiro')}>abrir</Button>}>
                      <Space direction="vertical" style={{ width: '100%' }} size={4}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Em aberto</Text><b>{brl(dados.receber.emAberto)}</b></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary">Vencido</Text>
                          <Text type={dados.receber.vencido > 0 ? 'danger' : undefined} strong>{brl(dados.receber.vencido)}{dados.receber.qtdVencidos > 0 && ` (${dados.receber.qtdVencidos})`}</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">Vence em 7 dias</Text><span>{brl(dados.receber.proximos7)}</span></div>
                      </Space>
                    </Card>
                    {/* Atenção */}
                    {(dados.estoque.negativos > 0 || t!.qtdCanceladas > 0) && (
                      <Card size="small" title={<Space><WarningOutlined style={{ color: '#d48806' }} />Atenção</Space>}>
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          {dados.estoque.negativos > 0 && (
                            <a onClick={() => navigate('/estoque/consulta')}>{dados.estoque.negativos} item(ns) com estoque negativo no depósito Venda</a>
                          )}
                          {t!.qtdCanceladas > 0 && (
                            <a onClick={() => navigate('/vendas/do-dia')}>{t!.qtdCanceladas} venda(s) cancelada(s) no período ({brl(t!.canceladas)})</a>
                          )}
                        </Space>
                      </Card>
                    )}
                  </Space>
                </Col>
              </Row>

              {/* Operadores, clientes, últimas vendas */}
              <Row gutter={[14, 14]}>
                <Col xs={24} lg={7}>
                  <Card size="small" title="Por operador" style={{ height: '100%' }}>
                    {dados.operadores.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="—" /> : dados.operadores.map(o => (
                      <div key={o.operador} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span>{o.operador} <Text type="secondary" style={{ fontSize: 11 }}>· {o.qtd}</Text></span><b>{brl(o.total)}</b>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col xs={24} lg={7}>
                  <Card size="small" title="Melhores clientes" style={{ height: '100%' }}>
                    {dados.clientes.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Vendas sem cliente identificado" /> : dados.clientes.map(c => (
                      <div key={c.idCliente} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', gap: 8 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome} <Text type="secondary" style={{ fontSize: 11 }}>· {c.qtd}</Text></span><b>{brl(c.total)}</b>
                      </div>
                    ))}
                  </Card>
                </Col>
                <Col xs={24} lg={10}>
                  <Card size="small" title="Últimas vendas" extra={<Button size="small" type="link" onClick={() => navigate('/vendas/do-dia')}>ver todas</Button>} style={{ height: '100%' }}>
                    <Table
                      size="small"
                      rowKey="idVenda"
                      pagination={false}
                      dataSource={dados.ultimasVendas}
                      locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma venda" /> }}
                      columns={[
                        { title: 'Nº', dataIndex: 'idVenda', width: 56 },
                        { title: 'Quando', dataIndex: 'criadoEm', width: 90, render: (v: string) => dayjs(v).format('DD/MM HH:mm') },
                        {
                          title: 'Cliente', key: 'c',
                          render: (_, v) => (
                            <span>
                              {v.cliente}{' '}
                              {v.status === 'CANCELADA' && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>cancelada</Tag>}
                              {v.autorizado && <Tooltip title="Desconto/margem autorizado"><SafetyCertificateOutlined style={{ color: '#d48806' }} /></Tooltip>}
                              <div><Text type="secondary" style={{ fontSize: 10 }}>{v.formas.map(f => ROTULO_FORMA[f] || f).join(' + ')}</Text></div>
                            </span>
                          ),
                        },
                        { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (x: number, v) => <Text delete={v.status === 'CANCELADA'} strong>{brl(x)}</Text> },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Atalhos */}
              <Row gutter={[10, 10]}>
                {atalhos.map(a => (
                  <Col key={a.rota} xs={12} md={8} xl={6} xxl={3}>
                    <Card size="small" hoverable onClick={() => navigate(a.rota)} style={{ height: '100%' }} styles={{ body: { padding: '10px 12px' } }}>
                      <Space align="start">
                        <span style={{ fontSize: 18, color: '#1677ff' }}>{a.icone}</span>
                        <div><Text strong>{a.titulo}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{a.descricao}</Text></div></div>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Space>
          )}
        </Spin>
      </Space>
    </div>
  );
};

export default CentralVendas;
