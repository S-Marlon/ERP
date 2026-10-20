// Financeiro › Painel: o que vai entrar e sair (fluxo previsto com o acumulado), os próximos vencimentos, os atrasados,
// o que entrou e saiu nos últimos meses e os maiores fornecedores e devedores.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Flex, Progress, Row, Segmented, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, CalendarOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import GraficoBarras from '../../../shared/components/graficos/GraficoBarras';
import { brl, brlCurto, dataBr, PainelFinanceiro as Painel, painelFinanceiroApi } from './painelFinanceiroApi';
import { vencimentosPorDia } from './vencimentosPorDia';

const { Text, Title } = Typography;
const VERDE = '#52c41a', VERMELHO = '#ff4d4f', AZUL = '#1677ff';
const DEVEDORES_NO_CARD = 6;

const Kpi: React.FC<{ titulo: string; valor: number; cor?: string; icone: React.ReactNode; rodape?: React.ReactNode; onClick?: () => void }> = ({ titulo, valor, cor, icone, rodape, onClick }) => (
  <Card size="small" hoverable={!!onClick} onClick={onClick} style={{ height: '100%' }} styles={{ body: { padding: '10px 14px' } }}>
    <Space size={6}><span style={{ color: cor || '#8c8c8c' }}>{icone}</span><Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text></Space>
    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, color: cor }}>{brl(valor)}</div>
    <div style={{ fontSize: 12 }}>{rodape}</div>
  </Card>
);

