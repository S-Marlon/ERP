// Preço e lucro no ML de um item: quanto você recebe (preço − tarifa − frete grátis), o lucro sobre o custo do ERP,
// os cenários (Clássico × Premium, com e sem frete grátis), o lucro por quantidade, os degraus de custo do ML, a
// posição no mercado e um simulador. Tarifa e frete vêm do ML (o frete muda com a faixa de preço da compra).
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Flex, InputNumber, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { BulbOutlined, CarOutlined, LineChartOutlined, WarningOutlined } from '@ant-design/icons';
import { AnalisePreco, AnuncioDetalhe, anunciosApi, formatarMoeda, ResultadoVendaMl } from './mercadoLivreApi';

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
const corLucro = (v: number) => (v < 0 ? '#cf1322' : undefined);
const TIPO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium' };

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
  const e = a?.envio;

  const colunasVenda = [
    { title: 'Tarifa', dataIndex: 'tarifa', align: 'right' as const, render: (v: number) => <Text type="secondary">−{formatarMoeda(v)}</Text> },
    { title: 'Frete', dataIndex: 'frete', align: 'right' as const, render: (v: number) => (v ? <Text type="secondary">−{formatarMoeda(v)}</Text> : <Text type="secondary">—</Text>) },
    { title: 'Você recebe', dataIndex: 'recebe', align: 'right' as const, render: (v: number) => <b>{formatarMoeda(v)}</b> },
    { title: 'Lucro', dataIndex: 'lucro', align: 'right' as const, render: (v: number) => <b style={{ color: corLucro(v) }}>{formatarMoeda(v)}</b> },
    { title: 'Sobre o custo', dataIndex: 'lucroSobreCustoPct', align: 'right' as const, render: pct },
    { title: '', dataIndex: 'nivel', width: 130, render: (v: string) => <Tag color={LUCRO[v].cor}>{LUCRO[v].texto}</Tag> },
  ];

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
          Quanto você recebe de verdade (preço − tarifa − frete grátis), o lucro sobre o custo do ERP, Clássico × Premium,
          com e sem frete grátis, o lucro por quantidade e onde o preço está no mercado. Tarifa e frete vêm do Mercado Livre.
        </Text>
      )}
      <Spin spinning={carregando}>
        {a && l && e && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Statistic title="Você recebe por venda" value={formatarMoeda(l.liquido)} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatarMoeda(l.preco)} − tarifa − frete</Text>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Statistic title="Lucro por venda" value={formatarMoeda(l.lucro)} valueStyle={{ color: corLucro(l.lucro) }} />
                  <Space wrap size={4}>
                    <Tag color={LUCRO[l.nivel].cor}>{LUCRO[l.nivel].texto}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{pct(l.lucroSobreCustoPct)} sobre o custo · alvo {a.alvo.pct}%</Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Statistic title={`Por unidade (${a.unidades} no anúncio)`} value={formatarMoeda(a.mercado.porUnidade)} />
                  <Space wrap size={4}>
                    <Tag color={MERCADO[a.mercado.nivel].cor}>{MERCADO[a.mercado.nivel].texto}</Tag>
                    {a.mercado.estatisticas && <Text type="secondary" style={{ fontSize: 12 }}>mediana {formatarMoeda(a.mercado.estatisticas.mediana)}/un {pct(a.mercado.difMedianaPct)}</Text>}
                  </Space>
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card size="small" style={{ height: '100%' }}>
                  <Statistic title="Preço no ML x loja" value={formatarMoeda(l.preco)} />
                  <Text type="secondary" style={{ fontSize: 12 }}>loja {formatarMoeda(a.loja.preco)} · {pct(a.loja.difPct)}</Text>
                </Card>
              </Col>
            </Row>

            <Text style={{ fontSize: 13 }}>
              {formatarMoeda(l.preco)} − tarifa {formatarMoeda(l.tarifa)} ({a.tarifa.comissaoPct}%{a.tarifa.fixa ? ` + ${formatarMoeda(a.tarifa.fixa)} fixa` : ''})
              {' '}− frete {l.frete ? formatarMoeda(l.frete) : 'R$ 0,00 (o comprador paga)'} = <b>{formatarMoeda(l.liquido)}</b>
              {' '}− custo {formatarMoeda(l.custo)}{a.unidadeMl ? ` (${a.unidades} × ${formatarMoeda(a.custoBase)})` : ''}
              {' '}= <b style={{ color: corLucro(l.lucro) }}>{formatarMoeda(l.lucro)}</b>
              {a.precoAlvo !== null && <Text type="secondary"> · preço mínimo para o alvo: <b>{formatarMoeda(a.precoAlvo)}</b></Text>}
            </Text>

            <Alert
              type={l.freteDesconhecido ? 'warning' : 'info'} showIcon icon={<CarOutlined />}
              message={(
                <Space wrap size={6}>
                  <b>Frete grátis {e.gratis ? 'ligado' : 'desligado'}</b>
                  <Text type="secondary">{e.noAnuncio ? '(no anúncio do ML)' : '(padrão da conta)'}</Text>
                  {e.obrigatorio && <Tag color="orange">obrigatório a partir de {formatarMoeda(e.limite)}</Tag>}
                  {e.informado && <Tag color="purple">frete informado à mão</Tag>}
                </Space>
              )}
              description={l.freteDesconhecido ? 'Não deu para calcular o frete: o item não tem peso no cadastro e ainda não está no ML. Lance o peso da embalagem ou informe o frete no simulador.' : (
                <div style={{ fontSize: 12 }}>
                  {e.envio && <div>Um envio custa <b>{formatarMoeda(e.envio.valor)}</b> para você{e.envio.cheio ? ` (tabela ${formatarMoeda(e.envio.cheio)}${e.envio.descontoPct ? `, ${e.envio.descontoPct}% de desconto do ML` : ''})` : ''}{!e.gratis && !e.obrigatorio ? ' se ligar o frete grátis' : ''}.</div>}
                  {e.acimaDoLimite && !e.obrigatorio && <div>Compra a partir de {formatarMoeda(e.limite)}: <b>{formatarMoeda(e.acimaDoLimite.valor)}</b> por envio (aí é obrigatório).</div>}
                  {e.peso && <div>Peso cobrado: {e.peso.pesoG} g {e.peso.fonte === 'ML' ? '(calculado pelo ML)' : '(do cadastro do ERP)'}.</div>}
                  <div style={{ marginTop: 2 }}><Text type="secondary" style={{ fontSize: 12 }}>Estimativa do ML. A tela do ML pode mostrar outro valor; o frete cobrado de verdade aparece na primeira venda.</Text></div>
                </div>
              )}
            />

            {a.degraus.length > 0 && (
              <Alert type="warning" showIcon icon={<WarningOutlined />} message={<Space direction="vertical" size={2}>{a.degraus.map(d => <span key={d}>{d}</span>)}</Space>} />
            )}
            <Alert type={l.nivel === 'PREJUIZO' ? 'error' : l.nivel === 'BAIXO' || a.mercado.nivel === 'ACIMA' ? 'warning' : 'success'} showIcon icon={<BulbOutlined />}
              message={<Space direction="vertical" size={2}>{a.conselhos.map(c => <span key={c}>{c}</span>)}</Space>} />

            <Table<AnalisePreco['cenarios'][number]>
              size="small" pagination={false} rowKey={c => `${c.tipo}-${c.freteGratis}`} dataSource={a.cenarios}
              title={() => <Text strong>Cenários a {formatarMoeda(l.preco)}: Clássico × Premium, com e sem frete grátis</Text>}
              rowClassName={c => (c.atual ? 'ml-linha-alterada' : '')}
              columns={[
                {
                  title: 'Anúncio', render: (_, c) => (
                    <Space size={4} wrap>
                      <Tooltip title={c.tipo === 'gold_pro' ? 'Mais exposição e parcelamento sem juros para o comprador' : 'Comissão menor, sem parcelamento sem juros'}><Text strong={c.atual}>{TIPO[c.tipo]}</Text></Tooltip>
                      <Text type="secondary">· {c.freteGratis ? 'frete grátis' : 'comprador paga o frete'}</Text>
                      {c.atual && <Tag color="blue">hoje</Tag>}
                    </Space>
                  ),
                },
                ...colunasVenda,
              ]}
            />

            <Table<AnalisePreco['porQuantidade'][number]>
              size="small" pagination={false} rowKey="quantidade" dataSource={a.porQuantidade}
              title={() => (
                <Space direction="vertical" size={0}>
                  <Text strong>Por quantidade na mesma compra</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>A tarifa é por unidade e o frete é um por envio: compra maior dilui o frete, mas a que passa de {formatarMoeda(e.limite)} paga o frete mais caro.</Text>
                </Space>
              )}
              columns={[
                {
                  title: 'Compra', render: (_, q: ResultadoVendaMl & { desconto: number; faixa: boolean }) => (
                    <Space size={4}>
                      <b>{q.quantidade} un.</b>
                      {q.desconto > 0 && <Tag color="purple">−{q.desconto}%</Tag>}
                      {q.receita >= e.limite && !(q.quantidade === 1) && <Tooltip title={`Passa de ${formatarMoeda(e.limite)}: frete grátis obrigatório`}><Tag color="orange">≥ {formatarMoeda(e.limite)}</Tag></Tooltip>}
                    </Space>
                  ),
                },
                { title: 'Preço un.', dataIndex: 'precoUnit', align: 'right', render: formatarMoeda },
                ...colunasVenda.slice(0, 3),
                { title: 'Lucro da compra', dataIndex: 'lucro', align: 'right', render: (v: number) => <b style={{ color: corLucro(v) }}>{formatarMoeda(v)}</b> },
                { title: 'Por unidade', dataIndex: 'lucroPorUnidade', align: 'right', render: (v: number) => <Text style={{ color: corLucro(v) }}>{formatarMoeda(v)}</Text> },
                ...colunasVenda.slice(4),
              ]}
            />

            <Flex gap={8} wrap align="center" style={{ background: '#fafafa', padding: 8, borderRadius: 6 }}>
              <Text strong>Simular:</Text>
              <InputNumber prefix="R$" min={0.01} step={0.5} precision={2} decimalSeparator="," placeholder="preço" value={simular} onChange={setSimular} style={{ width: 140 }} />
              <Tooltip title="Deixe vazio para usar o frete do ML (calculado para cada preço). Preencha só para testar um frete diferente.">
                <InputNumber prefix="frete R$" min={0} step={1} precision={2} decimalSeparator="," placeholder="do ML" value={frete} onChange={setFrete} style={{ width: 150 }} />
              </Tooltip>
              <Button onClick={() => analisar()}>Calcular</Button>
              {a.precoAlvo !== null && <Button type="link" onClick={() => { setSimular(a.precoAlvo); analisar(a.precoAlvo); }}>Testar o preço do alvo</Button>}
              {a.mercado.precoMercado !== null && <Button type="link" onClick={() => { setSimular(a.mercado.precoMercado); analisar(a.mercado.precoMercado); }}>Testar a mediana do mercado</Button>}
            </Flex>
            {a.simulado && (
              <Flex gap={8} wrap align="center" style={{ background: '#f0f7ff', padding: 8, borderRadius: 6 }}>
                <Text>
                  A {formatarMoeda(a.simulado.preco)}: você recebe <b>{formatarMoeda(a.simulado.liquido)}</b>
                  {' '}(frete {a.simulado.frete ? formatarMoeda(a.simulado.frete) : 'zero'}) e lucra <b style={{ color: corLucro(a.simulado.lucro) }}>{formatarMoeda(a.simulado.lucro)}</b> ({pct(a.simulado.lucroSobreCustoPct)} sobre o custo)
                </Text>
                <Tag color={LUCRO[a.simulado.nivel].cor}>{LUCRO[a.simulado.nivel].texto}</Tag>
                {a.mercado.estatisticas && (
                  <Text type="secondary">{formatarMoeda(a.simulado.preco / a.unidades)}/un: {pct((a.simulado.preco / a.unidades / a.mercado.estatisticas.mediana - 1) * 100)} da mediana</Text>
                )}
                <Button size="small" type="primary" onClick={() => aplicar(a.simulado!.preco)}>Usar este preço</Button>
              </Flex>
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
