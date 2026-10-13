// Preço e lucro no ML de um item: lucro depois da tarifa, posição no mercado (preço por unidade), diferença para a
// loja, faixas por quantidade e um simulador de preço. Os números vêm do servidor (tarifa real do ML e catálogo).
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Flex, InputNumber, Row, Select, Space, Spin, Statistic, Table, Tag, Typography, message } from 'antd';
import { BulbOutlined, LineChartOutlined } from '@ant-design/icons';
import { AnalisePreco, AnuncioDetalhe, anunciosApi, formatarMoeda } from './mercadoLivreApi';

const { Text } = Typography;

const LUCRO: Record<string, { texto: string; cor: string }> = {
  PREJUIZO: { texto: 'Prejuízo', cor: 'red' }, BAIXO: { texto: 'Abaixo do alvo', cor: 'orange' },
  BOM: { texto: 'Bom', cor: 'green' }, ALTO: { texto: 'Alto', cor: 'blue' }, SEM_CUSTO: { texto: 'Sem custo no ERP', cor: 'default' },
};
const MERCADO: Record<string, { texto: string; cor: string }> = {
  ABAIXO: { texto: 'Abaixo do mercado', cor: 'blue' }, COMPETITIVO: { texto: 'Competitivo', cor: 'green' },
  ACIMA: { texto: 'Acima do mercado', cor: 'orange' }, SEM_REFERENCIA: { texto: 'Sem referência suficiente', cor: 'default' },
};
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`);

interface Props { det: AnuncioDetalhe; onUsarPreco: (idItem: number, preco: number) => void }

const PrecoMlCard: React.FC<Props> = ({ det, onUsarPreco }) => {
  const [idItem, setIdItem] = useState<number>(det.itens[0]?.idItem);
  const [analise, setAnalise] = useState<AnalisePreco | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [simular, setSimular] = useState<number | null>(null);
  const [frete, setFrete] = useState<number | null>(null);
  useEffect(() => { setAnalise(null); }, [idItem]);

  const analisar = async (preco: number | null = simular) => {
    if (!idItem) return;
    setCarregando(true);
    try { setAnalise(await anunciosApi.analisePreco(det.id, idItem, { simular: preco, frete })); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  };

  // vai para o rascunho do editor: aparece na lista de alterações e só grava ao salvar
  const aplicar = (preco: number) => {
    onUsarPreco(idItem, preco);
    message.info(`Preço de ${formatarMoeda(preco)} posto nas alterações: salve para gravar${det.itens.find(i => i.idItem === idItem)?.ml.mlbId ? ' e enviar ao ML' : ''}.`);
    setSimular(null);
  };

  const a = analise;
  const l = a?.atual;

  return (
    <Card
      size="small" style={{ marginBottom: 16 }} title={<Space><LineChartOutlined />Preço e lucro no ML</Space>}
      extra={(
        <Space>
          {det.itens.length > 1 && (
            <Select size="small" style={{ width: 220 }} value={idItem} onChange={setIdItem} showSearch optionFilterProp="label"
              options={det.itens.map(i => ({ value: i.idItem, label: `${i.sku} · ${formatarMoeda(i.precoAnuncio)}` }))} />
          )}
          <Button size="small" type="primary" loading={carregando} onClick={() => analisar()}>{a ? 'Atualizar' : 'Analisar'}</Button>
        </Space>
      )}
    >
      {!a && !carregando && (
        <Text type="secondary">
          Lucro depois da tarifa do ML, posição do preço no mercado (comparando o preço por unidade com anúncios parecidos do catálogo),
          diferença para a loja e se as faixas por quantidade compensam. Use o simulador para testar outro preço.
        </Text>
      )}
      <Spin spinning={carregando}>
        {a && l && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Lucro por venda" value={formatarMoeda(l.lucro)} valueStyle={{ color: l.lucro < 0 ? '#cf1322' : undefined }} />
                  <Space wrap size={4}>
                    <Tag color={LUCRO[l.nivel].cor}>{LUCRO[l.nivel].texto}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{pct(l.lucroSobreCustoPct)} sobre o custo · alvo {a.alvo.pct}% ({a.alvo.origem === 'FAMILIA' ? 'família' : 'padrão'})</Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title={`Preço por unidade (${a.unidades} no anúncio)`} value={formatarMoeda(a.mercado.porUnidade)} />
                  <Space wrap size={4}>
                    <Tag color={MERCADO[a.mercado.nivel].cor}>{MERCADO[a.mercado.nivel].texto}</Tag>
                    {a.mercado.estatisticas && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        mediana {formatarMoeda(a.mercado.estatisticas.mediana)}/un ({a.mercado.regua === 'PACOTE_PARECIDO' ? 'pacotes parecidos' : 'todos'}) {pct(a.mercado.difMedianaPct)}
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Preço no ML x loja" value={formatarMoeda(l.preco)} suffix={<Text type="secondary" style={{ fontSize: 13 }}>loja {formatarMoeda(a.loja.preco)}</Text>} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{pct(a.loja.difPct)} sobre o preço da loja</Text>
                </Card>
              </Col>
            </Row>

            <Text style={{ fontSize: 13 }}>
              {formatarMoeda(l.preco)} − tarifa {formatarMoeda(l.tarifa)} ({a.tarifa.comissaoPct}%{a.tarifa.fixa ? ` + ${formatarMoeda(a.tarifa.fixa)} fixa` : ''})
              {l.frete ? ` − frete ${formatarMoeda(l.frete)}` : ''} − custo {formatarMoeda(l.custo)}{a.unidadeMl ? ` (${a.unidades} × ${formatarMoeda(a.custoBase)})` : ''}
              {' '}= <b style={{ color: l.lucro < 0 ? '#cf1322' : undefined }}>{formatarMoeda(l.lucro)}</b>
              {a.precoAlvo !== null && <Text type="secondary"> · preço mínimo para o alvo: <b>{formatarMoeda(a.precoAlvo)}</b></Text>}
            </Text>

            <Alert type={l.nivel === 'PREJUIZO' ? 'error' : l.nivel === 'BAIXO' || a.mercado.nivel === 'ACIMA' ? 'warning' : 'success'} showIcon icon={<BulbOutlined />}
              message={<Space direction="vertical" size={2}>{a.conselhos.map(c => <span key={c}>{c}</span>)}</Space>} />

            <Flex gap={8} wrap align="center">
              <Text strong>Simular:</Text>
              <InputNumber prefix="R$" min={0.01} step={0.5} precision={2} decimalSeparator="," placeholder="preço" value={simular} onChange={setSimular} style={{ width: 140 }} />
              <InputNumber prefix="frete R$" min={0} step={1} precision={2} decimalSeparator="," placeholder="0" value={frete} onChange={setFrete} style={{ width: 150 }} />
              <Button onClick={() => analisar()} disabled={!simular && frete === null}>Calcular</Button>
              {a.precoAlvo !== null && <Button type="link" onClick={() => { setSimular(a.precoAlvo); analisar(a.precoAlvo); }}>Testar o preço do alvo</Button>}
              {a.mercado.precoMercado !== null && <Button type="link" onClick={() => { setSimular(a.mercado.precoMercado); analisar(a.mercado.precoMercado); }}>Testar a mediana do mercado</Button>}
            </Flex>
            {a.simulado && (
              <Flex gap={8} wrap align="center" style={{ background: '#fafafa', padding: 8, borderRadius: 6 }}>
                <Text>A {formatarMoeda(a.simulado.preco)}: lucro <b>{formatarMoeda(a.simulado.lucro)}</b> ({pct(a.simulado.lucroSobreCustoPct)} sobre o custo)</Text>
                <Tag color={LUCRO[a.simulado.nivel].cor}>{LUCRO[a.simulado.nivel].texto}</Tag>
                {a.mercado.estatisticas && (
                  <Text type="secondary">{formatarMoeda(a.simulado.preco / a.unidades)}/un no mercado: {pct((a.simulado.preco / a.unidades / a.mercado.estatisticas.mediana - 1) * 100)} da mediana</Text>
                )}
                <Button size="small" type="primary" onClick={() => aplicar(a.simulado!.preco)}>Usar este preço</Button>
              </Flex>
            )}

            {a.faixas.length > 0 && (
              <Table
                size="small" pagination={false} rowKey="minimo" dataSource={a.faixas}
                title={() => <Text strong>Faixas por quantidade (compradores empresa)</Text>}
                columns={[
                  { title: 'A partir de', dataIndex: 'minimo', render: v => `${v} un.` },
                  { title: 'Desconto', dataIndex: 'desconto', render: v => `${v}%` },
                  { title: 'Preço', dataIndex: 'preco', render: formatarMoeda },
                  { title: 'Lucro', dataIndex: 'lucro', render: (v: number) => <Text type={v < 0 ? 'danger' : undefined}>{formatarMoeda(v)}</Text> },
                  { title: 'Sobre o custo', dataIndex: 'lucroSobreCustoPct', render: pct },
                  { title: '', dataIndex: 'nivel', render: (v: string) => <Tag color={LUCRO[v].cor}>{v === 'PREJUIZO' ? 'Não vale' : v === 'BAIXO' ? 'Só com volume' : 'Vale'}</Tag> },
                ]}
              />
            )}

            <Collapse size="small" items={[{
              key: 'mercado',
              label: `Anúncios parecidos no catálogo (${a.mercado.produtos.length})${a.mercado.erro ? ' · erro na pesquisa' : ''}`,
              children: a.mercado.erro ? <Text type="danger">{a.mercado.erro}</Text> : (
                <Table
                  size="small" pagination={false} rowKey="produtoId" dataSource={a.mercado.produtos}
                  locale={{ emptyText: 'Nenhum anúncio parecido o bastante (mesmo tipo e medida) no catálogo.' }}
                  columns={[
                    { title: 'Por unidade', dataIndex: 'porUnidade', width: 100, render: (v: number) => <b>{formatarMoeda(v)}</b> },
                    { title: 'Qtd.', dataIndex: 'unidades', width: 60 },
                    { title: 'Preço', dataIndex: 'preco', width: 100, render: formatarMoeda },
                    { title: 'Marca', dataIndex: 'marca', width: 120 },
                    { title: 'Produto', dataIndex: 'nome', render: (v: string, p) => <a href={`https://www.mercadolivre.com.br/p/${p.produtoId}`} target="_blank" rel="noreferrer">{v}</a> },
                  ]}
                />
              ),
            }]} />
          </Space>
        )}
      </Spin>
    </Card>
  );
};

export default PrecoMlCard;
