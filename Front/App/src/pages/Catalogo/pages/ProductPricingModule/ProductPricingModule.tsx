// Precificação: painel com custo, preço de varejo, margem e situação de cada item de venda.
// Clicar num item abre o configurador de preço dele (unidades de venda, faixas de atacado, custo defasado).
import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Drawer, Empty, Input, Row, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DollarOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import ProductCommercialSalesConfig from './ProductCommercialSalesConfig';
import PrecosComTaxaModal from './PrecosComTaxaModal';
import { carregarTaxaPreco, useTaxaPreco } from '../../../../core/precos/taxaPreco';

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
  faixasAtacado: number;
  unidadesVenda: number;
  situacoes: string[];
}
interface RespostaPainel {
  data: ItemPreco[];
  pagination: { page: number; limit: number; total: number };
  resumo: { itensVenda: number; margemMedia: number | null; comMargem: number; porSituacao: Record<string, number> };
  situacoes: Record<string, { label: string; nivel: Nivel }>;
}

const getPainel = async (f: { situacao?: string | null; busca?: string; page: number; limit: number }): Promise<RespostaPainel> => {
  const qs = new URLSearchParams({ tenant_id: '1', page: String(f.page), limit: String(f.limit) });
  if (f.situacao) qs.set('situacao', f.situacao);
  if (f.busca) qs.set('busca', f.busca);
  const r = await fetch(`http://localhost:3001/api/catalogo/precos/painel?${qs}`);
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
  const taxaPreco = useTaxaPreco();
  useEffect(() => { carregarTaxaPreco(); }, []);

  const carregar = async () => {
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
            <Button type="primary" icon={<DollarOutlined />} onClick={() => setEditando({ titulo: 'Configurar preço' })}>Buscar produto</Button>
          </Space>
        </div>

        {/* Indicadores (clique para filtrar) */}
        <Row gutter={[8, 8]}>
          {card(null, 'Itens de venda', resumo?.itensVenda ?? '—')}
          {card('SEM_PRECO', 'Sem preço', resumo?.porSituacao.SEM_PRECO ?? '—', resumo?.porSituacao.SEM_PRECO ? '#cf1322' : '#389e0d', 'Itens de venda sem preço de varejo na unidade base')}
          {card('MARGEM_NEGATIVA', 'Abaixo do custo', resumo?.porSituacao.MARGEM_NEGATIVA ?? '—', resumo?.porSituacao.MARGEM_NEGATIVA ? '#cf1322' : '#389e0d', 'Preço de varejo menor que o custo gerencial')}
          {card('CUSTO_DEFASADO', 'Custo defasado', resumo?.porSituacao.CUSTO_DEFASADO ?? '—', resumo?.porSituacao.CUSTO_DEFASADO ? '#d48806' : undefined, 'Último custo ou custo médio diferente do custo usado no preço: decida se atualiza')}
          {card('MARGEM_BAIXA', 'Margem baixa', resumo?.porSituacao.MARGEM_BAIXA ?? '—', resumo?.porSituacao.MARGEM_BAIXA ? '#d48806' : undefined, situacoes.MARGEM_BAIXA?.label)}
          {card(null, 'Margem média', resumo?.margemMedia !== null && resumo?.margemMedia !== undefined ? `${resumo.margemMedia}%` : '—', '#1677ff',
            resumo ? `Média dos ${resumo.comMargem} itens com preço e custo` : undefined)}
        </Row>

        <Card size="small">
          <Space style={{ marginBottom: 8 }} wrap>
            <Input allowClear prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />} placeholder="Buscar por SKU ou nome" style={{ width: 300 }}
              value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} />
            {situacao && <Tag closable color="blue" onClose={() => filtrar(null)}>{situacoes[situacao]?.label || situacao}</Tag>}
            {(resumo?.porSituacao.SEM_CUSTO || 0) > 0 && (
              <Button size="small" type={situacao === 'SEM_CUSTO' ? 'primary' : 'default'} onClick={() => filtrar('SEM_CUSTO')}>
                Sem custo ({resumo?.porSituacao.SEM_CUSTO})
              </Button>
            )}
          </Space>

          <Table<ItemPreco>
            rowKey="idItem"
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
                title: 'Varejo', key: 'preco', width: 140, align: 'right' as const,
                render: (_, i) => (
                  <div>
                    <b style={{ color: i.precoVarejo ? '#3f8600' : undefined }}>{i.precoVarejo ? `${brl(i.precoVarejo)} /${i.unidadeBase || 'un'}` : '—'}</b>
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
                title: 'Margem', dataIndex: 'margemPct', width: 90, align: 'right' as const,
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
    </div>
  );
};

export default ProductPricingModule;
