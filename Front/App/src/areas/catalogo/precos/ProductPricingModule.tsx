// Precificação: painel com custo, preço de varejo, margem e situação de cada item de venda.
// Clicar num item abre o configurador de preço dele (unidades de venda, faixas de atacado, custo defasado).
import { API_URL } from '../../../shared/api/config';
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Drawer, Empty, Input, Row, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getEtiquetasDesatualizadas } from '../../estoque/api/etiquetasApi';
import { DollarOutlined, DownOutlined, EditOutlined, OrderedListOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Badge, Dropdown, Modal } from 'antd';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';
import { ListaTrabalhoDrawer } from '../../../shared/core/listaTrabalho/ListaTrabalhoDrawer';
import { TAGS_LISTA, TagLista } from '../../../shared/core/listaTrabalho/listaTrabalho';
import ListaPrecificacao from './ListaPrecificacao';
import { LinhaLote, linhaDoPainel } from './precificacaoLote';
import ProductCommercialSalesConfig from './ProductCommercialSalesConfig';
import PrecosComTaxaModal from './PrecosComTaxaModal';
import { carregarTaxaPreco, fatorTaxaPreco, useTaxaPreco } from '../../../shared/core/precos/taxaPreco';

const { Text, Title } = Typography;

type Nivel = 'critico' | 'atencao';
interface ItemPreco {
  idItem: number;
  sku: string;
  nome: string;
  familia: string | null;
  unidadeBase: string | null;
  estoqueVenda: number;
  custoGerencial: number | null;
  custoMedio: number | null;
  ultimoCusto: number | null;
  precoVarejo: number | null;
  variacaoUltimoPct: number | null;
  margemPct: number | null;
  markupVarejo: number | null;
  // custo × markup = preço sem taxa; + taxa = preço que o markup manda
  composicao: { custo: number; markup: number; semTaxa: number; valorTaxa: number; esperado: number; taxaEmbutida: number | null } | null;
  conferenciaTaxa: 'OK' | 'TAXA_ANTIGA' | 'SEM_TAXA' | 'FORA_DO_MARKUP' | null;
  faixasAtacado: number;
  unidadesVenda: number;
  situacoes: string[];
}
interface RespostaPainel {
  data: ItemPreco[];
  pagination: { page: number; limit: number; total: number };
  resumo: { itensVenda: number; margemMedia: number | null; comMargem: number; porSituacao: Record<string, number> };
  situacoes: Record<string, { label: string; nivel: Nivel }>;
  taxa?: { percentual: number; fator: number };
}

const getPainel = async (f: { situacao?: string | null; busca?: string; ids?: number[]; page: number; limit: number }): Promise<RespostaPainel> => {
  const qs = new URLSearchParams({ tenant_id: '1', page: String(f.page), limit: String(f.limit) });
  if (f.ids?.length) qs.set('ids', f.ids.join(','));
  if (f.situacao) qs.set('situacao', f.situacao);
  if (f.busca) qs.set('busca', f.busca);
  const r = await fetch(`${API_URL}/api/catalogo/precos/painel?${qs}`);
  const d = await r.json().catch(() => ({}));
  if (r.status === 404) throw new Error('O servidor não conhece o painel de preços ainda: reinicie o backend (npm start).');
  if (!r.ok) throw new Error(d.error || 'Erro ao carregar o painel de preços.');
  return d;
};

const brl = (v: number | null, casas = 2) => (v === null || v === undefined ? '—'
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas }));
const COR_NIVEL: Record<Nivel, string> = { critico: 'red', atencao: 'orange' };

