// Painel de preço do item (topo da aba Preço e lucro): o preço no ML com ajuste de centavo em centavo e, ao vivo,
// quanto você recebe, o lucro e o caminho até o alvo, os degraus de preço e os cenários Clássico × Premium com e sem
// frete grátis. O preço vai para o rascunho do editor (desfaz e salva como o resto). Detalhes (conta, frete, por
// quantidade, mercado) ficam em "Mais detalhes".
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Flex, InputNumber, Progress, Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { AimOutlined, BulbOutlined, CarOutlined, LineChartOutlined, RollbackOutlined, WarningOutlined } from '@ant-design/icons';
import { AnalisePreco, AnuncioDetalhe, anunciosApi, formatarMoeda, ResultadoVendaMl } from './mercadoLivreApi';
import { AlertasPreco } from './colunasLucro';
import { precoComercial } from './listaAnuncios';
import { compararCenarios, ComparacaoCenario } from './cenariosMl';
import AjudaCenarios from './AjudaCenarios';

const { Text } = Typography;

const LUCRO: Record<string, { texto: string; cor: string }> = {
  PREJUIZO: { texto: 'Prejuízo', cor: 'red' }, BAIXO: { texto: 'Abaixo do alvo', cor: 'orange' },
  BOM: { texto: 'No alvo', cor: 'green' }, ALTO: { texto: 'Acima do alvo', cor: 'blue' }, SEM_CUSTO: { texto: 'Sem custo no ERP', cor: 'default' },
};
const MERCADO: Record<string, { texto: string; cor: string }> = {
  ABAIXO: { texto: 'Abaixo do mercado', cor: 'blue' }, COMPETITIVO: { texto: 'Competitivo', cor: 'green' },
  ACIMA: { texto: 'Acima do mercado', cor: 'orange' }, SEM_REFERENCIA: { texto: 'Sem referência suficiente', cor: 'default' },
};
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`);
const corLucro = (v: number) => (v < 0 ? '#cf1322' : undefined);
const TIPO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium' };
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;                                  // com o rascunho aplicado
  idItem: number;
  onTrocarItem: (idItem: number) => void;
  onMudarPreco: (idItem: number, preco: number | null) => void;
  /** Põe o tipo e o frete grátis do cenário nas alterações (freteGratis undefined = não muda o frete). */
  onEscolherCenario: (tipo: string, freteGratis: boolean | undefined) => void;
}

const PrecoMlCard: React.FC<Props> = ({ salvo, det, idItem, onTrocarItem, onMudarPreco, onEscolherCenario }) => {
  const [analise, setAnalise] = useState<AnalisePreco | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [frete, setFrete] = useState<number | null>(null);
  const [vendasMes, setVendasMes] = useState(10);
  const vez = useRef(0);

  const item = det.itens.find(i => i.idItem === idItem) || det.itens[0];
  const itemSalvo = salvo.itens.find(i => i.idItem === item?.idItem);
  const preco = item ? item.precoMl ?? item.precoAnuncio : 0;
  const precoSalvo = itemSalvo ? itemSalvo.precoMl ?? itemSalvo.precoAnuncio : preco;
  const mudou = Math.abs(preco - precoSalvo) >= 0.005;

  // recalcula ao trocar de item ou de preço (espera parar de clicar/digitar); a análise anterior fica até chegar a nova
  useEffect(() => {
    if (!item) return;
    const minha = ++vez.current;
    const t = window.setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await anunciosApi.analisePreco(det.id, item.idItem, { preco, frete });
        if (minha === vez.current) { setAnalise(r); setErro(null); }
      } catch (e) {
        if (minha === vez.current) setErro(e instanceof Error ? e.message : 'Erro ao analisar.');
      } finally {
        if (minha === vez.current) setCarregando(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [det.id, item?.idItem, preco, frete]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const mudar = (v: number | null) => { if (v !== null && v > 0) onMudarPreco(item.idItem, r2(v)); };
  const passo = (d: number) => mudar(r2(preco + d));

  const a = analise && analise.idItem === item.idItem ? analise : null;
  const l = a?.atual;
  const e = a?.envio;
  const alvoPct = a?.alvo.pct ?? 30;
  const pctAtual = l?.lucroSobreCustoPct ?? null;

  // modo de venda: o de hoje no ML (salvo.vendaMl) e o escolhido nas alterações (det)
  const publicado = !!salvo.vendaMl;
  const freteEscolhido = det.vendaMl ? det.vendaMl.freteGratis : e?.gratis ?? null;
  const escolhido = (c: { tipo: string; freteGratis: boolean; obrigatorio: boolean }) =>
    c.tipo === det.tipoAnuncio && (c.obrigatorio || freteEscolhido === null || c.freteGratis === freteEscolhido);
  const motivoBloqueio = (c: { tipo: string; freteGratis: boolean; obrigatorio: boolean }): string | null => {
    if (publicado && c.tipo !== salvo.vendaMl!.tipo && !salvo.vendaMl!.tiposPermitidos.includes(c.tipo)) {
      return `O ML não deixa trocar de ${TIPO[salvo.vendaMl!.tipo || ''] || salvo.vendaMl!.tipo} para ${TIPO[c.tipo]} num anúncio publicado: só subir de tipo. Para voltar, encerre e publique de novo.`;
    }
    const mudaFrete = !c.obrigatorio && freteEscolhido !== null && c.freteGratis !== freteEscolhido;
    if (mudaFrete && !publicado) return 'O frete grátis se escolhe depois de publicar: na publicação vale o padrão da sua conta do ML.';
    if (mudaFrete && !salvo.vendaMl!.podeMudarFrete) return 'Algum item deste anúncio custa R$ 79 ou mais: lá o frete grátis é obrigatório.';
    return null;
  };

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
      size="small" style={{ marginBottom: 16, borderColor: '#91caff' }}
      title={(
        <Space wrap>
          <LineChartOutlined style={{ color: '#1677ff' }} />
          {det.itens.length > 1 ? (
            <Select
              size="small" style={{ minWidth: 280 }} value={item.idItem} onChange={onTrocarItem} showSearch optionFilterProp="label"
              options={det.itens.map(i => ({ value: i.idItem, label: `${i.sku} · ${i.tituloMl || i.nome}` }))}
            />
          ) : <span>{item.sku} · {item.tituloMl || item.nome}</span>}
          {carregando && <Spin size="small" />}
        </Space>
      )}
      extra={(
        <Tooltip title="Para testar outro frete (ex.: o que a tela do ML mostra). Vazio = frete calculado pelo ML para cada preço.">
          <InputNumber size="small" prefix="frete R$" min={0} step={0.5} precision={2} decimalSeparator="," placeholder="do ML" value={frete} onChange={setFrete} style={{ width: 150 }} />
        </Tooltip>
      )}
    >
      {/* preço com ajuste fino + caminho até o alvo */}
      <Flex gap={16} wrap align="center" style={{ marginBottom: 12 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Preço no ML {mudou && <Tag color="processing" style={{ fontSize: 11, marginLeft: 4 }}>alterado</Tag>}</Text>
          <Space.Compact style={{ display: 'flex' }}>
            <Tooltip title="−R$ 0,10"><Button onClick={() => passo(-0.1)}>−0,10</Button></Tooltip>
            <Tooltip title="−R$ 0,01"><Button onClick={() => passo(-0.01)}>−0,01</Button></Tooltip>
            <InputNumber
              style={{ width: 130 }} prefix="R$" min={0.01} step={0.01} precision={2} decimalSeparator="," value={preco}
              onChange={v => mudar(v === null ? null : Number(v))}
            />
            <Tooltip title="+R$ 0,01"><Button onClick={() => passo(0.01)}>+0,01</Button></Tooltip>
            <Tooltip title="+R$ 0,10"><Button onClick={() => passo(0.1)}>+0,10</Button></Tooltip>
          </Space.Compact>
          <div style={{ marginTop: 2 }}>
            <Space size={8} wrap>
              <Text type="secondary" style={{ fontSize: 12 }}>loja {formatarMoeda(item.preco)}</Text>
              {mudou && <Button type="link" size="small" icon={<RollbackOutlined />} style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => onMudarPreco(item.idItem, itemSalvo?.precoMl ?? null)}>voltar a {formatarMoeda(precoSalvo)}</Button>}
              {item.precoMl !== null && <Tooltip title={`Seguir o preço do ERP com o ajuste do anúncio (${formatarMoeda(item.precoAnuncio)})`}><Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => onMudarPreco(item.idItem, null)}>usar o do ERP</Button></Tooltip>}
            </Space>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <Flex justify="space-between" align="baseline">
            <Text type="secondary" style={{ fontSize: 12 }}>Lucro sobre o custo · alvo {alvoPct}%</Text>
            <Text strong style={{ fontSize: 18, color: pctAtual === null ? undefined : pctAtual < 0 ? '#cf1322' : pctAtual < alvoPct ? '#d46b08' : '#389e0d' }}>
              {pctAtual === null ? '—' : `${pctAtual.toFixed(1).replace('.', ',')}%`}
            </Text>
          </Flex>
          <Progress
            percent={pctAtual === null ? 0 : Math.max(0, Math.min(100, (pctAtual / alvoPct) * 100))} showInfo={false} size="small"
            strokeColor={pctAtual !== null && pctAtual >= alvoPct ? '#52c41a' : pctAtual !== null && pctAtual < 0 ? '#ff4d4f' : '#fa8c16'}
          />
          {a?.precoAlvo !== null && a?.precoAlvo !== undefined && (
            <Space size={6} wrap style={{ marginTop: 2 }}>
              <AimOutlined style={{ color: '#1677ff' }} />
              <Text style={{ fontSize: 12 }}>{alvoPct}% a partir de</Text>
              <Tooltip title="Mínimo exato para o alvo (já com tarifa e frete do ML)">
                <Button size="small" onClick={() => mudar(a.precoAlvo!)} disabled={Math.abs(a.precoAlvo! - preco) < 0.005}>{formatarMoeda(a.precoAlvo)}</Button>
              </Tooltip>
              {precoComercial(a.precoAlvo) !== a.precoAlvo && (
                <Tooltip title="Arredondado para final ,90">
                  <Button size="small" type="primary" ghost onClick={() => mudar(precoComercial(a.precoAlvo!))} disabled={Math.abs(precoComercial(a.precoAlvo!) - preco) < 0.005}>{formatarMoeda(precoComercial(a.precoAlvo))}</Button>
                </Tooltip>
              )}
            </Space>
          )}
        </div>
      </Flex>

      {erro && !a && <Alert type="error" showIcon message={erro} />}
      {!a && !erro && <div style={{ minHeight: 120, display: 'grid', placeItems: 'center' }}><Spin /></div>}

      {a && l && e && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic title="Você recebe por venda" value={formatarMoeda(l.liquido)} />
                <Text type="secondary" style={{ fontSize: 12 }}>tarifa {formatarMoeda(l.tarifa)} · frete {l.frete ? formatarMoeda(l.frete) : '—'}</Text>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small" style={{ height: '100%' }}>
                <Statistic title="Lucro por venda" value={formatarMoeda(l.lucro)} valueStyle={{ color: corLucro(l.lucro) }} />
                <Space wrap size={4}>
                  <Tag color={LUCRO[l.nivel].cor}>{LUCRO[l.nivel].texto}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>custo {formatarMoeda(l.custo)}</Text>
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

          {a.alertas.length > 0 && (
            <Alert type={a.alertas.some(x => x.grave) ? 'error' : 'warning'} showIcon message={<AlertasPreco alertas={a.alertas} onUsar={mudar} textoUsar="Usar" />} />
          )}

          <Table<AnalisePreco['cenarios'][number] & ComparacaoCenario>
            size="small" pagination={false} rowKey={c => `${c.tipo}-${c.freteGratis}`} dataSource={compararCenarios(a.cenarios, vendasMes)}
            scroll={{ x: 1000 }}
            title={() => (
              <Flex justify="space-between" align="center" wrap gap={8}>
                <Text strong>Cenários a {formatarMoeda(l.preco)}: Clássico × Premium, com e sem frete grátis</Text>
                <Space size={8} wrap>
                  <Tooltip title="Quantas vendas por mês você faz (ou espera fazer) do jeito de hoje. A tabela mostra quanto cada cenário precisaria vender para lucrar o mesmo.">
                    <InputNumber size="small" min={1} max={100000} precision={0} value={vendasMes} onChange={v => setVendasMes(Math.max(1, Number(v) || 1))} addonAfter="vendas/mês hoje" style={{ width: 190 }} />
                  </Tooltip>
                  <AjudaCenarios />
                </Space>
              </Flex>
            )}
            rowClassName={c => (c.atual ? 'ml-linha-alterada' : '')}
            columns={[
              {
                title: 'Anúncio', width: 250, render: (_, c) => (
                  <Space size={4} wrap>
                    <Tooltip title={c.tipo === 'gold_pro' ? 'Mais exposição e parcelamento sem juros para o comprador' : 'Comissão menor, sem parcelamento sem juros'}><Text strong={c.atual}>{TIPO[c.tipo]}</Text></Tooltip>
                    <Text type="secondary">· {c.freteGratis ? 'frete grátis' : 'comprador paga o frete'}</Text>
                    {c.atual && <Tooltip title="Como o anúncio está hoje no ML"><Tag color="blue">hoje</Tag></Tooltip>}
                    {escolhido(c) && !c.atual && <Tooltip title="Escolhido nas alterações: vai ao ML ao salvar"><Tag color="processing">nas alterações</Tag></Tooltip>}
                    {c.melhorPorVenda && !c.atual && !escolhido(c) && <Tooltip title="Maior lucro por venda"><Tag color="green">mais lucro/venda</Tag></Tooltip>}
                  </Space>
                ),
              },
              ...colunasVenda,
              {
                title: <Tooltip title={`Lucro no mês com ${vendasMes} vendas (o mesmo volume em todos)`}>Lucro/mês</Tooltip>, dataIndex: 'lucroMes', align: 'right' as const,
                render: (v: number) => <Text style={{ color: corLucro(v) }}>{formatarMoeda(v)}</Text>,
              },
              {
                title: <Tooltip title="Quantas vendas por mês este cenário precisa para lucrar o mesmo que hoje. Até 2× costuma valer testar; 4× ou mais quase nunca compensa.">Para lucrar o mesmo</Tooltip>,
                align: 'right' as const, width: 150,
                render: (_, c) => {
                  if (c.atual) return <Text type="secondary">{vendasMes} (hoje)</Text>;
                  if (c.vendasParaEmpatar === null || c.multiplicador === null) return <Tag color="red">nunca (prejuízo)</Tag>;
                  const cor = c.multiplicador <= 1 ? 'green' : c.multiplicador <= 2 ? 'blue' : c.multiplicador < 4 ? 'orange' : 'red';
                  return (
                    <Tooltip title={c.multiplicador <= 1 ? 'Lucra mais com as mesmas vendas (ou menos)' : `Precisa vender ${c.multiplicador.toFixed(1).replace('.', ',')} vezes o que vende hoje`}>
                      <Tag color={cor} style={{ marginRight: 0 }}>{c.vendasParaEmpatar} · {c.multiplicador <= 1 ? 'menos vendas' : `${c.multiplicador.toFixed(1).replace('.', ',')}×`}</Tag>
                    </Tooltip>
                  );
                },
              },
              {
                title: '', width: 92, fixed: 'right' as const,
                render: (_, c) => {
                  if (escolhido(c)) return c.atual ? null : <Text type="secondary" style={{ fontSize: 12 }}>escolhido</Text>;
                  const motivo = motivoBloqueio(c);
                  return (
                    <Tooltip title={motivo || 'Põe este modo de venda nas alterações (vai ao ML ao salvar)'}>
                      <Button size="small" disabled={!!motivo} onClick={() => onEscolherCenario(c.tipo, publicado && !c.obrigatorio ? c.freteGratis : undefined)}>Usar</Button>
                    </Tooltip>
                  );
                },
              },
              {
                title: <Tooltip title="Menor preço que dá a sua margem alvo neste cenário (tarifa e frete do ML já descontados)">Preço p/ alvo</Tooltip>, align: 'right' as const, width: 110,
                render: (_, c) => (c.precoAlvo === null || c.precoAlvo === undefined
                  ? <Text type="secondary">—</Text>
                  : <Text style={{ color: c.precoAlvo > l.preco ? '#d46b08' : '#389e0d' }}>{formatarMoeda(c.precoAlvo)}</Text>),
              },
            ]}
          />

          <Collapse size="small" items={[
            {
              key: 'conta', label: 'Conta, frete e conselhos',
              children: (
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Text style={{ fontSize: 13 }}>
                    {formatarMoeda(l.preco)} − tarifa {formatarMoeda(l.tarifa)} ({a.tarifa.comissaoPct}%{a.tarifa.fixa ? ` + ${formatarMoeda(a.tarifa.fixa)} fixa` : ''})
                    {' '}− frete {l.frete ? formatarMoeda(l.frete) : 'R$ 0,00 (o comprador paga)'} = <b>{formatarMoeda(l.liquido)}</b>
                    {' '}− custo {formatarMoeda(l.custo)}{a.unidadeMl ? ` (${a.unidades} × ${formatarMoeda(a.custoBase)})` : ''}
                    {' '}= <b style={{ color: corLucro(l.lucro) }}>{formatarMoeda(l.lucro)}</b>
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
                    description={l.freteDesconhecido ? 'Não deu para calcular o frete: o item não tem peso no cadastro e ainda não está no ML. Lance o peso da embalagem ou informe o frete à mão (no topo).' : (
                      <div style={{ fontSize: 12 }}>
                        {e.envio && <div>Um envio custa <b>{formatarMoeda(e.envio.valor)}</b> para você{e.envio.cheio ? ` (tabela ${formatarMoeda(e.envio.cheio)}${e.envio.descontoPct ? `, ${e.envio.descontoPct}% de desconto do ML` : ''})` : ''}{!e.gratis && !e.obrigatorio ? ' se ligar o frete grátis' : ''}.</div>}
                        {e.acimaDoLimite && !e.obrigatorio && <div>Compra a partir de {formatarMoeda(e.limite)}: <b>{formatarMoeda(e.acimaDoLimite.valor)}</b> por envio (aí é obrigatório).</div>}
                        {e.peso && <div>Peso cobrado: {e.peso.pesoG} g {e.peso.fonte === 'ML' ? '(calculado pelo ML)' : '(do cadastro do ERP)'}.</div>}
                        <div style={{ marginTop: 2 }}><Text type="secondary" style={{ fontSize: 12 }}>Estimativa do ML. O frete cobrado de verdade aparece em Pedidos › Resultado real.</Text></div>
                      </div>
                    )}
                  />
                  {a.degraus.length > 0 && <Alert type="warning" showIcon icon={<WarningOutlined />} message={<Space direction="vertical" size={2}>{a.degraus.map(d => <span key={d}>{d}</span>)}</Space>} />}
                  <Alert type={l.nivel === 'PREJUIZO' ? 'error' : l.nivel === 'BAIXO' || a.mercado.nivel === 'ACIMA' ? 'warning' : 'success'} showIcon icon={<BulbOutlined />}
                    message={<Space direction="vertical" size={2}>{a.conselhos.map(c => <span key={c}>{c}</span>)}</Space>} />
                </Space>
              ),
            },
            {
              key: 'quantidade', label: 'Por quantidade na mesma compra',
              children: (
                <Table<AnalisePreco['porQuantidade'][number]>
                  size="small" pagination={false} rowKey="quantidade" dataSource={a.porQuantidade}
                  footer={() => <Text type="secondary" style={{ fontSize: 12 }}>A tarifa é por unidade e o frete é um por envio: compra maior dilui o frete, mas a que passa de {formatarMoeda(e.limite)} paga o frete mais caro.</Text>}
                  columns={[
                    {
                      title: 'Compra', render: (_, q: ResultadoVendaMl & { desconto: number; faixa: boolean }) => (
                        <Space size={4}>
                          <b>{q.quantidade} un.</b>
                          {q.desconto > 0 && <Tag color="purple">−{q.desconto}%</Tag>}
                          {q.receita >= e.limite && q.quantidade > 1 && <Tooltip title={`Passa de ${formatarMoeda(e.limite)}: frete grátis obrigatório`}><Tag color="orange">≥ {formatarMoeda(e.limite)}</Tag></Tooltip>}
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
              ),
            },
            {
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
            },
          ]} />
        </Space>
      )}
    </Card>
  );
};

export default PrecoMlCard;
