// Formas de venda do item no ML (aba Preço e lucro): unitário e conjuntos (kit c/2, c/10...) lado a lado, com preço,
// por unidade, você recebe, lucro e preço para o alvo de cada um. O que ainda não está no anúncio é simulação; "Vender
// assim" cria a linha (e a unidade do kit no cadastro, se faltar). Em rolamento o preço competitivo costuma ser o de 10.
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Flex, InputNumber, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { LineChartOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, formatarMoeda, FormaDeVenda, FormasDeVenda, ROTULO_STATUS_ML } from './mercadoLivreApi';
import { SITUACAO_LUCRO } from './colunasLucro';
import type { RascunhoItem } from './rascunhoAnuncio';

const { Text } = Typography;
const CHAVE_QUANTIDADES = 'ml-formas-quantidades';
const lerQuantidadesSalvas = () => {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_QUANTIDADES) || 'null'); return Array.isArray(v) && v.length ? v.map(Number) : [1, 2, 10]; }
  catch { return [1, 2, 10]; }
};

interface Props {
  det: AnuncioDetalhe;                                   // com o rascunho aplicado
  idLinha: number;                                       // linha escolhida: mostra as formas do item dela
  rascunhoItens: Record<number, RascunhoItem>;
  onMudarPreco: (idLinha: number, preco: number | null) => void;
  onCriar: (quantidade: number, preco: number | null) => void;
  onAtivar: (idLinha: number, ativo: boolean) => void;
  onAnalisar: (idLinha: number) => void;                 // abre a análise de mercado dessa forma
  ocupado?: boolean;
  embutido?: boolean;                                    // dentro do painel de preço: sem a moldura do cartão
}

const nomeDaForma = (q: number) => (q === 1 ? 'Unitário' : `Kit c/${q}`);