const PainelFinanceiro: React.FC = () => {
  const navigate = useNavigate();
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setDados(await painelFinanceiroApi.carregar(dias)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao carregar o painel.'); }
    finally { setCarregando(false); }
  }, [dias]);
  useEffect(() => { carregar(); }, [carregar]);

  const diasVenc = useMemo(() => (dados ? vencimentosPorDia(dados.vencimentos, dados.hoje) : []), [dados]);
  const t = dados?.totais;
  const saldoPeriodo = t ? Math.round((t.entraNoPeriodo - t.saiNoPeriodo) * 100) / 100 : 0;
  const menorAcumulado = dados?.fluxo.reduce((m, p) => (p.acumulado < m.acumulado ? p : m), dados.fluxo[0]);
  const irPara = (tipo: 'RECEBER' | 'PAGAR') => navigate(tipo === 'RECEBER' ? '/financeiro' : '/financeiro/pagar');
  const maiorFornecedor = Math.max(1, ...(dados?.fornecedores || []).map(f => f.pago + f.aberto));
  const maiorDevedor = Math.max(1, ...(dados?.devedores || []).map(d => d.aberto));
  const [todosDevedores, setTodosDevedores] = useState(false);
  const devedoresNaTela = todosDevedores ? dados?.devedores || [] : (dados?.devedores || []).slice(0, DEVEDORES_NO_CARD);
  const totalDevido = (dados?.devedores || []).reduce((a, d) => a + d.aberto, 0);

  return (
    <div style={{ padding: 24 }}>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Painel financeiro</Title>
          <Text type="secondary">O que vai entrar e sair, o que está atrasado e o que entrou e saiu nos últimos meses.</Text>
        </div>
        <Space>
          <Segmented value={dias} onChange={v => setDias(Number(v))} options={[
            { value: 30, label: 'Próximos 30 dias' }, { value: 60, label: '60 dias' }, { value: 90, label: '90 dias' },
          ]} />
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>
      </Flex>

      <Spin spinning={carregando && !dados}>
        {dados && t && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={12} lg={6}>
                <Kpi titulo={`Entra nos próximos ${dias} dias`} valor={t.entraNoPeriodo} cor="#389e0d" icone={<ArrowUpOutlined />}
                  rodape={<Text type="secondary">a receber no total: {brl(t.aReceber)}{t.qtdReceberSemPrazo ? ` (${brl(t.receberSemPrazo)} sem prazo)` : ''}</Text>} onClick={() => irPara('RECEBER')} />
              </Col>
              <Col xs={12} lg={6}>
                <Kpi titulo={`Sai nos próximos ${dias} dias`} valor={t.saiNoPeriodo} cor="#cf1322" icone={<ArrowDownOutlined />}
                  rodape={<Text type="secondary">a pagar no total: {brl(t.aPagar)}</Text>} onClick={() => irPara('PAGAR')} />
              </Col>
              <Col xs={12} lg={6}>
                <Kpi titulo="Sobra ou falta no período" valor={saldoPeriodo} cor={saldoPeriodo < 0 ? '#cf1322' : '#389e0d'} icone={<CalendarOutlined />}
                  rodape={menorAcumulado && menorAcumulado.acumulado < 0
                    ? <Text type="danger">pior momento: {brl(menorAcumulado.acumulado)} em {menorAcumulado.rotulo}</Text>
                    : <Text type="secondary">entra − sai dos títulos em aberto</Text>} />
              </Col>
              <Col xs={12} lg={6}>
                <Kpi titulo="Atrasados" valor={t.receberVencido + t.pagarVencido} cor={t.qtdReceberVencido + t.qtdPagarVencido ? '#d46b08' : undefined} icone={<WarningOutlined />}
                  rodape={<Text type="secondary">a receber {brl(t.receberVencido)} ({t.qtdReceberVencido}) · a pagar {brl(t.pagarVencido)} ({t.qtdPagarVencido})</Text>} />
              </Col>
            </Row>

            <Card size="small" title={`Fluxo previsto: próximos ${dias} dias${dados.agrupamento === 'semana' ? ' (por semana)' : ''}`}
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Títulos em aberto pelo vencimento. A linha soma o que sobra ou falta desde hoje (sem o saldo do banco).</Text>}>
              {dados.fluxo.some(p => p.entradas || p.saidas) ? (
                <GraficoBarras
                  pontos={dados.fluxo.map(p => ({ chave: p.chave, rotulo: p.rotulo, valores: { entradas: p.entradas, saidas: p.saidas }, linha: p.acumulado }))}
                  series={[{ chave: 'entradas', nome: 'Entra (a receber)', cor: VERDE }, { chave: 'saidas', nome: 'Sai (a pagar)', cor: VERMELHO, negativa: true }]}
                  linha={{ nome: 'Acumulado', cor: AZUL }} formatar={brlCurto} altura={240}
                />
              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Nada a receber ou pagar nos próximos ${dias} dias`} />}
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}>
                <Card size="small" title="Próximos 14 dias" style={{ height: '100%' }}>
                  {diasVenc.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum vencimento nos próximos 14 dias" /> : (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      {diasVenc.map(d => (
                        <div key={d.data}>
                          <Flex justify="space-between" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 2, marginBottom: 4 }}>
                            <Text strong style={{ textTransform: 'capitalize' }}>{d.rotulo}</Text>
                            <Space size={10}>
                              {d.entra > 0 && <Text style={{ color: '#389e0d' }}>+ {brl(d.entra)}</Text>}
                              {d.sai > 0 && <Text style={{ color: '#cf1322' }}>− {brl(d.sai)}</Text>}
                            </Space>
                          </Flex>
                          {d.titulos.map(x => (
                            <Flex key={`${x.tipo}${x.idTitulo}`} justify="space-between" gap={8} style={{ padding: '2px 0 2px 8px', cursor: 'pointer' }} onClick={() => irPara(x.tipo)}>
                              <Text ellipsis style={{ maxWidth: '70%' }}>
                                <Tag color={x.tipo === 'RECEBER' ? 'green' : 'red'} style={{ marginRight: 6 }}>{x.tipo === 'RECEBER' ? 'receber' : 'pagar'}</Tag>
                                {x.nome}{x.totalParcelas > 1 ? ` · ${x.parcela}/${x.totalParcelas}` : ''}{x.categoria ? <Text type="secondary"> · {x.categoria}</Text> : null}
                              </Text>
                              <Text>{x.estimado && <Tooltip title="Valor estimado: confirme quando a conta chegar"><Tag color="blue" style={{ marginRight: 4 }}>estimado</Tag></Tooltip>}{brl(x.valor)}</Text>
                            </Flex>
                          ))}
                        </div>
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card size="small" title="Atrasados" style={{ height: '100%' }}>
                  {dados.atrasados.length === 0 ? (
                    <Alert type="success" showIcon message="Nada atrasado: tudo o que venceu foi pago e recebido." />
                  ) : (
                    <>
                      <Table size="small" pagination={false} rowKey="faixa"
                        dataSource={dados.atrasoReceber.map((r, i) => ({ faixa: r.faixa, receber: r, pagar: dados.atrasoPagar[i] }))}
                        columns={[
                          { title: 'Atraso', dataIndex: 'faixa' },
                          { title: 'A receber', align: 'right', render: (_, l) => l.receber.qtd ? <Text style={{ color: '#d46b08' }}>{brl(l.receber.valor)} ({l.receber.qtd})</Text> : <Text type="secondary">—</Text> },
                          { title: 'A pagar', align: 'right', render: (_, l) => l.pagar.qtd ? <Text type="danger">{brl(l.pagar.valor)} ({l.pagar.qtd})</Text> : <Text type="secondary">—</Text> },
                        ]} />
                      <div style={{ marginTop: 10 }}>
                        {dados.atrasados.slice(0, 6).map(x => (
                          <Flex key={`${x.tipo}${x.idTitulo}`} justify="space-between" style={{ cursor: 'pointer', padding: '2px 0' }} onClick={() => irPara(x.tipo)}>
                            <Text ellipsis style={{ maxWidth: '68%' }}><Tag color={x.tipo === 'RECEBER' ? 'orange' : 'red'}>{x.diasAtraso} d</Tag>{x.nome}</Text>
                            <Text>{brl(x.valor)}</Text>
                          </Flex>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Entrou e saiu: últimos 6 meses"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Entradas: vendas à vista (já sem a taxa do cartão), recebimentos e sinais. Saídas: contas pagas e devoluções em dinheiro.</Text>}>
              <GraficoBarras
                pontos={dados.realizado.map(m => ({ chave: m.mes, rotulo: m.rotulo, valores: { entradas: m.entradas, saidas: m.saidas }, linha: m.saldo }))}
                series={[{ chave: 'entradas', nome: 'Entrou', cor: VERDE }, { chave: 'saidas', nome: 'Saiu', cor: VERMELHO, negativa: true }]}
                linha={{ nome: 'Saldo do mês', cor: AZUL }} formatar={brlCurto} altura={220}
                detalhe={p => {
                  const m = dados.realizado.find(x => x.mes === p.chave)!.detalhe;
                  return (
                    <div>
                      <div>vendas à vista {brl(m.vendasVista)} (taxas {brl(m.taxasCartao)})</div>
                      {m.recebimentos > 0 && <div>recebimentos {brl(m.recebimentos)}</div>}
                      {m.sinais > 0 && <div>sinais {brl(m.sinais)}</div>}
                      <div>contas pagas {brl(m.pagamentos)}</div>
                      {m.devolucoes > 0 && <div>devoluções {brl(m.devolucoes)}</div>}
                    </div>
                  );
                }}
              />
            </Card>

            <Card size="small" title="Para onde vai o dinheiro"
              extra={<Text type="secondary" style={{ fontSize: 12 }}>Pago nos últimos 6 meses e o que vence nos próximos {dias} dias, por categoria</Text>}>
              {dados.categorias.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem contas a pagar" /> : (
                <Row gutter={[24, 6]}>
                  {dados.categorias.map(c => {
                    const maior = Math.max(1, ...dados.categorias.map(x => x.pago + x.previsto));
                    return (
                      <Col xs={24} md={12} key={`${c.grupo}|${c.nome}`}>
                        <Flex justify="space-between">
                          <Text>{c.nome} <Text type="secondary" style={{ fontSize: 12 }}>· {c.grupo}</Text></Text>
                          <Text strong>{brl(c.pago + c.previsto)}</Text>
                        </Flex>
                        <Tooltip title={`Pago ${brl(c.pago)} · vence no período ${brl(c.previsto)}`}>
                          <Progress percent={((c.pago + c.previsto) / maior) * 100} success={{ percent: (c.pago / maior) * 100 }} showInfo={false} size="small" strokeColor="#ffa39e" />
                        </Tooltip>
                      </Col>
                    );
                  })}
                </Row>
              )}
              {dados.categorias.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>Verde: pago · rosa: vence no período. Conta sem categoria aparece como "Sem categoria" (dá para pôr no lápis do contas a pagar).</Text>}
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <Card size="small" title="Para quem mais paga (6 meses + em aberto)" style={{ height: '100%' }}>
                  {dados.fornecedores.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem contas a pagar" /> : dados.fornecedores.map(f => (
                    <div key={`${f.idPessoa}|${f.nome}`} style={{ marginBottom: 6 }}>
                      <Flex justify="space-between"><Text>{f.nome}</Text><Text strong>{brl(f.pago + f.aberto)}</Text></Flex>
                      <Tooltip title={`Pago ${brl(f.pago)} · em aberto ${brl(f.aberto)}`}>
                        <Progress percent={((f.pago + f.aberto) / maiorFornecedor) * 100} success={{ percent: (f.pago / maiorFornecedor) * 100 }}
                          showInfo={false} size="small" strokeColor="#ffa39e" />
                      </Tooltip>
                    </div>
                  ))}
                  {dados.fornecedores.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>Verde: pago · rosa: em aberto</Text>}
                </Card>
              </Col>
              <Col xs={24} lg={12}>
                <Card size="small" title="Quem mais deve à loja" style={{ height: '100%' }}
                  extra={dados.devedores.length > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{dados.devedores.length} cliente(s) · {brl(totalDevido)}</Text>}>
                  <div style={todosDevedores ? { maxHeight: 420, overflowY: 'auto', paddingRight: 4 } : undefined}>
                  {dados.devedores.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Ninguém devendo" /> : devedoresNaTela.map(d => (
                    <div key={d.idPessoa} style={{ marginBottom: 6 }}>
                      <Flex justify="space-between">
                        <Text>{d.nome} <Text type="secondary" style={{ fontSize: 12 }}>· {d.titulos} parcela(s)</Text></Text>
                        <Text strong>{brl(d.aberto)}</Text>
                      </Flex>
                      <Tooltip title={d.vencido > 0 ? `${brl(d.vencido)} já venceu` : 'Nada vencido'}>
                        <Progress percent={(d.aberto / maiorDevedor) * 100} success={{ percent: 0 }} showInfo={false} size="small"
                          strokeColor={d.vencido > 0 ? '#fa8c16' : '#91caff'} />
                      </Tooltip>
                    </div>
                  ))}
                  </div>
                  {dados.devedores.length > DEVEDORES_NO_CARD && (
                    <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setTodosDevedores(v => !v)}>
                      {todosDevedores ? 'Mostrar só os maiores' : `Ver todos (${dados.devedores.length})`}
                    </Button>
                  )}
                </Card>
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>Atualizado em {dataBr(dados.hoje)}. As contas fixas (água, luz, aluguel...) entram sozinhas: <a onClick={() => navigate('/financeiro/contas-fixas')}>cadastrar contas fixas</a>.</Text>
          </Space>
        )}
      </Spin>
    </div>
  );
};

export default PainelFinanceiro;
