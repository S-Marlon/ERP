// Painel de Compras: o que comprar (abaixo do mínimo, lista de compras), notas em conferência, compras do mês,
// principais fornecedores e custos que subiram. Tudo com dados reais; os atalhos levam às telas de trabalho.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Empty, Row, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  AlertOutlined, ArrowRightOutlined, BarChartOutlined, DiffOutlined, FileDoneOutlined, FileTextOutlined,
  ReloadOutlined, RiseOutlined, ShoppingCartOutlined, SolutionOutlined, TeamOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { listarNotas, NotaEntrada, SITUACOES_NOTA } from './NotasEntrada/notasEntradaApi';
import { getFornecedores } from './FornecedoresList/fornecedores.api';
import { getSaldos, ResumoSaldos, SaldoItem } from '../Estoque/api/estoqueItensApi';
import { useListaTrabalho } from '../../core/listaTrabalho/ListaTrabalhoContext';
import { API_URL } from '../../shared/api/config';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const inicioMes = (deslocamento = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + deslocamento); return d; };

const getCustosDefasados = async (): Promise<number | null> => {
  const r = await fetch(`${API_URL}/api/catalogo/precos/painel?tenant_id=1&limit=1`);
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  return d?.resumo?.porSituacao?.CUSTO_DEFASADO ?? null;
};