export const ProductPricingModule: React.FC = () => {
  const [dados, setDados] = useState<RespostaPainel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [editando, setEditando] = useState<{ idItem?: number; titulo: string } | null>(null);
  const [precosTaxa, setPrecosTaxa] = useState(false);

  // Lista de precificação: itens juntados de qualquer filtro/busca, precificados de uma vez (guardada neste navegador)
  const [lista, setListaEstado] = useState<LinhaLote[]>(() => {
    try { return JSON.parse(localStorage.getItem('erp.precificacao.lista') || '[]'); } catch { return []; }
  });
  const setLista = (l: LinhaLote[]) => {
    setListaEstado(l);
    try { localStorage.setItem('erp.precificacao.lista', JSON.stringify(l)); } catch { /* sem armazenamento */ }
  };
  const [listaAberta, setListaAberta] = useState(false);
  const [marcados, setMarcados] = useState<React.Key[]>([]);
  const [linhasMarcadas, setLinhasMarcadas] = useState<Record<number, ItemPreco>>({});
  const [juntando, setJuntando] = useState(false);
  const naLista = new Set(lista.map(l => l.idItem));

  // Lista de trabalho (toolbar): tarefa "Precificar" chega aqui; daqui itens vão para outras tarefas
  const trabalho = useListaTrabalho();
  const [trabalhoAberto, setTrabalhoAberto] = useState(false);
  const paraPrecificar = trabalho.comTag('PRECIFICAR').filter(i => !naLista.has(i.idItem));
  const [trazendo, setTrazendo] = useState(false);
  const trazerDaListaDeTrabalho = async () => {
    setTrazendo(true);
    try {
      const r = await getPainel({ ids: paraPrecificar.map(i => i.idItem), page: 1, limit: 500 });
      const fora = paraPrecificar.length - r.data.length;
      adicionarNaLista(r.data);
      if (fora > 0) message.info(`${fora} item(ns) não são itens de venda (consumo/patrimônio) ou estão inativos: ficaram fora.`);
      setListaAberta(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao trazer os itens.');
    } finally {
      setTrazendo(false);
    }
  };
  const mandarParaTrabalho = (itens: Array<{ idItem: number; sku: string; nome: string; unidade?: string | null }>, tag: TagLista) => {
    if (!itens.length) return;
    trabalho.adicionarVarios(itens.map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade || undefined })), { tags: [tag], origem: 'Precificação' });
    message.success(`${itens.length} item(ns) na lista de trabalho: ${TAGS_LISTA[tag].label}.`);
  };
  const menuTarefas = (acao: (tag: TagLista) => void) => ({
    items: (Object.keys(TAGS_LISTA) as TagLista[]).map(t => ({ key: t, label: TAGS_LISTA[t].label, onClick: () => acao(t) })),
  });
  // Depois de gravar os preços: oferece mandar os itens para outra tarefa (ex.: tirar etiqueta)
  const [posGravacao, setPosGravacao] = useState<LinhaLote[] | null>(null);

  const adicionarNaLista = (itens: ItemPreco[]) => {
    const novos = itens.filter(i => !naLista.has(i.idItem)).map(i => linhaDoPainel(i, fatorTaxaPreco()));
    if (!novos.length) { message.info('Esses itens já estão na lista.'); return; }
    setLista([...lista, ...novos]);
    setMarcados([]);
    setLinhasMarcadas({});
    message.success(`${novos.length} item(ns) na lista de precificação.`);
  };

  // Todos os itens do filtro/busca atual (todas as páginas)
  const adicionarTodosDoFiltro = async () => {
    setJuntando(true);
    try {
      const todos: ItemPreco[] = [];
      for (let p = 1; p <= 50; p++) {
        const r = await getPainel({ situacao, busca, page: p, limit: 200 });
        todos.push(...r.data);
        if (todos.length >= r.pagination.total || r.data.length === 0) break;
      }
      if (todos.length > 500) message.warning('Mais de 500 itens: a lista pega os 500 primeiros (grave e repita para o resto).');
      adicionarNaLista(todos.slice(0, 500));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao juntar os itens.');
    } finally {
      setJuntando(false);
    }
  };
  const taxaPreco = useTaxaPreco();
  useEffect(() => { carregarTaxaPreco(); }, []);

  // Etiquetas da gôndola que ficaram com preço velho (depois de corrigir preços aqui)
  const navigate = useNavigate();
  const [etiquetasVelhas, setEtiquetasVelhas] = useState(0);
  const conferirEtiquetas = () => { getEtiquetasDesatualizadas().then(l => setEtiquetasVelhas(l.length)).catch(() => undefined); };

  const carregar = async () => {
    conferirEtiquetas();
    setCarregando(true);
    try {
      setDados(await getPainel({ situacao, busca, page, limit }));
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar o painel de preços.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacao, busca, page, limit]);
  useEffect(() => {
    const t = setTimeout(() => { setBusca(buscaDigitada.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const resumo = dados?.resumo;
  const taxaPercentual = dados?.taxa?.percentual ?? taxaPreco.percentual;
  // Preços que a taxa deixou defasados (taxa mudou, preço sem taxa ou fora do markup)
  const paraCorrigir = (resumo?.porSituacao.TAXA_ANTIGA || 0) + (resumo?.porSituacao.SEM_TAXA || 0) + (resumo?.porSituacao.FORA_DO_MARKUP || 0);
  const situacoes = dados?.situacoes || {};
  const filtrar = (s: string | null) => { setSituacao(situacao === s ? null : s); setPage(1); };

  const card = (chave: string | null, titulo: string, valor: React.ReactNode, cor?: string, ajuda?: string) => (
    <Col xs={12} md={8} xl={4}>
      <Tooltip title={ajuda}>
        <Card size="small" hoverable onClick={() => filtrar(chave)} style={{ height: '100%', borderColor: situacao === chave ? '#1677ff' : undefined }}
          styles={{ body: { padding: '10px 12px' } }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{titulo}</Text>
          <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{valor}</div>
        </Card>
      </Tooltip>
    </Col>
  );

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Precificação</Title>
            <Text type="secondary">Custo, preço de varejo e margem de cada item de venda. Clique num item para ajustar unidades, faixas de atacado e custo.</Text>
          </div>
          <Space>
            <Tooltip title={taxaPreco.percentual > 0 ? `O preço embute ${taxaPreco.percentual.toFixed(2)}% de taxa (Vendas › Taxas de pagamento)` : 'Nenhuma taxa embutida no preço'}>
              <Button onClick={() => setPrecosTaxa(true)}>Preços com taxa{taxaPreco.percentual > 0 ? ` (${taxaPreco.percentual.toFixed(2)}%)` : ''}</Button>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
            <Badge count={trabalho.itens.length} size="small">
              <Button icon={<UnorderedListOutlined />} onClick={() => setTrabalhoAberto(true)}>Lista de trabalho</Button>
            </Badge>
            <Badge count={lista.length} size="small">
              <Button icon={<OrderedListOutlined />} onClick={() => setListaAberta(true)}>Lista de precificação</Button>
            </Badge>
            <Button type="primary" icon={<DollarOutlined />} onClick={() => setEditando({ titulo: 'Configurar preço' })}>Buscar produto</Button>
          </Space>
        </div>

        {paraPrecificar.length > 0 && (
          <Alert type="info" showIcon
            title={`${paraPrecificar.length} item(ns) da lista de trabalho marcados para precificar`}
            action={<Button size="small" type="primary" loading={trazendo} onClick={trazerDaListaDeTrabalho}>Trazer para a lista de precificação</Button>} />
        )}
        {etiquetasVelhas > 0 && (
          <Alert type="warning" showIcon
            title={`${etiquetasVelhas} etiqueta(s) na gôndola com preço antigo`}
            description="O preço mudou depois que a etiqueta foi impressa. Imprima as novas para o cliente não ver o preço errado."
            action={<Button size="small" type="primary" onClick={() => navigate('/estoque/etiquetagem')}>Ir para a Etiquetagem</Button>} />
        )}

        {/* Indicadores (clique para filtrar) */}
        <Row gutter={[8, 8]}>
          {card(null, 'Itens de venda', resumo?.itensVenda ?? '—')}
          {card('SEM_PRECO', 'Sem preço', resumo?.porSituacao.SEM_PRECO ?? '—', resumo?.porSituacao.SEM_PRECO ? '#cf1322' : '#389e0d', 'Itens de venda sem preço de varejo na unidade base')}
          {card('MARGEM_NEGATIVA', 'Abaixo do custo', resumo?.porSituacao.MARGEM_NEGATIVA ?? '—', resumo?.porSituacao.MARGEM_NEGATIVA ? '#cf1322' : '#389e0d', 'Preço de varejo menor que o custo gerencial')}
          {card('CUSTO_DEFASADO', 'Custo defasado', resumo?.porSituacao.CUSTO_DEFASADO ?? '—', resumo?.porSituacao.CUSTO_DEFASADO ? '#d48806' : undefined, 'Último custo ou custo médio diferente do custo usado no preço: decida se atualiza')}
          {card('TAXA_ANTIGA', 'Taxa mudou', resumo?.porSituacao.TAXA_ANTIGA ?? '—', resumo?.porSituacao.TAXA_ANTIGA ? '#d48806' : '#389e0d',
            'Preço calculado com uma taxa diferente da atual (Vendas › Taxas de pagamento). Os preços não mudam sozinhos: corrija em "Preços com taxa".')}
          {card('SEM_TAXA', 'Preço sem a taxa', resumo?.porSituacao.SEM_TAXA ?? '—', resumo?.porSituacao.SEM_TAXA ? '#d48806' : '#389e0d',
            'Preço antigo: segue custo × markup, mas sem a taxa da maquininha embutida. Use "Preços com taxa" para corrigir.')}
          {(resumo?.porSituacao.FORA_DO_MARKUP || 0) > 0 && card('FORA_DO_MARKUP', 'Fora do markup', resumo?.porSituacao.FORA_DO_MARKUP ?? '—', '#d48806',
            'Preço gravado diferente de custo × markup + taxa (preço digitado à mão ou custo mudou depois)')}
          {card('MARGEM_BAIXA', 'Margem baixa', resumo?.porSituacao.MARGEM_BAIXA ?? '—', resumo?.porSituacao.MARGEM_BAIXA ? '#d48806' : undefined, situacoes.MARGEM_BAIXA?.label)}
          {card(null, 'Margem média (líquida)', resumo?.margemMedia !== null && resumo?.margemMedia !== undefined ? `${resumo.margemMedia}%` : '—', '#1677ff',
            resumo ? `Média dos ${resumo.comMargem} itens com preço e custo` : undefined)}
        </Row>

        <Card size="small">
          <Space style={{ marginBottom: 8 }} wrap>
            <Input allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="Buscar por SKU ou nome" style={{ width: 300 }}
              value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} />
            {situacao && <Tag closable color="blue" onClose={() => filtrar(null)}>{situacoes[situacao]?.label || situacao}</Tag>}
            {paraCorrigir > 0 && (
              <Button size="small" type="primary" ghost onClick={() => setPrecosTaxa(true)}>
                Corrigir {paraCorrigir} preço(s) defasado(s) pela taxa
              </Button>
            )}
            {(resumo?.porSituacao.SEM_CUSTO || 0) > 0 && (
              <Button size="small" type={situacao === 'SEM_CUSTO' ? 'primary' : 'default'} onClick={() => filtrar('SEM_CUSTO')}>
                Sem custo ({resumo?.porSituacao.SEM_CUSTO})
              </Button>
            )}
            <Button size="small" type="primary" icon={<PlusOutlined />} disabled={!marcados.length}
              onClick={() => adicionarNaLista(Object.values(linhasMarcadas))}>
              Adicionar à lista{marcados.length ? ` (${marcados.length})` : ''}
            </Button>
            <Dropdown disabled={!marcados.length} trigger={['click']}
              menu={menuTarefas(tag => {
                mandarParaTrabalho(Object.values(linhasMarcadas).map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidadeBase })), tag);
                setMarcados([]); setLinhasMarcadas({});
              })}>
              <Button size="small" icon={<UnorderedListOutlined />} disabled={!marcados.length}>
                Lista de trabalho <DownOutlined />
              </Button>
            </Dropdown>
            <Tooltip title="Junta na lista todos os itens deste filtro/busca (todas as páginas)">
              <Button size="small" icon={<PlusOutlined />} loading={juntando} disabled={!dados?.pagination.total} onClick={adicionarTodosDoFiltro}>
                Todos do filtro ({dados?.pagination.total ?? 0})
              </Button>
            </Tooltip>
          </Space>

          <Table<ItemPreco>
            rowKey="idItem"
            rowSelection={{
              selectedRowKeys: marcados,
              preserveSelectedRowKeys: true,
              onChange: (keys, rows) => {
                setMarcados(keys);
                setLinhasMarcadas(atual => {
                  const novo: Record<number, ItemPreco> = {};
                  for (const k of keys) {
                    const linha = rows.find(r => r && r.idItem === Number(k)) || atual[Number(k)];
                    if (linha) novo[Number(k)] = linha;
                  }
                  return novo;
                });
              },
              getCheckboxProps: i => ({ disabled: naLista.has(i.idItem) }),
              renderCell: (_marcado, i, _idx, no) => (naLista.has(i.idItem) ? <Tooltip title="Já está na lista de precificação"><Tag color="blue" style={{ margin: 0, fontSize: 10 }}>lista</Tag></Tooltip> : no),
            }}
            size="small"
            loading={carregando}
            dataSource={dados?.data || []}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item com estes filtros" /> }}
            onRow={i => ({ onClick: () => setEditando({ idItem: i.idItem, titulo: `${i.sku} · ${i.nome}` }), style: { cursor: 'pointer' } })}
            pagination={{ current: page, pageSize: limit, total: dados?.pagination.total || 0, showSizeChanger: true, onChange: (p, l) => { setPage(p); setLimit(l); } }}
            columns={[
              {
                title: 'Item', key: 'item',
                render: (_, i) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.nome}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}{i.familia ? ` · ${i.familia}` : ''}</Text>
                  </div>
                ),
              },
              {
                title: 'Estoque', dataIndex: 'estoqueVenda', width: 90, align: 'right' as const,
                render: (v: number, i) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${i.unidadeBase || ''}`,
              },
              {
                title: <Tooltip title="Custo gerencial: a base do preço de venda">Custo</Tooltip>, key: 'custo', width: 150, align: 'right' as const,
                render: (_, i) => (
                  <div>
                    <div>{brl(i.custoGerencial, 4)}</div>
                    {i.ultimoCusto !== null && (
                      <Tooltip title={`Último custo de entrada${i.custoMedio !== null ? ` · custo médio ${brl(i.custoMedio, 4)}` : ''}`}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          últ. {brl(i.ultimoCusto, 4)}
                          {i.variacaoUltimoPct !== null && Math.abs(i.variacaoUltimoPct) >= 0.5 && (
                            <span style={{ color: i.variacaoUltimoPct > 0 ? '#cf1322' : '#389e0d' }}> ({i.variacaoUltimoPct > 0 ? '+' : ''}{i.variacaoUltimoPct}%)</span>
                          )}
                        </Text>
                      </Tooltip>
                    )}
                  </div>
                ),
              },
              {
                title: 'Varejo', key: 'preco', width: 170, align: 'right' as const,
                render: (_, i) => (
                  <div>
                    <b style={{ color: i.precoVarejo ? '#3f8600' : undefined }}>{i.precoVarejo ? `${brl(i.precoVarejo)} /${i.unidadeBase || 'un'}` : '—'}</b>
                    {/* Conta do preço: custo × markup + taxa embutida */}
                    {i.composicao && (
                      <Tooltip title={`Custo ${brl(i.composicao.custo, 4)} × markup ${i.composicao.markup} = ${brl(i.composicao.semTaxa)}; + taxa ${taxaPercentual.toFixed(2)}% (${brl(i.composicao.valorTaxa)}) = ${brl(i.composicao.esperado)}`}>
                        <div style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                          {brl(i.composicao.semTaxa)} + taxa {brl(i.composicao.valorTaxa)}
                        </div>
                      </Tooltip>
                    )}
                    {i.conferenciaTaxa === 'TAXA_ANTIGA' && i.composicao && (
                      <div style={{ fontSize: 11, color: '#d48806', whiteSpace: 'nowrap' }}>
                        calculado com {Number(i.composicao.taxaEmbutida).toFixed(2)}% · atual: <b>{brl(i.composicao.esperado)}</b>
                      </div>
                    )}
                    {i.conferenciaTaxa === 'SEM_TAXA' && i.composicao && (
                      <div style={{ fontSize: 11, color: '#d48806', whiteSpace: 'nowrap' }}>com a taxa: <b>{brl(i.composicao.esperado)}</b></div>
                    )}
                    {i.conferenciaTaxa === 'FORA_DO_MARKUP' && i.composicao && (
                      <div style={{ fontSize: 11, color: '#d48806', whiteSpace: 'nowrap' }}>pelo markup: <b>{brl(i.composicao.esperado)}</b></div>
                    )}
                    {(i.faixasAtacado > 0 || i.unidadesVenda > 1) && (
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {i.unidadesVenda > 1 && `${i.unidadesVenda} unidades`}{i.unidadesVenda > 1 && i.faixasAtacado > 0 && ' · '}
                        {i.faixasAtacado > 0 && `${i.faixasAtacado} faixa(s) de atacado`}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: <Tooltip title={taxaPercentual > 0 ? `Lucro depois de descontar a taxa de ${taxaPercentual.toFixed(2)}% embutida no preço, sobre o preço` : 'Lucro sobre o preço'}>Margem líq.</Tooltip>,
                dataIndex: 'margemPct', width: 100, align: 'right' as const,
                render: (v: number | null) => v === null ? <Text type="secondary">—</Text>
                  : <Tag color={v < 0 ? 'red' : v < 15 ? 'orange' : 'green'} style={{ margin: 0 }}>{v.toFixed(1)}%</Tag>,
              },
              {
                title: 'Situação', key: 'sit', width: 230,
                render: (_, i) => i.situacoes.length === 0
                  ? <Tag color="green" style={{ margin: 0 }}>ok</Tag>
                  : <Space size={[4, 4]} wrap>{i.situacoes.map(s => (
                    <Tag key={s} color={COR_NIVEL[situacoes[s]?.nivel || 'atencao']} style={{ margin: 0 }}>{situacoes[s]?.label || s}</Tag>
                  ))}</Space>,
              },
              {
                title: '', key: 'acao', width: 90,
                render: (_, i) => (
                  <Button size="small" type="link" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); setEditando({ idItem: i.idItem, titulo: `${i.sku} · ${i.nome}` }); }}>
                    Ajustar
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      {/* Configurador de preço do item (o mesmo da ficha do produto e da entrada de NF) */}
      <Drawer
        open={Boolean(editando)}
        width={1100}
        title={editando?.titulo}
        destroyOnClose
        onClose={() => { setEditando(null); carregar(); }}
      >
        {editando && <ProductCommercialSalesConfig idItem={editando.idItem} />}
      </Drawer>
      <PrecosComTaxaModal aberto={precosTaxa} onFechar={() => setPrecosTaxa(false)} onAplicado={carregar} />
      <ListaPrecificacao aberta={listaAberta} linhas={lista} onChange={setLista} onFechar={() => setListaAberta(false)}
        onSalvo={ids => {
          const s = new Set(ids);
          setPosGravacao(lista.filter(l => s.has(l.idItem)));
          setLista(lista.filter(l => !s.has(l.idItem)));
          // Tarefa "Precificar" da lista de trabalho concluída para quem foi gravado
          trabalho.concluirTag('PRECIFICAR', ids);
          carregar();
        }} />
      <Modal open={!!posGravacao?.length} title={`${posGravacao?.length || 0} item(ns) precificado(s)`} footer={null} onCancel={() => setPosGravacao(null)}>
        <p>Quer mandar esses itens para a lista de trabalho com outra tarefa?</p>
        <Space wrap>
          {(['ETIQUETAR', 'CONFERIR', 'REVISAR', 'COMPRAR'] as TagLista[]).map(t => (
            <Button key={t} type={t === 'ETIQUETAR' ? 'primary' : 'default'}
              onClick={() => { mandarParaTrabalho(posGravacao || [], t); setPosGravacao(null); }}>
              {TAGS_LISTA[t].label}
            </Button>
          ))}
          <Button type="text" onClick={() => setPosGravacao(null)}>Não, obrigado</Button>
        </Space>
      </Modal>
      <ListaTrabalhoDrawer open={trabalhoAberto} onClose={() => setTrabalhoAberto(false)} tagInicial="PRECIFICAR"
        extra={paraPrecificar.length > 0 && (
          <Button type="primary" loading={trazendo} onClick={() => { setTrabalhoAberto(false); trazerDaListaDeTrabalho(); }}>
            Precificar ({paraPrecificar.length})
          </Button>
        )} />
    </div>
  );
};

export default ProductPricingModule;
