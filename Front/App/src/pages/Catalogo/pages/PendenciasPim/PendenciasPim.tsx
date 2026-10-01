// Pendências do PIM: todos os itens com algo a resolver numa tela só (sem entrar família por família).
// Crítico = fica fora do PDV ou vende sem preço; incompleto = cadastro sem informação importante.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, Row, Segmented, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { EditOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import ProductDetailsDrawer from '../CatalogSkus/ProductDetailsDrawer';
import { updateProduto } from '../CatalogSkus/CatalogSku.service';
import { getTipoRecursoConfig } from '../../../Compras/StockEntry/tipoRecurso';
import { getPendenciasPim, ItemPendente, RespostaPendencias } from './pendenciasApi';

const { Text } = Typography;
const COR_NIVEL = { critico: 'red', incompleto: 'orange' } as const;

const PendenciasPim: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const lote = Number(params.get('lote')) || null;

  const [tipo, setTipo] = useState<'VENDA' | 'TODOS'>('VENDA');
  const [familiaId, setFamiliaId] = useState<number | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [buscaDigitada, setBuscaDigitada] = useState('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [dados, setDados] = useState<RespostaPendencias | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [editando, setEditando] = useState<ItemPendente | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      setDados(await getPendenciasPim({ tipo, familiaId, codigo: codigo || undefined, busca, lote, page, limit }));
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tipo, familiaId, codigo, busca, lote, page, limit]);
  useEffect(() => {
    const t = setTimeout(() => { setBusca(buscaDigitada.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const tipos = dados?.tipos || {};
  const codigos = Object.keys(tipos);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Pendências do PIM</h2>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Itens com cadastro a completar. Os críticos ficam fora do PDV (ou estão sem preço) até serem resolvidos.
            </Text>
          </div>
          <Space>
            <Segmented
              value={tipo}
              onChange={v => { setTipo(v as 'VENDA' | 'TODOS'); setPage(1); }}
              options={[{ value: 'VENDA', label: 'Itens de venda' }, { value: 'TODOS', label: 'Todos (inclui consumo/patrimônio)' }]}
            />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          </Space>
        </div>

        {lote && (
          <Alert
            type="info"
            showIcon
            message={`Mostrando só os itens que entraram pela nota (lote #${lote}).`}
            action={<Button size="small" onClick={() => { params.delete('lote'); setParams(params); setPage(1); }}>Ver todos</Button>}
          />
        )}

        {/* Resumo por tipo de pendência (clique para filtrar) */}
        <Row gutter={[8, 8]}>
          <Col xs={12} md={4}>
            <Card size="small" hoverable onClick={() => { setCodigo(null); setPage(1); }}
              style={{ borderColor: codigo === null ? '#1677ff' : undefined, height: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Itens com pendência</Text>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{dados?.totalItensComPendencia ?? '—'}</div>
              <Text type="danger" style={{ fontSize: 12 }}><WarningOutlined /> {dados?.criticos ?? 0} crítico(s)</Text>
            </Card>
          </Col>
          {codigos.map(c => (
            <Col xs={12} md={4} lg={3} key={c}>
              <Tooltip title={tipos[c].ajuda}>
                <Card size="small" hoverable onClick={() => { setCodigo(codigo === c ? null : c); setPage(1); }}
                  style={{ borderColor: codigo === c ? '#1677ff' : undefined, opacity: dados?.resumo[c] ? 1 : 0.55, height: '100%' }}>
                  <Tag color={COR_NIVEL[tipos[c].nivel]} style={{ margin: 0, fontSize: 10 }}>{tipos[c].nivel === 'critico' ? 'crítico' : 'incompleto'}</Tag>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{tipos[c].label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{dados?.resumo[c] ?? 0}</div>
                </Card>
              </Tooltip>
            </Col>
          ))}
        </Row>

        <Row gutter={12}>
          {/* Por família */}
          <Col xs={24} md={6}>
            <Card size="small" title="Por família" bodyStyle={{ padding: 4, maxHeight: 560, overflowY: 'auto' }}>
              <div
                onClick={() => { setFamiliaId(null); setPage(1); }}
                style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, background: familiaId === null ? '#e6f4ff' : undefined, fontWeight: familiaId === null ? 600 : 400 }}
              >
                Todas as famílias
              </div>
              {(dados?.porFamilia || []).map(f => {
                const id = f.familiaId ?? 0;
                const ativa = familiaId === id;
                return (
                  <div key={id} onClick={() => { setFamiliaId(ativa ? null : id); setPage(1); }}
                    style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, background: ativa ? '#e6f4ff' : undefined, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <Text style={{ fontSize: 12, fontStyle: f.familiaId ? 'normal' : 'italic' }} ellipsis>{f.nome}</Text>
                    <Space size={2}>
                      {f.criticos > 0 && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>{f.criticos}</Tag>}
                      <Tag style={{ margin: 0, fontSize: 10 }}>{f.itens}</Tag>
                    </Space>
                  </div>
                );
              })}
            </Card>
          </Col>

          {/* Itens */}
          <Col xs={24} md={18}>
            <Card size="small">
              <Input.Search allowClear placeholder="Buscar por SKU ou nome" style={{ width: 300, marginBottom: 8 }}
                value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} />
              <Table<ItemPendente>
                rowKey="idItem"
                size="small"
                loading={carregando}
                dataSource={dados?.data || []}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma pendência com estes filtros 🎉" /> }}
                pagination={{
                  current: page, pageSize: limit, total: dados?.pagination.total || 0, showSizeChanger: true,
                  onChange: (p, l) => { setPage(p); setLimit(l); },
                }}
                columns={[
                  {
                    title: 'Item', key: 'item',
                    render: (_, i) => {
                      const t = getTipoRecursoConfig(i.tipoRecurso);
                      return (
                        <div>
                          <div style={{ fontWeight: 600 }}>{i.nome}</div>
                          <Space size={4}>
                            <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}</Text>
                            <Tag color={t.color} style={{ margin: 0, fontSize: 10 }}>{t.short}</Tag>
                          </Space>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Família / Categoria', key: 'classif', width: 220,
                    render: (_, i) => (
                      <div style={{ fontSize: 12 }}>
                        <div>{i.familia?.nome || <Text type="secondary" italic>sem família</Text>}</div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{i.categoria?.nome || 'sem categoria'}</Text>
                      </div>
                    ),
                  },
                  {
                    title: 'Pendências', key: 'pend',
                    render: (_, i) => (
                      <Space size={[4, 4]} wrap>
                        {i.pendencias.map(p => (
                          <Tooltip key={p.codigo} title={p.detalhe}>
                            <Tag color={COR_NIVEL[p.nivel]} style={{ margin: 0, fontSize: 11 }}>{tipos[p.codigo]?.label || p.codigo}</Tag>
                          </Tooltip>
                        ))}
                      </Space>
                    ),
                  },
                  {
                    title: '', key: 'acoes', width: 100,
                    render: (_, i) => <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => setEditando(i)}>Corrigir</Button>,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Space>

      <ProductDetailsDrawer
        open={Boolean(editando)}
        product={editando ? { id_item: editando.idItem, sku: editando.sku, nome: editando.nome } : null}
        onClose={() => { setEditando(null); carregar(); }}
        onSave={async (id, campos) => {
          try {
            await updateProduto(Number(id), campos);
            message.success('Item atualizado.');
          } catch (e: any) {
            message.error(e.message || 'Erro ao salvar o item.');
          }
        }}
      />
    </div>
  );
};

export default PendenciasPim;
