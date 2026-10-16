// Painel de preço da linha escolhida (aba Preço e lucro): em cima o preço (ajuste de centavo em centavo) e os quatro
// números que decidem (você recebe, lucro × alvo, por unidade × mercado e o preço para o alvo); embaixo as seções em
// abas, sem rolar: formas de venda, Clássico × Premium, mercado, preço por quantidade (CNPJ) e a conta com o frete.
// O preço vai para o rascunho do editor (desfaz e salva como o resto).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Flex, InputNumber, Progress, Segmented, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import {
  AimOutlined, BarChartOutlined, BulbOutlined, CalculatorOutlined, CarOutlined, RollbackOutlined, ShoppingCartOutlined, TeamOutlined, ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons';
import { AnalisePreco, AnuncioDetalhe, anunciosApi, formatarMoeda, ResultadoVendaMl, SecaoPreco, SugestaoMl } from './mercadoLivreApi';
import { SugestoesDaLinha } from './SugestoesMl';
import { AlertasPreco } from './colunasLucro';
import { precoComercial } from './listaAnuncios';
import { compararCenarios, ComparacaoCenario } from './cenariosMl';
import AjudaCenarios from './AjudaCenarios';
import { rotuloDaUnidade } from './linhasAnuncio';

const { Text } = Typography;

