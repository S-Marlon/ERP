// Estoque › Inventário rotativo: o sistema escolhe os itens do dia (uma área da loja por lista), imprime a folha com o
// saldo à vista; o conferente marca ✓ ou escreve a contagem, assina e anota a hora; aqui se lança (só o que mudou) e o
// estoque é ajustado pela diferença em relação ao saldo daquela hora. Divergência grande pede a senha de autorização.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AutoComplete, Button, Card, Col, DatePicker, Drawer, Empty, Flex, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tabs, Tag, Tooltip, TreeSelect, Typography, message } from 'antd';
import { CheckOutlined, DeleteOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { imprimirHtml } from '../../../shared/core/impressao/saida';
import { getSaldos } from '../api/estoqueItensApi';
import {
  AreaInventario, ConfigInventario, ErroInventario, htmlFolha, inventarioApi, ListaHistorico, ListaInventario, PainelInventario, ROTULO_MOTIVO,
} from './inventarioApi';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }));
const dataHora = (s?: string | null) => (s ? `${s.slice(0, 10).split('-').reverse().join('/')}${s.length > 10 ? ` ${s.slice(11, 16)}` : ''}` : '—');
const COR_MOTIVO: Record<string, string> = { PEDIDO: 'magenta', PROBLEMA: 'red', NUNCA_CONTADO: 'blue', CURVA_A: 'gold', CURVA_B: 'cyan', CURVA_C: 'default' };

