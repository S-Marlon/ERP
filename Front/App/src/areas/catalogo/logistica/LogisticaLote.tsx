// Catálogo › Logística em lote: peso e medidas dos itens e a embalagem recomendada por quantidade (por família ou só no
// item), com o mesmo filtro das outras telas em lote. É o que o frete do Mercado Livre precisa e o custo da embalagem
// que entra no lucro de cada envio.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Card, Col, Empty, Flex, Input, InputNumber, Modal, Popover, Row, Segmented, Select, Space, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { DeleteOutlined, InboxOutlined, PlusOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import FiltroItensLote from '../FiltroItensLote';
import { FiltroPolitica, OpcoesPolitica, politicaPrecoApi } from '../precos/politicaPrecoApi';
import { EmbalagemCatalogo, FaltaLogistica, ItemLogistica, logisticaApi, RegraEmbalagem, ROTULO_FALTA, textoMedidas } from './logisticaApi';
import { alteracoes, aplicarNosMarcados, Rascunho, ValoresLogistica, valoresDaLinha } from './logisticaTela';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const COR_FALTA: Record<FaltaLogistica, string> = { PESO: 'red', MEDIDAS: 'orange', EMBALAGEM: 'gold', FOTO: 'default' };

const nomeEmb = (e: EmbalagemCatalogo) => `${e.nome} · ${textoMedidas(e.medidas)}${e.custo ? ` · ${brl(e.custo)}` : ''}`;

/** Editor das faixas de embalagem: "até N unidades → embalagem". */
const EditorRegras: React.FC<{ regras: RegraEmbalagem[]; embalagens: EmbalagemCatalogo[]; onChange: (r: RegraEmbalagem[]) => void }> = ({ regras, embalagens, onChange }) => (
  <Space direction="vertical" style={{ width: '100%' }} size={6}>
    {regras.map((r, k) => (
      <Flex key={k} gap={6} align="center">
        <InputNumber min={1} prefix="até" addonAfter="un." style={{ width: 150 }} value={r.quantidadeAte}
          onChange={v => onChange(regras.map((x, i) => (i === k ? { ...x, quantidadeAte: Number(v) || 0 } : x)))} />
        <Select showSearch optionFilterProp="label" style={{ flex: 1 }} placeholder="Embalagem" value={r.idEmbalagem || undefined}
          options={embalagens.map(e => ({ value: e.idEmbalagem, label: nomeEmb(e) }))}
          onChange={v => onChange(regras.map((x, i) => (i === k ? { ...x, idEmbalagem: v } : x)))} />
        <Button type="text" icon={<DeleteOutlined />} onClick={() => onChange(regras.filter((_, i) => i !== k))} />
      </Flex>
    ))}
    <Button size="small" type="dashed" icon={<PlusOutlined />}
      onClick={() => onChange([...regras, { quantidadeAte: (regras[regras.length - 1]?.quantidadeAte || 0) + (regras.length ? 8 : 2), idEmbalagem: 0 }])}>
      Faixa de quantidade
    </Button>
    <Text type="secondary" style={{ fontSize: 12 }}>Ex.: até 2 un. no envelope P, até 10 na caixa nº 1. A venda usa a menor faixa que comporta a quantidade (o kit c/10 vai na caixa).</Text>
  </Space>
);