const LUCRO: Record<string, { texto: string; cor: string }> = {
  PREJUIZO: { texto: 'Prejuízo', cor: 'red' }, BAIXO: { texto: 'Abaixo do alvo', cor: 'orange' },
  BOM: { texto: 'No alvo', cor: 'green' }, ALTO: { texto: 'Acima do alvo', cor: 'blue' }, SEM_CUSTO: { texto: 'Sem custo no ERP', cor: 'default' },
};
const MERCADO: Record<string, { texto: string; cor: string }> = {
  ABAIXO: { texto: 'Abaixo do mercado', cor: 'blue' }, COMPETITIVO: { texto: 'Competitivo', cor: 'green' },
  ACIMA: { texto: 'Acima do mercado', cor: 'orange' }, SEM_REFERENCIA: { texto: 'Sem referência', cor: 'default' },
};
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`);
const corLucro = (v: number) => (v < 0 ? '#cf1322' : undefined);
const TIPO: Record<string, string> = { gold_special: 'Clássico', gold_pro: 'Premium' };
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
/** Nome pequeno à esquerda do valor, nas colunas de dois andares. */
const Rotulo: React.FC<{ children: React.ReactNode }> = ({ children }) => <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>{children}</Text>;
const menos = (v: number) => <Text type="secondary">{v ? `−${formatarMoeda(v)}` : '—'}</Text>;
const DOIS_ANDARES: React.CSSProperties = { lineHeight: 1.35 };

type Secao = SecaoPreco;
const CHAVE_SECAO = 'ml-preco-secao';
const secaoSalva = (): Secao => { try { return (localStorage.getItem(CHAVE_SECAO) as Secao) || 'formas'; } catch { return 'formas'; } };

/** Um número grande do topo do painel. */
const Indicador: React.FC<{ titulo: React.ReactNode; valor: React.ReactNode; cor?: string; children?: React.ReactNode; destaque?: boolean }> = ({ titulo, valor, cor, children, destaque }) => (
  <div style={{ flex: '1 1 170px', minWidth: 160, padding: '8px 12px', borderRadius: 8, background: destaque ? '#f0f7ff' : '#fafafa', border: `1px solid ${destaque ? '#bae0ff' : '#f0f0f0'}` }}>
    <Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text>
    <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25, color: cor }}>{valor}</div>
    <div style={{ fontSize: 12, marginTop: 2 }}>{children}</div>
  </div>
);

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;                                  // com o rascunho aplicado
  idLinha: number;
  onMudarPreco: (idLinha: number, preco: number | null) => void;
  /** Põe o tipo e o frete grátis do cenário nas alterações (freteGratis undefined = não muda o frete). */
  onEscolherCenario: (tipo: string, freteGratis: boolean | undefined) => void;
  formas: React.ReactNode;                              // seção "Formas de venda" (unitário e conjuntos)
  faixas: React.ReactNode;                              // preço por quantidade para CNPJ (do anúncio inteiro)
  /** Pedido de fora para abrir uma seção (ex.: "Analisar" numa forma de venda abre o mercado). */
  secaoPedida?: { secao: Secao; vez: number } | null;
  sugestoes?: SugestaoMl[];                                    // da central, só desta linha
  onIrParaItens?: (s: SugestaoMl) => void;
}

const PrecoMlCard: React.FC<Props> = ({ salvo, det, idLinha, onMudarPreco, onEscolherCenario, formas, faixas, secaoPedida, sugestoes, onIrParaItens }) => {
  const [analise, setAnalise] = useState<AnalisePreco | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [frete, setFrete] = useState<number | null>(null);
  const [vendasMes, setVendasMes] = useState(10);
  const [secao, setSecao] = useState<Secao>(secaoSalva);
  const vez = useRef(0);
  useEffect(() => { try { localStorage.setItem(CHAVE_SECAO, secao); } catch { /* sem armazenamento */ } }, [secao]);
  useEffect(() => { if (secaoPedida) setSecao(secaoPedida.secao); }, [secaoPedida?.vez]);   // eslint-disable-line react-hooks/exhaustive-deps

  const item = det.itens.find(i => i.idLinha === idLinha) || det.itens[0];
  const itemSalvo = salvo.itens.find(i => i.idLinha === item?.idLinha);
  const preco = item ? item.precoMl ?? item.precoAnuncio : 0;
  const precoSalvo = itemSalvo ? itemSalvo.precoMl ?? itemSalvo.precoAnuncio : preco;
  const mudou = Math.abs(preco - precoSalvo) >= 0.005;

  // recalcula ao trocar de linha ou de preço (espera parar de clicar/digitar); a análise anterior fica até chegar a nova
  useEffect(() => {
    if (!item) return;
    const minha = ++vez.current;
    const t = window.setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await anunciosApi.analisePreco(det.id, item.idLinha, { preco, frete });
        if (minha === vez.current) { setAnalise(r); setErro(null); }
      } catch (e) {
        if (minha === vez.current) setErro(e instanceof Error ? e.message : 'Erro ao analisar.');
      } finally {
        if (minha === vez.current) setCarregando(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [det.id, item?.idLinha, preco, frete]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const mudar = (v: number | null) => { if (v !== null && v > 0) onMudarPreco(item.idLinha, r2(v)); };
  const passo = (d: number) => mudar(r2(preco + d));

  const a = analise && analise.idLinha === item.idLinha ? analise : null;
  const l = a?.atual;
  const e = a?.envio;
  const alvoPct = a?.alvo.pct ?? 30;
  const pctAtual = l?.lucroSobreCustoPct ?? null;
  const corPct = pctAtual === null ? undefined : pctAtual < 0 ? '#cf1322' : pctAtual < alvoPct ? '#d46b08' : '#389e0d';

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

  // colunas de dois andares (como na lista de anúncios): tarifa e frete · você recebe · lucro com % e situação
  type Venda = { tarifa: number; frete: number; recebe: number; lucro: number; lucroSobreCustoPct: number | null; nivel: string };
  const colTarifaFrete = {
    title: <Tooltip title="O que o ML desconta: a tarifa (comissão do tipo de anúncio) e o frete que você paga">Tarifa e frete</Tooltip>,
    align: 'right' as const, width: 120,
    render: (_: unknown, v: Venda) => (
      <div style={DOIS_ANDARES}>
        <div><Rotulo>tarifa</Rotulo>{menos(v.tarifa)}</div>
        <div><Rotulo>frete</Rotulo>{menos(v.frete)}</div>
      </div>
    ),
  };
  const colRecebe = { title: 'Você recebe', dataIndex: 'recebe', align: 'right' as const, width: 100, render: (v: number) => <b>{formatarMoeda(v)}</b> };
  const colCusto = { title: <Tooltip title='Custo do item no ERP (da compra inteira, na tabela por quantidade)'>Custo</Tooltip>, dataIndex: 'custo', align: 'right' as const, width: 90, render: (v: number) => menos(v) };
  /** Lucro (em cima) e % sobre o custo com a situação (embaixo); `topo` troca o valor de cima (ex.: lucro da compra inteira). */
  const colLucro = <T extends Venda>(titulo: React.ReactNode, topo?: (v: T) => React.ReactNode) => ({
    title: titulo, align: 'right' as const, width: 150,
    render: (_: unknown, v: T) => (
      <div style={DOIS_ANDARES}>
        {topo ? topo(v) : <b style={{ color: corLucro(v.lucro) }}>{formatarMoeda(v.lucro)}</b>}
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>{pct(v.lucroSobreCustoPct)}</Text>
          <Tag color={LUCRO[v.nivel].cor} style={{ fontSize: 11, lineHeight: '16px', marginInlineEnd: 0 }}>{LUCRO[v.nivel].texto}</Tag>
        </div>
      </div>
    ),
  });

  const sugerido = a?.precoAlvo !== null && a?.precoAlvo !== undefined ? precoComercial(a.precoAlvo) : null;
  const atencao = !!a && (a.alertas.length > 0 || a.degraus.length > 0 || (l?.freteDesconhecido ?? false));

  // ---------------------------------------------------------------- seções
  const cenarios = a && l && (
    <Table<AnalisePreco['cenarios'][number] & ComparacaoCenario>
      size="small" pagination={false} rowKey={c => `${c.tipo}-${c.freteGratis}`} dataSource={compararCenarios(a.cenarios, vendasMes)}
      scroll={{ x: 880 }}
      title={() => (
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>A {formatarMoeda(l.preco)}: qual tipo de anúncio e se vale ligar o frete grátis. "Usar" põe nas alterações.</Text>
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
          title: 'Anúncio', width: 200, render: (_, c) => (
            <Space size={4} wrap>
              <Tooltip title={c.tipo === 'gold_pro' ? 'Mais exposição e parcelamento sem juros para o comprador' : 'Comissão menor, sem parcelamento sem juros'}><Text strong={c.atual}>{TIPO[c.tipo]}</Text></Tooltip>
              {c.freteGratis
                ? <Tooltip title="Frete grátis para o comprador: você paga o envio"><Tag color="cyan" style={{ marginInlineEnd: 0 }}>Frete grátis</Tag></Tooltip>
                : <Tooltip title="O comprador paga o envio (abaixo de R$ 79 o ML ainda cobra de você a tarifa de envio do item barato)"><Tag color="gold" style={{ marginInlineEnd: 0 }}>Frete custeado</Tag></Tooltip>}
              {c.atual && <Tooltip title="Como o anúncio está hoje no ML"><Tag color="blue">hoje</Tag></Tooltip>}
              {escolhido(c) && !c.atual && <Tooltip title="Escolhido nas alterações: vai ao ML ao salvar"><Tag color="processing">nas alterações</Tag></Tooltip>}
              {c.melhorPorVenda && !c.atual && !escolhido(c) && <Tooltip title="Maior lucro por venda"><Tag color="green">mais lucro/venda</Tag></Tooltip>}
            </Space>
          ),
        },
        colTarifaFrete,
        colRecebe,
        colCusto,
        colLucro<AnalisePreco['cenarios'][number] & ComparacaoCenario>('Lucro por venda'),
        {
          title: <Tooltip title={`Em cima: lucro no mês com ${vendasMes} vendas (o mesmo volume em todos). Embaixo: quantas vendas por mês o cenário precisa para lucrar o mesmo que hoje. Até 2× costuma valer testar; 4× ou mais quase nunca compensa.`}>No mês</Tooltip>,
          align: 'right' as const, width: 160,
          render: (_, c) => {
            let empate: React.ReactNode;
            if (c.atual) empate = <Text type="secondary" style={{ fontSize: 12 }}>{vendasMes} vendas (hoje)</Text>;
            else if (c.vendasParaEmpatar === null || c.multiplicador === null) empate = <Tag color="red" style={{ fontSize: 11, marginInlineEnd: 0 }}>nunca (prejuízo)</Tag>;
            else {
              const cor = c.multiplicador <= 1 ? 'green' : c.multiplicador <= 2 ? 'blue' : c.multiplicador < 4 ? 'orange' : 'red';
              const vezes = c.multiplicador.toFixed(1).replace('.', ',');
              empate = (
                <Tooltip title={c.multiplicador <= 1 ? 'Lucra mais com as mesmas vendas (ou menos)' : `Precisa vender ${vezes} vezes o que vende hoje para lucrar o mesmo`}>
                  <Tag color={cor} style={{ fontSize: 11, marginInlineEnd: 0 }}>{c.multiplicador <= 1 ? 'mesmas vendas ou -' : `precisa ${c.vendasParaEmpatar} (${vezes}×)`}</Tag>
                </Tooltip>
              );
            }
            return (
              <div style={DOIS_ANDARES}>
                <Text style={{ color: corLucro(c.lucroMes) }}>{formatarMoeda(c.lucroMes)}</Text>
                <div>{empate}</div>
              </div>
            );
          },
        },
        {
          title: <Tooltip title="Menor preço que dá a sua margem alvo neste cenário (tarifa e frete do ML já descontados)">Preço p/ alvo</Tooltip>, align: 'right' as const, width: 110,
          render: (_, c) => (c.precoAlvo === null || c.precoAlvo === undefined
            ? <Text type="secondary">—</Text>
            : <Text style={{ color: c.precoAlvo > l.preco ? '#d46b08' : '#389e0d' }}>{formatarMoeda(c.precoAlvo)}</Text>),
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
      ]}
    />
  );

  const mercado = a && (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      {a.mercado.estatisticas && (
        <Flex gap={8} wrap>
          {([['Menor', a.mercado.estatisticas.min], ['25% mais baratos', a.mercado.estatisticas.p25], ['Mediana', a.mercado.estatisticas.mediana], ['Maior', a.mercado.estatisticas.max]] as const).map(([t, v]) => (
            <Indicador key={t} titulo={`${t} (por unidade)`} valor={formatarMoeda(v)} destaque={t === 'Mediana'}>
              {t === 'Mediana' && <Text type="secondary">{a.unidades > 1 ? `× ${a.unidades} = ${formatarMoeda(a.mercado.precoMercado ?? 0)}` : `${a.mercado.estatisticas!.n} anúncios`}</Text>}
            </Indicador>
          ))}
        </Flex>
      )}
      {a.mercado.erro ? <Text type="danger">{a.mercado.erro}</Text> : (
        <Table
          size="small" pagination={a.mercado.produtos.length > 8 ? { pageSize: 8, size: 'small', showSizeChanger: false } : false} rowKey="produtoId" dataSource={a.mercado.produtos}
          locale={{ emptyText: 'Nenhum anúncio parecido o bastante (mesmo tipo e medida) no catálogo.' }}
          title={() => <Text type="secondary" style={{ fontSize: 12 }}>Comparado por unidade{a.unidades > 1 ? ` com pacotes de tamanho parecido (${a.unidades} un.)` : ''}{a.mercado.regua === 'TODOS' ? ': poucos do mesmo tamanho, valem todos' : ''}.</Text>}
          columns={[
            { title: 'Por unidade', dataIndex: 'porUnidade', width: 100, render: (v: number) => <b style={{ color: v < (a.mercado.porUnidade || 0) ? '#cf1322' : undefined }}>{formatarMoeda(v)}</b> },
            { title: 'Qtd.', dataIndex: 'unidades', width: 60 },
            { title: 'Preço', dataIndex: 'preco', width: 100, render: formatarMoeda },
            { title: 'Marca', dataIndex: 'marca', width: 120 },
            { title: 'Produto', dataIndex: 'nome', render: (v: string, p) => <a href={`https://www.mercadolivre.com.br/p/${p.produtoId}`} target="_blank" rel="noreferrer">{v}</a> },
          ]}
        />
      )}
    </Space>
  );

  const quantidade = a && e && (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {faixas}
      <Table<AnalisePreco['porQuantidade'][number]>
        size="small" pagination={false} rowKey="quantidade" dataSource={a.porQuantidade}
        title={() => <Text strong>Na mesma compra (a este preço)</Text>}
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
          colTarifaFrete,
          colRecebe,
          colCusto,
          colLucro<AnalisePreco['porQuantidade'][number]>(<Tooltip title="Lucro da compra inteira (e por unidade); embaixo, o % sobre o custo e a situação">Lucro da compra</Tooltip>, q => (
            <div style={{ whiteSpace: 'nowrap' }}>
              <b style={{ color: corLucro(q.lucro) }}>{formatarMoeda(q.lucro)}</b>
              {q.quantidade > 1 && <Text type="secondary" style={{ fontSize: 11 }}> · {formatarMoeda(q.lucroPorUnidade)}/un</Text>}
            </div>
          )),
        ]}
      />
    </Space>
  );

  const conta = a && l && e && (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <div style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 8, fontSize: 13 }}>
        {formatarMoeda(l.preco)} − tarifa {formatarMoeda(l.tarifa)} ({a.tarifa.comissaoPct}%{a.tarifa.fixa ? ` + ${formatarMoeda(a.tarifa.fixa)} fixa` : ''})
        {' '}− frete {l.frete ? `${formatarMoeda(l.frete)}${!e.gratis && !e.obrigatorio ? ' (tarifa de envio do item barato)' : ''}` : 'R$ 0,00'} = <b>{formatarMoeda(l.liquido)}</b>
        {' '}− custo {formatarMoeda(l.custo)}{a.unidadeMl ? ` (${a.unidades} × ${formatarMoeda(a.custoBase)})` : ''}
        {' '}= <b style={{ color: corLucro(l.lucro) }}>{formatarMoeda(l.lucro)}</b>
      </div>
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
        description={l.freteDesconhecido ? 'Não deu para calcular o frete: o item não tem peso no cadastro e ainda não está no ML. Preencha em Itens e estoque › Cadastro, ou teste um frete à mão (campo "frete" no topo).' : (
          <div style={{ fontSize: 12 }}>
            {e.envio && <div>Com frete grátis, um envio custa <b>{formatarMoeda(e.envio.valor)}</b> para você{e.envio.cheio ? ` (tabela ${formatarMoeda(e.envio.cheio)}${e.envio.descontoPct ? `, ${e.envio.descontoPct}% de desconto do ML` : ''})` : ''}{!e.obrigatorio ? ': abaixo de R$ 79 é o frete grátis cheio, sem o desconto do item barato' : ''}.</div>}
            {e.semGratis && !e.obrigatorio && <div>Sem frete grátis, o ML ainda cobra de você <b>{formatarMoeda(e.semGratis.valor)}</b> por envio (tarifa de envio de item abaixo de R$ 79), mesmo com o comprador pagando o frete.</div>}
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
  );

  const conteudo: Record<Secao, React.ReactNode> = { formas, cenarios, mercado, quantidade, conta };

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e6f0ff', padding: 12 }}>
      {/* cabeçalho: qual linha e o frete de teste */}
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 10 }}>
        <Space size={6} wrap>
          <Text strong style={{ fontSize: 15 }}>{item.sku}</Text>
          {item.unidadeMl && <Tag color="purple">{rotuloDaUnidade(item)}</Tag>}
          <Text type="secondary" ellipsis style={{ maxWidth: 420 }}>{item.tituloMl || item.nome}</Text>
          {carregando && <Spin size="small" />}
        </Space>
        <Tooltip title="Para testar outro frete (ex.: o que a tela do ML mostra). Vazio = frete calculado pelo ML para cada preço.">
          <InputNumber size="small" prefix="frete R$" min={0} step={0.5} precision={2} decimalSeparator="," placeholder="do ML" value={frete} onChange={setFrete} style={{ width: 150 }} />
        </Tooltip>
      </Flex>

      {/* preço + os quatro números */}
      <Flex gap={10} wrap align="stretch">
        <div style={{ flex: '0 0 auto', padding: '8px 12px', borderRadius: 8, border: '1px solid #91caff', background: '#fff' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Preço no ML {mudou && <Tag color="processing" style={{ fontSize: 11, marginLeft: 4 }}>alterado</Tag>}</Text>
          <Space.Compact style={{ display: 'flex', marginTop: 2 }}>
            <Tooltip title="−R$ 0,10"><Button onClick={() => passo(-0.1)}>−0,10</Button></Tooltip>
            <Tooltip title="−R$ 0,01"><Button onClick={() => passo(-0.01)}>−0,01</Button></Tooltip>
            <InputNumber style={{ width: 120 }} prefix="R$" min={0.01} step={0.01} precision={2} decimalSeparator="," value={preco} onChange={v => mudar(v === null ? null : Number(v))} />
            <Tooltip title="+R$ 0,01"><Button onClick={() => passo(0.01)}>+0,01</Button></Tooltip>
            <Tooltip title="+R$ 0,10"><Button onClick={() => passo(0.1)}>+0,10</Button></Tooltip>
          </Space.Compact>
          <Space size={8} wrap style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>loja {formatarMoeda(item.preco)}{a ? ` (${pct(a.loja.difPct)})` : ''}</Text>
            {mudou && <Button type="link" size="small" icon={<RollbackOutlined />} style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => onMudarPreco(item.idLinha, itemSalvo?.precoMl ?? null)}>voltar a {formatarMoeda(precoSalvo)}</Button>}
            {item.precoMl !== null && <Tooltip title={`Seguir o preço do ERP com o ajuste do anúncio (${formatarMoeda(item.precoAnuncio)})`}><Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => onMudarPreco(item.idLinha, null)}>usar o do ERP</Button></Tooltip>}
          </Space>
        </div>

        <Indicador titulo="Você recebe por venda" valor={l ? formatarMoeda(l.liquido) : '…'}>
          {l && <Text type="secondary">tarifa {formatarMoeda(l.tarifa)} · frete {l.freteDesconhecido ? <Text type="warning">?</Text> : l.frete ? formatarMoeda(l.frete) : '—'}</Text>}
        </Indicador>

        <Indicador titulo={<>Lucro por venda · alvo {alvoPct}%</>} valor={l ? <>{formatarMoeda(l.lucro)} <span style={{ fontSize: 14, color: corPct }}>{pctAtual === null ? '' : `${pctAtual.toFixed(1).replace('.', ',')}%`}</span></> : '…'} cor={l ? corLucro(l.lucro) : undefined}>
          <Progress
            percent={pctAtual === null ? 0 : Math.max(0, Math.min(100, (pctAtual / alvoPct) * 100))} showInfo={false} size="small" style={{ margin: 0 }}
            strokeColor={pctAtual !== null && pctAtual >= alvoPct ? '#52c41a' : pctAtual !== null && pctAtual < 0 ? '#ff4d4f' : '#fa8c16'}
          />
          {l && <Tag color={LUCRO[l.nivel].cor} style={{ marginTop: 2 }}>{LUCRO[l.nivel].texto}</Tag>}
        </Indicador>

        <Indicador titulo={a ? `Por unidade${a.unidades > 1 ? ` (${a.unidades} un.)` : ''} × mercado` : 'Por unidade × mercado'} valor={a ? formatarMoeda(a.mercado.porUnidade) : '…'}>
          {a && (
            <Space size={4} wrap>
              <Tag color={MERCADO[a.mercado.nivel].cor} style={{ marginRight: 0 }}>{MERCADO[a.mercado.nivel].texto}</Tag>
              {a.mercado.estatisticas && <Text type="secondary">mediana {formatarMoeda(a.mercado.estatisticas.mediana)} {pct(a.mercado.difMedianaPct)}</Text>}
            </Space>
          )}
        </Indicador>

        <Indicador titulo={<><AimOutlined /> Para o alvo de {alvoPct}%</>} destaque valor={sugerido !== null ? formatarMoeda(sugerido) : '—'}>
          {a?.precoAlvo !== null && a?.precoAlvo !== undefined && sugerido !== null && (
            <Space size={4} wrap>
              <Button size="small" type="primary" disabled={Math.abs(sugerido - preco) < 0.005} onClick={() => mudar(sugerido)}>Usar</Button>
              {sugerido !== a.precoAlvo && (
                <Tooltip title="Mínimo exato (sem arredondar para ,90)">
                  <Button size="small" type="link" style={{ padding: 0 }} disabled={Math.abs(a.precoAlvo - preco) < 0.005} onClick={() => mudar(a.precoAlvo!)}>exato {formatarMoeda(a.precoAlvo)}</Button>
                </Tooltip>
              )}
            </Space>
          )}
          {a && a.precoAlvo === null && <Text type="secondary">sem custo no ERP</Text>}
        </Indicador>
      </Flex>

      {erro && !a && <Alert type="error" showIcon message={erro} style={{ marginTop: 10 }} />}
      {a && a.alertas.length > 0 && (
        <Alert type={a.alertas.some(x => x.grave) ? 'error' : 'warning'} showIcon style={{ marginTop: 10, padding: '6px 12px' }} message={<AlertasPreco alertas={a.alertas} onUsar={mudar} textoUsar="Usar" />} />
      )}

      <SugestoesDaLinha lista={sugestoes || []} onAbrir={s => (s.acao.aba === 'itens' ? onIrParaItens?.(s) : s.acao.secao && setSecao(s.acao.secao))} />

      {/* seções */}
      <Segmented
        block style={{ marginTop: 12 }} value={secao} onChange={v => setSecao(v as Secao)}
        options={[
          { value: 'formas', label: <Space size={4}><ShoppingCartOutlined />Formas de venda</Space> },
          { value: 'cenarios', label: <Space size={4}><ThunderboltOutlined />Clássico × Premium</Space> },
          { value: 'mercado', label: <Space size={4}><BarChartOutlined />Mercado{a ? ` (${a.mercado.produtos.length})` : ''}</Space> },
          { value: 'quantidade', label: <Space size={4}><TeamOutlined />Por quantidade (CNPJ)</Space> },
          { value: 'conta', label: <Space size={4}><CalculatorOutlined />Conta e frete{atencao ? <WarningOutlined style={{ color: '#fa8c16' }} /> : null}</Space> },
        ]}
      />
      <div style={{ marginTop: 10, minHeight: 160 }}>
        {secao === 'formas' ? formas : !a ? <div style={{ minHeight: 160, display: 'grid', placeItems: 'center' }}><Spin /></div> : conteudo[secao]}
      </div>
    </div>
  );
};

export default PrecoMlCard;
