// Financeiro › Resultado do mês: a cascata do mês escolhido (vendas − devoluções − custo − taxas = margem; − despesas
// por grupo = resultado), a evolução dos meses e a comparação lado a lado.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Empty, Flex, Row, Segmented, Space, Spin, Table, Tooltip, Typography, message } from 'antd';
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import GraficoCascata from '../../../shared/components/graficos/GraficoCascata';
import GraficoBarras from '../../../shared/components/graficos/GraficoBarras';
import { linhasDaComparacao, MesResultado, resultadoApi } from './resultadoApi';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (v: number) => {
  const a = Math.abs(v);
  return a >= 1000 ? `${v < 0 ? '-' : ''}R$ ${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${v < 0 ? '-' : ''}R$ ${a.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
};
const valorDe = (m: MesResultado, chave: string) => m.linhas.find(l => l.chave === chave)?.valor ?? 0;

const ResultadoMes: React.FC = () => {
  const navigate = useNavigate();
  const [qtd, setQtd] = useState(6);
  const [meses, setMeses] = useState<MesResultado[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await resultadoApi.carregar(qtd);
      setMeses(r.meses);
      setEscolhido(e => (e && r.meses.some(m => m.mes === e) ? e : r.meses[r.meses.length - 1]?.mes ?? null));
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao carregar.'); }
    finally { setCarregando(false); }
  }, [qtd]);
  useEffect(() => { carregar(); }, [carregar]);

  const mes = meses.find(m => m.mes === escolhido) || null;
  const comparacao = useMemo(() => linhasDaComparacao(meses), [meses]);
  const despesasDoMes = (m: MesResultado) => -m.linhas.filter(l => l.chave.startsWith('desp:')).reduce((a, l) => a + l.valor, 0);
  const semDespesa = meses.length > 0 && meses.every(m => despesasDoMes(m) === 0);

  return (
    <div style={{ padding: 24 }}>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Resultado do mês</Title>
          <Text type="secondary">Quanto a loja lucrou: vendas − devoluções − custo das mercadorias − taxas = margem; − as contas da loja = resultado.</Text>
        </div>
        <Space>
          <Segmented value={qtd} onChange={v => setQtd(Number(v))} options={[{ value: 3, label: '3 meses' }, { value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }]} />
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>
      </Flex>

      <Spin spinning={carregando && !meses.length}>
        {meses.length > 0 && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {semDespesa && (
              <Alert type="info" showIcon message="Nenhuma conta da loja lançada nesses meses"
                description={<span>Sem aluguel, luz, salários... o resultado fica igual à margem. <a onClick={() => navigate('/financeiro/contas-fixas')}>Cadastre as contas fixas</a> para o resultado ficar real.</span>} />
            )}
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={14}>
                <Card size="small"
                  title={<Flex align="center" gap={8} wrap>
                    <span>Cascata</span>
                    <Segmented size="small" value={escolhido ?? undefined} onChange={v => setEscolhido(String(v))}
                      options={meses.map(m => ({ value: m.mes, label: m.rotulo }))} />
                  </Flex>}>
                  {mes && (valorDe(mes, 'vendas') === 0 && despesasDoMes(mes) === 0
                    ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`Sem vendas nem contas em ${mes.rotulo}`} />
                    : (
                      <>
                        <GraficoCascata formatar={brl} linhas={mes.linhas.map(l => ({
                          ...l,
                          detalhe: l.detalhe?.length
                            ? <div>{l.detalhe.map(d => <div key={d.nome}>{d.nome}: {brl(d.valor)}</div>)}</div>
                            : l.chave === 'cmv' ? 'O custo de cada item vendido (menos o que voltou ao estoque nas devoluções)'
                              : l.chave === 'ml' ? 'Tarifa e frete que o Mercado Livre cobrou nas vendas de lá' : undefined,
                        }))} />
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                          <InfoCircleOutlined /> Compras de mercadoria em {mes.rotulo}: {brl(mes.comprasMercadoria)}. Não entram como despesa: viram custo quando a mercadoria é vendida.
                          Contas pelo mês a que se referem (conta fixa) ou pelo vencimento.
                        </Text>
                      </>
                    ))}
                </Card>
              </Col>
              <Col xs={24} xl={10}>
                <Card size="small" title="Mês a mês" style={{ height: '100%' }}>
                  <GraficoBarras
                    pontos={meses.map(m => ({ chave: m.mes, rotulo: m.rotulo, valores: { margem: Math.max(0, valorDe(m, 'margem')), despesas: despesasDoMes(m) }, linha: valorDe(m, 'resultado') }))}
                    series={[{ chave: 'margem', nome: 'Margem de contribuição', cor: '#52c41a' }, { chave: 'despesas', nome: 'Contas da loja', cor: '#ff7875', negativa: true }]}
                    linha={{ nome: 'Resultado', cor: '#1677ff' }} formatar={brlCurto} altura={240}
                    onClicar={p => setEscolhido(p.chave)}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>Clique num mês para ver a cascata dele.</Text>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Comparação" styles={{ body: { padding: 0 } }}>
              <Table size="small" pagination={false} rowKey="chave" scroll={{ x: true }} dataSource={comparacao}
                rowClassName={l => (l.tipo === 'SUBTOTAL' || l.tipo === 'RESULTADO' ? 'linha-subtotal' : '')}
                columns={[
                  { title: '', dataIndex: 'rotulo', fixed: 'left', width: 230, render: (v, l) => <Text strong={l.tipo !== 'DEDUCAO'}>{l.tipo === 'DEDUCAO' ? `(−) ${v}` : v}</Text> },
                  ...meses.map(m => ({
                    title: <a onClick={() => setEscolhido(m.mes)} style={{ fontWeight: m.mes === escolhido ? 700 : 400 }}>{m.rotulo}</a>,
                    key: m.mes, align: 'right' as const, width: 120,
                    render: (_: unknown, l: { chave: string; tipo: string }) => {
                      const linha = m.linhas.find(x => x.chave === l.chave);
                      if (!linha) return <Text type="secondary">—</Text>;
                      const forte = l.tipo !== 'DEDUCAO';
                      return (
                        <Tooltip title={linha.pct !== null ? `${linha.pct.toLocaleString('pt-BR')}% da receita líquida` : undefined}>
                          <Text strong={forte} type={linha.valor === 0 ? 'secondary' : undefined} style={{ color: l.tipo === 'RESULTADO' && linha.valor < 0 ? '#cf1322' : undefined }}>
                            {brl(linha.valor)}
                          </Text>
                        </Tooltip>
                      );
                    },
                  })),
                ]}
              />
            </Card>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Não lance no contas a pagar a taxa do cartão nem a tarifa do ML de cada venda: elas já entram pelas vendas (lance só o que é cobrado à parte, como o aluguel da maquininha).
            </Text>
          </Space>
        )}
      </Spin>
    </div>
  );
};

export default ResultadoMes;