const LogisticaLote: React.FC = () => {
  const [params] = useSearchParams();
  const familiaInicial = Number(params.get('familia')) || null;   // vindo das Pendências do PIM
  const [opcoes, setOpcoes] = useState<OpcoesPolitica | null>(null);
  const [filtro, setFiltro] = useState<FiltroPolitica>(familiaInicial ? { busca: '', idsFamilias: [familiaInicial] } : { busca: '' });
  const [falta, setFalta] = useState<FaltaLogistica | 'TODOS'>('TODOS');
  const [itens, setItens] = useState<ItemLogistica[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [marcados, setMarcados] = useState<number[]>([]);
  const [embalagens, setEmbalagens] = useState<EmbalagemCatalogo[]>([]);
  const [lote, setLote] = useState<Partial<ValoresLogistica>>({});
  const [editorRegras, setEditorRegras] = useState<{ alvo: 'FAMILIAS' | 'ITENS'; regras: RegraEmbalagem[] } | null>(null);
  const [novaEmb, setNovaEmb] = useState<{ nome: string; pesoKg: number | null; altura: number | null; largura: number | null; comprimento: number | null; custo: number } | null>(null);

  const carregarEmbalagens = useCallback(() => logisticaApi.embalagens().then(setEmbalagens).catch(e => message.error(e.message)), []);
  useEffect(() => { politicaPrecoApi.opcoes().then(setOpcoes).catch(e => message.error(e.message)); carregarEmbalagens(); }, [carregarEmbalagens]);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      setItens(await logisticaApi.itens(filtro, falta === 'TODOS' ? null : falta));
      setRascunho({});
      setMarcados([]);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [filtro, falta]);
  useEffect(() => { if (itens) buscar(); }, [falta]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (familiaInicial) buscar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mudancas = useMemo(() => (itens ? alteracoes(itens, rascunho) : []), [itens, rascunho]);
  const editar = (idItem: number, p: Partial<ValoresLogistica>) => setRascunho(r => ({ ...r, [idItem]: { ...(r[idItem] || {}), ...p } }));
  const contagem = useMemo(() => {
    const c: Record<FaltaLogistica, number> = { PESO: 0, MEDIDAS: 0, EMBALAGEM: 0, FOTO: 0 };
    for (const i of itens || []) for (const f of i.faltas) c[f]++;
    return c;
  }, [itens]);
  const familiasDosMarcados = [...new Set((itens || []).filter(i => marcados.includes(i.idItem)).map(i => i.idFamilia).filter((x): x is number => !!x))];

  const salvar = async () => {
    setSalvando(true);
    try {
      const r = await logisticaApi.salvar(mudancas);
      message.success(`${r.salvos} item(ns) salvo(s).`);
      await buscar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  const salvarRegras = async () => {
    if (!editorRegras) return;
    try {
      const alvo = editorRegras.alvo === 'FAMILIAS' ? { idsFamilias: familiasDosMarcados } : { idsItens: marcados };
      const r = await logisticaApi.salvarRegras(alvo, editorRegras.regras.filter(x => x.idEmbalagem));
      message.success(editorRegras.alvo === 'FAMILIAS' ? `Embalagem salva em ${r.familias} família(s).` : `Embalagem própria salva em ${r.itens} item(ns).`);
      setEditorRegras(null);
      await buscar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  const criarEmbalagem = async () => {
    if (!novaEmb) return;
    try {
      const r = await logisticaApi.criarEmbalagem(novaEmb);
      message.success(`Embalagem ${r.sku} criada.`);
      setNovaEmb(null);
      carregarEmbalagens();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  const numero = (v: number | null, onChange: (v: number | null) => void, w = 72, passo = 0.1) => (
    <InputNumber size="small" min={0} step={passo} decimalSeparator="," style={{ width: w }} value={v ?? undefined} onChange={x => onChange(x === null || x === undefined ? null : Number(x))} />
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}><InboxOutlined /> Logística em lote</Title>
        <Text type="secondary">Peso e medidas da embalagem do produto e a embalagem de envio por quantidade. É o que o frete do Mercado Livre usa, e o custo da embalagem entra no lucro de cada envio.</Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card size="small" title="1. Quais itens" style={{ height: '100%' }}>
            <FiltroItensLote opcoes={opcoes} filtro={filtro} setFiltro={setFiltro} onEnter={buscar} />
            <Flex justify="flex-end" style={{ marginTop: 10 }}>
              <Button type="primary" icon={<SearchOutlined />} loading={carregando} onClick={buscar}>Buscar itens</Button>
            </Flex>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title={`Embalagens (${embalagens.length})`} style={{ height: '100%' }}
            extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setNovaEmb({ nome: '', pesoKg: null, altura: null, largura: null, comprimento: null, custo: 0 })}>Nova embalagem</Button>}>
            {embalagens.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma embalagem ainda" /> : (
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {embalagens.map(e => (
                  <Flex key={e.idEmbalagem} justify="space-between" style={{ padding: '3px 0', borderBottom: '1px solid #f5f5f5' }}>
                    <div>
                      <Text>{e.nome}</Text> <Text type="secondary" style={{ fontSize: 11 }}>{e.sku}</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{textoMedidas(e.medidas)}{e.pesoKg ? ` · ${e.pesoKg} kg` : ''}</Text></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Text>{brl(e.custo)}</Text>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>estoque {e.estoque}</Text></div>
                    </div>
                  </Flex>
                ))}
              </div>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>Embalagem é um item de consumo: o custo e o estoque entram pela NF de compra, como qualquer item.</Text>
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginTop: 12 }}
        title={<Space wrap>
          <span>2. Itens</span>
          <Segmented size="small" value={falta} onChange={v => setFalta(v as FaltaLogistica | 'TODOS')} options={[
            { value: 'TODOS', label: `Todos${itens ? ` (${itens.length})` : ''}` },
            ...(['PESO', 'MEDIDAS', 'EMBALAGEM', 'FOTO'] as FaltaLogistica[]).map(f => ({ value: f, label: `${ROTULO_FALTA[f]}${itens && falta === 'TODOS' ? ` (${contagem[f]})` : ''}` })),
          ]} />
        </Space>}
        extra={itens && <Button type="primary" icon={<SaveOutlined />} disabled={!mudancas.length} loading={salvando} onClick={salvar}>Salvar {mudancas.length || ''} alteração(ões)</Button>}>
        {!itens ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Escolha os itens no filtro e clique em Buscar itens" /> : (
          <>
            {marcados.length > 0 && (
              <Flex gap={8} wrap align="center" style={{ marginBottom: 8, padding: '6px 10px', background: '#e6f4ff', borderRadius: 6 }}>
                <Text>{marcados.length} marcado(s)</Text>
                <Popover trigger="click" title="Peso e medidas nos marcados" content={
                  <Space direction="vertical">
                    <Flex gap={6} align="center"><Text style={{ width: 90 }}>Peso (kg)</Text>{numero(lote.pesoKg ?? null, v => setLote(l => ({ ...l, pesoKg: v })), 100, 0.01)}</Flex>
                    <Flex gap={6} align="center"><Text style={{ width: 90 }}>A × L × C (cm)</Text>
                      {numero(lote.altura ?? null, v => setLote(l => ({ ...l, altura: v })))}{numero(lote.largura ?? null, v => setLote(l => ({ ...l, largura: v })))}{numero(lote.comprimento ?? null, v => setLote(l => ({ ...l, comprimento: v })))}
                    </Flex>
                    <Text type="secondary" style={{ fontSize: 12 }}>Só os campos preenchidos mudam. Depois clique em Salvar.</Text>
                    <Button type="primary" size="small" onClick={() => { setRascunho(r => aplicarNosMarcados(r, marcados, lote)); message.info('Valores postos nos marcados: confira e salve.'); }}>Pôr nos marcados</Button>
                  </Space>
                }>
                  <Button size="small">Peso e medidas…</Button>
                </Popover>
                <Tooltip title="Vale para todos os itens das famílias dos marcados, inclusive os que entrarem depois">
                  <Button size="small" disabled={!familiasDosMarcados.length} onClick={() => setEditorRegras({ alvo: 'FAMILIAS', regras: [{ quantidadeAte: 2, idEmbalagem: 0 }] })}>
                    Embalagem das famílias ({familiasDosMarcados.length})
                  </Button>
                </Tooltip>
                <Tooltip title="Embalagem própria só dos itens marcados (a exceção da família)">
                  <Button size="small" onClick={() => setEditorRegras({ alvo: 'ITENS', regras: [{ quantidadeAte: 1, idEmbalagem: 0 }] })}>Embalagem só dos itens</Button>
                </Tooltip>
                <Button size="small" type="link" onClick={() => setMarcados([])}>Limpar seleção</Button>
              </Flex>
            )}
            <Table<ItemLogistica>
              size="small" rowKey="idItem" dataSource={itens} pagination={{ pageSize: 50, hideOnSinglePage: true }}
              rowSelection={{ selectedRowKeys: marcados, onChange: k => setMarcados(k as number[]) }}
              columns={[
                {
                  title: 'Item', render: (_, i) => (
                    <div style={{ lineHeight: 1.3 }}>
                      <Text strong>{i.sku}</Text> <Text>{i.nome}</Text>
                      <div><Text type="secondary" style={{ fontSize: 11 }}>{[i.familia, i.marca].filter(Boolean).join(' · ')}</Text></div>
                    </div>
                  ),
                },
                {
                  title: 'Peso (kg)', width: 95,
                  render: (_, i) => { const v = valoresDaLinha(i, rascunho); return numero(v.pesoKg, x => editar(i.idItem, { pesoKg: x }), 82, 0.01); },
                },
                {
                  title: <Tooltip title="Medidas da embalagem do produto (altura × largura × comprimento)">A × L × C (cm)</Tooltip>, width: 240,
                  render: (_, i) => {
                    const v = valoresDaLinha(i, rascunho);
                    return (
                      <Flex gap={4}>
                        {numero(v.altura, x => editar(i.idItem, { altura: x }))}{numero(v.largura, x => editar(i.idItem, { largura: x }))}{numero(v.comprimento, x => editar(i.idItem, { comprimento: x }))}
                      </Flex>
                    );
                  },
                },
                {
                  title: 'Embalagem de envio', width: 260,
                  render: (_, i) => i.embalagens.regras.length ? (
                    <div>
                      {i.embalagens.regras.map(r => (
                        <div key={r.quantidadeAte}><Text style={{ fontSize: 12 }}>até {r.quantidadeAte}: {r.embalagem?.nome || '?'}</Text></div>
                      ))}
                      <Text type="secondary" style={{ fontSize: 11 }}>{i.embalagens.origem === 'ITEM' ? 'só deste item' : 'da família'}</Text>
                    </div>
                  ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
                },
                {
                  title: 'O que falta', width: 200,
                  render: (_, i) => i.faltas.length
                    ? i.faltas.map(f => <Tag key={f} color={COR_FALTA[f]} style={{ marginBottom: 2 }}>{ROTULO_FALTA[f]}</Tag>)
                    : <Tag color="green">completo</Tag>,
                },
              ]}
            />
            {mudancas.length > 0 && <Alert type="info" showIcon style={{ marginTop: 8 }} message={`${mudancas.length} alteração(ões) ainda não salva(s).`} />}
          </>
        )}
      </Card>

      <Modal open={!!editorRegras} width={620} destroyOnHidden okText="Salvar" cancelText="Voltar" onCancel={() => setEditorRegras(null)} onOk={salvarRegras}
        title={editorRegras?.alvo === 'FAMILIAS' ? `Embalagem de ${familiasDosMarcados.length} família(s)` : `Embalagem própria de ${marcados.length} item(ns)`}>
        {editorRegras && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {embalagens.length === 0 && <Alert type="warning" showIcon message="Cadastre uma embalagem antes (botão Nova embalagem)." />}
            <EditorRegras regras={editorRegras.regras} embalagens={embalagens} onChange={regras => setEditorRegras(e => e && { ...e, regras })} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {editorRegras.alvo === 'FAMILIAS' ? 'Troca a embalagem das famílias pelas faixas acima. Sem faixa nenhuma, tira a embalagem.'
                : 'Os itens passam a usar só estas faixas, não as da família. Sem faixa nenhuma, voltam a usar as da família.'}
            </Text>
          </Space>
        )}
      </Modal>

      <Modal open={!!novaEmb} title="Nova embalagem" okText="Criar" cancelText="Voltar" onCancel={() => setNovaEmb(null)} onOk={criarEmbalagem} destroyOnHidden>
        {novaEmb && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>Nome</Text>
            <Input placeholder="Ex.: Caixa de papelão nº 1, Envelope plástico P" maxLength={255} value={novaEmb.nome} onChange={e => setNovaEmb({ ...novaEmb, nome: e.target.value })} />
            <Text>Medidas por fora (cm): altura × largura × comprimento</Text>
            <Flex gap={6}>
              {numero(novaEmb.altura, v => setNovaEmb({ ...novaEmb, altura: v }), 100)}{numero(novaEmb.largura, v => setNovaEmb({ ...novaEmb, largura: v }), 100)}{numero(novaEmb.comprimento, v => setNovaEmb({ ...novaEmb, comprimento: v }), 100)}
            </Flex>
            <Flex gap={16}>
              <span><Text>Peso (kg) </Text>{numero(novaEmb.pesoKg, v => setNovaEmb({ ...novaEmb, pesoKg: v }), 100, 0.005)}</span>
              <span><Text>Custo (R$) </Text>{numero(novaEmb.custo, v => setNovaEmb({ ...novaEmb, custo: v || 0 }), 100, 0.05)}</span>
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>Vira um item de consumo (CON-…), fora do PDV. O custo se atualiza quando a NF da embalagem entrar.</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default LogisticaLote;
