// Aba Anúncios: o dia a dia no ML. Cada linha mostra quanto você recebe e o lucro (tarifa e frete grátis do ML sobre o
// custo do ERP), o estoque que vai ao ML e ações rápidas (preço, estoque, ativo/pausado), além dos rascunhos e pendências.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Col, Empty, Flex, Input, Popconfirm, Row, Segmented, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import {
  CloudDownloadOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PauseCircleOutlined, PictureOutlined, PlayCircleOutlined, PlusOutlined,
  ReloadOutlined, SyncOutlined,
} from '@ant-design/icons';
import {
  AnuncioResumo, anunciosApi, FinanceiroItem, formatarMoeda, ItemResumo, resumoSincronizacao, ROTULO_STATUS_ML, ROTULO_TIPO_ANUNCIO, SituacaoSincronizacao,
} from './mercadoLivreApi';
import { faixaMoeda, FiltroLista, lucroBaixo, passaNoFiltro, resumirFinanceiro, ResumoFinanceiro, semEstoqueNoMl } from './listaAnuncios';
import { AtivoNoMl, EstoqueRapido, PrecoRapido } from './AcoesRapidas';
import AdicionarAnuncioModal from './AdicionarAnuncioModal';
import AnuncioEditor from './AnuncioEditor';
import SituacaoTag from './SituacaoTag';
import ImportarMlModal from './ImportarMlModal';
import AjudaCatalogo from './AjudaCatalogo';

const { Text } = Typography;

