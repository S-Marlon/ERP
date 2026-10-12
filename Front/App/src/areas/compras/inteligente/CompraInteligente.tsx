// Compra inteligente: o que vendeu × saldo × fornecedor. Escolhe o fornecedor, parte da sugestão pelo giro,
// completa o pedido mínimo com os itens que acabam primeiro e envia só "código do fornecedor + quantidade".
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Input, InputNumber, Popover, Progress, Row, Segmented, Space, Statistic, Switch, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CopyOutlined, DownloadOutlined, HistoryOutlined, ReloadOutlined, SaveOutlined, ThunderboltOutlined, ClearOutlined, StarFilled,
} from '@ant-design/icons';
import { AnaliseFornecedor, CondicoesFornecedor, compraInteligenteApi, ItemSugestao, OutroFornecedor, ResumoFornecedor } from './compraInteligenteApi';
import { csvPedido, situacaoMinimo, textoPedido, totalPedido } from './pedidoCompra';
import HistoricoPrecosDrawer from './HistoricoPrecosDrawer';
import PedidosCompra, { copiarTexto } from './PedidosCompra';

const { Title, Text } = Typography;
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const PERIODOS = [{ label: '30 dias', value: 30 }, { label: '90 dias', value: 90 }, { label: '6 meses', value: 180 }, { label: '1 ano', value: 365 }];

// Rascunho do pedido por fornecedor (só neste navegador: não perde ao trocar de tela)
const chaveRascunho = (id: number) => `erp.compras.rascunho.${id}`;
const lerRascunho = (id: number): Record<number, number> | null => {
  try { const v = localStorage.getItem(chaveRascunho(id)); return v ? JSON.parse(v) : null; } catch { return null; }
};
const gravarRascunho = (id: number, q: Record<number, number>) => {
  try {
    if (Object.values(q).some(v => v > 0)) localStorage.setItem(chaveRascunho(id), JSON.stringify(q));
    else localStorage.removeItem(chaveRascunho(id));
  } catch { /* sem armazenamento */ }
};

/** Rascunhos dos OUTROS fornecedores neste navegador: idItem -> [{ idFornecedor, quantidade }] (item já está noutra lista). */
const rascunhosDeOutros = (idAtual: number | null) => {
  const mapa = new Map<number, Array<{ idFornecedor: number; quantidade: number }>>();
  try {
    for (let k = 0; k < localStorage.length; k++) {
      const chave = localStorage.key(k) || '';
      const m = /^erp\.compras\.rascunho\.(\d+)$/.exec(chave);
      if (!m || Number(m[1]) === idAtual) continue;
      const q = JSON.parse(localStorage.getItem(chave) || '{}') as Record<string, number>;
      for (const [id, qtd] of Object.entries(q)) {
        if (!(Number(qtd) > 0)) continue;
        if (!mapa.has(Number(id))) mapa.set(Number(id), []);
        mapa.get(Number(id))!.push({ idFornecedor: Number(m[1]), quantidade: Number(qtd) });
      }
    }
  } catch { /* sem armazenamento */ }
  return mapa;
};

const STATUS_PEDIDO: Record<string, string> = { RASCUNHO: 'rascunho', ENVIADO: 'enviado', COTADO: 'cotado' };

