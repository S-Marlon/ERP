// Estoque › Curva ABC: três curvas (venda, lucro, estoque parado), frequência XYZ, parados (P) e novos (N), a curva dentro
// da categoria e o que fazer com cada item. A troca de curva/filtro é toda no navegador (cópia da regra em curvaAbc.ts).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Flex, Input, Progress, Row, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { baixarArquivo } from '../../../shared/core/impressao/saida';
import { ClasseExibida, classeExibida, Curva, resumir } from './curvaAbc';
import { AJUDA_CLASSE, AJUDA_XYZ, COR_CLASSE, csvCurva, curvaAbcApi, ItemCurvaTela, RespostaCurva, ROTULO_CLASSE } from './curvaAbcApi';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const brl2 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const dataBr = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—');

const ROTULO_CURVA: Record<Curva, { titulo: string; ajuda: string; valor: string }> = {
  VENDA: { titulo: 'Venda', ajuda: 'O que traz dinheiro: faturamento no período (devoluções descontadas)', valor: 'Faturamento' },
  LUCRO: { titulo: 'Lucro', ajuda: 'O que dá resultado: venda menos custo no período', valor: 'Lucro' },
  ESTOQUE: { titulo: 'Estoque', ajuda: 'Onde está o dinheiro: valor do estoque de hoje pelo custo', valor: 'Valor em estoque' },
};

const Selo: React.FC<{ c: ClasseExibida | null | undefined; pequeno?: boolean }> = ({ c, pequeno }) => (c
  ? <Tooltip title={AJUDA_CLASSE[c]}><Tag color={COR_CLASSE[c]} style={{ margin: 0, minWidth: pequeno ? 20 : 26, textAlign: 'center', fontWeight: 600, fontSize: pequeno ? 10 : 12 }}>
      {c === 'P' || c === 'N' ? c : c}</Tag></Tooltip>
  : <Text type="secondary">—</Text>);