const NIVEL: Record<string, { texto: string; cor: string }> = {
  PREJUIZO: { texto: 'Prejuízo', cor: 'red' }, BAIXO: { texto: 'Abaixo do alvo', cor: 'orange' },
  BOM: { texto: 'Bom', cor: 'green' }, ALTO: { texto: 'Alto', cor: 'blue' }, SEM_CUSTO: { texto: 'Sem custo', cor: 'default' },
};
const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(0)}%`);
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erro.');

/** Você recebe / lucro de um item, com a conta no tooltip. */
const LucroItem: React.FC<{ f: FinanceiroItem | undefined }> = ({ f }) => {
  if (!f) return <Text type="secondary">—</Text>;
  return (
    <Tooltip title={(
      <div style={{ fontSize: 12 }}>
        {formatarMoeda(f.preco)} − tarifa {formatarMoeda(f.tarifa)} − frete {f.frete ? formatarMoeda(f.frete) : 'R$ 0,00'}{!f.freteGratis && !f.frete ? ' (comprador paga)' : ''}
        {' '}= {formatarMoeda(f.recebe)}<br />− custo {formatarMoeda(f.custo)} = {formatarMoeda(f.lucro)} ({pct(f.lucroSobreCustoPct)} sobre o custo, alvo {f.alvoPct}%)
        {f.freteDesconhecido && <div>Frete não calculado: item sem peso no cadastro.</div>}
      </div>
    )}>
      <div style={{ lineHeight: 1.25, textAlign: 'right' }}>
        <div><Text strong>{formatarMoeda(f.recebe)}</Text></div>
        <Text style={{ fontSize: 12, color: f.lucro < 0 ? '#cf1322' : undefined }}>lucro {formatarMoeda(f.lucro)}</Text>
      </div>
    </Tooltip>
  );
};

const AnunciosMercadoLivre: React.FC = () => {
  const [anuncios, setAnuncios] = useState<AnuncioResumo[]>([]);
  const [financeiro, setFinanceiro] = useState<Map<number, FinanceiroItem[]>>(new Map());
  const [carregando, setCarregando] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroLista>('todos');
  const [busca, setBusca] = useState('');
  const [adicionar, setAdicionar] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [importar, setImportar] = useState(false);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [emMassa, setEmMassa] = useState(false);

  const calcular = useCallback(async () => {
    setCalculando(true);
    try { setFinanceiro(new Map((await anunciosApi.financeiro()).map(a => [a.id, a.itens]))); }
    catch { /* a lista funciona sem o lucro */ }
    finally { setCalculando(false); }
  }, []);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setAnuncios(await anunciosApi.listar()); }
    catch (e) { message.error(erroMsg(e)); }
    finally { setCarregando(false); }
    calcular();
  }, [calcular]);
  useEffect(() => { carregar(); }, [carregar]);

  // Atualização automática de estoque/preço no ML: mostra a última rodada e permite rodar agora
  const [auto, setAuto] = useState<SituacaoSincronizacao | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const lerAuto = useCallback(() => { anunciosApi.situacaoSincronizacao().then(setAuto).catch(() => undefined); }, []);
  useEffect(() => {
    lerAuto();
    const t = window.setInterval(lerAuto, 60 * 1000);
    return () => window.clearInterval(t);
  }, [lerAuto]);
  const sincronizarTodos = async () => {
    setSincronizando(true);
    try {
      const r = await anunciosApi.sincronizarTodos();
      const resumo = resumoSincronizacao(r.enviados);
      message[resumo.tipo](resumo.texto, 6);
      carregar();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setSincronizando(false);
    }
  };

  const resumos = useMemo(() => new Map(anuncios.map(a => [a.id, resumirFinanceiro(financeiro.get(a.id))])), [anuncios, financeiro]);
  const fin = (a: AnuncioResumo): ResumoFinanceiro | null => resumos.get(a.id) ?? null;

  const contagem = useMemo(() => {
    const conta = (f: FiltroLista) => anuncios.filter(a => passaNoFiltro(a, resumos.get(a.id) ?? null, f)).length;
    return { pendentes: conta('pendentes'), prontos: conta('prontos'), publicados: conta('publicados'), pausados: conta('pausados'), lucroBaixo: conta('lucroBaixo'), semEstoque: conta('semEstoque') };
  }, [anuncios, resumos]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return anuncios.filter(a => passaNoFiltro(a, resumos.get(a.id) ?? null, filtro)
      && (!t || [a.titulo, a.familia, a.categoriaNome, a.mlbId, ...a.itens.map(i => `${i.sku} ${i.mlbId || ''}`)].some(x => String(x || '').toLowerCase().includes(t))));
  }, [anuncios, resumos, filtro, busca]);

  // ações que gravam e recarregam a lista
  const acao = async (fazer: () => Promise<unknown>, ok: string) => {
    try { await fazer(); message.success(ok); carregar(); }
    catch (e) { message.error(erroMsg(e), 6); carregar(); throw e; }
  };
  const excluir = (id: number) => acao(() => anunciosApi.excluir(id), 'Rascunho excluído.').catch(() => undefined);
  const salvarPreco = (a: AnuncioResumo, i: ItemResumo, preco: number) =>
    acao(() => anunciosApi.precoItem(a.id, i.idItem, preco), i.mlbId ? `Preço de ${i.sku} salvo e enviado ao ML.` : `Preço de ${i.sku} salvo.`).catch(() => undefined);
  const salvarEstoque = (a: AnuncioResumo, r: { estoqueReserva: number; estoqueMaximo: number | null }) =>
    acao(() => anunciosApi.salvar(a.id, r), a.publicados ? 'Estoque salvo e enviado ao ML.' : 'Estoque salvo.').catch(() => undefined);
  const ativar = (a: AnuncioResumo, sim: boolean) =>
    acao(() => anunciosApi.pausarNoMl(a.id, !sim), sim ? 'Reativado no Mercado Livre.' : 'Pausado no Mercado Livre.').catch(() => undefined);

  const emLote = async (ativarTodos: boolean) => {
    const alvo = anuncios.filter(a => selecionados.includes(a.id) && a.ativosMl + a.pausadosMl > 0);
    setEmMassa(true);
    const falhas: string[] = [];
    for (const a of alvo) {
      try { await anunciosApi.pausarNoMl(a.id, !ativarTodos); } catch (e) { falhas.push(`${a.titulo}: ${erroMsg(e)}`); }
    }
    setEmMassa(false);
    setSelecionados([]);
    if (falhas.length) message.warning(`${alvo.length - falhas.length} ok, ${falhas.length} com erro: ${falhas[0]}`, 8);
    else message.success(`${alvo.length} anúncio(s) ${ativarTodos ? 'reativados' : 'pausados'} no ML.`);
    carregar();
  };

  const itemDoFin = (a: AnuncioResumo, idItem: number) => financeiro.get(a.id)?.find(f => f.idItem === idItem);

  const colunaLucro = (a: AnuncioResumo) => {
    const r = fin(a);
    if (a.itens.length === 1) return <LucroItem f={itemDoFin(a, a.itens[0].idItem)} />;
    if (!r) return calculando ? <Spin size="small" /> : <Text type="secondary">—</Text>;
    return (
      <div style={{ lineHeight: 1.25, textAlign: 'right' }}>
        <div><Text strong>{faixaMoeda(r.recebeMin, r.recebeMax, formatarMoeda)}</Text></div>
        <Text style={{ fontSize: 12, color: r.lucroMin < 0 ? '#cf1322' : undefined }}>lucro {faixaMoeda(r.lucroMin, r.lucroMax, formatarMoeda)}</Text>
      </div>
    );
  };

  const itensExpandidos = (a: AnuncioResumo) => (
    <Table<ItemResumo>
      size="small" rowKey="idItem" dataSource={a.itens} pagination={false} style={{ margin: '4px 0' }}
      columns={[
        {
          title: 'Item', render: (_, i) => (
            <Space size={8}>
              {i.fotoUrl ? <Avatar shape="square" size={32} src={i.fotoUrl} /> : <Avatar shape="square" size={32} icon={<PictureOutlined />} style={{ background: '#f5f5f5', color: '#bbb' }} />}
              <div style={{ lineHeight: 1.25 }}>
                <Text strong>{i.sku}</Text> <Text type="secondary" style={{ fontSize: 12 }}>{i.nome}</Text>
                <div>
                  {i.mlbId
                    ? <a href={i.permalink || undefined} target="_blank" rel="noreferrer"><Tag color={ROTULO_STATUS_ML[i.status || '']?.cor} style={{ fontSize: 11 }}>{i.mlbId} · {ROTULO_STATUS_ML[i.status || '']?.texto || i.status}</Tag></a>
                    : <Tag style={{ fontSize: 11 }}>a publicar</Tag>}
                </div>
              </div>
            </Space>
          ),
        },
        { title: 'Preço no ML', width: 190, render: (_, i) => <PrecoRapido valor={i.preco} proprio={i.precoMl !== null} onSalvar={v => salvarPreco(a, i, v)} /> },
        { title: 'Recebe / lucro', width: 130, align: 'right', render: (_, i) => <LucroItem f={itemDoFin(a, i.idItem)} /> },
        {
          title: '', width: 110, align: 'right',
          render: (_, i) => { const f = itemDoFin(a, i.idItem); return f ? <Tag color={NIVEL[f.nivel].cor}>{NIVEL[f.nivel].texto}</Tag> : null; },
        },
        {
          title: 'Estoque', width: 120, align: 'right',
          render: (_, i) => <Text><Text type="secondary" style={{ fontSize: 12 }}>ERP {i.estoque} →</Text> <Text strong style={{ color: i.mlbId && i.estoqueMl === 0 ? '#cf1322' : undefined }}>ML {i.estoqueMl}</Text>{i.unidade ? <Text type="secondary" style={{ fontSize: 11 }}> {i.unidade}</Text> : null}</Text>,
        },
      ]}
    />
  );

  const qtdSelecionaveis = selecionados.length;

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={() => setFiltro('publicados')}><Statistic title="Publicados" value={contagem.publicados} suffix={contagem.pausados ? <Text type="secondary" style={{ fontSize: 13 }}>· {contagem.pausados} pausado(s)</Text> : null} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small" hoverable onClick={() => setFiltro('lucroBaixo')}>
            <Statistic title={<Space size={4}>Lucro baixo ou prejuízo{calculando && <Spin size="small" />}</Space>} value={contagem.lucroBaixo} valueStyle={{ color: contagem.lucroBaixo ? '#d46b08' : undefined }} />
          </Card>
        </Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={() => setFiltro('semEstoque')}><Statistic title="Sem estoque no ML" value={contagem.semEstoque} valueStyle={{ color: contagem.semEstoque ? '#cf1322' : undefined }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small" hoverable onClick={() => setFiltro('pendentes')}><Statistic title="Rascunhos com pendência" value={contagem.pendentes} suffix={contagem.prontos ? <Text type="secondary" style={{ fontSize: 13 }}>· {contagem.prontos} pronto(s)</Text> : null} /></Card></Col>
      </Row>

      <Card size="small">
        <Flex justify="space-between" wrap gap={8} style={{ marginBottom: 12 }}>
          <Space wrap>
            <Segmented<FiltroLista> value={filtro} onChange={setFiltro} options={[
              { value: 'todos', label: `Todos (${anuncios.length})` },
              { value: 'publicados', label: `Publicados (${contagem.publicados})` },
              { value: 'pausados', label: `Pausados (${contagem.pausados})` },
              { value: 'lucroBaixo', label: `Lucro baixo (${contagem.lucroBaixo})` },
              { value: 'semEstoque', label: `Sem estoque (${contagem.semEstoque})` },
              { value: 'pendentes', label: `Com pendência (${contagem.pendentes})` },
              { value: 'prontos', label: `Prontos (${contagem.prontos})` },
            ]} />
            <Input.Search placeholder="Buscar por título, SKU ou MLB" allowClear value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 260 }} />
          </Space>
          <Space wrap>
            {contagem.publicados > 0 && (
              <Tooltip title={
                <>
                  Manda o estoque e o preço do ERP para os anúncios com "Atualizar sozinho" ligado.
                  {auto && <div style={{ marginTop: 4 }}>Automático a cada {auto.intervaloMin} min{auto.ultimaEm ? ` · última: ${new Date(auto.ultimaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${auto.enviados} enviados${auto.erros ? `, ${auto.erros} com erro` : ''})` : ' · ainda não rodou'}</div>}
                  {auto?.mensagem && <div>Último erro: {auto.mensagem}</div>}
                </>
              }>
                <Button icon={<SyncOutlined spin={sincronizando || !!auto?.rodando} />} onClick={sincronizarTodos} loading={sincronizando} danger={!!auto?.erros}>
                  Atualizar estoque no ML
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Recarregar a lista e recalcular o lucro"><Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando || calculando} /></Tooltip>
            <AjudaCatalogo />
            <Tooltip title="Liga ao ERP os anúncios que você já tem no Mercado Livre (pelo SKU)">
              <Button icon={<CloudDownloadOutlined />} onClick={() => setImportar(true)}>Importar do ML</Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdicionar(true)}>Adicionar do catálogo</Button>
          </Space>
        </Flex>

        {qtdSelecionaveis > 0 && (
          <Flex align="center" gap={8} wrap style={{ background: '#f0f7ff', border: '1px solid #bae0ff', borderRadius: 6, padding: '6px 12px', marginBottom: 8 }}>
            <Text strong>{qtdSelecionaveis} selecionado(s)</Text>
            <Popconfirm title={`Pausar ${qtdSelecionaveis} anúncio(s) no ML?`} okText="Pausar" onConfirm={() => emLote(false)}>
              <Button size="small" icon={<PauseCircleOutlined />} loading={emMassa}>Pausar no ML</Button>
            </Popconfirm>
            <Button size="small" icon={<PlayCircleOutlined />} loading={emMassa} onClick={() => emLote(true)}>Reativar no ML</Button>
            <Button size="small" type="link" onClick={() => setSelecionados([])}>Limpar seleção</Button>
          </Flex>
        )}

        <Table<AnuncioResumo>
          size="middle" rowKey="id" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 1100 }}
          rowSelection={{
            selectedRowKeys: selecionados, onChange: k => setSelecionados(k as number[]),
            getCheckboxProps: a => ({ disabled: a.ativosMl + a.pausadosMl === 0 }),
          }}
          expandable={{ rowExpandable: a => a.itens.length > 1, expandedRowRender: itensExpandidos }}
          rowClassName={a => (lucroBaixo(fin(a)) && fin(a)!.nivel === 'PREJUIZO' ? 'ml-linha-erro' : '')}
          locale={{
            emptyText: (
              <Empty description={anuncios.length ? 'Nada neste filtro.' : 'Nenhum anúncio ainda: comece escolhendo uma família ou itens do catálogo.'}>
                {!anuncios.length && <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdicionar(true)}>Adicionar do catálogo</Button>}
              </Empty>
            ),
          }}
          columns={[
            {
              title: '', width: 56,
              render: (_, a) => a.fotoUrl
                ? <Avatar shape="square" size={44} src={a.fotoUrl} />
                : <Avatar shape="square" size={44} icon={<PictureOutlined />} style={{ background: '#f5f5f5', color: '#bbb' }} />,
            },
            {
              title: 'Anúncio',
              render: (_, a) => (
                <div style={{ lineHeight: 1.35 }}>
                  <a onClick={() => setEditando(a.id)}><Text strong>{a.titulo || '(sem título)'}</Text></a>
                  <div>
                    <Space size={4} wrap>
                      <SituacaoTag a={a} />
                      <Tag>{ROTULO_TIPO_ANUNCIO[a.tipoAnuncio] || a.tipoAnuncio}</Tag>
                      {a.itens.length > 1 ? <Tag>{a.itens.length} itens</Tag> : a.itens[0] && <Text type="secondary" style={{ fontSize: 12 }}>{a.itens[0].sku}</Text>}
                      {a.itens.length === 1 && a.itens[0].mlbId && <Text type="secondary" style={{ fontSize: 12 }}>· {a.itens[0].mlbId}</Text>}
                    </Space>
                  </div>
                </div>
              ),
            },
            {
              title: 'Preço no ML', width: 190,
              render: (_, a) => (a.itens.length === 1
                ? <PrecoRapido valor={a.itens[0].preco} proprio={a.itens[0].precoMl !== null} onSalvar={v => salvarPreco(a, a.itens[0], v)} />
                : <Text>{a.precoMin === null ? '—' : faixaMoeda(a.precoMin, a.precoMax ?? a.precoMin, formatarMoeda)}</Text>),
            },
            { title: <Tooltip title="Preço − tarifa − frete grátis do ML, e o lucro sobre o custo do ERP. Passe o mouse para ver a conta.">Você recebe</Tooltip>, width: 140, align: 'right', render: (_, a) => colunaLucro(a) },
            {
              title: 'Lucro', width: 120,
              render: (_, a) => {
                const r = fin(a);
                if (!r) return calculando ? <Spin size="small" /> : null;
                return <Tooltip title={`Pior item: ${pct(r.pctMin)} sobre o custo`}><Tag color={NIVEL[r.nivel].cor}>{NIVEL[r.nivel].texto}</Tag></Tooltip>;
              },
            },
            {
              title: 'Estoque', width: 130, align: 'right',
              render: (_, a) => (
                <EstoqueRapido
                  erp={a.estoque} ml={a.estoqueMl} noMl={a.ativosMl + a.pausadosMl > 0} reserva={a.estoqueReserva} maximo={a.estoqueMaximo}
                  onSalvar={r => salvarEstoque(a, r)}
                />
              ),
            },
            {
              title: 'No ML', width: 100, align: 'center',
              render: (_, a) => (semEstoqueNoMl(a) && a.ativosMl > 0
                ? <Tooltip title="Sem estoque: o ML não vende até o estoque voltar"><Tag color="red">sem estoque</Tag></Tooltip>
                : <AtivoNoMl ativos={a.ativosMl} pausados={a.pausadosMl} onMudar={sim => ativar(a, sim)} />),
            },
            {
              title: '', width: 110, align: 'right', fixed: 'right',
              render: (_, a) => (
                <Space size={0}>
                  <Tooltip title="Abrir o editor"><Button type="text" icon={<EditOutlined />} onClick={() => setEditando(a.id)} /></Tooltip>
                  {a.permalink && <Tooltip title="Ver no Mercado Livre"><Button type="text" icon={<ExportOutlined />} href={a.permalink} target="_blank" /></Tooltip>}
                  {(a.situacao === 'RASCUNHO' || a.situacao === 'ENCERRADO') && (
                    <Popconfirm title={a.situacao === 'ENCERRADO' ? 'Excluir do ERP? (no ML ele já foi excluído/encerrado)' : 'Excluir este rascunho?'} description="Os itens voltam a ficar livres para outro anúncio." okText="Excluir" okButtonProps={{ danger: true }} onConfirm={() => excluir(a.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <style>{'.ml-linha-erro > td { background: #fff7f6 !important; }'}</style>

      <AdicionarAnuncioModal
        aberto={adicionar}
        onFechar={() => setAdicionar(false)}
        onCriados={ids => { setAdicionar(false); carregar(); if (ids.length === 1) setEditando(ids[0]); }}
      />
      <AnuncioEditor id={editando} onFechar={() => setEditando(null)} onAlterado={carregar} />
      <ImportarMlModal aberto={importar} onFechar={() => setImportar(false)} onImportados={() => { setImportar(false); carregar(); }} />
    </>
  );
};

export default AnunciosMercadoLivre;