export default function ComprasDashboard() {
  const navigate = useNavigate();
  const lista = useListaTrabalho();
  const [carregando, setCarregando] = useState(false);
  const [notas90, setNotas90] = useState<NotaEntrada[]>([]);
  const [reposicao, setReposicao] = useState<{ resumo: ResumoSaldos; itens: SaldoItem[] } | null>(null);
  const [fornecedores, setFornecedores] = useState<number | null>(null);
  const [custosDefasados, setCustosDefasados] = useState<number | null>(null);

  const carregar = async () => {
    setCarregando(true);
    const noventaDias = new Date(Date.now() - 90 * 86400000);
    const [n, s, f, c] = await Promise.allSettled([
      listarNotas({ de: isoDia(noventaDias) }),
      getSaldos({ deposito: 'VENDA', situacao: 'ABAIXO_MINIMO', page: 1, limit: 8 }),
      getFornecedores(1),
      getCustosDefasados(),
    ]);
    if (n.status === 'fulfilled') setNotas90(n.value.data); else message.error(n.reason?.message || 'Erro ao carregar as notas.');
    if (s.status === 'fulfilled') setReposicao({ resumo: s.value.resumo, itens: s.value.data });
    if (f.status === 'fulfilled') setFornecedores(Array.isArray(f.value) ? f.value.length : null);
    if (c.status === 'fulfilled') setCustosDefasados(c.value);
    setCarregando(false);
  };
  useEffect(() => { carregar(); }, []);

  // Compras (notas com entrada) no mês atual x mês anterior, pela data de entrada no sistema
  const compras = useMemo(() => {
    const atual = inicioMes(0).getTime();
    const anterior = inicioMes(-1).getTime();
    const importadas = notas90.filter(x => x.situacao === 'IMPORTADA');
    const valor = (de: number, ate: number) => importadas
      .filter(x => { const t = new Date(x.entradaEm).getTime(); return t >= de && t < ate; })
      .reduce((a, x) => a + x.valorNf + (x.freteAdicional || 0), 0);
    const mes = valor(atual, Infinity);
    const mesAnterior = valor(anterior, atual);
    return {
      mes,
      mesAnterior,
      notasMes: importadas.filter(x => new Date(x.entradaEm).getTime() >= atual).length,
      variacao: mesAnterior > 0 ? Math.round(((mes - mesAnterior) / mesAnterior) * 100) : null,
    };
  }, [notas90]);

  const emConferencia = notas90.filter(x => x.situacao === 'EM_CONFERENCIA' || x.situacao === 'PRONTA');
  const prontas = notas90.filter(x => x.situacao === 'PRONTA').length;

  // Principais fornecedores dos últimos 90 dias (valor das notas com entrada)
  const topFornecedores = useMemo(() => {
    const mapa = new Map<string, { nome: string; notas: number; valor: number }>();
    for (const x of notas90.filter(n => n.situacao === 'IMPORTADA')) {
      const chave = x.cnpj || x.fornecedor;
      const atual = mapa.get(chave) || { nome: x.fantasia || x.fornecedor, notas: 0, valor: 0 };
      atual.notas++;
      atual.valor += x.valorNf;
      mapa.set(chave, atual);
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [notas90]);

  const paraComprar = lista.comTag('COMPRAR');
  const abaixoMinimo = reposicao?.resumo.abaixoMinimo ?? null;

  const indicador = (titulo: string, valor: React.ReactNode, rodape: React.ReactNode, onClick?: () => void, cor?: string) => (
    <Card size="small" hoverable={Boolean(onClick)} onClick={onClick} style={{ height: '100%' }} styles={{ body: { padding: '10px 14px' } }}>
      <Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.25, color: cor }}>{valor}</div>
      <div style={{ fontSize: 12, marginTop: 2 }}>{rodape}</div>
    </Card>
  );

  const atalhos = [
    { titulo: 'Entrada de NF-e', descricao: 'Importar o XML, conferir, vincular ou cadastrar itens e dar entrada.', rota: '/compras/entrada-nfe', icone: <FileTextOutlined />, principal: true },
    { titulo: 'Notas de Entrada', descricao: 'Histórico das notas, alertas de entrada errada e correção.', rota: '/compras/notas', icone: <FileDoneOutlined /> },
    { titulo: 'Aprovação (Staging)', descricao: 'Lotes em conferência e aprovação da entrada no estoque.', rota: '/stagings', icone: <DiffOutlined /> },
    { titulo: 'Fornecedores', descricao: 'Cadastro de fornecedores (PJ/PF), contatos e endereços.', rota: '/compras/fornecedores', icone: <TeamOutlined /> },
    { titulo: 'Lista de compras', descricao: 'Montar e exportar a lista de itens para pedir ao fornecedor.', rota: '/compras/ListaCompras', icone: <UnorderedListOutlined /> },
    { titulo: 'Faturado / boletos', descricao: 'Emissão de boletos das compras faturadas.', rota: '/compras/Faturamento', icone: <SolutionOutlined /> },
  ];

  const roadmap = [
    { titulo: 'Pedido de compra', descricao: 'Pedido ao fornecedor a partir da lista de compras, conferido contra a NF na entrada.' },
    { titulo: 'Cotação', descricao: 'Comparar preço e prazo de vários fornecedores para os mesmos itens.' },
    { titulo: 'Lead time e ruptura', descricao: 'Prazo de entrega por fornecedor e alerta antes de o item acabar.' },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Compras</Title>
            <Text type="secondary">O que repor, notas em conferência e o que foi comprado.</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
            <Button type="primary" icon={<FileTextOutlined />} onClick={() => navigate('/compras/entrada-nfe')}>Dar entrada em NF-e</Button>
          </Space>
        </div>

        {/* Indicadores */}
        <Row gutter={[10, 10]}>
          <Col xs={12} lg={6}>
            {indicador('Compras no mês', brl(compras.mes), (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {compras.notasMes} nota(s)
                {compras.variacao !== null && (
                  <> · <span style={{ color: compras.variacao > 0 ? '#cf1322' : '#389e0d' }}>{compras.variacao > 0 ? '+' : ''}{compras.variacao}%</span> vs mês anterior</>
                )}
              </Text>
            ), () => navigate('/compras/notas'))}
          </Col>
          <Col xs={12} lg={6}>
            {indicador('Notas em conferência', emConferencia.length, (
              <Text type="secondary" style={{ fontSize: 11 }}>{prontas > 0 ? `${prontas} pronta(s) para aprovar` : 'aguardando conferência'}</Text>
            ), () => navigate('/compras/notas'), emConferencia.length ? '#1677ff' : undefined)}
          </Col>
          <Col xs={12} lg={6}>
            {indicador('Abaixo do mínimo', abaixoMinimo ?? '—', reposicao && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {reposicao.resumo.zerados} zerado(s) · {reposicao.resumo.negativos} negativo(s) no depósito Venda
              </Text>
            ), () => navigate('/estoque/consulta'), abaixoMinimo ? '#d48806' : '#389e0d')}
          </Col>
          <Col xs={12} lg={6}>
            {indicador('Custos que mudaram', custosDefasados ?? '—', (
              <Text type="secondary" style={{ fontSize: 11 }}>itens com custo diferente do usado no preço</Text>
            ), () => navigate('/catalogo/preco'), custosDefasados ? '#d48806' : undefined)}
          </Col>
        </Row>

        <Row gutter={[14, 14]}>
          {/* O que comprar */}
          <Col xs={24} xl={14}>
            <Card
              size="small"
              title={<Space><ShoppingCartOutlined /> O que comprar</Space>}
              extra={<Button size="small" type="link" onClick={() => navigate('/estoque/consulta')}>Ver estoque <ArrowRightOutlined /></Button>}
              style={{ height: '100%' }}
            >
              {paraComprar.length > 0 && (
                <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12 }}>
                  <AlertOutlined style={{ color: '#d46b08' }} /> <b>{paraComprar.length}</b> item(ns) marcado(s) como <Tag color="orange" style={{ margin: 0 }}>Comprar</Tag> na lista de trabalho:{' '}
                  {paraComprar.slice(0, 4).map(i => i.sku).join(', ')}{paraComprar.length > 4 ? '…' : ''}
                </div>
              )}
              <Table<SaldoItem>
                size="small"
                rowKey="idItem"
                pagination={false}
                dataSource={reposicao?.itens || []}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item abaixo do mínimo" /> }}
                columns={[
                  {
                    title: 'Item', key: 'item',
                    render: (_, i) => (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{i.nome}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}</Text>
                      </div>
                    ),
                  },
                  { title: 'Saldo', key: 's', width: 90, align: 'right' as const, render: (_, i) => `${qtd(i.quantidade)} ${i.unidade || ''}` },
                  { title: 'Mínimo', key: 'm', width: 80, align: 'right' as const, render: (_, i) => qtd(i.minimo || 0) },
                  {
                    title: <Tooltip title="Quanto falta para chegar ao máximo (ou ao mínimo, se não houver máximo)">Repor</Tooltip>,
                    key: 'r', width: 80, align: 'right' as const, render: (_, i) => <b style={{ color: '#d46b08' }}>{qtd(i.sugestaoReposicao)}</b>,
                  },
                  {
                    title: '', key: 'acao', width: 90,
                    render: (_, i) => lista.temItem(i.idItem, 'COMPRAR')
                      ? <Tag color="orange" style={{ margin: 0 }}>na lista</Tag>
                      : (
                        <Button size="small" type="link" onClick={() => lista.adicionar(
                          { idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade || undefined },
                          { tags: ['COMPRAR'], quantidade: i.sugestaoReposicao || undefined, origem: 'Compras' }
                        )}>
                          + Comprar
                        </Button>
                      ),
                  },
                ]}
              />
              {(abaixoMinimo || 0) > (reposicao?.itens.length || 0) && (
                <Text type="secondary" style={{ fontSize: 11 }}>Mostrando {reposicao?.itens.length} de {abaixoMinimo}. Veja todos na consulta de estoque (filtro Abaixo do mínimo).</Text>
              )}
            </Card>
          </Col>

          {/* Notas em conferência + fornecedores */}
          <Col xs={24} xl={10}>
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Card
                size="small"
                title={<Space><FileTextOutlined /> Notas em conferência</Space>}
                extra={<Button size="small" type="link" onClick={() => navigate('/compras/notas')}>Todas <ArrowRightOutlined /></Button>}
              >
                {emConferencia.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>Nenhuma nota aguardando.</Text> : (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {emConferencia.slice(0, 5).map(x => (
                      <div key={x.idLote} onClick={() => navigate(`/compras/entrada-nfe?lote=${x.idLote}`)}
                        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <b>NF {x.numero}</b> · {x.fantasia || x.fornecedor}
                        </span>
                        <Space size={4}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{x.conferidos}/{x.totalItens}</Text>
                          <Tag color={SITUACOES_NOTA[x.situacao]?.color} style={{ margin: 0 }}>{SITUACOES_NOTA[x.situacao]?.label}</Tag>
                        </Space>
                      </div>
                    ))}
                  </Space>
                )}
              </Card>

              <Card
                size="small"
                title={<Space><BarChartOutlined /> Principais fornecedores (90 dias)</Space>}
                extra={<Text type="secondary" style={{ fontSize: 11 }}>{fornecedores !== null ? `${fornecedores} cadastrados` : ''}</Text>}
              >
                {topFornecedores.length === 0 ? <Text type="secondary" style={{ fontSize: 12 }}>Sem compras nos últimos 90 dias.</Text> : (
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    {topFornecedores.map((f, i) => {
                      const maior = topFornecedores[0].valor || 1;
                      return (
                        <div key={f.nome}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span><b>{i + 1}.</b> {f.nome} <Text type="secondary" style={{ fontSize: 11 }}>({f.notas} nota{f.notas > 1 ? 's' : ''})</Text></span>
                            <b>{brl(f.valor)}</b>
                          </div>
                          <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, marginTop: 2 }}>
                            <div style={{ width: `${(f.valor / maior) * 100}%`, height: 4, background: '#1677ff', borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </Space>
                )}
              </Card>
            </Space>
          </Col>
        </Row>

        {/* Atalhos */}
        <div>
          <Text strong style={{ fontSize: 15 }}>Telas de compras</Text>
          <Row gutter={[10, 10]} style={{ marginTop: 6 }}>
            {atalhos.map(a => (
              <Col key={a.titulo} xs={24} md={12} xl={8}>
                <Card size="small" hoverable onClick={() => navigate(a.rota)} style={{ height: '100%', borderColor: a.principal ? '#91caff' : undefined }}
                  styles={{ body: { padding: '10px 12px' } }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ fontSize: 20, color: '#1677ff', lineHeight: 1 }}>{a.icone}</div>
                    <div>
                      <Text strong>{a.titulo}</Text>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{a.descricao}</Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* Próximos passos */}
        <div>
          <Text strong style={{ fontSize: 15 }}>Próximos passos</Text>
          <Row gutter={[10, 10]} style={{ marginTop: 6 }}>
            {roadmap.map(r => (
              <Col key={r.titulo} xs={24} md={8}>
                <div style={{ border: '1px dashed #d9d9d9', borderRadius: 8, padding: '8px 12px', height: '100%', background: '#fcfcfc' }}>
                  <Space size={6} style={{ color: '#8c8c8c' }}><RiseOutlined /><Text type="secondary" strong>{r.titulo}</Text></Space>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{r.descricao}</div>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </Space>
    </div>
  );
}