const CurvaAbc: React.FC = () => {
  const [dados, setDados] = useState<RespostaCurva | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [dias, setDias] = useState(90);
  const [curva, setCurva] = useState<Curva>('VENDA');
  const [classe, setClasse] = useState<ClasseExibida | null>(null);
  const [xyz, setXyz] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [soComRecomendacao, setSoComRecomendacao] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try { setDados(await curvaAbcApi.carregar(dias)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const daCategoria = useMemo(() => (dados?.itens || []).filter(i => !categoria || (i.categoriaTopoNome || 'Sem categoria') === categoria), [dados, categoria]);
  const resumo = useMemo(() => resumir(daCategoria, curva), [daCategoria, curva]);
  const categorias = useMemo(() => [...new Set((dados?.itens || []).map(i => i.categoriaTopoNome || 'Sem categoria'))].sort(), [dados]);
  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const valor = (i: ItemCurvaTela) => (curva === 'VENDA' ? i.receita : curva === 'LUCRO' ? i.lucro : i.valorEstoque);
    return daCategoria
      .filter(i => !classe || classeExibida(i, curva) === classe)
      .filter(i => !xyz || `${classeExibida(i, curva)}${i.xyz}` === xyz)
      .filter(i => !soComRecomendacao || i.recomendacao)
      .filter(i => !t || `${i.sku} ${i.nome}`.toLowerCase().includes(t))
      .sort((a, b) => (classe === 'P' ? b.valorEstoque - a.valorEstoque : valor(b) - valor(a)) || b.valorEstoque - a.valorEstoque);
  }, [daCategoria, curva, classe, xyz, busca, soComRecomendacao]);

  if (!dados) return <div style={{ padding: 16 }}><Card loading /></div>;
  const historicoCurto = dados.diasDeHistorico < dias;
  const mudarCurva = (c: Curva) => { setCurva(c); setXyz(null); if (c === 'ESTOQUE' && (classe === 'P' || classe === 'N')) setClasse(null); };

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Curva ABC</Title>
            <Text type="secondary">Quais itens pesam mais em venda, lucro e dinheiro parado, e o que fazer com cada um.</Text>
          </div>
          <Space wrap>
            <Segmented value={dias} onChange={v => setDias(Number(v))} options={[30, 90, 180, 365].map(d => ({ value: d, label: d === 365 ? '12 meses' : `${d} dias` }))} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
          </Space>
        </Flex>

        {historicoCurto && (
          <Alert type="info" showIcon title={`O ERP registra vendas desde ${dataBr(dados.historicoDesde)} (${dados.diasDeHistorico} dias): a curva de venda e de lucro ainda muda bastante a cada venda.`}
            description="A curva de estoque e os parados (P) já são confiáveis. O ritmo de venda (cobertura, frequência) usa os dias de histórico que existem." />
        )}

        <Flex gap={8} wrap align="center">
          <Segmented value={curva} onChange={v => mudarCurva(v as Curva)}
            options={(Object.keys(ROTULO_CURVA) as Curva[]).map(c => ({ value: c, label: <Tooltip title={ROTULO_CURVA[c].ajuda}>{ROTULO_CURVA[c].titulo}</Tooltip> }))} />
          <Select style={{ minWidth: 240 }} allowClear placeholder="Todas as categorias" value={categoria} onChange={v => { setCategoria(v ?? null); setXyz(null); }}
            options={categorias.map(c => ({ value: c, label: c }))} />
          <Input.Search allowClear placeholder="Código ou nome" style={{ width: 220 }} value={busca} onChange={e => setBusca(e.target.value)} />
          <Space size={4}><Switch size="small" checked={soComRecomendacao} onChange={setSoComRecomendacao} /><Text>só com recomendação</Text></Space>
        </Flex>

        <Row gutter={[10, 10]}>
          {resumo.porClasse.filter(c => c.itens > 0).map(c => {
            const ativo = classe === c.classe;
            return (
              <Col key={c.classe} xs={12} sm={8} lg={4}>
                <Card size="small" hoverable onClick={() => { setClasse(ativo ? null : c.classe); setXyz(null); }}
                  style={{ borderColor: ativo ? COR_CLASSE[c.classe] : undefined, borderWidth: ativo ? 2 : 1, height: '100%' }}>
                  <Flex justify="space-between" align="center">
                    <Tooltip title={AJUDA_CLASSE[c.classe]}><Text strong style={{ color: COR_CLASSE[c.classe], fontSize: 15 }}>{ROTULO_CLASSE[c.classe]}</Text></Tooltip>
                    <Text type="secondary">{c.itens} {c.itens === 1 ? 'item' : 'itens'}</Text>
                  </Flex>
                  <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{brl(c.classe === 'P' ? c.valorEstoque : c.valor)}</div>
                  {c.pctValor !== null
                    ? <Progress percent={Math.round(c.pctValor * 100)} size="small" strokeColor={COR_CLASSE[c.classe]} format={p => `${p}%`} />
                    : <Text type="secondary" style={{ fontSize: 11 }}>{c.classe === 'P' ? 'em estoque sem vender' : c.classe === 'N' ? 'aguardando histórico' : ''}</Text>}
                </Card>
              </Col>
            );
          })}
        </Row>

        <Row gutter={10}>
          <Col xs={24} lg={9}>
            <Card size="small" title={<Tooltip title="Classe × frequência de venda. Clique para filtrar.">Matriz ABC × frequência</Tooltip>} style={{ height: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4, textAlign: 'center' }}>
                <thead><tr><th />{['X', 'Y', 'Z'].map(f => <th key={f}><Tooltip title={AJUDA_XYZ[f]}><Text strong>{f}</Text></Tooltip></th>)}</tr></thead>
                <tbody>
                  {(['A', 'B', 'C'] as const).map(c => (
                    <tr key={c}>
                      <td><Selo c={c} /></td>
                      {['X', 'Y', 'Z'].map(f => {
                        const k = `${c}${f}`;
                        const nItens = resumo.matriz[k] || 0;
                        const ativo = xyz === k;
                        return (
                          <td key={k} onClick={() => nItens && (setXyz(ativo ? null : k), setClasse(null))}
                            style={{ padding: '8px 4px', borderRadius: 6, cursor: nItens ? 'pointer' : 'default', fontWeight: 600,
                              background: ativo ? COR_CLASSE[c] : nItens ? `${COR_CLASSE[c]}1f` : '#fafafa', color: ativo ? '#fff' : nItens ? undefined : '#ccc' }}>
                            {nItens}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <Text type="secondary" style={{ fontSize: 11 }}>AX: nunca pode faltar · AZ: venda pontual, não estocar demais · C: muitos itens, pouco peso.</Text>
            </Card>
          </Col>
          <Col xs={24} lg={15}>
            <Card size="small" title="Leitura rápida" style={{ height: '100%' }}>
              <Space direction="vertical" size={4}>
                {(() => {
                  const r = resumir(daCategoria, 'VENDA');
                  const p = resumir(daCategoria, 'ESTOQUE');
                  const a = r.porClasse.find(x => x.classe === 'A')!;
                  const parados = r.porClasse.find(x => x.classe === 'P')!;
                  const vendidos = daCategoria.filter(i => i.situacao === 'NORMAL').length;
                  const contagem = (txt: string) => daCategoria.filter(i => i.recomendacao?.startsWith(txt)).length;
                  return <>
                    <Text>• <b>{a.itens}</b> {a.itens === 1 ? 'item faz' : 'itens fazem'} {pct(a.pctValor)} do faturamento ({brl(a.valor)}) de {vendidos} que venderam.</Text>
                    <Text>• <b>{parados.itens}</b> itens parados somam <b style={{ color: COR_CLASSE.P }}>{brl(parados.valorEstoque)}</b> ({pct(p.total ? parados.valorEstoque / p.total : null)} do estoque de {brl(p.total)}).</Text>
                    {contagem('Sem estoque') + contagem('Pode faltar') > 0 && <Text>• <b>{contagem('Sem estoque') + contagem('Pode faltar')}</b> itens que vendem bem estão sem estoque ou perto de acabar.</Text>}
                    {contagem('Vende muito e lucra pouco') + contagem('Vendendo com prejuízo') > 0 && <Text>• <b>{contagem('Vende muito e lucra pouco') + contagem('Vendendo com prejuízo')}</b> itens com preço para revisar (margem baixa ou prejuízo).</Text>}
                    {contagem('Estoque para') > 0 && <Text>• <b>{contagem('Estoque para')}</b> itens com estoque para muito mais tempo que o normal: comprar menos.</Text>}
                  </>;
                })()}
              </Space>
            </Card>
          </Col>
        </Row>

        <Card size="small" title={`${visiveis.length} itens${classe ? ` · ${ROTULO_CLASSE[classe]}` : ''}${xyz ? ` · ${xyz}` : ''}`}
          extra={<Button size="small" icon={<DownloadOutlined />} onClick={() => baixarArquivo(csvCurva(visiveis, i => classeExibida(i, curva)), `curva-abc-${curva.toLowerCase()}-${dias}d.csv`, 'text/csv;charset=utf-8')}>Planilha</Button>}>
          <Table<ItemCurvaTela> size="small" rowKey="idItem" dataSource={visiveis} pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty description="Nenhum item neste filtro." /> }} scroll={{ x: 1100 }}
            columns={[
              { title: '', key: 'c', width: 50, fixed: 'left', render: (_, i) => <Selo c={classeExibida(i, curva)} /> },
              {
                title: 'Item', key: 'i', fixed: 'left', width: 300, render: (_, i) => <>
                  <Text strong style={{ fontSize: 13 }}>{i.nome}</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>{i.sku} · {i.categoria || 'sem categoria'}</Text></div>
                </>,
              },
              {
                title: <Tooltip title="Classe em cada curva: venda · lucro · estoque · frequência · venda dentro da categoria">Curvas</Tooltip>, key: 'cs', width: 170,
                render: (_, i) => <Space size={2}>
                  <Tooltip title="Venda"><span><Selo pequeno c={classeExibida(i, 'VENDA')} /></span></Tooltip>
                  <Tooltip title="Lucro"><span><Selo pequeno c={classeExibida(i, 'LUCRO')} /></span></Tooltip>
                  <Tooltip title="Estoque"><span><Selo pequeno c={classeExibida(i, 'ESTOQUE')} /></span></Tooltip>
                  {i.xyz && <Tooltip title={AJUDA_XYZ[i.xyz]}><Tag style={{ margin: 0, fontSize: 10 }}>{i.xyz}</Tag></Tooltip>}
                  {i.vendaNaCategoria && <Tooltip title={`Na categoria ${i.categoriaTopoNome || ''}: ${i.vendaNaCategoria}`}><Tag style={{ margin: 0, fontSize: 10 }} bordered={false}>cat {i.vendaNaCategoria}</Tag></Tooltip>}
                </Space>,
              },
              { title: 'Faturamento', dataIndex: 'receita', width: 110, align: 'right' as const, sorter: (a, b) => a.receita - b.receita, render: (v: number) => (v ? brl2(v) : '—') },
              {
                title: 'Lucro', dataIndex: 'lucro', width: 120, align: 'right' as const, sorter: (a, b) => a.lucro - b.lucro,
                render: (v: number, i) => (i.receita ? <><Text type={v < 0 ? 'danger' : undefined}>{brl2(v)}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{pct(i.margem)}</Text></div></> : '—'),
              },
              { title: 'Vendas', key: 'v', width: 90, align: 'right' as const, sorter: (a, b) => a.vendas - b.vendas, render: (_, i) => (i.vendas ? <>{i.vendas}× <div><Text type="secondary" style={{ fontSize: 11 }}>{qtd(i.quantidade)} {i.unidade}</Text></div></> : '—') },
              {
                title: 'Estoque', key: 'e', width: 120, align: 'right' as const, sorter: (a, b) => a.valorEstoque - b.valorEstoque,
                render: (_, i) => <>{qtd(i.estoque)} {i.unidade}<div><Text type="secondary" style={{ fontSize: 11 }}>{brl(i.valorEstoque)}</Text></div></>,
              },
              {
                title: <Tooltip title="Quantos dias o estoque dura no ritmo de venda do período">Cobertura</Tooltip>, dataIndex: 'coberturaDias', width: 95, align: 'right' as const,
                sorter: (a, b) => (a.coberturaDias ?? 99999) - (b.coberturaDias ?? 99999),
                render: (v: number | null) => (v === null ? '—' : <Text type={v < 15 ? 'danger' : undefined}>{v.toLocaleString('pt-BR')} d</Text>),
              },
              { title: 'Última venda', dataIndex: 'ultimaVenda', width: 100, render: (v: string | null) => dataBr(v) },
              { title: 'O que fazer', dataIndex: 'recomendacao', width: 280, render: (v: string | null) => (v ? <Text style={{ fontSize: 12 }}>{v}</Text> : '') },
            ]} />
        </Card>
      </Space>
    </div>
  );
};

export default CurvaAbc;