const baixar = (nome: string, conteudo: string) => {
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const corCobertura = (d: number | null) => (d === null ? 'default' : d <= 7 ? 'red' : d <= 30 ? 'orange' : 'green');

const CompraInteligente: React.FC = () => {
  const [aba, setAba] = useState('montar');
  const [dias, setDias] = useState(90);
  const [cobertura, setCobertura] = useState(30);
  const [resumo, setResumo] = useState<ResumoFornecedor[]>([]);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [idFornecedor, setIdFornecedor] = useState<number | null>(null);
  const [analise, setAnalise] = useState<AnaliseFornecedor | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [quantidades, setQuantidades] = useState<Record<number, number>>({});
  const [origem, setOrigem] = useState<Record<number, 'SUGESTAO' | 'COMPLETAR' | 'MANUAL'>>({});
  const [condicoes, setCondicoes] = useState<CondicoesFornecedor>({ pedidoMinimo: 0, prazoEntregaDias: 0, contato: '', observacao: '' });
  const [filtro, setFiltro] = useState<'PEDIDO' | 'GIRO' | 'TODOS'>('GIRO');
  const [busca, setBusca] = useState('');
  const [limiteCobertura, setLimiteCobertura] = useState(120);
  const [ocupado, setOcupado] = useState(false);
  const [historico, setHistorico] = useState<ItemSugestao | null>(null);
  const [versaoPedidos, setVersaoPedidos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirDescricao, setIncluirDescricao] = useState(false);

  const carregarResumo = useCallback(async () => {
    setCarregandoResumo(true);
    setErro(null);
    try { setResumo(await compraInteligenteApi.resumo(dias, cobertura)); } catch (e) { setErro(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregandoResumo(false); }
  }, [dias, cobertura]);
  useEffect(() => { carregarResumo(); }, [carregarResumo]);

  const carregarFornecedor = useCallback(async (id: number, manterQuantidades = false) => {
    setCarregando(true);
    try {
      const a = await compraInteligenteApi.analise(id, dias, cobertura);
      setAnalise(a);
      setCondicoes(a.condicoes);
      if (!manterQuantidades) {
        const salvo = lerRascunho(id);
        const q = salvo || Object.fromEntries(a.itens.filter(i => i.quantidade > 0).map(i => [i.idItem, i.quantidade]));
        setQuantidades(q);
        setOrigem(Object.fromEntries(Object.keys(q).map(k => [Number(k), salvo ? 'MANUAL' : 'SUGESTAO'])));
        if (salvo) message.info('Rascunho deste fornecedor recuperado (use "Sugestão" para recomeçar).');
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setCarregando(false);
    }
  }, [dias, cobertura]);
  useEffect(() => { if (idFornecedor) carregarFornecedor(idFornecedor, true); }, [dias, cobertura]); // eslint-disable-line react-hooks/exhaustive-deps

  const abrir = (id: number) => { setIdFornecedor(id); carregarFornecedor(id); };
  const mudarQtd = (idItem: number, v: number) => {
    setQuantidades(q => { const n = { ...q, [idItem]: Math.max(0, v) }; if (idFornecedor) gravarRascunho(idFornecedor, n); return n; });
    setOrigem(o => ({ ...o, [idItem]: 'MANUAL' }));
  };

  const itens = analise?.itens || [];
  const nomeDoFornecedor = useMemo(() => new Map(resumo.map(r => [r.idFornecedor, r.nome])), [resumo]);
  // Item já colocado na lista (rascunho) de outro fornecedor neste navegador
  const outrasListas = useMemo(() => rascunhosDeOutros(idFornecedor), [idFornecedor, quantidades, analise]); // eslint-disable-line react-hooks/exhaustive-deps

  const tornarPrincipal = async (i: ItemSugestao, idNovo: number) => {
    try {
      await compraInteligenteApi.definirPrincipal(i.idItem, idNovo);
      message.success('Fornecedor principal do item atualizado.');
      if (idFornecedor) carregarFornecedor(idFornecedor, true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    }
  };

  // Outros fornecedores do item: código, preço por unidade de estoque (para comparar) e tornar principal
  const painelFornecedores = (i: ItemSugestao) => {
    const todos: Array<OutroFornecedor & { atual?: boolean }> = [
      { idFornecedor: idFornecedor!, fornecedor: analise?.fornecedor.nome || '', codigo: i.codigoFornecedor, descricao: i.descricaoFornecedor,
        unidadeCompra: i.unidadeCompra, fatorCompra: i.fatorCompra, preco: i.precoCompra, precoBase: i.precoBase, principal: i.ehPrincipal, atual: true },
      ...i.outrosFornecedores,
    ];
    const menor = Math.min(...todos.filter(t => t.precoBase > 0).map(t => t.precoBase));
    return (
      <Table
        size="small" rowKey="idFornecedor" pagination={false} dataSource={todos} style={{ width: 640 }}
        columns={[
          { title: 'Fornecedor', key: 'f', render: (_, t) => <Space size={4}>{t.principal && <StarFilled style={{ color: '#faad14' }} />}<Text strong={t.atual}>{t.fornecedor}</Text>{t.atual && <Tag>esta lista</Tag>}</Space> },
          { title: 'Código / descrição', key: 'c', render: (_, t) => <Space direction="vertical" size={0}><Text>{t.codigo || '—'}</Text><Text type="secondary" style={{ fontSize: 11 }}>{t.descricao || ''}</Text></Space> },
          { title: `Por ${i.unidade || 'un'}`, key: 'p', width: 100, align: 'right' as const, render: (_, t) => (t.precoBase > 0 ? <Text type={t.precoBase === menor ? 'success' : undefined} strong={t.precoBase === menor}>{brl(t.precoBase)}</Text> : '—') },
          { key: 'a', width: 110, render: (_, t) => (t.principal ? <Tag color="gold">principal</Tag> : <Button size="small" onClick={() => tornarPrincipal(i, t.idFornecedor)}>Tornar principal</Button>) },
        ]}
      />
    );
  };
  const linhasPedido = useMemo(() => itens.filter(i => (quantidades[i.idItem] || 0) > 0)
    .map(i => ({ ...i, quantidadePedido: quantidades[i.idItem] })), [itens, quantidades]);
  const total = totalPedido(linhasPedido.map(l => ({ quantidade: l.quantidadePedido, precoCompra: l.precoCompra })));
  const minimo = situacaoMinimo(total, condicoes.pedidoMinimo);

  const visiveis = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return itens.filter(i => {
      if (filtro === 'PEDIDO' && !(quantidades[i.idItem] > 0)) return false;
      if (filtro === 'GIRO' && !(i.vendido > 0 || quantidades[i.idItem] > 0 || i.motivo)) return false;
      return !t || i.nome.toUpperCase().includes(t) || i.sku.toUpperCase().includes(t) || String(i.codigoFornecedor || '').toUpperCase().includes(t);
    });
  }, [itens, filtro, busca, quantidades]);

  const usarSugestao = () => {
    const q = Object.fromEntries(itens.filter(i => i.quantidade > 0).map(i => [i.idItem, i.quantidade]));
    setQuantidades(q);
    setOrigem(Object.fromEntries(Object.keys(q).map(k => [Number(k), 'SUGESTAO'])));
    if (idFornecedor) gravarRascunho(idFornecedor, q);
  };
  const zerar = () => { setQuantidades({}); setOrigem({}); if (idFornecedor) gravarRascunho(idFornecedor, {}); };

  const completar = async () => {
    if (!idFornecedor) return;
    if (!(condicoes.pedidoMinimo > 0)) { message.warning('Informe o pedido mínimo do fornecedor.'); return; }
    setOcupado(true);
    try {
      const r = await compraInteligenteApi.completar(idFornecedor, { quantidades, pedidoMinimo: condicoes.pedidoMinimo, dias, cobertura, limiteCobertura });
      const q = Object.fromEntries(Object.entries(r.quantidades).map(([k, v]) => [Number(k), Number(v)]));
      setQuantidades(q);
      setOrigem(o => ({ ...o, ...Object.fromEntries(Object.keys(r.acrescentados).map(k => [Number(k), 'COMPLETAR' as const])) }));
      gravarRascunho(idFornecedor, q);
      const n = Object.keys(r.acrescentados).length;
      if (r.falta > 0) {
        message.warning(n
          ? `Acrescentei ${n} item(ns), mas ainda faltam ${brl(r.falta)}: os outros itens com giro já passariam de ${limiteCobertura} dias de estoque. Complete à mão ou aumente o limite.`
          : `Nenhum item com giro cabe sem passar de ${limiteCobertura} dias de estoque. Faltam ${brl(r.falta)}: complete à mão (filtro "Todos").`);
      } else {
        message.success(`Pedido mínimo atingido: ${n} item(ns) acrescentado(s), pelos que acabam primeiro.`);
      }
      setFiltro('PEDIDO');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setOcupado(false);
    }
  };

  const salvarCondicoes = async () => {
    if (!idFornecedor) return;
    try { await compraInteligenteApi.salvarCondicoes(idFornecedor, condicoes); message.success('Condições do fornecedor salvas.'); carregarResumo(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  // O que vai para o fornecedor sai do jeito DELE (código e descrição da nota dele); a tela mostra o principal
  const linhasExport = linhasPedido.map(l => ({ codigoFornecedor: l.codigoFornecedor, nome: l.descricaoFornecedor || l.nome, quantidade: l.quantidadePedido, unidadeCompra: l.unidadeCompra, precoCompra: l.precoCompra }));
  const texto = analise ? textoPedido(analise.fornecedor.nome, linhasExport, '', incluirDescricao) : '';
  const semCodigo = linhasPedido.filter(l => !l.codigoFornecedor).length;

  const salvarPedido = async () => {
    if (!idFornecedor || linhasPedido.length === 0) return;
    setOcupado(true);
    try {
      const p = await compraInteligenteApi.criarPedido({
        idFornecedor, itens: linhasPedido.map(l => ({ idItem: l.idItem, quantidade: l.quantidadePedido, origem: origem[l.idItem] || 'MANUAL' })),
      });
      message.success(`Pedido ${p.idPedido} salvo. Copie o texto e envie; quando o fornecedor responder, guarde a cotação em "Pedidos e cotações".`);
      gravarRascunho(idFornecedor, {});
      setVersaoPedidos(v => v + 1);
      await copiarTexto(p.texto);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setOcupado(false);
    }
  };

  const colunas = [
    {
      title: 'Item', key: 'item',
      render: (_: unknown, i: ItemSugestao) => {
        const emOutraLista = (outrasListas.get(i.idItem) || []);
        const pedidos = i.emPedidos || [];
        return (
          <Space direction="vertical" size={0}>
            {/* Como a loja conhece o item: nome do catálogo + código do fornecedor principal */}
            <Text strong>{i.nome}</Text>
            <Space size={4} wrap>
              <Text type="secondary" style={{ fontSize: 11 }}>{i.sku}</Text>
              {i.principal && !i.ehPrincipal && (
                <Tooltip title={i.principal.descricao || undefined}>
                  <Tag color="gold" style={{ fontSize: 11 }}><StarFilled /> {i.principal.fornecedor} · {i.principal.codigo || 'sem código'}</Tag>
                </Tooltip>
              )}
              {i.ehPrincipal && i.outrosFornecedores.length > 0 && <Tag color="gold" style={{ fontSize: 11 }}><StarFilled /> principal</Tag>}
              {i.outrosFornecedores.length > 0 && (
                <Popover content={painelFornecedores(i)} title="Fornecedores deste item" trigger="click">
                  <Tag style={{ fontSize: 11, cursor: 'pointer' }}>+{i.outrosFornecedores.length} fornecedor(es) · comparar</Tag>
                </Popover>
              )}
            </Space>
            {/* Como ESTE fornecedor escreve (é assim que vai no pedido) */}
            <Text style={{ fontSize: 11 }} type={i.codigoFornecedor ? 'secondary' : 'warning'}>
              Nesta lista: {i.codigoFornecedor || 'sem código'}{i.descricaoFornecedor && i.descricaoFornecedor !== i.nome ? ` · ${i.descricaoFornecedor}` : ''}
            </Text>
            {(emOutraLista.length > 0 || pedidos.length > 0) && (
              <Space size={4} wrap>
                {emOutraLista.map(o => {
                  const v = i.outrosFornecedores.find(x => x.idFornecedor === o.idFornecedor);
                  return <Tag key={`r${o.idFornecedor}`} color="orange" style={{ fontSize: 11 }}>já na lista da {nomeDoFornecedor.get(o.idFornecedor) || v?.fornecedor || `fornecedor ${o.idFornecedor}`}: {num(o.quantidade)} {v?.unidadeCompra || ''}</Tag>;
                })}
                {pedidos.map(pd => (
                  <Tag key={`p${pd.idPedido}`} color={pd.idFornecedor === idFornecedor ? 'blue' : 'purple'} style={{ fontSize: 11 }}>
                    pedido {pd.idPedido} {pd.idFornecedor === idFornecedor ? '' : `(${pd.fornecedor}) `}{STATUS_PEDIDO[pd.status] || pd.status}: {num(pd.quantidade)} {pd.unidade}
                  </Tag>
                ))}
              </Space>
            )}
          </Space>
        );
      },
    },
    { title: 'Saldo', key: 'saldo', width: 90, align: 'right' as const, sorter: (a: ItemSugestao, b: ItemSugestao) => a.saldo - b.saldo, render: (_: unknown, i: ItemSugestao) => `${num(i.saldo)} ${i.unidade}` },
    {
      title: `Vendido (${dias}d)`, key: 'vend', width: 110, align: 'right' as const, sorter: (a: ItemSugestao, b: ItemSugestao) => a.vendido - b.vendido,
      render: (_: unknown, i: ItemSugestao) => (i.vendido > 0 ? <Tooltip title={`${num(i.consumoDia * 30)} ${i.unidade}/mês`}>{num(i.vendido)} {i.unidade}</Tooltip> : <Text type="secondary">—</Text>),
    },
    {
      title: 'Dura', key: 'cob', width: 85, align: 'right' as const,
      sorter: (a: ItemSugestao, b: ItemSugestao) => (a.coberturaAtual ?? 1e9) - (b.coberturaAtual ?? 1e9),
      render: (_: unknown, i: ItemSugestao) => (i.coberturaAtual === null ? <Text type="secondary">sem giro</Text> : <Tag color={corCobertura(i.coberturaAtual)}>{i.coberturaAtual} dias</Tag>),
    },
    {
      title: 'Sugestão', key: 'sug', width: 120,
      render: (_: unknown, i: ItemSugestao) => (i.quantidade > 0 ? (
        <Space direction="vertical" size={0}>
          <Text>{num(i.quantidade)} {i.unidadeCompra}</Text>
          <Tag color={i.motivo === 'ABAIXO_MINIMO' ? 'red' : 'orange'} style={{ fontSize: 10 }}>{i.motivo === 'ABAIXO_MINIMO' ? 'abaixo do mínimo' : `p/ ${cobertura + (analise?.parametros.prazoEntregaDias || 0)} dias`}</Tag>
        </Space>
      ) : <Text type="secondary">—</Text>),
    },
    {
      title: 'Pedido', key: 'ped', width: 150,
      render: (_: unknown, i: ItemSugestao) => (
        <Tooltip title={i.fatorCompra !== 1 ? `1 ${i.unidadeCompra} = ${num(i.fatorCompra)} ${i.unidade}` : undefined}>
          <InputNumber size="small" min={0} step={1} style={{ width: '100%' }} value={quantidades[i.idItem] || null} placeholder="0"
            addonAfter={i.unidadeCompra} onChange={v => mudarQtd(i.idItem, Number(v) || 0)}
            status={origem[i.idItem] === 'COMPLETAR' ? 'warning' : undefined} />
        </Tooltip>
      ),
    },
    {
      title: 'Preço', key: 'preco', width: 120, align: 'right' as const,
      render: (_: unknown, i: ItemSugestao) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <span>{i.precoCompra > 0 ? brl(i.precoCompra) : <Text type="warning">sem preço</Text>}</span>
          <Text type="secondary" style={{ fontSize: 10 }}>{i.origemPreco === 'COTACAO' ? `cotação ${String(i.dataCotacao).split('-').reverse().join('/')}` : 'última nota'}</Text>
        </Space>
      ),
    },
    { title: 'Total', key: 'tot', width: 100, align: 'right' as const, render: (_: unknown, i: ItemSugestao) => ((quantidades[i.idItem] || 0) > 0 ? <Text strong>{brl(Math.round(quantidades[i.idItem] * i.precoCompra * 100) / 100)}</Text> : '') },
    { key: 'h', width: 40, render: (_: unknown, i: ItemSugestao) => <Tooltip title="Memória de preços (notas e cotações)"><Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setHistorico(i)} /></Tooltip> },
  ];

  const montar = (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={8}>
        <Card size="small" title="Fornecedores" extra={<Button size="small" icon={<ReloadOutlined />} onClick={carregarResumo} loading={carregandoResumo} />}>
          <Table<ResumoFornecedor>
            size="small" rowKey="idFornecedor" loading={carregandoResumo} dataSource={resumo} pagination={false}
            onRow={r => ({ onClick: () => abrir(r.idFornecedor), style: { cursor: 'pointer', background: r.idFornecedor === idFornecedor ? '#e6f4ff' : undefined } })}
            columns={[
              {
                title: 'Fornecedor', key: 'f',
                render: (_, r) => (
                  <Space direction="vertical" size={0}>
                    <Text strong={r.itensRepor > 0}>{r.nome}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.itensVinculados} itens · mín. {r.pedidoMinimo > 0 ? brl(r.pedidoMinimo) : '—'}{r.pedidosAbertos ? ` · ${r.pedidosAbertos} pedido(s) em aberto` : ''}</Text>
                  </Space>
                ),
              },
              {
                title: 'Repor', key: 'r', width: 100, align: 'right' as const,
                render: (_, r) => (r.itensRepor > 0 ? (
                  <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
                    <Tag color={r.abaixoMinimo ? 'red' : 'orange'} style={{ margin: 0 }}>{r.itensRepor} item(ns)</Tag>
                    <Text style={{ fontSize: 11 }} type={r.atingeMinimo ? undefined : 'warning'}>{brl(r.valorSugerido)}</Text>
                  </Space>
                ) : <Text type="secondary">—</Text>),
              },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} xl={16}>
        {!analise ? (
          <Card><Empty description="Escolha um fornecedor para montar o pedido" /></Card>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title={<Space>{analise.fornecedor.nome}<Text type="secondary" style={{ fontSize: 12 }}>{analise.fornecedor.cnpj}</Text></Space>}
              extra={<Button size="small" icon={<SaveOutlined />} onClick={salvarCondicoes}>Salvar condições</Button>}>
              <Row gutter={[12, 12]} align="middle">
                <Col xs={12} md={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Pedido mínimo</Text>
                  <InputNumber style={{ width: '100%' }} min={0} prefix="R$" value={condicoes.pedidoMinimo} onChange={v => setCondicoes(c => ({ ...c, pedidoMinimo: Number(v) || 0 }))} />
                </Col>
                <Col xs={12} md={5}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Prazo de entrega</Text>
                  <InputNumber style={{ width: '100%' }} min={0} addonAfter="dias" value={condicoes.prazoEntregaDias} onChange={v => setCondicoes(c => ({ ...c, prazoEntregaDias: Number(v) || 0 }))} />
                </Col>
                <Col xs={24} md={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Contato para pedido</Text>
                  <Input value={condicoes.contato} placeholder="WhatsApp / e-mail do vendedor" onChange={e => setCondicoes(c => ({ ...c, contato: e.target.value }))} />
                </Col>
                <Col xs={24} md={7}>
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Pedido: {brl(total)} {condicoes.pedidoMinimo > 0 && `de ${brl(condicoes.pedidoMinimo)}`}</Text>
                    <Progress percent={minimo.percentual} size="small" status={minimo.atinge ? 'success' : 'active'} />
                    {!minimo.atinge && <Text type="warning" style={{ fontSize: 12 }}>Faltam {brl(minimo.falta)} para o mínimo</Text>}
                  </Space>
                </Col>
              </Row>
            </Card>

            <Card size="small">
              <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                <Space wrap>
                  <Segmented value={filtro} onChange={v => setFiltro(v as typeof filtro)} options={[
                    { label: `No pedido (${linhasPedido.length})`, value: 'PEDIDO' }, { label: 'Com giro / sugeridos', value: 'GIRO' }, { label: `Todos (${itens.length})`, value: 'TODOS' },
                  ]} />
                  <Input.Search allowClear placeholder="Buscar item ou código" style={{ width: 220 }} value={busca} onChange={e => setBusca(e.target.value)} />
                </Space>
                <Space wrap>
                  <Button icon={<ClearOutlined />} onClick={zerar}>Zerar</Button>
                  <Button onClick={usarSugestao}>Sugestão</Button>
                  <Tooltip title={`Acrescenta embalagens nos itens com giro que acabam primeiro, sem passar de ${limiteCobertura} dias de estoque`}>
                    <Space.Compact>
                      <Button type="primary" ghost icon={<ThunderboltOutlined />} loading={ocupado} onClick={completar} disabled={minimo.atinge && condicoes.pedidoMinimo > 0}>
                        Completar mínimo
                      </Button>
                      <InputNumber style={{ width: 90 }} min={15} max={365} value={limiteCobertura} onChange={v => setLimiteCobertura(Number(v) || 120)} addonAfter="d" />
                    </Space.Compact>
                  </Tooltip>
                </Space>
              </Space>
              <Table<ItemSugestao>
                size="small" rowKey="idItem" loading={carregando} dataSource={visiveis} columns={colunas}
                pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
                rowClassName={i => ((quantidades[i.idItem] || 0) > 0 ? 'linha-no-pedido' : '')}
                locale={{ emptyText: <Empty description={filtro === 'GIRO' ? 'Nenhum item deste fornecedor vendeu no período: use o filtro "Todos" para montar à mão' : 'Nada aqui'} /> }}
              />
            </Card>

            <Card size="small">
              <Row gutter={[16, 12]} align="middle">
                <Col xs={12} md={4}><Statistic title="Itens" value={linhasPedido.length} /></Col>
                <Col xs={12} md={5}><Statistic title="Total estimado" value={total} precision={2} prefix="R$" /></Col>
                <Col xs={24} md={15} style={{ textAlign: 'right' }}>
                  <Space wrap>
                    <Tooltip title="No texto, além do código, vai a descrição como este fornecedor escreve o item">
                      <Space size={4}><Switch size="small" checked={incluirDescricao} onChange={setIncluirDescricao} /><Text style={{ fontSize: 12 }}>com descrição</Text></Space>
                    </Tooltip>
                    <Button icon={<CopyOutlined />} disabled={!linhasPedido.length} onClick={() => copiarTexto(texto)}>Copiar texto</Button>
                    <Button icon={<DownloadOutlined />} disabled={!linhasPedido.length}
                      onClick={() => baixar(`pedido-${analise.fornecedor.nome.replace(/\W+/g, '-').toLowerCase()}.csv`, csvPedido(linhasExport))}>Baixar planilha</Button>
                    <Button type="primary" icon={<SaveOutlined />} disabled={!linhasPedido.length} loading={ocupado} onClick={salvarPedido}>Salvar pedido e copiar</Button>
                  </Space>
                </Col>
              </Row>
              {semCodigo > 0 && <Alert style={{ marginTop: 8 }} type="warning" showIcon message={`${semCodigo} item(ns) sem código do fornecedor: vão pelo nome. O código entra sozinho na próxima nota deste fornecedor.`} />}
            </Card>
          </Space>
        )}
      </Col>
    </Row>
  );

  return (
    <div style={{ padding: 24 }}>
      <style>{'.linha-no-pedido td { background: #f6ffed; }'}</style>
      <Row justify="space-between" align="middle" gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Compra inteligente</Title>
          <Text type="secondary">O que vendeu × saldo × fornecedor: monte o pedido, complete o mínimo e mande só código e quantidade.</Text>
        </Col>
        <Col>
          <Space wrap>
            <Text type="secondary">Vendas de</Text>
            <Segmented options={PERIODOS} value={dias} onChange={v => setDias(Number(v))} />
            <Tooltip title="Quer estoque para quantos dias depois que a mercadoria chegar">
              <InputNumber min={0} max={365} value={cobertura} onChange={v => setCobertura(Number(v) || 0)} addonBefore="Estoque p/" addonAfter="dias" style={{ width: 200 }} />
            </Tooltip>
          </Space>
        </Col>
      </Row>
      {erro && <Alert style={{ marginBottom: 12 }} type="error" showIcon message={erro} />}
      <Tabs activeKey={aba} onChange={setAba} items={[
        { key: 'montar', label: 'Montar pedido', children: montar },
        { key: 'pedidos', label: 'Pedidos e cotações', children: <PedidosCompra versao={versaoPedidos} /> },
      ]} />
      <HistoricoPrecosDrawer item={historico} onFechar={() => setHistorico(null)} />
    </div>
  );
};

export default CompraInteligente;