const FormasDeVendaCard: React.FC<Props> = ({ det, idLinha, rascunhoItens, onMudarPreco, onCriar, onAtivar, onAnalisar, ocupado, embutido }) => {
  const linha = det.itens.find(i => i.idLinha === idLinha) || det.itens[0];
  const [quantidades, setQuantidades] = useState<number[]>(lerQuantidadesSalvas);
  const [simulados, setSimulados] = useState<Record<number, number>>({});
  const [nova, setNova] = useState<number | null>(null);
  const [dados, setDados] = useState<FormasDeVenda | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setSimulados({}); }, [linha?.idItem]);
  useEffect(() => { try { localStorage.setItem(CHAVE_QUANTIDADES, JSON.stringify(quantidades)); } catch { /* sem armazenamento */ } }, [quantidades]);

  // preços que valem na conta: os do rascunho (linhas que existem) e os simulados (formas ainda não criadas)
  const precos = useMemo(() => {
    const m: Record<number, number> = { ...simulados };
    for (const l of det.itens.filter(i => i.idItem === linha?.idItem)) {
      const r = rascunhoItens[l.idLinha];
      if (r && 'precoMl' in r) m[l.unidadeMl?.fator ?? 1] = r.precoMl ?? l.precoAnuncio;
    }
    return m;
  }, [simulados, rascunhoItens, det.itens, linha?.idItem]);
  const chavePrecos = JSON.stringify(precos);
  const linhasDoItem = det.itens.filter(i => i.idItem === linha?.idItem).map(i => `${i.idLinha}:${i.linhaAtiva}`).join(',');

  useEffect(() => {
    if (!linha || !det.categoria) return;
    let vale = true;
    const t = window.setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await anunciosApi.formasDeVenda(det.id, linha.idLinha, quantidades, precos);
        if (vale) { setDados(r); setErro(null); }
      } catch (e) {
        if (vale) setErro(e instanceof Error ? e.message : 'Erro ao calcular as formas de venda.');
      } finally {
        if (vale) setCarregando(false);
      }
    }, 350);
    return () => { vale = false; window.clearTimeout(t); };
  }, [det.id, linha?.idLinha, quantidades.join(','), chavePrecos, linhasDoItem, det.categoria?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!linha || !det.categoria) return null;
  const formas = dados?.formas || [];
  const comCusto = formas.filter(f => f.lucroSobreCustoPct !== null);
  const melhorMargem = comCusto.length > 1 ? comCusto.reduce((a, b) => ((b.lucroSobreCustoPct ?? -Infinity) > (a.lucroSobreCustoPct ?? -Infinity) ? b : a)) : null;
  const maisBarato = formas.length > 1 ? formas.reduce((a, b) => (b.porUnidade < a.porUnidade ? b : a)) : null;

  const mudarPreco = (f: FormaDeVenda, v: number | null) => {
    if (f.idLinha) onMudarPreco(f.idLinha, v);
    else setSimulados(s => { const n = { ...s }; if (v && v > 0) n[f.quantidade] = v; else delete n[f.quantidade]; return n; });
  };
  const situacao = (f: FormaDeVenda) => {
    if (!f.idLinha) return <Tag style={{ fontSize: 11 }}>simulação</Tag>;
    if (f.ativo === false) return <Tag style={{ fontSize: 11 }}>desativado</Tag>;
    if (f.mlbId) { const s = ROTULO_STATUS_ML[f.status || '']; return <Tag color={s?.cor || 'green'} style={{ fontSize: 11 }}>{s?.texto || f.status || 'no ML'}</Tag>; }
    return <Tag color="processing" style={{ fontSize: 11 }}>a publicar</Tag>;
  };

  return (
    <Card
      size="small" style={embutido ? { boxShadow: 'none' } : { marginBottom: 16 }} variant={embutido ? 'borderless' : undefined}
      styles={embutido ? { header: { padding: '0 0 4px', minHeight: 0, borderBottom: 0 }, body: { padding: 0 } } : undefined}
      loading={carregando && !dados}
      title={<Space wrap><ShoppingCartOutlined />Formas de venda<Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>{dados?.sku || linha.sku}</Text></Space>}
      extra={(
        <Space size={4}>
          <InputNumber size="small" min={2} max={999} precision={0} placeholder="outra qtd." value={nova ?? undefined} onChange={v => setNova(v)} style={{ width: 96 }} />
          <Button size="small" icon={<PlusOutlined />} disabled={!nova || quantidades.includes(nova)}
            onClick={() => { if (nova) setQuantidades(q => [...q, nova].sort((a, b) => a - b)); setNova(null); }}>Comparar</Button>
        </Space>
      )}
    >
      {erro && <Text type="danger">{erro}</Text>}
      <Table<FormaDeVenda>
        size="small" pagination={false} rowKey="quantidade" dataSource={formas} loading={carregando && !!dados} scroll={{ x: 900 }}
        columns={[
          {
            title: 'Forma', width: 170,
            render: (_, f) => (
              <div style={{ lineHeight: 1.35 }}>
                <Space size={4} wrap><Text strong>{nomeDaForma(f.quantidade)}</Text>{situacao(f)}</Space>
                {f.sku && <div><Text type="secondary" style={{ fontSize: 11 }}>{f.sku}</Text></div>}
                <Space size={4} wrap>
                  {melhorMargem === f && <Tag color="green" style={{ fontSize: 10 }}>melhor margem</Tag>}
                  {maisBarato === f && f.quantidade > 1 && <Tag color="blue" style={{ fontSize: 10 }}>menor por unidade</Tag>}
                </Space>
              </div>
            ),
          },
          {
            title: 'Preço', width: 150,
            render: (_, f) => (
              <div>
                <InputNumber size="small" min={0.01} step={0.5} precision={2} decimalSeparator="," prefix="R$" value={f.preco} style={{ width: 130 }}
                  onChange={v => mudarPreco(f, v === null ? null : Number(v))} />
                <div><Text type="secondary" style={{ fontSize: 11 }}>{formatarMoeda(f.porUnidade)} por unidade</Text></div>
              </div>
            ),
          },
          {
            title: <Tooltip title="O que sobra depois da tarifa do ML e do frete que você paga">Você recebe</Tooltip>, width: 130, align: 'right',
            render: (_, f) => (
              <Tooltip title={<>Tarifa −{formatarMoeda(f.tarifa)}<br />Frete {f.freteDesconhecido ? 'não deu para calcular (falta peso/medidas)' : `−${formatarMoeda(f.frete)}`}</>}>
                <Text>{formatarMoeda(f.recebe)}</Text>{f.freteDesconhecido && <Text type="warning"> *</Text>}
              </Tooltip>
            ),
          },
          {
            title: 'Lucro', width: 160, align: 'right',
            render: (_, f) => {
              const s = SITUACAO_LUCRO[f.nivel];
              return (
                <Tooltip title={s?.dica}>
                  <div>
                    <Text strong type={f.lucro < 0 ? 'danger' : undefined}>{formatarMoeda(f.lucro)}</Text>
                    {f.lucroSobreCustoPct !== null && <Tag color={s?.cor} style={{ marginLeft: 6, marginRight: 0, fontSize: 11 }}>{f.lucroSobreCustoPct.toFixed(1).replace('.', ',')}%</Tag>}
                  </div>
                  {f.quantidade > 1 && <Text type="secondary" style={{ fontSize: 11 }}>{formatarMoeda(f.lucroPorUnidade)} por unidade</Text>}
                </Tooltip>
              );
            },
          },
          {
            title: <Tooltip title={`Menor preço que dá a margem alvo${dados?.alvoPct !== null && dados?.alvoPct !== undefined ? ` (${dados.alvoPct}% sobre o custo)` : ''}`}>Para o alvo</Tooltip>, width: 140, align: 'right',
            render: (_, f) => (f.precoAlvo === null ? <Text type="secondary">—</Text> : (
              <div>
                <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} disabled={Math.abs(f.precoAlvo - f.preco) < 0.005} onClick={() => mudarPreco(f, f.precoAlvo)}>
                  {formatarMoeda(f.precoAlvo)}
                </Button>
                <div><Text type="secondary" style={{ fontSize: 11 }}>{formatarMoeda(f.precoAlvoPorUnidade || 0)} por unidade</Text></div>
              </div>
            )),
          },
          { title: <Tooltip title="Quantos conjuntos dá para vender com o saldo de hoje">Estoque</Tooltip>, width: 80, align: 'right', render: (_, f) => <Text type={f.estoque > 0 ? undefined : 'secondary'}>{f.estoque}</Text> },
          {
            title: '', width: 170,
            render: (_, f) => (f.idLinha ? (
              <Space size={6}>
                <Tooltip title={f.ativo ? (f.mlbId ? 'Desativar (pausa no ML)' : 'Desativar (não publica)') : 'Ativar de novo'}>
                  <Switch size="small" checked={!!f.ativo} disabled={ocupado} onChange={v => onAtivar(f.idLinha!, v)} />
                </Tooltip>
                <Tooltip title="Abrir a análise de preço e mercado desta forma (compara com pacotes de tamanho parecido)">
                  <Button size="small" icon={<LineChartOutlined />} onClick={() => onAnalisar(f.idLinha!)}>Analisar</Button>
                </Tooltip>
              </Space>
            ) : (
              <Tooltip title={f.quantidade > 1 ? `Cria a linha "${nomeDaForma(f.quantidade)}" no anúncio (SKU e título próprios; a unidade do kit entra no cadastro se faltar)` : 'Volta a vender a unidade avulsa'}>
                <Button size="small" type="primary" ghost disabled={ocupado} onClick={() => onCriar(f.quantidade, simulados[f.quantidade] ?? null)}>Vender assim</Button>
              </Tooltip>
            )),
          },
        ]}
      />
      <Flex justify="space-between" wrap gap={8} style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dados?.custoUnidade ? `Custo de uma unidade: ${formatarMoeda(dados.custoUnidade)}. ` : 'Item sem custo no ERP: o lucro fica sem margem. '}
          No kit, custo, peso e frete contam a quantidade. Preço digitado nas formas que já existem vai para as alterações (salve para valer).
        </Text>
        {quantidades.some(q => ![1, 2, 10].includes(q)) && (
          <Button size="small" type="link" onClick={() => setQuantidades([1, 2, 10])}>Voltar a 1 · 2 · 10</Button>
        )}
      </Flex>
    </Card>
  );
};

export default FormasDeVendaCard;