const imprimirLista = async (id: number) => {
  try { await imprimirHtml(htmlFolha(await inventarioApi.lista(id))); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao imprimir.'); }
};

// ------------------------------------------------------------------ lançamento da folha

const LancarLista: React.FC<{ id: number | null; onFechar: () => void; onLancado: () => void }> = ({ id, onFechar, onLancado }) => {
  const [l, setL] = useState<ListaInventario | null>(null);
  const [contados, setContados] = useState<Record<number, number | null>>({});
  const [naoContados, setNaoContados] = useState<Record<number, boolean>>({});
  const [conferente, setConferente] = useState('');
  const [contadoEm, setContadoEm] = useState(dayjs());
  const [salvando, setSalvando] = useState(false);
  const [autorizar, setAutorizar] = useState<string[] | null>(null);
  const [aut, setAut] = useState({ senha: '', nome: '' });

  useEffect(() => {
    if (!id) return;
    setL(null); setConferente(''); setContadoEm(dayjs()); setAutorizar(null); setNaoContados({});
    inventarioApi.lista(id).then(x => {
      setL(x);
      // Folha: o conferente só escreve onde mudou; o resto é o saldo impresso
      setContados(Object.fromEntries(x.itens.map(i => [i.idItem, i.contado ?? i.saldoImpresso])));
    }).catch(e => { message.error(e.message); onFechar(); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!id) return null;
  const lancada = l?.status !== 'ABERTA';
  const alterados = l ? l.itens.filter(i => !naoContados[i.idItem] && contados[i.idItem] !== null && Number(contados[i.idItem]) !== i.saldoImpresso) : [];

  const lancar = async (autorizacao?: { senha: string; nome: string }) => {
    if (!l) return;
    setSalvando(true);
    try {
      const r = await inventarioApi.lancar(l.id, {
        conferente: conferente.trim(), contadoEm: contadoEm.format('YYYY-MM-DD HH:mm'), autorizacao,
        itens: l.itens.map(i => ({ idItem: i.idItem, contado: naoContados[i.idItem] ? null : contados[i.idItem] ?? null })),
      });
      setAutorizar(null);
      message.success(`Lista ${l.id} lançada: ${r.contados} contados, ${r.ajustados} ajustados${r.naoContados ? `, ${r.naoContados} não contados (voltam nas próximas)` : ''}.`);
      onLancado();
    } catch (e) {
      if (e instanceof ErroInventario && e.detalhes?.codigo === 'AUTORIZACAO_NECESSARIA' && e.detalhes.temSenha) {
        if (e.detalhes.senhaIncorreta) message.error('Senha incorreta.');
        setAutorizar(e.detalhes.motivos || []);
      } else message.error(e instanceof Error ? e.message : 'Erro ao lançar.');
    } finally { setSalvando(false); }
  };

  return (
    <Drawer open={!!id} onClose={onFechar} width="min(980px, 100vw)" destroyOnHidden loading={!l}
      title={l ? <Space wrap>Lista Nº {l.id}<Tag>{l.area}</Tag>{lancada && <Tag color="green">Lançada</Tag>}</Space> : 'Lista'}
      extra={l && <Space>
        <Button icon={<PrinterOutlined />} onClick={() => imprimirLista(l.id)}>Imprimir</Button>
        {!lancada && <Button type="primary" icon={<SaveOutlined />} loading={salvando} disabled={!conferente.trim()} onClick={() => lancar()}>Lançar contagem</Button>}
      </Space>}>
      {l && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {lancada ? (
            <Alert type="success" showIcon title={`Contada por ${l.conferente || '—'} em ${dataHora(l.contado)}${l.autorizadoPor ? ` · divergência autorizada por ${l.autorizadoPor}` : ''}`} />
          ) : (
            <>
              <Alert type="info" showIcon title="Digite só o que o conferente escreveu na folha (o resto já vem com o saldo do sistema). Item que não foi contado: marque &quot;não contou&quot;." />
              <Flex gap={8} wrap>
                <Input style={{ width: 260 }} placeholder="Conferente (quem assinou a folha)" value={conferente} maxLength={60} onChange={e => setConferente(e.target.value)} />
                <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" value={contadoEm} allowClear={false}
                  disabledDate={d => d.isAfter(dayjs(), 'day')} onChange={v => v && setContadoEm(v)} />
                <Tooltip title="O sistema compara com o saldo desta hora: o que vendeu ou entrou depois não conta como diferença">
                  <Text type="secondary" style={{ alignSelf: 'center' }}>hora em que contou</Text>
                </Tooltip>
              </Flex>
            </>
          )}
          <Table size="small" rowKey="idItem" pagination={false} dataSource={l.itens}
            rowClassName={i => (lancada ? '' : naoContados[i.idItem] ? 'linha-apagada' : '')}
            columns={[
              { title: '#', key: 'n', width: 36, render: (_, __, k) => k + 1 },
              {
                title: 'Item', key: 'i', render: (_, i) => <>
                  <Text strong style={{ fontSize: 13 }}>{i.nome}</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>{i.sku} · {i.categoria || 'sem categoria'}</Text>{' '}
                    <Tooltip title={i.detalheMotivo}><Tag color={COR_MOTIVO[i.motivo]} style={{ fontSize: 10, lineHeight: '16px' }}>{ROTULO_MOTIVO[i.motivo] || i.motivo}</Tag></Tooltip></div>
                </>,
              },
              { title: 'Sistema', key: 's', align: 'right' as const, width: 90, render: (_, i) => <>{qtd(lancada ? i.saldoNaContagem : i.saldoImpresso)} <Text type="secondary" style={{ fontSize: 11 }}>{i.unidade}</Text></> },
              {
                title: 'Contado', key: 'c', width: 190, render: (_, i) => lancada ? <b>{qtd(i.contado)}</b> : (
                  <Space size={4}>
                    <CampoNumero size="small" min={0} style={{ width: 96 }} disabled={naoContados[i.idItem]}
                      value={contados[i.idItem] ?? null} onChange={v => setContados({ ...contados, [i.idItem]: v === null ? null : Number(v) })} />
                    <Button size="small" type={naoContados[i.idItem] ? 'primary' : 'text'} onClick={() => setNaoContados({ ...naoContados, [i.idItem]: !naoContados[i.idItem] })}>
                      não contou</Button>
                  </Space>
                ),
              },
              {
                title: 'Diferença', key: 'd', align: 'right' as const, width: 130, render: (_, i) => {
                  const dif = lancada ? i.diferenca : naoContados[i.idItem] || contados[i.idItem] === null ? null : Math.round((Number(contados[i.idItem]) - i.saldoImpresso) * 1000) / 1000;
                  if (lancada && i.situacao === 'NAO_CONTADO') return <Text type="secondary">não contado</Text>;
                  if (dif === null) return '—';
                  if (dif === 0) return <CheckOutlined style={{ color: '#52c41a' }} />;
                  return <Text type={dif < 0 ? 'danger' : 'warning'}>{dif > 0 ? '+' : ''}{qtd(dif)} <Text type="secondary" style={{ fontSize: 11 }}>({brl(Math.abs(dif) * i.custo)})</Text></Text>;
                },
              },
            ]} />
          {!lancada && alterados.length > 0 && <Text type="secondary">{alterados.length} item(ns) com diferença em relação à folha.</Text>}
        </Space>
      )}
      <Modal open={!!autorizar} title="Divergência acima do limite" okText="Autorizar e lançar" cancelText="Voltar" confirmLoading={salvando}
        okButtonProps={{ disabled: !aut.senha || !aut.nome.trim() }} onCancel={() => setAutorizar(null)} onOk={() => lancar(aut)} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }}>
          {autorizar?.map((m, k) => <Text key={k} type="danger">{m}</Text>)}
          <Text type="secondary" style={{ fontSize: 12 }}>Antes de autorizar, vale recontar: diferença grande costuma ser item no lugar errado ou entrada/venda lançada errada.</Text>
          <Input.Password placeholder="Senha de autorização" value={aut.senha} onChange={e => setAut({ ...aut, senha: e.target.value })} />
          <Input placeholder="Quem autorizou" value={aut.nome} maxLength={60} onChange={e => setAut({ ...aut, nome: e.target.value })} />
        </Space>
      </Modal>
    </Drawer>
  );
};

// ------------------------------------------------------------------ áreas

const AbaAreas: React.FC<{ p: PainelInventario; onMudou: () => void }> = ({ p, onMudou }) => {
  const [edicao, setEdicao] = useState<Record<number, AreaInventario>>({});
  const arvore = useMemo(() => {
    const filhos = (pai: number | null): any[] => p.categorias.filter(c => c.pai === pai).map(c => ({ value: c.id, title: c.nome, children: filhos(c.id) }));
    return filhos(null);
  }, [p.categorias]);
  const areaDe = (idCat: number) => p.areas.find(a => a.categorias.includes(idCat));
  const salvar = async (a: AreaInventario) => {
    try { await inventarioApi.salvarArea(a); message.success('Área salva.'); setEdicao(e => { const x = { ...e }; delete x[a.id]; return x; }); onMudou(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Text type="secondary">Cada lista do dia sai de uma área só (o conferente não anda a loja inteira). A subcategoria herda a área da categoria de cima.
        Categorias sem área saem agrupadas pela categoria principal. Área desligada não entra nas listas (ex.: mangueiras até existir o fracionado).</Text>
      {p.areas.map(orig => {
        const a = edicao[orig.id] || orig;
        const mudou = !!edicao[orig.id];
        const mudar = (x: Partial<AreaInventario>) => setEdicao({ ...edicao, [orig.id]: { ...a, ...x } });
        return (
          <Card key={orig.id} size="small" title={<Space>
            <Input value={a.nome} maxLength={80} style={{ width: 300 }} onChange={e => mudar({ nome: e.target.value })} />
            <Tooltip title="Ordem no percurso da loja"><CampoNumero value={a.ordem} style={{ width: 80 }} prefix="#" onChange={v => mudar({ ordem: Number(v) || 0 })} /></Tooltip>
            <Switch checked={a.contar} checkedChildren="conta" unCheckedChildren="não conta" onChange={v => mudar({ contar: v })} />
          </Space>} extra={<Space>
            {mudou && <Button type="primary" size="small" icon={<SaveOutlined />} onClick={() => salvar(a)}>Salvar</Button>}
            <Popconfirm title="Excluir a área? As categorias dela ficam sem área." onConfirm={() => inventarioApi.excluirArea(orig.id).then(onMudou).catch(e => message.error(e.message))}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>}>
            <TreeSelect style={{ width: '100%' }} treeData={arvore} multiple treeCheckable={false} showSearch treeNodeFilterProp="title" placeholder="Categorias desta área"
              value={a.categorias} onChange={v => mudar({ categorias: v as number[] })} popupMatchSelectWidth={false} allowClear
              tagRender={({ value, closable, onClose }) => {
                const outra = areaDe(Number(value));
                return <Tag closable={closable} onClose={onClose} color={outra && outra.id !== orig.id ? 'orange' : undefined} style={{ marginInlineEnd: 4 }}>
                  {p.categorias.find(c => c.id === Number(value))?.nome}{outra && outra.id !== orig.id ? ` (sai de ${outra.nome})` : ''}</Tag>;
              }} />
          </Card>
        );
      })}
      <Button icon={<PlusOutlined />} onClick={() => inventarioApi.criarArea({ nome: 'Nova área', ordem: (p.areas.slice(-1)[0]?.ordem ?? 0) + 1, contar: true, categorias: [] })
        .then(onMudou).catch(e => message.error(e.message))}>Nova área</Button>
    </Space>
  );
};

// ------------------------------------------------------------------ página

const InventarioRotativo: React.FC = () => {
  const [p, setP] = useState<PainelInventario | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [grupo, setGrupo] = useState<string | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [historico, setHistorico] = useState<ListaHistorico[]>([]);
  const [cfg, setCfg] = useState<ConfigInventario | null>(null);
  const [buscaItem, setBuscaItem] = useState('');
  const [opcoesItem, setOpcoesItem] = useState<Array<{ value: string; label: string; id: number }>>([]);
  const [itemPedido, setItemPedido] = useState<{ id: number; nome: string } | null>(null);
  const [motivoPedido, setMotivoPedido] = useState('');

  const carregar = async () => {
    setCarregando(true);
    try {
      const [x, h] = await Promise.all([inventarioApi.painel(), inventarioApi.historico()]);
      setP(x); setHistorico(h); setCfg(x.config);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    const t = buscaItem.trim();
    if (t.length < 2) { setOpcoesItem([]); return; }
    const timer = setTimeout(() => {
      getSaldos({ busca: t, limit: 15 }).then(r => setOpcoesItem(r.data.map(i => ({ value: `${i.idItem}`, id: i.idItem, label: `${i.sku} · ${i.nome} (${qtd(i.quantidade)} ${i.unidade})` })))).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaItem]);

  const gerar = async () => {
    try {
      const r = await inventarioApi.gerar(grupo);
      message.success(`Lista Nº ${r.id} · ${r.grupo} · ${r.itens} itens.`);
      await carregar();
      imprimirLista(r.id);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  if (!p) return <div style={{ padding: 16 }}><Card loading /></div>;
  const ind = p.indicadores;
  const acuracidade = ind.contados ? ind.certos / ind.contados : null;
  const devidosTotal = p.grupos.reduce((a, g) => a + g.devidos, 0);

  return (
    <div style={{ padding: 16 }}>
      <style>{'.linha-apagada td { opacity: .45; }'}</style>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Inventário rotativo</Title>
            <Text type="secondary">Um pouco por dia: o sistema escolhe o que conferir, uma área da loja por lista.</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
        </Flex>

        <Row gutter={12}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="A conferir" value={devidosTotal} suffix="itens" /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Acuracidade (30 dias)" value={acuracidade === null ? '—' : `${(acuracidade * 100).toFixed(0)}%`}
            valueStyle={{ color: acuracidade === null ? undefined : acuracidade >= 0.95 ? '#389e0d' : acuracidade >= 0.85 ? '#d48806' : '#cf1322' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Contados (30 dias)" value={ind.contados} suffix={`em ${ind.listas} lista(s)`} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Tooltip title="Soma das diferenças pelo custo (positivo: sobrou; negativo: faltou)">
            <Statistic title="Ajuste no estoque (30 dias)" value={brl(ind.saldoAjustado)} valueStyle={{ color: ind.saldoAjustado < 0 ? '#cf1322' : undefined }} /></Tooltip></Card></Col>
        </Row>

        <Tabs items={[
          {
            key: 'hoje', label: 'Conferência', children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small" title="Lista do dia">
                  <Flex gap={8} wrap align="center">
                    <Select style={{ minWidth: 360 }} value={grupo} onChange={setGrupo} allowClear placeholder="Automático: a área mais urgente"
                      options={p.grupos.map(g => ({ value: g.grupo, label: `${g.nome} · ${g.devidos} a conferir${g.pedidos ? ` · ${g.pedidos} pedido(s)` : ''}${g.problemas ? ` · ${g.problemas} problema(s)` : ''}` }))} />
                    <Button type="primary" icon={<ThunderboltOutlined />} onClick={gerar} disabled={!p.grupos.length}>Gerar e imprimir ({p.config.itensPorDia} itens)</Button>
                  </Flex>
                  {!p.grupos.length && <Text type="secondary">Tudo em dia.</Text>}
                </Card>

                <Card size="small" title={`Listas abertas (${p.abertas.length})`}>
                  {p.abertas.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma folha em campo." /> : (
                    <Table size="small" rowKey="id" pagination={false} dataSource={p.abertas} columns={[
                      { title: 'Nº', dataIndex: 'id', width: 60 },
                      { title: 'Área', dataIndex: 'area' },
                      { title: 'Itens', dataIndex: 'itens', width: 70 },
                      { title: 'Emitida', dataIndex: 'criada', width: 130, render: (v: string) => dataHora(v) },
                      {
                        title: '', key: 'a', width: 280, render: (_, a) => <Space>
                          <Button size="small" type="primary" onClick={() => setAberta(a.id)}>Lançar contagem</Button>
                          <Button size="small" icon={<PrinterOutlined />} onClick={() => imprimirLista(a.id)} />
                          <Popconfirm title="Cancelar a lista? Os itens voltam para as próximas." onConfirm={() => inventarioApi.cancelar(a.id).then(carregar).catch(e => message.error(e.message))}>
                            <Button size="small" danger>Cancelar</Button>
                          </Popconfirm>
                        </Space>,
                      },
                    ]} />
                  )}
                </Card>

                <Card size="small" title="Pedidos de conferência" extra={<Text type="secondary" style={{ fontSize: 12 }}>entram primeiro na próxima lista da área do item</Text>}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Flex gap={8} wrap>
                      <AutoComplete style={{ flex: '1 1 280px' }} options={opcoesItem} value={itemPedido ? itemPedido.nome : buscaItem} placeholder="Buscar item (nome ou código)"
                        onChange={v => { setItemPedido(null); setBuscaItem(v); }}
                        onSelect={(_, o: any) => { setItemPedido({ id: o.id, nome: o.label }); }} />
                      <Input style={{ flex: '1 1 260px' }} placeholder="O que conferir (ex.: entrada da NF com quantidade estranha)" maxLength={150}
                        value={motivoPedido} onChange={e => setMotivoPedido(e.target.value)} />
                      <Button icon={<PlusOutlined />} disabled={!itemPedido || !motivoPedido.trim()} onClick={() => inventarioApi.pedirConferencia(itemPedido!.id, motivoPedido.trim())
                        .then(() => { message.success('Conferência pedida.'); setItemPedido(null); setBuscaItem(''); setMotivoPedido(''); carregar(); })
                        .catch(e => message.error(e.message))}>Pedir conferência</Button>
                    </Flex>
                    {p.pedidos.map(x => (
                      <Flex key={x.idItem} justify="space-between" align="center" gap={8}>
                        <Text><Tag color="magenta">{dataHora(x.pedida)}</Tag><b>{x.sku}</b> {x.nome} <Text type="secondary">— {x.motivo}</Text></Text>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => inventarioApi.retirarPedido(x.idItem).then(carregar).catch(e => message.error(e.message))} />
                      </Flex>
                    ))}
                  </Space>
                </Card>
              </Space>
            ),
          },
          {
            key: 'historico', label: 'Histórico', children: (
              <Table size="small" rowKey="id" dataSource={historico} pagination={{ pageSize: 20, hideOnSinglePage: true }}
                onRow={h => ({ onClick: () => h.status === 'LANCADA' && setAberta(h.id), style: { cursor: h.status === 'LANCADA' ? 'pointer' : undefined } })}
                columns={[
                  { title: 'Nº', dataIndex: 'id', width: 60 },
                  { title: 'Área', dataIndex: 'area' },
                  { title: 'Situação', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'LANCADA' ? 'green' : 'default'}>{v === 'LANCADA' ? 'Lançada' : 'Cancelada'}</Tag> },
                  { title: 'Conferente', dataIndex: 'conferente', width: 140, render: (v: string | null) => v || '—' },
                  { title: 'Contada em', dataIndex: 'contado', width: 130, render: (v: string | null) => dataHora(v) },
                  { title: 'Itens', key: 'i', width: 140, render: (_, h) => h.status === 'LANCADA' ? `${h.certos} certos · ${h.ajustados} ajustados` : `${h.itens}` },
                  { title: 'Ajuste', dataIndex: 'saldoAjustado', align: 'right' as const, width: 110, render: (v: number) => <Text type={v < 0 ? 'danger' : undefined}>{brl(v)}</Text> },
                  { title: 'Autorizado', dataIndex: 'autorizadoPor', width: 110, render: (v: string | null) => v || '' },
                ]} />
            ),
          },
          { key: 'areas', label: 'Áreas da loja', children: <AbaAreas p={p} onMudou={carregar} /> },
          {
            key: 'config', label: 'Configuração', children: cfg && (
              <Card size="small" style={{ maxWidth: 640 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Flex gap={8} align="center"><Text style={{ width: 260 }}>Itens por lista</Text>
                    <CampoNumero min={1} max={200} value={cfg.itensPorDia} onChange={v => setCfg({ ...cfg, itensPorDia: Number(v) || 1 })} /></Flex>
                  <Flex gap={8} align="center"><Text style={{ width: 260 }}>Divergência que pede senha (R$)</Text>
                    <CampoDinheiro min={0} value={cfg.limiteDivergenciaValor} onChange={v => setCfg({ ...cfg, limiteDivergenciaValor: Number(v) || 0 })} /></Flex>
                  <Flex gap={8} align="center"><Text style={{ width: 260 }}>Ou acima de (% do saldo)</Text>
                    <CampoNumero min={0} max={100} suffix="%" value={Math.round(cfg.limiteDivergenciaPct * 100)} onChange={v => setCfg({ ...cfg, limiteDivergenciaPct: (Number(v) || 0) / 100 })} /></Flex>
                  <Text type="secondary" style={{ fontSize: 12 }}>O % só vale com diferença de pelo menos 20% do limite em R$ (para não pedir senha por centavos).</Text>
                  <Flex gap={8} align="center"><Text style={{ width: 260 }}>Recontar curva A (mais vendidos) a cada</Text>
                    <CampoNumero min={1} suffix="dias" value={cfg.diasCurvaA} onChange={v => setCfg({ ...cfg, diasCurvaA: Number(v) || 1 })} /></Flex>
                  <Flex gap={8} align="center"><Text style={{ width: 260 }}>Curva B a cada</Text>
                    <CampoNumero min={1} suffix="dias" value={cfg.diasCurvaB} onChange={v => setCfg({ ...cfg, diasCurvaB: Number(v) || 1 })} /></Flex>
                  <Flex gap={8} align="center"><Text style={{ width: 260 }}>Curva C a cada</Text>
                    <CampoNumero min={1} suffix="dias" value={cfg.diasCurvaC} onChange={v => setCfg({ ...cfg, diasCurvaC: Number(v) || 1 })} /></Flex>
                  <Button type="primary" icon={<SaveOutlined />} style={{ width: 'fit-content' }}
                    onClick={() => inventarioApi.salvarConfig(cfg).then(() => { message.success('Configuração salva.'); carregar(); }).catch(e => message.error(e.message))}>Salvar</Button>
                </Space>
              </Card>
            ),
          },
        ]} />
      </Space>
      <LancarLista id={aberta} onFechar={() => setAberta(null)} onLancado={() => { setAberta(null); carregar(); }} />
    </div>
  );
};

export default InventarioRotativo;
