// Catálogo › Precificação › Varejo e atacado em lote: escolhe os itens (categoria, famílias, marca, busca), define a
// política (varejo mantido, markup fixo ou por faixa de custo; atacado 1 e 2 com quantidade e markup próprios), confere a
// prévia com o preço e o lucro de cada faixa e aplica nos itens marcados. Só a unidade base de cada item.
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Card, Checkbox, Col, Empty, Flex, Input, InputNumber, Popconfirm, Row, Segmented, Select, Space, Table, Tag, Tooltip, TreeSelect, Typography, message,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons';
import { FaixaPrevia, FiltroPolitica, ItemPrevia, NivelAtacado, OpcoesPolitica, Politica, politicaPrecoApi, RegraVarejo } from './politicaPrecoApi';
import { arvoreCategorias, familiasDaCategoria, marcasDoFiltro, resumoPrevia } from './politicaPrecoTela';

const { Text, Title } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const x = (m: number) => `${Number(m).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}x`;

type ModoVarejo = RegraVarejo['modo'];
const FAIXAS_CUSTO_PADRAO = [{ ateCusto: 2 as number | null, markup: 6 }, { ateCusto: 5 as number | null, markup: 4.5 }, { ateCusto: null as number | null, markup: 3 }];

const CelulaFaixa: React.FC<{ f: FaixaPrevia | undefined; antes?: { preco: number; markup: number } | null }> = ({ f, antes }) => {
  if (!f) return <Text type="secondary">—</Text>;
  const mudou = antes && Math.abs(antes.preco - f.preco) >= 0.005;
  return (
    <div style={{ lineHeight: 1.3 }}>
      {mudou && <Text delete type="secondary" style={{ fontSize: 11 }}>{brl(antes!.preco)}</Text>}
      <div><Text strong>{brl(f.preco)}</Text> <Text type="secondary" style={{ fontSize: 11 }}>{x(f.markup)}</Text></div>
      <Text type={f.lucroPct < 0 ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>lucro {f.lucroPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</Text>
    </div>
  );
};

const VarejoAtacadoLote: React.FC = () => {
  const navigate = useNavigate();
  const [opcoes, setOpcoes] = useState<OpcoesPolitica | null>(null);
  const [filtro, setFiltro] = useState<FiltroPolitica>({ busca: '' });
  // varejo
  const [modoVarejo, setModoVarejo] = useState<ModoVarejo>('MANTER');
  const [markupVarejo, setMarkupVarejo] = useState(3);
  const [faixasCusto, setFaixasCusto] = useState(FAIXAS_CUSTO_PADRAO);
  // atacado
  const [definirAtacado, setDefinirAtacado] = useState(true);
  const [a1, setA1] = useState<NivelAtacado>({ quantidade: 10, markup: 2 });
  const [usarA2, setUsarA2] = useState(false);
  const [a2, setA2] = useState<NivelAtacado>({ quantidade: 50, markup: 1.7 });
  const [pularQuemTem, setPularQuemTem] = useState(false);
  // prévia
  const [previa, setPrevia] = useState<{ taxaPct: number; itens: ItemPrevia[] } | null>(null);
  const [desatualizada, setDesatualizada] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [soProblemas, setSoProblemas] = useState(false);

  useEffect(() => { politicaPrecoApi.opcoes().then(setOpcoes).catch(e => message.error(e.message)); }, []);

  const politica: Politica = useMemo(() => ({
    varejo: modoVarejo === 'MARKUP' ? { modo: 'MARKUP', markup: markupVarejo }
      : modoVarejo === 'POR_CUSTO' ? { modo: 'POR_CUSTO', faixas: faixasCusto } : { modo: 'MANTER' },
    atacado: definirAtacado ? { modo: 'DEFINIR', nivel1: a1, nivel2: usarA2 ? a2 : null, pularQuemTem } : { modo: 'MANTER' },
  }), [modoVarejo, markupVarejo, faixasCusto, definirAtacado, a1, usarA2, a2, pularQuemTem]);
  useEffect(() => { if (previa) setDesatualizada(true); }, [politica, filtro]); // eslint-disable-line react-hooks/exhaustive-deps

  const verPrevia = async () => {
    setCarregando(true);
    try {
      const r = await politicaPrecoApi.previa(filtro, politica);
      setPrevia(r);
      setDesatualizada(false);
      setMarcados(r.itens.filter(i => i.plano.situacao === 'ALTERA').map(i => i.idItem));
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro na prévia.'); }
    finally { setCarregando(false); }
  };

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await politicaPrecoApi.aplicar(marcados, politica);
      message.success(`${r.alterados} item(ns) atualizado(s)${r.ignorados.length ? `, ${r.ignorados.length} não aplicado(s)` : ''}.`);
      if (r.ignorados.length) message.warning(r.ignorados.slice(0, 3).map(i => `${i.sku}: ${i.motivo}`).join(' · '), 6);
      await verPrevia();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao aplicar.'); }
    finally { setAplicando(false); }
  };

  const resumo = previa ? resumoPrevia(previa.itens) : null;
  const linhas = (previa?.itens || []).filter(i => !soProblemas || i.plano.situacao === 'ERRO' || i.plano.avisos.length > 0);
  const familiasDaCat = opcoes ? familiasDaCategoria(opcoes, filtro.idCategoria) : [];
  const familiasOpcoes = familiasDaCat.map(f => ({ value: f.id, label: `${f.nome} (${f.itens})` }));
  const marcasOpcoes = opcoes ? marcasDoFiltro(opcoes, filtro) : [];
  // as marcas escolhidas que não existem na categoria/famílias novas saem
  const comMarcaValida = (f: FiltroPolitica): FiltroPolitica => {
    if (!f.idsMarcas?.length || !opcoes) return f;
    const validas = new Set(marcasDoFiltro(opcoes, f).map(m => m.id));
    return { ...f, idsMarcas: f.idsMarcas.filter(id => validas.has(id)) };
  };
  const escolherCategoria = (idCategoria: number | null) => setFiltro(f => {
    // as famílias escolhidas que não são da categoria nova saem
    const validas = new Set((opcoes ? familiasDaCategoria(opcoes, idCategoria) : []).map(x => x.id));
    return comMarcaValida({ ...f, idCategoria, idsFamilias: (f.idsFamilias || []).filter(id => validas.has(id)) });
  });
  const escolherFamilias = (idsFamilias: number[]) => setFiltro(f => comMarcaValida({ ...f, idsFamilias }));
  const mudarFaixaCusto = (k: number, p: Partial<{ ateCusto: number | null; markup: number }>) => setFaixasCusto(l => l.map((f, i) => (i === k ? { ...f, ...p } : f)));

  return (
    <div style={{ padding: 16 }}>
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Varejo e atacado em lote</Title>
          <Text type="secondary">Defina o markup do varejo e do atacado para vários itens de uma vez, confira a prévia e aplique. Vale para a unidade base de cada item.</Text>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/catalogo/preco')}>Precificação</Button>
      </Flex>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={10}>
          <Card size="small" title="1. Quais itens" style={{ height: '100%' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <Text>Categoria (com as subcategorias)</Text>
                <TreeSelect allowClear showSearch treeNodeFilterProp="title" style={{ width: '100%' }} placeholder="Ex.: Rolamentos"
                  treeData={opcoes ? arvoreCategorias(opcoes.categorias) : []} value={filtro.idCategoria ?? undefined}
                  onChange={v => escolherCategoria((v as number) ?? null)} />
              </div>
              <div>
                <Flex justify="space-between">
                  <Text>Famílias{filtro.idCategoria ? ` da categoria (${familiasDaCat.length})` : ''}</Text>
                  <Space size={8}>
                    {filtro.idCategoria && familiasDaCat.length > 0 && (
                      <a onClick={() => escolherFamilias(familiasDaCat.map(x => x.id))}>adicionar todas ({familiasDaCat.length})</a>
                    )}
                    {(filtro.idsFamilias || []).length > 0 && <a onClick={() => escolherFamilias([])}>limpar</a>}
                  </Space>
                </Flex>
                <Select mode="multiple" allowClear showSearch optionFilterProp="label" style={{ width: '100%' }}
                  placeholder={filtro.idCategoria ? 'Todas as da categoria (ou escolha algumas)' : 'Ex.: Rolamento 608, Rolamento 6004'}
                  maxTagCount="responsive" options={familiasOpcoes} value={filtro.idsFamilias || []} onChange={v => escolherFamilias(v)} />
              </div>
              <Row gutter={8}>
                <Col span={12}>
                  <Text>Tag</Text>
                  <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Ex.: bicicleta"
                    options={(opcoes?.tags || []).map(t => ({ value: t.id, label: t.nome }))} value={filtro.idTag ?? undefined}
                    onChange={v => setFiltro(f => ({ ...f, idTag: (v as number) ?? null }))} />
                </Col>
                <Col span={12}>
                  <Text>Marca{filtro.idCategoria || (filtro.idsFamilias || []).length ? ` (${marcasOpcoes.length})` : ''}</Text>
                  <Select mode="multiple" allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} maxTagCount="responsive"
                    placeholder={filtro.idCategoria || (filtro.idsFamilias || []).length ? 'Todas as do filtro' : 'Todas'}
                    notFoundContent="Nenhuma marca nos itens do filtro"
                    options={marcasOpcoes.map(m => ({ value: m.id, label: m.nome }))} value={filtro.idsMarcas || []}
                    onChange={v => setFiltro(f => ({ ...f, idsMarcas: v as number[] }))} />
                </Col>
                <Col span={24}>
                  <Text>Busca (nome, SKU ou família)</Text>
                  <Input allowClear placeholder="Ex.: Rolamento 62" value={filtro.busca} onChange={e => setFiltro(f => ({ ...f, busca: e.target.value }))} onPressEnter={verPrevia} />
                </Col>
              </Row>
              <Text type="secondary" style={{ fontSize: 12 }}>Os filtros se somam (ex.: categoria Rolamentos + tag bicicleta). Até 500 itens por vez.</Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card size="small" title="2. Política de preço" style={{ height: '100%' }}>
            <Row gutter={[16, 12]}>
              <Col xs={24} md={12}>
                <Text strong>Varejo</Text>
                <Segmented block size="small" style={{ margin: '4px 0 8px' }} value={modoVarejo} onChange={v => setModoVarejo(v as ModoVarejo)}
                  options={[{ value: 'MANTER', label: 'Manter' }, { value: 'MARKUP', label: 'Markup fixo' }, { value: 'POR_CUSTO', label: 'Por custo' }]} />
                {modoVarejo === 'MANTER' && <Text type="secondary" style={{ fontSize: 12 }}>O varejo de cada item fica como está.</Text>}
                {modoVarejo === 'MARKUP' && (
                  <InputNumber min={1} step={0.1} decimalSeparator="," addonAfter="x" style={{ width: 140 }} value={markupVarejo} onChange={v => setMarkupVarejo(Number(v) || 0)} />
                )}
                {modoVarejo === 'POR_CUSTO' && (
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Item barato leva markup maior (não vale vender 1 por R$ 3).</Text>
                    {faixasCusto.map((f, k) => (
                      <Flex key={k} gap={6} align="center">
                        {f.ateCusto === null
                          ? <Text style={{ width: 128 }}>acima disso</Text>
                          : <InputNumber size="small" min={0} step={0.5} decimalSeparator="," prefix="até R$" style={{ width: 128 }} value={f.ateCusto}
                              onChange={v => mudarFaixaCusto(k, { ateCusto: Number(v) || 0 })} />}
                        <InputNumber size="small" min={1} step={0.1} decimalSeparator="," addonAfter="x" style={{ width: 100 }} value={f.markup}
                          onChange={v => mudarFaixaCusto(k, { markup: Number(v) || 0 })} />
                        {f.ateCusto !== null && faixasCusto.length > 2 && (
                          <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => setFaixasCusto(l => l.filter((_, i) => i !== k))} />
                        )}
                      </Flex>
                    ))}
                    <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => setFaixasCusto(l => {
                      const comLimite = l.filter(f => f.ateCusto !== null);
                      const ultimo = comLimite.length ? comLimite[comLimite.length - 1].ateCusto! : 0;
                      return [...comLimite, { ateCusto: ultimo + 5, markup: 3 }, ...l.filter(f => f.ateCusto === null)];
                    })}>Faixa de custo</Button>
                  </Space>
                )}
              </Col>
              <Col xs={24} md={12}>
                <Flex justify="space-between" align="center">
                  <Text strong>Atacado</Text>
                  <Segmented size="small" value={definirAtacado ? 'DEFINIR' : 'MANTER'} onChange={v => setDefinirAtacado(v === 'DEFINIR')}
                    options={[{ value: 'DEFINIR', label: 'Definir' }, { value: 'MANTER', label: 'Manter' }]} />
                </Flex>
                {definirAtacado ? (
                  <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 8 }}>
                    <Flex gap={6} align="center">
                      <Text style={{ width: 70 }}>Atacado 1</Text>
                      <InputNumber size="small" min={2} prefix="a partir de" style={{ width: 150 }} value={a1.quantidade} onChange={v => setA1(a => ({ ...a, quantidade: Number(v) || 0 }))} />
                      <InputNumber size="small" min={0.5} step={0.1} decimalSeparator="," addonAfter="x" style={{ width: 100 }} value={a1.markup} onChange={v => setA1(a => ({ ...a, markup: Number(v) || 0 }))} />
                    </Flex>
                    <Flex gap={6} align="center">
                      <Checkbox style={{ width: 70 }} checked={usarA2} onChange={e => setUsarA2(e.target.checked)}>2</Checkbox>
                      <InputNumber size="small" min={2} disabled={!usarA2} prefix="a partir de" style={{ width: 150 }} value={a2.quantidade} onChange={v => setA2(a => ({ ...a, quantidade: Number(v) || 0 }))} />
                      <InputNumber size="small" min={0.5} step={0.1} decimalSeparator="," disabled={!usarA2} addonAfter="x" style={{ width: 100 }} value={a2.markup} onChange={v => setA2(a => ({ ...a, markup: Number(v) || 0 }))} />
                    </Flex>
                    <Text type="secondary" style={{ fontSize: 12 }}>A quantidade é na unidade base (ex.: 10 = a embalagem de 10 peças). O PDV usa o atacado quando a venda chega na quantidade.</Text>
                    <Checkbox checked={pularQuemTem} onChange={e => setPularQuemTem(e.target.checked)}>Não mexer no atacado de quem já tem um próprio</Checkbox>
                  </Space>
                ) : <div style={{ marginTop: 8 }}><Text type="secondary" style={{ fontSize: 12 }}>O atacado de cada item fica como está.</Text></div>}
              </Col>
            </Row>
            <Flex justify="flex-end" style={{ marginTop: 12 }}>
              <Button type="primary" icon={<EyeOutlined />} loading={carregando} onClick={verPrevia}>Ver prévia</Button>
            </Flex>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 12 }}
        title={<Space>3. Prévia{previa && <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>preço com {previa.taxaPct.toLocaleString('pt-BR')}% de taxa embutida · lucro sobre o custo, já sem a taxa</Text>}</Space>}
        extra={previa && (
          <Space>
            <Checkbox checked={soProblemas} onChange={e => setSoProblemas(e.target.checked)}>Só com aviso ou bloqueio</Checkbox>
            <Popconfirm title={`Aplicar em ${marcados.length} item(ns)?`} description="O varejo e o atacado da unidade base de cada um são gravados como na prévia." okText="Aplicar" cancelText="Voltar"
              disabled={!marcados.length || desatualizada} onConfirm={aplicar}>
              <Button type="primary" icon={<CheckOutlined />} loading={aplicando} disabled={!marcados.length || desatualizada}>Aplicar em {marcados.length}</Button>
            </Popconfirm>
          </Space>
        )}>
        {!previa ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Escolha os itens e a política e clique em Ver prévia" /> : (
          <>
            {desatualizada && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message="A política ou o filtro mudou: clique em Ver prévia de novo antes de aplicar." />}
            {resumo && (
              <Space wrap style={{ marginBottom: 8 }}>
                <Tag color="blue">{resumo.altera} mudam</Tag>
                <Tag>{resumo.igual} já estão assim</Tag>
                {resumo.erro > 0 && <Tag color="red">{resumo.erro} não dá para aplicar</Tag>}
                {resumo.avisos > 0 && <Tag color="orange">{resumo.avisos} abaixo do alvo de lucro</Tag>}
              </Space>
            )}
            <Table<ItemPrevia>
              size="small" rowKey="idItem" dataSource={linhas} pagination={{ pageSize: 50, hideOnSinglePage: true }}
              rowSelection={{
                selectedRowKeys: marcados, onChange: k => setMarcados(k as number[]),
                getCheckboxProps: i => ({ disabled: i.plano.situacao !== 'ALTERA' }),
              }}
              columns={[
                {
                  title: 'Item', render: (_, i) => (
                    <div style={{ lineHeight: 1.3 }}>
                      <Text strong>{i.sku}</Text> <Text>{i.nome}</Text>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{[i.familia, i.marca, i.unidade].filter(Boolean).join(' · ')}</Text></div>
                    </div>
                  ),
                },
                { title: 'Custo', width: 90, align: 'right', render: (_, i) => brl(i.custo) },
                {
                  title: 'Varejo', width: 120,
                  render: (_, i) => <CelulaFaixa f={i.plano.faixas.find(f => f.tipo === 'VAREJO')} antes={i.varejoAtual} />,
                },
                ...[0, 1].map(k => ({
                  title: `Atacado ${k + 1}`, width: 130, key: `a${k}`,
                  render: (_: unknown, i: ItemPrevia) => {
                    const f = i.plano.faixas.filter(x => x.tipo === 'ATACADO')[k];
                    if (!f) return i.atacadoAtual[k] && i.plano.mexeNoAtacado ? <Text delete type="secondary">{brl(i.atacadoAtual[k].preco)}</Text> : <Text type="secondary">—</Text>;
                    return <div><Tag style={{ marginBottom: 2 }}>{f.quantidadeMinima}+</Tag><CelulaFaixa f={f} antes={i.atacadoAtual[k] ? { preco: i.atacadoAtual[k].preco, markup: i.atacadoAtual[k].markup } : null} /></div>;
                  },
                })),
                {
                  title: 'Situação', width: 260,
                  render: (_, i) => i.plano.situacao === 'ERRO'
                    ? <Text type="danger" style={{ fontSize: 12 }}>{i.plano.erro}</Text>
                    : (
                      <div>
                        <Tag color={i.plano.situacao === 'ALTERA' ? 'blue' : 'default'}>{i.plano.situacao === 'ALTERA' ? 'muda' : 'já está assim'}</Tag>
                        {i.plano.avisos.map(a => (
                          <div key={a}><Tooltip title={a}><Text type="warning" style={{ fontSize: 11 }}><WarningOutlined /> {a}</Text></Tooltip></div>
                        ))}
                      </div>
                    ),
                },
              ]}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default VarejoAtacadoLote;
