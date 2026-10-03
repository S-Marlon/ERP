// Vendas › Taxas de pagamento: taxas da maquininha por forma e faixa de parcelas, qual taxa o preço de tabela
// embute, até quantas parcelas a loja absorve e a prévia do desconto/acréscimo de cada forma.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Input, InputNumber, Row, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ConfigTaxas, invalidarTaxas, ROTULO_FORMA_TAXA, TaxaPagamento, taxasApi } from '../../taxas/taxasVenda';
import { carregarTaxaPreco } from '../../../../core/precos/taxaPreco';

const { Text, Title } = Typography;
const FORMAS = ['DEBITO', 'CREDITO', 'PIX', 'DINHEIRO', 'TRANSFERENCIA', 'PRAZO'];
type Linha = TaxaPagamento & { chave: number };

// Mesma conta do servidor, para a prévia enquanto edita
const previa = (linhas: Linha[], formaRef: string, parcelasRef: number) => {
  const taxa = (forma: string, n: number) => linhas.find(l => l.forma === forma && n >= l.parcelasDe && n <= l.parcelasAte)?.percentual || 0;
  const ref = taxa(formaRef, parcelasRef) / 100;
  const ajuste = (forma: string, n: number) => ((1 - ref) / (1 - taxa(forma, n) / 100) - 1) * 100;
  return { ref: ref * 100, ajuste };
};

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

  const aplicar = (c: ConfigTaxas) => {
    setCfg(c);
    setLinhas(c.taxas.map((t, i) => ({ ...t, chave: i + 1 })));
    setFormaRef(c.formaReferencia);
    setParcelasRef(c.parcelasReferencia);
    setSemJuros(c.parcelasSemJuros);
    setAutomatico(c.descontoFormaAutomatico);
  };

  useEffect(() => {
    taxasApi.obter().then(aplicar).catch(e => message.error(e.message));
    fetch('http://localhost:3001/api/vendas/configuracoes').then(r => r.json()).then(r => setTemSenha(Boolean(r.temSenha))).catch(() => undefined);
  }, []);

  const alterar = (chave: number, campo: keyof TaxaPagamento, valor: unknown) =>
    setLinhas(ls => ls.map(l => (l.chave === chave ? { ...l, [campo]: valor } : l)));

  const adicionar = (forma = 'CREDITO') => {
    const daForma = linhas.filter(l => l.forma === forma);
    const de = daForma.length ? Math.max(...daForma.map(l => l.parcelasAte)) + 1 : 1;
    setLinhas(ls => [...ls, { chave: Date.now(), forma, parcelasDe: de, parcelasAte: forma === 'CREDITO' ? de : 1, percentual: 0, fixa: 0, observacao: '' }]);
  };

  const sugestaoInicial = () => setLinhas([
    { chave: 1, forma: 'DEBITO', parcelasDe: 1, parcelasAte: 1, percentual: 1.99, fixa: 0 },
    { chave: 2, forma: 'CREDITO', parcelasDe: 1, parcelasAte: 1, percentual: 4.99, fixa: 0 },
    { chave: 3, forma: 'CREDITO', parcelasDe: 2, parcelasAte: 6, percentual: 6.99, fixa: 0 },
    { chave: 4, forma: 'CREDITO', parcelasDe: 7, parcelasAte: 12, percentual: 9.99, fixa: 0 },
    { chave: 5, forma: 'PIX', parcelasDe: 1, parcelasAte: 1, percentual: 0, fixa: 0 },
  ]);

  const prev = useMemo(() => previa(linhas, formaRef, parcelasRef), [linhas, formaRef, parcelasRef]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await taxasApi.salvar({
        taxas: linhas.map(l => ({ forma: l.forma, parcelasDe: l.parcelasDe, parcelasAte: l.parcelasAte, percentual: l.percentual, fixa: l.fixa, observacao: l.observacao })),
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

  const corAjuste = (v: number) => (Math.abs(v) < 0.005 ? undefined : v < 0 ? '#389e0d' : '#d48806');
  const textoAjuste = (v: number) => (Math.abs(v) < 0.005 ? '—' : `${v < 0 ? '' : '+'}${v.toFixed(2)}%`);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Taxas de pagamento</Title>
          <Text type="secondary">
            Taxas da maquininha por forma e parcelas. Para receber R$ 100 com 5% de taxa é preciso cobrar R$ 105,26 (100 ÷ 0,95):
            o preço de tabela embute a taxa de referência e as outras formas ganham desconto ou acréscimo.
          </Text>
        </div>

        <Row gutter={[14, 14]}>
          <Col xs={24} xl={15}>
            <Card size="small" title="Taxas" extra={<Space>
              {linhas.length === 0 && <Button size="small" onClick={sugestaoInicial}>Preencher exemplo</Button>}
              <Button size="small" icon={<PlusOutlined />} onClick={() => adicionar('CREDITO')}>Faixa</Button>
            </Space>}>
              <Table<Linha>
                size="small"
                rowKey="chave"
                pagination={false}
                dataSource={linhas}
                locale={{ emptyText: 'Nenhuma taxa: todas as formas contam como 0%.' }}
                columns={[
                  {
                    title: 'Forma', dataIndex: 'forma', width: 140,
                    render: (v: string, l) => <Select size="small" value={v} style={{ width: '100%' }} onChange={x => alterar(l.chave, 'forma', x)}
                      options={FORMAS.map(f => ({ value: f, label: ROTULO_FORMA_TAXA[f] }))} />,
                  },
                  {
                    title: 'Parcelas', key: 'p', width: 140,
                    render: (_, l) => (
                      <Space size={4}>
                        <InputNumber size="small" min={1} max={36} value={l.parcelasDe} style={{ width: 55 }} onChange={v => alterar(l.chave, 'parcelasDe', Number(v) || 1)} />
                        <Text type="secondary">a</Text>
                        <InputNumber size="small" min={1} max={36} value={l.parcelasAte} style={{ width: 55 }} onChange={v => alterar(l.chave, 'parcelasAte', Number(v) || 1)} />
                      </Space>
                    ),
                  },
                  {
                    title: 'Taxa', dataIndex: 'percentual', width: 110,
                    render: (v: number, l) => <InputNumber size="small" min={0} max={49.99} step={0.1} precision={2} decimalSeparator="," addonAfter="%" value={v} onChange={x => alterar(l.chave, 'percentual', Number(x) || 0)} />,
                  },
                  {
                    title: 'Fixa', dataIndex: 'fixa', width: 100,
                    render: (v: number, l) => <InputNumber size="small" min={0} precision={2} decimalSeparator="," prefix="R$" value={v} onChange={x => alterar(l.chave, 'fixa', Number(x) || 0)} />,
                  },
                  {
                    title: 'Observação', dataIndex: 'observacao',
                    render: (v: string, l) => <Input size="small" placeholder="Ex.: maquininha X" value={v || ''} maxLength={100} onChange={e => alterar(l.chave, 'observacao', e.target.value)} />,
                  },
                  {
                    title: '', key: 'x', width: 40,
                    render: (_, l) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setLinhas(ls => ls.filter(x => x.chave !== l.chave))} />,
                  },
                ]}
              />
            </Card>

            <Card size="small" title="Como o preço trata as taxas" style={{ marginTop: 14 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  <Text>O preço de tabela já embute a taxa de</Text>
                  <Select size="small" value={formaRef} style={{ width: 130 }} onChange={setFormaRef} options={FORMAS.map(f => ({ value: f, label: ROTULO_FORMA_TAXA[f] }))} />
                  <Text>em</Text>
                  <InputNumber size="small" min={1} max={36} value={parcelasRef} onChange={v => setParcelasRef(Number(v) || 1)} style={{ width: 60 }} />
                  <Text>x</Text>
                  <Tag color="blue">{prev.ref.toFixed(2)}%</Tag>
                </Space>
                <Space wrap>
                  <Text>Crédito sem juros (a loja absorve a taxa) até</Text>
                  <InputNumber size="small" min={1} max={36} value={semJuros} onChange={v => setSemJuros(Number(v) || 1)} style={{ width: 60 }} />
                  <Text>x. Acima disso o PDV cobra a diferença de taxa do cliente.</Text>
                </Space>
                <Space>
                  <Switch checked={automatico} onChange={setAutomatico} />
                  <Text>Desconto da forma de pagamento sem pedir autorização (PIX/débito/dinheiro até o que a taxa permite)</Text>
                </Space>
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={9}>
            <Card size="small" title="Prévia sobre o preço de tabela">
              <Table
                size="small"
                pagination={false}
                rowKey={r => `${r.forma}-${r.parcelas}`}
                dataSource={[
                  ...['DINHEIRO', 'PIX', 'DEBITO'].map(forma => ({ forma, parcelas: 1 })),
                  ...Array.from({ length: 12 }, (_, i) => ({ forma: 'CREDITO', parcelas: i + 1 })),
                ]}
                columns={[
                  { title: 'Forma', key: 'f', render: (_, r) => `${ROTULO_FORMA_TAXA[r.forma]}${r.forma === 'CREDITO' ? ` ${r.parcelas}x` : ''}` },
                  {
                    title: 'Ajuste', key: 'a', align: 'right' as const,
                    render: (_, r) => {
                      const absorve = r.forma === 'CREDITO' && r.parcelas <= semJuros;
                      const v = absorve ? 0 : prev.ajuste(r.forma, r.parcelas);
                      return <Text style={{ color: corAjuste(v) }}>{absorve && prev.ajuste(r.forma, r.parcelas) > 0.005 ? 'loja absorve' : textoAjuste(v)}</Text>;
                    },
                  },
                  {
                    title: 'R$ 100 vira', key: 'v', align: 'right' as const,
                    render: (_, r) => {
                      const absorve = r.forma === 'CREDITO' && r.parcelas <= semJuros;
                      const v = absorve ? 0 : prev.ajuste(r.forma, r.parcelas);
                      return `R$ ${(100 * (1 + v / 100)).toFixed(2)}`;
                    },
                  },
                ]}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>Negativo = desconto permitido sem perder margem; positivo = acréscimo cobrado do cliente.</Text>
            </Card>
          </Col>
        </Row>

        {temSenha && (
          <Space>
            <Text>Senha de autorização:</Text>
            <Input.Password size="small" style={{ width: 200 }} value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoComplete="current-password" />
          </Space>
        )}
        {cfg && cfg.taxas.length === 0 && linhas.length === 0 && (
          <Alert type="info" showIcon message="Cadastre as taxas reais da sua maquininha (o botão Preencher exemplo coloca valores comuns para você ajustar)." />
        )}
        <div><Button type="primary" loading={salvando} onClick={salvar}>Salvar taxas</Button></div>
      </Space>
    </div>
  );
};

export default TaxasPagamento;
