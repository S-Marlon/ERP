// Vendas › Taxas de pagamento: taxas da maquininha por forma e faixa de parcelas, qual taxa o preço de tabela
// embute, até quantas parcelas a loja absorve e o simulador (quanto cobrar e quanto recebe em cada forma).
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Dropdown, Empty, Input, InputNumber, Row, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { CalculatorOutlined, DeleteOutlined, InfoCircleOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { ConfigTaxas, invalidarTaxas, ROTULO_FORMA_TAXA, TaxaPagamento, taxasApi } from '../../taxas/taxasVenda';
import { carregarTaxaPreco } from '../../../../core/precos/taxaPreco';

const { Text, Title } = Typography;
const FORMAS = ['CREDITO', 'DEBITO', 'PIX', 'DINHEIRO', 'TRANSFERENCIA', 'PRAZO'];
const ICONE_FORMA: Record<string, string> = { CREDITO: '💳', DEBITO: '💳', PIX: '⚡', DINHEIRO: '💵', TRANSFERENCIA: '🏦', PRAZO: '📒' };
const VERDE = '#389e0d';
const LARANJA = '#d48806';

// tipoFixa: como a taxa fixa por venda é informada (% vai para vendaPercentual, R$ para fixa)
type Linha = TaxaPagamento & { chave: number; tipoFixa: 'PCT' | 'RS' };
const totalPct = (l: TaxaPagamento) => (Number(l.percentual) || 0) + (Number(l.vendaPercentual) || 0);
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`;

// Mesma conta do servidor (Backend/src/routes/Venda/taxas/taxas.ts), para a prévia enquanto edita
const previa = (linhas: Linha[], formaRef: string, parcelasRef: number) => {
  const linha = (forma: string, n: number) => linhas.find(x => x.forma === forma && n >= x.parcelasDe && n <= x.parcelasAte);
  const taxa = (forma: string, n: number) => { const l = linha(forma, n); return l ? totalPct(l) : 0; };
  const fixa = (forma: string, n: number) => { const l = linha(forma, n); return l && l.tipoFixa === 'RS' ? Number(l.fixa) || 0 : 0; };
  const ref = taxa(formaRef, parcelasRef) / 100;
  const ajuste = (forma: string, n: number) => ((1 - ref) / (1 - taxa(forma, n) / 100) - 1) * 100;
  return { ref: ref * 100, ajuste, taxa, fixa, fixaRef: fixa(formaRef, parcelasRef) };
};

// Faixas de parcelas do crédito sem taxa cadastrada (contam como 0%)
const lacunasCredito = (linhas: Linha[], ate: number) => {
  const cobre = (n: number) => linhas.some(l => l.forma === 'CREDITO' && n >= l.parcelasDe && n <= l.parcelasAte);
  const faixas: string[] = [];
  let inicio: number | null = null;
  for (let n = 1; n <= ate + 1; n++) {
    if (n <= ate && !cobre(n)) { if (inicio === null) inicio = n; }
    else if (inicio !== null) { faixas.push(inicio === n - 1 ? `${inicio}x` : `${inicio}x a ${n - 1}x`); inicio = null; }
  }
  return faixas;
};

const fotografia = (linhas: Linha[], formaRef: string, parcelasRef: number, semJuros: number, automatico: boolean) =>
  JSON.stringify({ l: linhas.map(({ chave: _c, ...x }) => x), formaRef, parcelasRef, semJuros, automatico }); // eslint-disable-line @typescript-eslint/no-unused-vars

const TaxasPagamento: React.FC = () => {
  const [cfg, setCfg] = useState<ConfigTaxas | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [formaRef, setFormaRef] = useState('CREDITO');
  const [parcelasRef, setParcelasRef] = useState(1);
  const [semJuros, setSemJuros] = useState(1);
  const [automatico, setAutomatico] = useState(true);
  const [temSenha, setTemSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState('');
  const [vendaEmLote, setVendaEmLote] = useState<number | null>(null);
  // Simulador: preço de tabela digitado ou o líquido que se quer receber
  const [valorSimulado, setValorSimulado] = useState<number | null>(100);
  const [modoSimulacao, setModoSimulacao] = useState<'TABELA' | 'RECEBER'>('TABELA');

  const aplicar = (c: ConfigTaxas) => {
    const novas: Linha[] = c.taxas.map((t, i) => ({ ...t, chave: i + 1, tipoFixa: Number(t.fixa) > 0 && !Number(t.vendaPercentual) ? 'RS' : 'PCT' }));
    setCfg(c);
    setLinhas(novas);
    setFormaRef(c.formaReferencia);
    setParcelasRef(c.parcelasReferencia);
    setSemJuros(c.parcelasSemJuros);
    setAutomatico(c.descontoFormaAutomatico);
    setSalvo(fotografia(novas, c.formaReferencia, c.parcelasReferencia, c.parcelasSemJuros, c.descontoFormaAutomatico));
  };

  useEffect(() => {
    taxasApi.obter().then(aplicar).catch(e => message.error(e.message));
    fetch('http://localhost:3001/api/vendas/configuracoes').then(r => r.json()).then(r => setTemSenha(Boolean(r.temSenha))).catch(() => undefined);
  }, []);

  const sujo = cfg !== null && fotografia(linhas, formaRef, parcelasRef, semJuros, automatico) !== salvo;

  const alterar = (chave: number, campo: keyof Linha, valor: unknown) =>
    setLinhas(ls => ls.map(l => (l.chave === chave ? { ...l, [campo]: valor } : l)));

  const adicionar = (forma: string) => {
    const daForma = linhas.filter(l => l.forma === forma);
    const de = daForma.length ? Math.max(...daForma.map(l => l.parcelasAte)) + 1 : 1;
    // Nova faixa herda a taxa por venda das outras linhas da mesma forma
    const base = daForma[0];
    setLinhas(ls => [...ls, {
      chave: Date.now(), forma, parcelasDe: de, parcelasAte: de, percentual: 0, observacao: '',
      vendaPercentual: base?.tipoFixa === 'PCT' ? base.vendaPercentual || 0 : 0, fixa: base?.tipoFixa === 'RS' ? base.fixa : 0, tipoFixa: base?.tipoFixa || 'PCT',
    }]);
  };

  const sugestaoInicial = () => setLinhas([
    { chave: 1, forma: 'CREDITO', parcelasDe: 1, parcelasAte: 1, percentual: 4.99, fixa: 0, tipoFixa: 'PCT' },
    { chave: 2, forma: 'CREDITO', parcelasDe: 2, parcelasAte: 6, percentual: 6.99, fixa: 0, tipoFixa: 'PCT' },
    { chave: 3, forma: 'CREDITO', parcelasDe: 7, parcelasAte: 12, percentual: 9.99, fixa: 0, tipoFixa: 'PCT' },
    { chave: 4, forma: 'DEBITO', parcelasDe: 1, parcelasAte: 1, percentual: 1.99, fixa: 0, tipoFixa: 'PCT' },
    { chave: 5, forma: 'PIX', parcelasDe: 1, parcelasAte: 1, percentual: 0, fixa: 0, tipoFixa: 'PCT' },
  ]);

  const prev = useMemo(() => previa(linhas, formaRef, parcelasRef), [linhas, formaRef, parcelasRef]);
  const lacunas = useMemo(() => lacunasCredito(linhas, Math.max(12, semJuros, formaRef === 'CREDITO' ? parcelasRef : 1)), [linhas, semJuros, formaRef, parcelasRef]);
  const formasPresentes = FORMAS.filter(f => linhas.some(l => l.forma === f));
  const formasAusentes = FORMAS.filter(f => !formasPresentes.includes(f));

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await taxasApi.salvar({
        taxas: linhas.map(l => ({
          forma: l.forma, parcelasDe: l.parcelasDe, parcelasAte: l.forma === 'CREDITO' ? l.parcelasAte : l.parcelasDe, percentual: l.percentual,
          vendaPercentual: l.tipoFixa === 'PCT' ? Number(l.vendaPercentual) || 0 : 0,
          fixa: l.tipoFixa === 'RS' ? Number(l.fixa) || 0 : 0,
          observacao: l.observacao,
        })),
        formaReferencia: formaRef, parcelasReferencia: parcelasRef, parcelasSemJuros: semJuros, descontoFormaAutomatico: automatico,
        senhaAtual: senhaAtual || undefined,
      });
      aplicar(r);
      setSenhaAtual('');
      invalidarTaxas();
      carregarTaxaPreco();
      message.success('Taxas salvas. Para atualizar os preços existentes, use Catálogo › Precificação › Preços com taxa.');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar as taxas.');
    } finally {
      setSalvando(false);
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Simulação (usada no resumo e no simulador)
  // ---------------------------------------------------------------------------------------------
  const simular = (forma: string, parcelas: number, precoTabela: number) => {
    const ajusteBruto = prev.ajuste(forma, parcelas);
    const absorveTaxa = forma === 'CREDITO' && parcelas <= semJuros && ajusteBruto > 0.005;
    const ajuste = forma === 'CREDITO' && parcelas <= semJuros ? 0 : ajusteBruto;
    const cobrar = Math.round(precoTabela * (1 + ajuste / 100) * 100) / 100;
    const taxaValor = Math.round((cobrar * prev.taxa(forma, parcelas) / 100 + prev.fixa(forma, parcelas)) * 100) / 100;
    return { forma, parcelas, ajuste, absorveTaxa, cobrar, taxaValor, recebe: Math.round((cobrar - taxaValor) * 100) / 100 };
  };
  const descontoPix = -Math.min(0, prev.ajuste('PIX', 1));
  const ajusteDebito = prev.ajuste('DEBITO', 1);

  const valor = Number(valorSimulado) || 0;
  const precoTabela = modoSimulacao === 'TABELA' ? valor : (valor + prev.fixaRef) / (1 - prev.ref / 100);
  const linhasSim = [
    ...['DINHEIRO', 'PIX', 'DEBITO'].map(f => simular(f, 1, precoTabela)),
    ...Array.from({ length: 12 }, (_, i) => simular('CREDITO', i + 1, precoTabela)),
  ];

  // ---------------------------------------------------------------------------------------------
  // Pedaços da tela
  // ---------------------------------------------------------------------------------------------
  const kpi = (rotulo: string, valorKpi: React.ReactNode, ajuda: string, cor?: string) => (
    <Tooltip title={ajuda}>
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px', minWidth: 160, flex: 1 }}>
        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{rotulo}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: cor }}>{valorKpi}</div>
      </div>
    </Tooltip>
  );

  const campoFixa = (l: Linha) => (
    <Space.Compact size="small">
      <InputNumber size="small" min={0} max={l.tipoFixa === 'PCT' ? 49.99 : undefined} step={l.tipoFixa === 'PCT' ? 0.1 : 0.05}
        precision={2} decimalSeparator="," style={{ width: 82 }}
        value={l.tipoFixa === 'PCT' ? l.vendaPercentual || 0 : l.fixa}
        onChange={x => alterar(l.chave, l.tipoFixa === 'PCT' ? 'vendaPercentual' : 'fixa', Number(x) || 0)} />
      <Select size="small" value={l.tipoFixa} style={{ width: 58 }}
        onChange={(tipo: 'PCT' | 'RS') => setLinhas(ls => ls.map(x => (x.chave !== l.chave ? x : tipo === 'PCT'
          ? { ...x, tipoFixa: 'PCT', vendaPercentual: x.fixa || x.vendaPercentual || 0, fixa: 0 }
          : { ...x, tipoFixa: 'RS', fixa: x.vendaPercentual || x.fixa || 0, vendaPercentual: 0 })))}
        options={[{ value: 'PCT', label: '%' }, { value: 'RS', label: 'R$' }]} />
    </Space.Compact>
  );

  const blocoForma = (forma: string) => {
    const daForma = linhas.filter(l => l.forma === forma).sort((a, b) => a.parcelasDe - b.parcelasDe);
    const parcelado = forma === 'CREDITO';
    return (
      <div key={forma} style={{ border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', padding: '6px 10px' }}>
          <Space size={6}>
            <span>{ICONE_FORMA[forma]}</span>
            <Text strong>{ROTULO_FORMA_TAXA[forma]}</Text>
            {formaRef === forma && <Tag color="blue" style={{ margin: 0 }}>referência do preço</Tag>}
          </Space>
          {parcelado && <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => adicionar(forma)}>faixa de parcelas</Button>}
        </div>
        <Table<Linha>
          size="small"
          rowKey="chave"
          pagination={false}
          showHeader
          dataSource={daForma}
          columns={[
            ...(parcelado ? [{
              title: 'Parcelas', key: 'p', width: 130,
              render: (_: unknown, l: Linha) => (
                <Space size={4}>
                  <InputNumber size="small" min={1} max={36} value={l.parcelasDe} style={{ width: 52 }} onChange={v => alterar(l.chave, 'parcelasDe', Number(v) || 1)} />
                  <Text type="secondary">a</Text>
                  <InputNumber size="small" min={1} max={36} value={l.parcelasAte} style={{ width: 52 }} onChange={v => alterar(l.chave, 'parcelasAte', Number(v) || 1)} />
                </Space>
              ),
            }] : []),
            {
              title: <Tooltip title="Taxa da faixa de parcelas (MDR / antecipação)">Taxa <InfoCircleOutlined /></Tooltip>, dataIndex: 'percentual', width: 110,
              render: (v: number, l: Linha) => <InputNumber size="small" min={0} max={49.99} step={0.1} precision={2} decimalSeparator="," addonAfter="%" style={{ width: 100 }} value={v} onChange={x => alterar(l.chave, 'percentual', Number(x) || 0)} />,
            },
            {
              title: <Tooltip title="Cobrada em toda venda, além da taxa da faixa: em % (ex.: 3,09%) ou em R$">Por venda <InfoCircleOutlined /></Tooltip>, key: 'fixa', width: 150,
              render: (_: unknown, l: Linha) => campoFixa(l),
            },
            {
              title: 'Total', key: 'total', width: 100, align: 'right' as const,
              render: (_: unknown, l: Linha) => (
                <b style={{ fontSize: 13 }}>{pct(totalPct(l))}{l.tipoFixa === 'RS' && l.fixa > 0 && <div style={{ fontSize: 11, fontWeight: 400 }}>+ {brl(l.fixa)}</div>}</b>
              ),
            },
            {
              title: 'Observação', dataIndex: 'observacao',
              render: (v: string, l: Linha) => <Input size="small" placeholder="Ex.: maquininha X" value={v || ''} maxLength={100} onChange={e => alterar(l.chave, 'observacao', e.target.value)} />,
            },
            {
              title: '', key: 'x', width: 36,
              render: (_: unknown, l: Linha) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLinhas(ls => ls.filter(x => x.chave !== l.chave))} />,
            },
          ]}
        />
      </div>
    );
  };

  const corAjuste = (v: number) => (Math.abs(v) < 0.005 ? undefined : v < 0 ? VERDE : LARANJA);

  return (
    <div style={{ padding: 16 }}>
      {/* Cabeçalho fixo: título, situação e salvar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: '#f5f7fa', margin: '-16px -16px 12px', padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Taxas de pagamento</Title>
          <Text type="secondary">Quanto a maquininha cobra, quanto o preço já cobre e quanto você recebe em cada forma de pagamento.</Text>
        </div>
        <Space wrap>
          {sujo && <Tag color="orange" style={{ margin: 0 }}>Alterações não salvas</Tag>}
          {temSenha && (
            <Input.Password size="middle" placeholder="Senha de autorização" style={{ width: 200 }} value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
          )}
          <Button type="primary" icon={<SaveOutlined />} loading={salvando} disabled={!sujo} onClick={salvar}>Salvar</Button>
        </Space>
      </div>

      {/* Resumo */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {kpi('O preço de tabela cobre', pct(prev.ref), `Taxa do ${ROTULO_FORMA_TAXA[formaRef]} em ${parcelasRef}x, já embutida no preço de tabela`, '#1677ff')}
        {kpi('Crédito sem juros', `até ${semJuros}x`, 'Até aqui a loja absorve a taxa; acima o PDV cobra a diferença do cliente')}
        {kpi('PIX / dinheiro', descontoPix > 0.005 ? `até -${pct(descontoPix)}` : '—', 'Desconto possível sem perder margem', VERDE)}
        {kpi('Débito', Math.abs(ajusteDebito) < 0.005 ? '—' : `${ajusteDebito < 0 ? 'até ' : '+'}${pct(ajusteDebito)}`,
          ajusteDebito < 0 ? 'Desconto possível sem perder margem' : 'Acréscimo necessário (taxa do débito maior que a referência)', corAjuste(ajusteDebito))}
      </div>

      <Row gutter={[14, 14]}>
        <Col xs={24} xl={14}>
          {/* 1. Taxas */}
          <Card size="small" style={{ marginBottom: 14 }}
            title={<Space><Tag color="blue" style={{ margin: 0 }}>1</Tag>Taxas da maquininha</Space>}
            extra={(
              <Space wrap>
                <Space.Compact size="small">
                  <InputNumber size="small" min={0} max={49.99} step={0.1} precision={2} decimalSeparator="," addonAfter="%" placeholder="Por venda"
                    style={{ width: 120 }} value={vendaEmLote} onChange={v => setVendaEmLote(v)} />
                  <Button size="small" disabled={vendaEmLote === null}
                    onClick={() => setLinhas(ls => ls.map(l => (['DEBITO', 'CREDITO'].includes(l.forma)
                      ? { ...l, tipoFixa: 'PCT', vendaPercentual: Number(vendaEmLote) || 0, fixa: 0 } : l)))}>
                    no débito e crédito
                  </Button>
                </Space.Compact>
                {formasAusentes.length > 0 && (
                  <Dropdown menu={{ items: formasAusentes.map(f => ({ key: f, label: `${ICONE_FORMA[f]} ${ROTULO_FORMA_TAXA[f]}` })), onClick: ({ key }) => adicionar(key) }}>
                    <Button size="small" icon={<PlusOutlined />}>Forma</Button>
                  </Dropdown>
                )}
              </Space>
            )}>
            {linhas.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma taxa cadastrada: todas as formas contam como 0%.">
                <Button type="primary" onClick={sugestaoInicial}>Começar com valores comuns</Button>
              </Empty>
            ) : (
              <>
                {formasPresentes.map(blocoForma)}
                {lacunas.length > 0 && (
                  <Alert type="warning" showIcon style={{ padding: '4px 10px' }}
                    message={`Crédito sem taxa cadastrada em ${lacunas.join(', ')}: essas parcelas contam como 0%.`} />
                )}
              </>
            )}
          </Card>

          {/* 2. Regras */}
          <Card size="small" title={<Space><Tag color="blue" style={{ margin: 0 }}>2</Tag>Como o preço trata as taxas</Space>}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <div>
                <Space wrap align="center">
                  <Text strong>O preço de tabela já cobre a taxa do</Text>
                  <Select value={formaRef} style={{ width: 130 }} onChange={setFormaRef} options={FORMAS.map(f => ({ value: f, label: ROTULO_FORMA_TAXA[f] }))} />
                  <Text strong>em</Text>
                  <InputNumber min={1} max={36} value={parcelasRef} onChange={v => setParcelasRef(Number(v) || 1)} style={{ width: 70 }} addonAfter="x" />
                  <Tag color="blue" style={{ fontSize: 13 }}>{pct(prev.ref)}</Tag>
                </Space>
                <div><Text type="secondary" style={{ fontSize: 12 }}>
                  O preço é calculado para render a margem depois dessa taxa. Formas com taxa menor permitem desconto; com taxa maior, acréscimo.
                </Text></div>
              </div>
              <div>
                <Space wrap align="center">
                  <Text strong>Crédito sem juros até</Text>
                  <InputNumber min={1} max={36} value={semJuros} onChange={v => setSemJuros(Number(v) || 1)} style={{ width: 70 }} addonAfter="x" />
                </Space>
                <div><Text type="secondary" style={{ fontSize: 12 }}>
                  Até aqui o cliente paga o preço de tabela e a loja absorve a diferença de taxa. Acima disso, o PDV soma o acréscimo.
                  Para anunciar "até {semJuros}x sem juros" sem perder margem, use a mesma quantidade na referência acima.
                </Text></div>
              </div>
              <div>
                <Space align="center">
                  <Switch checked={automatico} onChange={setAutomatico} />
                  <Text strong>Desconto da forma de pagamento sem pedir senha</Text>
                </Space>
                <div><Text type="secondary" style={{ fontSize: 12 }}>
                  No PIX, dinheiro e débito o operador pode dar o desconto que a taxa menor permite. Só o que passar disso cai no limite de desconto (Regras de venda).
                </Text></div>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 3. Simulador */}
        <Col xs={24} xl={10}>
          <Card size="small" style={{ position: 'sticky', top: 90 }}
            title={<Space><Tag color="blue" style={{ margin: 0 }}>3</Tag><CalculatorOutlined /> Simulador</Space>}>
            <Space direction="vertical" style={{ width: '100%' }} size={10}>
              <Segmented block value={modoSimulacao} onChange={v => setModoSimulacao(v as 'TABELA' | 'RECEBER')}
                options={[{ value: 'TABELA', label: 'Tenho o preço de tabela' }, { value: 'RECEBER', label: 'Quero receber' }]} />
              <InputNumber size="large" min={0} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%' }}
                value={valorSimulado} onChange={setValorSimulado} />
              <div style={{ background: '#e6f4ff', borderRadius: 8, padding: '8px 12px' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Preço de tabela</Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}>{brl(precoTabela)}</div>
                {modoSimulacao === 'RECEBER' && (
                  <Text type="secondary" style={{ fontSize: 12 }}>para receber {brl(valor)} no {ROTULO_FORMA_TAXA[formaRef]} {parcelasRef}x</Text>
                )}
              </div>
              <Table
                size="small"
                pagination={false}
                rowKey={r => `${r.forma}-${r.parcelas}`}
                dataSource={linhasSim}
                rowClassName={r => (r.forma === formaRef && r.parcelas === parcelasRef ? 'linha-referencia-taxa' : '')}
                columns={[
                  {
                    title: 'Forma', key: 'f',
                    render: (_, r) => (
                      <div style={{ lineHeight: 1.2 }}>
                        <span>{ICONE_FORMA[r.forma]} {ROTULO_FORMA_TAXA[r.forma]}{r.forma === 'CREDITO' ? ` ${r.parcelas}x` : ''}</span>
                        <div style={{ fontSize: 11 }}>
                          {r.absorveTaxa
                            ? <Text type="secondary" style={{ fontSize: 11 }}>sem juros</Text>
                            : Math.abs(r.ajuste) >= 0.005 && <span style={{ color: corAjuste(r.ajuste) }}>{r.ajuste < 0 ? 'desconto' : 'acréscimo'} {pct(Math.abs(r.ajuste))}</span>}
                        </div>
                      </div>
                    ),
                  },
                  { title: 'Cobrar', dataIndex: 'cobrar', align: 'right' as const, render: (v: number, r) => <b style={{ color: corAjuste(r.ajuste) }}>{brl(v)}</b> },
                  { title: 'Taxa', dataIndex: 'taxaValor', align: 'right' as const, render: (v: number) => (v ? <Text type="danger" style={{ fontSize: 12 }}>-{brl(v)}</Text> : <Text type="secondary">—</Text>) },
                  {
                    title: 'Recebe', dataIndex: 'recebe', align: 'right' as const,
                    render: (v: number, r) => <Text strong style={{ color: r.absorveTaxa ? LARANJA : undefined }}>{brl(v)}</Text>,
                  },
                ]}
              />
              <Space size={[12, 4]} wrap style={{ fontSize: 11 }}>
                <span style={{ color: VERDE }}>■ desconto sem perder margem</span>
                <span style={{ color: LARANJA }}>■ acréscimo / loja absorve</span>
                <span style={{ color: '#1677ff' }}>■ referência do preço</span>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>
      <style>{'.linha-referencia-taxa > td { background: #e6f4ff !important; }'}</style>
    </div>
  );
};

export default TaxasPagamento;
