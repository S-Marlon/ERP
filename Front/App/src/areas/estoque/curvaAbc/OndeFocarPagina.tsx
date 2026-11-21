// Estoque › Onde focar: a curva ABC virando decisão. Categorias em quadrantes, o que divulgar (com desconto que respeita a
// margem mínima e texto pronto para WhatsApp), chamarizes, o que repor e o que não recomprar, quem subiu/caiu, e o PDF do mês.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Flex, Modal, Row, Segmented, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CopyOutlined, PrinterOutlined, ReloadOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { imprimirHtml } from '../../../shared/core/impressao/saida';
import { reservasApi } from '../../financeiro/reservas/reservasApi';
import { CategoriaFoco, htmlRelatorioFoco, ItemPropaganda, ondeFocarApi, Quadrante, QUADRANTES, RelatorioFoco, textoPromocao } from './ondeFocarApi';
import { curvaAbcApi, ItemCurvaTela } from './curvaAbcApi';
import { CategoriaFocoDrawer } from './CategoriaFocoDrawer';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const OndeFocarPagina: React.FC = () => {
  const [r, setR] = useState<RelatorioFoco | null>(null);
  const [dias, setDias] = useState(90);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [texto, setTexto] = useState<string | null>(null);
  // Gaveta da categoria: os produtos vêm da curva ABC do mesmo período (carregada uma vez, na primeira abertura)
  const [categoriaAberta, setCategoriaAberta] = useState<CategoriaFoco | null>(null);
  const [itensCurva, setItensCurva] = useState<ItemCurvaTela[] | null>(null);
  const abrirCategoria = (c: CategoriaFoco) => {
    setCategoriaAberta(c);
    if (!itensCurva) curvaAbcApi.carregar(dias).then(x => setItensCurva(x.itens)).catch(e => message.error(e.message));
  };

  const carregar = async () => {
    setCarregando(true);
    try { const x = await ondeFocarApi.carregar(dias); setR(x); setSelecionados(x.propaganda.slice(0, 6).map(i => i.idItem)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); setItensCurva(null); }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const imprimir = async () => {
    if (!r) return;
    const fundos = await reservasApi.listar().catch(() => null);
    await imprimirHtml(htmlRelatorioFoco(r, fundos));
  };

  if (!r) return <div style={{ padding: 16 }}><Card loading /></div>;
  const porQuadrante = (Object.keys(QUADRANTES) as Quadrante[]).map(q => ({ q, cats: r.categorias.filter(c => c.quadrante === q) }));
  const escolhidos = r.propaganda.filter(i => selecionados.includes(i.idItem));

  return (
    <div style={{ padding: 16 }}>
      <style>{'.linha-categoria:hover { background: rgba(0,0,0,.04); }'}</style>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Onde focar</Title>
            <Text type="secondary">O que proteger, o que divulgar, o que repor e o que parar de comprar.</Text>
          </div>
          <Space wrap>
            <Segmented value={dias} onChange={v => setDias(Number(v))} options={[30, 90, 180, 365].map(d => ({ value: d, label: d === 365 ? '12 meses' : `${d} dias` }))} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
            <Button type="primary" icon={<PrinterOutlined />} onClick={imprimir}>PDF do mês</Button>
          </Space>
        </Flex>
        {r.diasDeHistorico < 60 && (
          <Alert type="info" showIcon title={`Vendas registradas há ${r.diasDeHistorico} dias: "o que vende" ainda muda muito a cada venda. O estoque parado já é confiável.`} />
        )}
        <Row gutter={10}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Faturamento" value={brl0(r.totais.receita)} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Lucro bruto" value={brl0(r.totais.lucro)} suffix={r.totais.receita ? <Text type="secondary" style={{ fontSize: 13 }}>{pct(r.totais.lucro / r.totais.receita)}</Text> : null} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Estoque (custo)" value={brl0(r.totais.estoque)} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Parado (sem venda)" value={brl0(r.totais.parado)} valueStyle={{ color: '#cf1322' }}
            suffix={r.totais.estoque ? <Text type="secondary" style={{ fontSize: 13 }}>{pct(r.totais.parado / r.totais.estoque)}</Text> : null} /></Card></Col>
        </Row>

        <Card size="small" title="Categorias: onde agir">
          <Row gutter={[10, 10]}>
            {porQuadrante.filter(g => g.q !== 'ACOMPANHAR').map(g => (
              <Col key={g.q} xs={24} md={12}>
                <div style={{ border: `1px solid ${QUADRANTES[g.q].cor}55`, borderLeft: `4px solid ${QUADRANTES[g.q].cor}`, borderRadius: 6, padding: '8px 10px', height: '100%' }}>
                  <Text strong style={{ color: QUADRANTES[g.q].cor }}>{QUADRANTES[g.q].titulo}</Text> <Text type="secondary" style={{ fontSize: 12 }}>· {QUADRANTES[g.q].acao}</Text>
                  {g.cats.length === 0 ? <div><Text type="secondary" style={{ fontSize: 12 }}>Nenhuma categoria.</Text></div> : g.cats.map(c => (
                    <Tooltip key={c.categoria} title={`${c.motivo}. Clique para ver os produtos.`}>
                      <Flex justify="space-between" className="linha-categoria" onClick={() => abrirCategoria(c)}
                        style={{ marginTop: 2, fontSize: 13, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>
                        <Text style={{ color: QUADRANTES[g.q].cor }} underline>{c.categoria}</Text>
                        <Text type="secondary">{c.receita ? `${brl0(c.receita)} · ` : ''}margem {pct(c.margem ?? c.margemTabela)}{c.parado ? ` · parado ${brl0(c.parado)}` : ''}</Text>
                      </Flex>
                    </Tooltip>
                  ))}
                </div>
              </Col>
            ))}
          </Row>
          {porQuadrante.find(g => g.q === 'ACOMPANHAR')!.cats.length > 0 && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>Acompanhar:{' '}
              {porQuadrante.find(g => g.q === 'ACOMPANHAR')!.cats.map((c, k) => (
                <React.Fragment key={c.categoria}>{k > 0 && ' · '}<a onClick={() => abrirCategoria(c)}>{c.categoria}</a></React.Fragment>
              ))}</Text>
          )}
        </Card>

        <Card size="small" title={`O que divulgar (${r.propaganda.length})`}
          extra={<Space>
            <Text type="secondary" style={{ fontSize: 12 }}>desconto que mantém a margem mínima de {pct(r.margemMinima)}</Text>
            <Button size="small" icon={<WhatsAppOutlined style={{ color: '#25d366' }} />} disabled={!escolhidos.length} onClick={() => setTexto(textoPromocao(escolhidos))}>Texto da promoção ({escolhidos.length})</Button>
          </Space>}>
          <Table<ItemPropaganda> size="small" rowKey="idItem" pagination={false} dataSource={r.propaganda} scroll={{ y: 360 }}
            rowSelection={{ selectedRowKeys: selecionados, onChange: k => setSelecionados(k as number[]) }}
            locale={{ emptyText: <Empty description="Nenhum parado com margem para promoção." /> }}
            columns={[
              { title: 'Item', key: 'i', render: (_, i) => <><Text strong style={{ fontSize: 13 }}>{i.nome}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{i.sku} · {i.categoria}</Text></div></> },
              { title: 'Parado', key: 'e', width: 130, align: 'right' as const, render: (_, i) => <>{qtd(i.estoque)} {i.unidade}<div><Text type="secondary" style={{ fontSize: 11 }}>{brl0(i.valorEstoque)}</Text></div></> },
              { title: 'Margem', dataIndex: 'margemTabela', width: 75, align: 'right' as const, render: (v: number) => pct(v) },
              { title: 'Preço', dataIndex: 'preco', width: 95, align: 'right' as const, render: (v: number) => brl(v) },
              { title: <Tooltip title="Até 15%, sem passar do máximo">Promoção</Tooltip>, key: 'p', width: 120, align: 'right' as const, render: (_, i) => <><Text strong>{brl(i.precoPromocao)}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>−{pct(i.descontoSugerido)}</Text></div></> },
              { title: <Tooltip title="Maior desconto que ainda deixa a margem mínima">Desc. máx.</Tooltip>, dataIndex: 'descontoMaximo', width: 85, align: 'right' as const, render: (v: number) => <Tag color="blue">{pct(v)}</Tag> },
            ]} />
          {r.chamarizes.length > 0 && <Text style={{ display: 'block', marginTop: 8 }}><b>Chamarizes</b> <Text type="secondary">(vendem sempre: vitrine e anúncio)</Text>: {r.chamarizes.map(c => c.nome).join(' · ')}</Text>}
        </Card>

        <Row gutter={10}>
          <Col xs={24} lg={12}>
            <Card size="small" title={`Repor (${r.repor.length})`} extra={<Text type="secondary" style={{ fontSize: 12 }}>vende (A/B) e está acabando</Text>} style={{ height: '100%' }}>
              <Table size="small" rowKey="idItem" pagination={false} dataSource={r.repor} scroll={{ y: 300 }} locale={{ emptyText: 'Nada urgente.' }} columns={[
                { title: 'Item', key: 'i', render: (_, i: any) => <><Tag style={{ margin: 0 }}>{i.classe}</Tag> {i.nome}</> },
                { title: 'Estoque', key: 'e', width: 90, align: 'right' as const, render: (_, i: any) => `${qtd(i.estoque)} ${i.unidade || ''}` },
                { title: 'Dura', dataIndex: 'coberturaDias', width: 90, align: 'right' as const, render: (v: number | null) => (v === null || v === 0 ? <Text type="danger">sem estoque</Text> : `${v} dias`) },
              ]} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title={`Não recomprar (${r.naoRecomprar.length})`} extra={<Text type="secondary" style={{ fontSize: 12 }}>parado ou estoque para muito tempo</Text>} style={{ height: '100%' }}>
              <Table size="small" rowKey="idItem" pagination={false} dataSource={r.naoRecomprar} scroll={{ y: 300 }} columns={[
                { title: 'Item', dataIndex: 'nome' },
                { title: 'Estoque', dataIndex: 'valorEstoque', width: 100, align: 'right' as const, render: (v: number) => brl0(v) },
                { title: '', dataIndex: 'motivo', width: 140, render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
              ]} />
            </Card>
          </Col>
        </Row>

        <Card size="small" title="Evolução">
          {r.evolucao.mesAnterior ? (
            <Space direction="vertical">
              <Text><Text type="success" strong>Subiram para A:</Text> {r.evolucao.subiram.map(x => x.nome).join(' · ') || '—'}</Text>
              <Text><Text type="danger" strong>Caíram de A:</Text> {r.evolucao.cairam.map(x => `${x.nome} (${x.para})`).join(' · ') || '—'}</Text>
            </Space>
          ) : <Text type="secondary">A primeira foto da curva foi tirada este mês; a comparação aparece a partir do mês que vem.</Text>}
        </Card>
      </Space>

      <CategoriaFocoDrawer categoria={categoriaAberta} itens={itensCurva} margemMinima={r.margemMinima}
        onFechar={() => setCategoriaAberta(null)} onPrecoMudou={() => { setItensCurva(null); curvaAbcApi.carregar(dias).then(x => setItensCurva(x.itens)).catch(() => undefined); }} />
      <Modal open={texto !== null} title="Texto da promoção" onCancel={() => setTexto(null)} footer={<Space>
        <Button icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(texto || '').then(() => message.success('Texto copiado.')).catch(() => message.error('O navegador não deixou copiar.'))}>Copiar</Button>
        <Button type="primary" icon={<WhatsAppOutlined />} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(texto || '')}`, '_blank')}>Abrir no WhatsApp</Button>
      </Space>}>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, background: '#f6f6f6', padding: 10, borderRadius: 6 }}>{texto}</pre>
        <Text type="secondary" style={{ fontSize: 12 }}>Os preços de promoção não mudam o cadastro: lance o desconto no PDV ou crie a promoção no ML.</Text>
      </Modal>
    </div>
  );
};

export default OndeFocarPagina;
