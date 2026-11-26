// Orçamento de negociação: a régua de margem por item, por categoria e no orçamento inteiro, buscando a margem alvo
// (baixar num item e recuperar em outro). Mostra a margem de tabela e a da última venda para o cliente; trava itens
// combinados; "equilibrar" leva os livres para a margem que fecha no alvo; faixas por quantidade. Custo e margem nunca
// saem na proposta. Abaixo da margem mínima pede a senha de autorização (Vendas › Regras de venda).
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, AutoComplete, Button, Card, Col, Drawer, Empty, Flex, Input, Modal, Popconfirm, Progress, Row, Select, Slider, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, LockOutlined, PlusOutlined, SaveOutlined, ThunderboltOutlined, UnlockOutlined } from '@ant-design/icons';
import {
  aplicarMargem, equilibrar, FaixaQuantidade, margem as margemDe, markup as markupDe, precoParaMargem, resumoNegociacao,
} from './negociacao';
import { CONDICOES_PAGAMENTO, ConfigNegociacao, ErroNegociacao, ItemNegociacao, LinhaPreparada, negociacaoApi } from './negociacaoApi';
import { CondicaoPagamento, custoDaCondicao, FormaCondicao, textoDaCondicao, totalComDesconto } from './condicaoPagamento';
import { taxaPara, useTaxasVenda } from '../taxas/taxasVenda';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { AdicionarItemNegociacao, ItemBuscado } from './AdicionarItemNegociacao';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number | null | undefined, casas = 1) => (v === null || v === undefined ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`);
const dataBr = (s: string) => s.slice(0, 10).split('-').reverse().join('/');

/** O que abre a negociação: os itens (do carrinho ou de um orçamento) e, ao renegociar, o que já estava combinado. */
export interface AberturaNegociacao {
  itens: ItemNegociacao[];
  cliente: { id: number | null; nome: string } | null;
  idPedido?: number | null;
  inicial?: {
    precos: Array<number | null>; travados: boolean[]; faixas: FaixaQuantidade[][];
    margemAlvo?: number | null; condicaoPagamento?: string | null; condicao?: CondicaoPagamento | null; contato?: string | null; observacao?: string | null;
  };
}

interface Linha extends LinhaPreparada { preco: number; travado: boolean; faixas: FaixaQuantidade[]; componentes?: ItemNegociacao['componentes'] }

const corDaMargem = (m: number | null, cfg: ConfigNegociacao, alvo: number) =>
  m === null ? undefined : m < cfg.margemMinimaNegociacao ? '#cf1322' : m < alvo - 0.0005 ? '#d48806' : '#389e0d';

export const NegociacaoDrawer: React.FC<{
  abrir: AberturaNegociacao | null; onFechar: () => void; onSalvo: (id: number, total: number) => void;
}> = ({ abrir, onFechar, onSalvo }) => {
  const [cfg, setCfg] = useState<ConfigNegociacao | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [alvo, setAlvo] = useState(0.3);
  const [condicao, setCondicao] = useState('');
  // Condição em campos: forma ('' = a combinar / texto livre), parcelas, intervalo e entrada
  const [cond, setCond] = useState<{ forma: FormaCondicao | ''; parcelas: number; intervaloDias: number; entrada: number; descontoPct: number }>({ forma: '', parcelas: 1, intervaloDias: 30, entrada: 0, descontoPct: 0 });
  const taxas = useTaxasVenda();
  const [validade, setValidade] = useState(7);
  const [contato, setContato] = useState('');
  const [observacao, setObservacao] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [autorizar, setAutorizar] = useState<{ motivos: string[] } | null>(null);
  const [aut, setAut] = useState({ senha: '', nome: '', motivo: '' });

  useEffect(() => {
    if (!abrir) return;
    setCfg(null); setLinhas([]); setAviso(null); setAutorizar(null);
    const ini = abrir.inicial;
    negociacaoApi.preparar(abrir.itens, abrir.cliente?.id).then(r => {
      setCfg(r.config);
      setAlvo(ini?.margemAlvo ?? r.config.margemAlvoPadrao);
      setCondicao(ini?.condicaoPagamento || ''); setContato(ini?.contato || '');
      setCond(ini?.condicao
        ? { forma: ini.condicao.forma, parcelas: ini.condicao.parcelas, intervaloDias: ini.condicao.intervaloDias || 30, entrada: ini.condicao.entrada || 0, descontoPct: ini.condicao.descontoPct || 0 }
        : { forma: '', parcelas: 1, intervaloDias: 30, entrada: 0, descontoPct: 0 }); setObservacao(ini?.observacao || ''); setValidade(7);
      setLinhas(r.linhas.map((l, i) => ({
        ...l, preco: ini?.precos[i] ?? l.precoTabela, travado: ini?.travados[i] ?? false, faixas: ini?.faixas[i] ?? [],
        componentes: abrir.itens[i]?.componentes,
      })));
    }).catch(e => { message.error(e instanceof Error ? e.message : 'Erro ao preparar.'); onFechar(); });
  }, [abrir]);   // eslint-disable-line react-hooks/exhaustive-deps

  const resumo = useMemo(() => resumoNegociacao(linhas.map(l => ({ quantidade: l.quantidade, preco: l.preco, custoUnitario: l.custoUnitario }))), [linhas]);
  // seções por categoria, na ordem em que aparecem
  const secoes = useMemo(() => {
    const m = new Map<string, { nome: string; sugerida: number | null; indices: number[] }>();
    linhas.forEach((l, i) => {
      const k = l.categoria ? String(l.categoria.id) : 'sem';
      if (!m.has(k)) m.set(k, { nome: l.categoria?.nome || 'Sem categoria', sugerida: l.categoria?.margemSugerida ?? null, indices: [] });
      m.get(k)!.indices.push(i);
    });
    return [...m.values()];
  }, [linhas]);

  const condicaoAtual: CondicaoPagamento | null = cond.forma
    ? {
      forma: cond.forma,
      parcelas: cond.forma === 'CREDITO' || cond.forma === 'PRAZO' ? Math.max(1, cond.parcelas) : 1,
      intervaloDias: cond.forma === 'PRAZO' ? cond.intervaloDias : null,
      // crédito/a prazo: entrada; PIX/dinheiro: o antecipado (saldo na conclusão e entrega); débito: sem
      entrada: cond.forma === 'DEBITO' ? 0 : cond.entrada,
      // desconto por pagar nesta forma: só PIX e dinheiro
      ...((cond.forma === 'PIX' || cond.forma === 'DINHEIRO') && cond.descontoPct > 0 ? { descontoPct: cond.descontoPct } : {}),
    }
    : null;

  if (!abrir) return null;
  const mudar = (i: number, x: Partial<Linha>) => setLinhas(ls => ls.map((l, k) => (k === i ? { ...l, ...x } : l)));
  const aplicarEm = (indices: number[] | null, m: number) => setLinhas(ls => {
    const alvoIdx = new Set(indices ?? ls.map((_, i) => i));
    const precos = aplicarMargem(ls.map((l, i) => ({ quantidade: l.quantidade, preco: l.preco, custoUnitario: l.custoUnitario, travado: l.travado || !alvoIdx.has(i) })), m);
    return ls.map((l, i) => ({ ...l, preco: precos[i] }));
  });
  const equilibrarAlvo = () => {
    const e = equilibrar(linhas.map(l => ({ quantidade: l.quantidade, preco: l.preco, custoUnitario: l.custoUnitario, travado: l.travado })), alvo);
    setLinhas(ls => ls.map((l, i) => ({ ...l, preco: e.precos[i] })));
    setAviso(e.aviso);
    if (!e.aviso && e.margemLivres !== null) message.success(`Itens livres em ${pct(e.margemLivres)}: o orçamento fecha em ${pct(alvo)}.`);
  };
  const margemSecao = (indices: number[]) => resumoNegociacao(indices.map(i => linhas[i]).map(l => ({ quantidade: l.quantidade, preco: l.preco, custoUnitario: l.custoUnitario }))).margem;

  const salvar = async (autorizacao?: typeof aut) => {
    setSalvando(true);
    try {
      const r = await negociacaoApi.salvar({
        idPedido: abrir.idPedido, idCliente: abrir.cliente?.id ?? null, clienteNome: abrir.cliente?.nome, contato, observacao, validadeDias: validade,
        margemAlvo: alvo, condicaoPagamento: condicao, condicao: condicaoAtual,
        itens: linhas.map(l => ({ idItem: l.idItem, quantidade: l.quantidade, idUnidade: l.idUnidade, componentes: l.componentes, precoUnitario: l.preco, travado: l.travado, faixas: l.faixas })),
        autorizacao,
      });
      setAutorizar(null);
      onSalvo(r.id, r.totalLiquido);
    } catch (e) {
      if (e instanceof ErroNegociacao && e.detalhes?.codigo === 'AUTORIZACAO_NECESSARIA') {
        if (!e.detalhes.temSenha) { message.error(e.message); return; }
        if (e.detalhes.senhaIncorreta) message.error('Senha de autorização incorreta.');
        setAutorizar({ motivos: e.detalhes.motivos || [] });
      } else message.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally { setSalvando(false); }
  };

  const colunas = (cfgN: ConfigNegociacao) => [
    {
      title: 'Item', key: 'item', render: (_: unknown, l: Linha & { i: number }) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{l.nome}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{l.sku} · {l.sigla}{l.fator !== 1 && l.siglaBase ? ` (${l.fator.toLocaleString('pt-BR')} ${l.siglaBase})` : ''}</Text>
        </Space>
      ),
    },
    {
      title: 'Qtd', key: 'q', width: 80, render: (_: unknown, l: Linha & { i: number }) => (
        <CampoNumero size="small" min={0.001} value={l.quantidade} style={{ width: 70 }} onChange={v => v && mudar(l.i, { quantidade: Number(v) })} />
      ),
    },
    {
      title: 'Custo · tabela', key: 'c', width: 130, render: (_: unknown, l: Linha) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{l.custoUnitario > 0 ? brl(l.custoUnitario) : <Text type="warning" style={{ fontSize: 12 }}>sem custo</Text>}</Text>
          <Tooltip title="Preço de tabela e a margem dele"><Text type="secondary" style={{ fontSize: 11 }}>{brl(l.precoTabela)} · {pct(l.margemTabela)}</Text></Tooltip>
        </Space>
      ),
    },
    {
      title: 'Última venda p/ ele', key: 'u', width: 130, render: (_: unknown, l: Linha) => (l.ultimaVenda ? (
        <Tooltip title={`Venda Nº ${l.ultimaVenda.idVenda} em ${dataBr(l.ultimaVenda.data)}`}>
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{brl(l.ultimaVenda.preco)} · {pct(l.ultimaVenda.margem)}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{dataBr(l.ultimaVenda.data)}</Text>
          </Space>
        </Tooltip>
      ) : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>),
    },
    {
      title: 'Margem', key: 'm', width: 230, render: (_: unknown, l: Linha & { i: number }) => {
        const m = margemDe(l.preco, l.custoUnitario);
        if (l.custoUnitario <= 0) return <Text type="secondary" style={{ fontSize: 11 }}>sem custo: ajuste pelo preço</Text>;
        return (
          <Flex gap={6} align="center">
            <Slider style={{ flex: 1, margin: '0 4px' }} min={0} max={70} step={0.5} value={Math.max(0, Math.min(70, (m ?? 0) * 100))} disabled={l.travado}
              marks={{ [Math.round(cfgN.margemMinimaNegociacao * 100)]: ' ', [Math.round(alvo * 100)]: ' ' }}
              tooltip={{ formatter: v => `${v}% → ${brl(precoParaMargem(l.custoUnitario, (v ?? 0) / 100))}` }}
              onChange={v => mudar(l.i, { preco: precoParaMargem(l.custoUnitario, v / 100) })} />
            <CampoNumero size="small" style={{ width: 72 }} value={m === null ? null : Math.round(m * 1000) / 10} suffix="%" disabled={l.travado}
              onChange={v => v !== null && mudar(l.i, { preco: precoParaMargem(l.custoUnitario, Number(v) / 100) })} />
          </Flex>
        );
      },
    },
    {
      title: 'Preço', key: 'p', width: 140, render: (_: unknown, l: Linha & { i: number }) => {
        const m = margemDe(l.preco, l.custoUnitario);
        return (
          <Space direction="vertical" size={0}>
            <CampoDinheiro size="small" min={0} step={0.5} style={{ width: 120, borderColor: corDaMargem(m, cfgN, alvo) }} precision={2}
              value={l.preco} disabled={l.travado} onChange={v => v !== null && mudar(l.i, { preco: Number(v) })} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              <Text style={{ fontSize: 11, color: corDaMargem(m, cfgN, alvo) }}>{pct(m)}</Text>
              {l.fator !== 1 && l.siglaBase ? ` · ${brl(l.preco / l.fator)}/${l.siglaBase}` : ''}{m !== null ? ` · mk ${pct(markupDe(l.preco, l.custoUnitario))}` : ''}
            </Text>
          </Space>
        );
      },
    },
    { title: 'Total', key: 't', width: 100, align: 'right' as const, render: (_: unknown, l: Linha) => <Text strong>{brl(Math.round(l.preco * l.quantidade * 100) / 100)}</Text> },
    {
      key: 'trava', width: 44, render: (_: unknown, l: Linha & { i: number }) => (
        <Tooltip title={l.travado ? 'Travado: o equilibrar e as réguas não mexem (clique para soltar)' : 'Travar este preço (já combinado)'}>
          <Button size="small" type={l.travado ? 'primary' : 'text'} icon={l.travado ? <LockOutlined /> : <UnlockOutlined />} onClick={() => mudar(l.i, { travado: !l.travado })} />
        </Tooltip>
      ),
    },
    {
      key: 'tirar', width: 40, render: (_: unknown, l: Linha & { i: number }) => (
        <Popconfirm title="Tirar este item do orçamento?" okText="Tirar" cancelText="Não" disabled={linhas.length <= 1}
          onConfirm={() => setLinhas(ls => ls.filter((_, k) => k !== l.i))}>
          <Tooltip title={linhas.length <= 1 ? 'O orçamento precisa de ao menos um item' : 'Tirar do orçamento'}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} disabled={linhas.length <= 1} />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  // incluir um item: busca no catálogo (como no PDV) e prepara a linha com o custo, a tabela e a última venda para o cliente
  const adicionarItem = async (p: ItemBuscado, quantidade: number) => {
    if (p.ehKit) { message.info('Kit: adicione pelo PDV (para escolher as peças) e negocie de novo.'); return; }
    if (linhas.some(l => l.idItem === p.idItem && l.idUnidade === p.idUnidade)) { message.info(`${p.sku} já está no orçamento: mude a quantidade na linha.`); return; }
    try {
      const r = await negociacaoApi.preparar([{ idItem: p.idItem, quantidade, idUnidade: p.idUnidade }], abrir.cliente?.id);
      const nova = r.linhas[0];
      if (!nova) { message.error('Não foi possível preparar o item.'); return; }
      setLinhas(ls => [...ls, { ...nova, indice: ls.length, preco: nova.precoTabela, travado: false, faixas: [] }]);
      message.success(`${p.sku} incluído pelo preço de tabela.`);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao incluir o item.'); }
  };

  /** Faixas por quantidade de um item: "a partir de X" com a margem/preço de cada faixa. */
  const faixasDe = (l: Linha & { i: number }) => (
    <Space direction="vertical" size={4} style={{ width: '100%', paddingLeft: 24 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Faixas por quantidade (saem na proposta): até a primeira faixa vale o preço da linha, {brl(l.preco)}.</Text>
      {l.faixas.map((f, k) => {
        const m = margemDe(f.precoUnitario, l.custoUnitario);
        const set = (x: Partial<FaixaQuantidade>) => mudar(l.i, { faixas: l.faixas.map((y, j) => (j === k ? { ...y, ...x } : y)) });
        return (
          <Flex key={k} gap={8} align="center" wrap>
            <Text style={{ fontSize: 12 }}>A partir de</Text>
            <CampoNumero size="small" min={2} value={f.quantidadeMinima} style={{ width: 80 }} onChange={v => v && set({ quantidadeMinima: Number(v) })} suffix={l.sigla} />
            {l.custoUnitario > 0 && (
              <CampoNumero size="small" style={{ width: 80 }} value={m === null ? null : Math.round(m * 1000) / 10} suffix="%"
                onChange={v => v !== null && set({ precoUnitario: precoParaMargem(l.custoUnitario, Number(v) / 100) })} />
            )}
            <CampoDinheiro size="small" min={0} precision={2} style={{ width: 120, borderColor: cfg ? corDaMargem(m, cfg, alvo) : undefined }}
              value={f.precoUnitario} onChange={v => v !== null && set({ precoUnitario: Number(v) })} />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => mudar(l.i, { faixas: l.faixas.filter((_, j) => j !== k) })} />
          </Flex>
        );
      })}
      <Button size="small" icon={<PlusOutlined />} style={{ width: 'fit-content' }} onClick={() => {
        const ultima = l.faixas[l.faixas.length - 1];
        const qtd = ultima ? ultima.quantidadeMinima * 2 : Math.max(10, Math.ceil(l.quantidade * 2));
        const base = ultima?.precoUnitario ?? l.preco;
        mudar(l.i, { faixas: [...l.faixas, { quantidadeMinima: qtd, precoUnitario: Math.round(base * 0.95 * 100) / 100 }] });
      }}>Faixa</Button>
    </Space>
  );

  const corResumo = cfg ? corDaMargem(resumo.margem, cfg, alvo) : undefined;
  // Margem depois do custo da condição (taxa da maquininha) e o prazo médio para receber
  // o que o cliente paga na condição (com o desconto da forma, se houver) e a margem depois da taxa e do desconto
  const aPagar = condicaoAtual ? totalComDesconto(condicaoAtual, resumo.receita) : resumo.receita;
  const descontoDaForma = Math.round((resumo.receita - aPagar) * 100) / 100;
  const custoCond = condicaoAtual && taxas && resumo.receita > 0 ? custoDaCondicao((f, n) => taxaPara(taxas, f, n), condicaoAtual, aPagar) : null;
  const margemLiquida = custoCond && resumo.custo > 0 && aPagar > 0 ? (resumo.lucro - descontoDaForma - custoCond.taxa) / aPagar : null;
  const lucroNoAlvo = resumo.custo > 0 ? resumo.custo / (1 - alvo) - resumo.custo : 0;

  return (
    <Drawer open={!!abrir} onClose={onFechar} width="min(1400px, 100vw)" destroyOnHidden loading={!cfg}
      title={<Space wrap>{abrir.idPedido ? `Renegociar orçamento Nº ${abrir.idPedido}` : 'Negociar orçamento'}{abrir.cliente?.nome && <Tag>{abrir.cliente.nome}</Tag>}</Space>}
      extra={<Button type="primary" icon={<SaveOutlined />} loading={salvando} disabled={!linhas.length} onClick={() => salvar()}>Salvar orçamento</Button>}>
      {cfg && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small">
            <Row gutter={[16, 8]} align="middle">
              <Col xs={24} lg={7}>
                <Text type="secondary" style={{ fontSize: 12 }}>Margem do orçamento (alvo {pct(alvo)})</Text>
                <Flex align="center" gap={10}>
                  <Text strong style={{ fontSize: 28, color: corResumo }}>{pct(resumo.margem)}</Text>
                  <Progress percent={Math.max(0, Math.min(100, ((resumo.margem ?? 0) / Math.max(alvo, 0.01)) * 100))} showInfo={false} strokeColor={corResumo} style={{ flex: 1 }} />
                </Flex>
                <Text type="secondary" style={{ fontSize: 12 }}>markup {pct(resumo.markup)}{resumo.semCusto ? ` · ${resumo.semCusto} item(ns) sem custo fora da conta` : ''}</Text>
                {custoCond && (
                  <Tooltip title="Margem depois da taxa da forma combinada (Vendas › Taxas). O prazo médio é quanto tempo, em média, até o dinheiro entrar.">
                    <Text style={{ fontSize: 12, display: 'block', color: cfg ? corDaMargem(margemLiquida, cfg, alvo) : undefined }}>
                      Depois da condição: <b>{pct(margemLiquida)}</b>{descontoDaForma > 0 ? ` · desconto ${brl(descontoDaForma)}` : ''}{custoCond.taxa > 0 ? ` · taxa ${brl(custoCond.taxa)}` : ' · sem taxa'}
                      {custoCond.prazoMedioDias > 0 ? ` · recebe em ~${custoCond.prazoMedioDias.toLocaleString('pt-BR')} dias` : ''}
                    </Text>
                  </Tooltip>
                )}
              </Col>
              <Col xs={8} lg={3}><Statistic title="Total" value={brl(resumo.receita)} valueStyle={{ fontSize: 17 }} /></Col>
              <Col xs={8} lg={3}><Statistic title="Lucro" value={brl(resumo.lucro)} valueStyle={{ fontSize: 17, color: corResumo }} /></Col>
              <Col xs={8} lg={3}>
                <Tooltip title="Lucro que o orçamento teria na margem alvo">
                  <Statistic title="No alvo" value={brl(lucroNoAlvo)} valueStyle={{ fontSize: 17, color: '#8c8c8c' }} />
                </Tooltip>
              </Col>
              <Col xs={24} lg={8}>
                <Flex gap={8} align="center" wrap>
                  <Text>Alvo</Text>
                  <CampoNumero size="small" min={0} max={90} value={Math.round(alvo * 1000) / 10} suffix="%" style={{ width: 84 }}
                    onChange={v => v !== null && setAlvo(Number(v) / 100)} />
                  <Tooltip title="Os itens travados ficam; os outros vão para a margem que fecha o orçamento no alvo">
                    <Button type="primary" ghost icon={<ThunderboltOutlined />} onClick={equilibrarAlvo}>Equilibrar para o alvo</Button>
                  </Tooltip>
                </Flex>
                <Flex gap={8} align="center" style={{ marginTop: 6 }}>
                  <Tooltip title="Leva todos os itens livres para a mesma margem"><Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Régua geral</Text></Tooltip>
                  <Slider style={{ flex: 1 }} min={0} max={70} step={0.5} value={Math.round((resumo.margem ?? 0) * 1000) / 10}
                    tooltip={{ formatter: v => `${v}%` }} onChange={v => aplicarEm(null, v / 100)} />
                </Flex>
              </Col>
            </Row>
            {aviso && <Alert type="warning" showIcon style={{ marginTop: 8 }} message={aviso} closable onClose={() => setAviso(null)} />}
          </Card>

          {secoes.map(sec => {
            const ms = margemSecao(sec.indices);
            return (
              <Card key={sec.nome} size="small"
                title={<Space wrap><Text strong>{sec.nome}</Text><Tag color={cfg ? (corDaMargem(ms, cfg, alvo) === '#389e0d' ? 'green' : corDaMargem(ms, cfg, alvo) === '#d48806' ? 'gold' : 'red') : undefined}>{pct(ms)}</Tag>
                  {sec.sugerida !== null && <Text type="secondary" style={{ fontSize: 12 }}>sugerida da categoria {pct(sec.sugerida)}</Text>}</Space>}
                extra={<Flex gap={6} align="center" style={{ width: 260 }}>
                  <Tooltip title="Régua da categoria: leva os itens livres desta seção para a mesma margem"><Text type="secondary" style={{ fontSize: 12 }}>Régua</Text></Tooltip>
                  <Slider style={{ flex: 1 }} min={0} max={70} step={0.5} value={Math.round((ms ?? 0) * 1000) / 10}
                    marks={sec.sugerida !== null ? { [Math.round(sec.sugerida * 100)]: ' ' } : undefined}
                    tooltip={{ formatter: v => `${v}%` }} onChange={v => aplicarEm(sec.indices, v / 100)} />
                </Flex>}>
                <Table<Linha & { i: number }> size="small" pagination={false} rowKey="i"
                  dataSource={sec.indices.map(i => ({ ...linhas[i], i }))} columns={colunas(cfg) as any}
                  expandable={{
                    expandedRowRender: l => faixasDe(l),
                    expandIcon: ({ expanded, onExpand, record }) => (
                      <Tooltip title="Faixas por quantidade">
                        <Button size="small" type={record.faixas.length ? 'link' : 'text'} onClick={e => onExpand(record, e)} style={{ padding: 0, width: 28 }}>
                          {expanded ? '−' : record.faixas.length ? `${record.faixas.length}f` : '+'}
                        </Button>
                      </Tooltip>
                    ),
                  }} />
              </Card>
            );
          })}
          {!linhas.length && <Empty description="Sem itens." />}
          <AdicionarItemNegociacao onAdicionar={adicionarItem} />

          <Card size="small" title="O que vai na proposta">
            <Row gutter={[12, 8]}>
              <Col xs={24} md={9}>
                <Text style={{ fontSize: 12 }}>Condição de pagamento</Text>
                <Flex gap={6} wrap>
                  <Select style={{ width: 170 }} value={cond.forma} onChange={v => setCond({ ...cond, forma: v })} popupMatchSelectWidth={false}
                    options={[
                      { value: '', label: 'A combinar / outra' }, { value: 'PIX', label: 'À vista no PIX' }, { value: 'DINHEIRO', label: 'À vista em dinheiro' },
                      { value: 'DEBITO', label: 'Cartão de débito' }, { value: 'CREDITO', label: 'Cartão de crédito' }, { value: 'PRAZO', label: 'A prazo (boleto/crediário)' },
                    ]} />
                  {(cond.forma === 'CREDITO' || cond.forma === 'PRAZO') && (
                    <CampoNumero style={{ width: 82 }} min={1} max={24} value={cond.parcelas} suffix="x" onChange={v => setCond({ ...cond, parcelas: Number(v) || 1 })} />
                  )}
                  {cond.forma === 'PRAZO' && (
                    <Select style={{ width: 120 }} value={cond.intervaloDias} onChange={v => setCond({ ...cond, intervaloDias: v })}
                      options={[7, 10, 14, 15, 21, 28, 30, 35, 45, 60].map(d => ({ value: d, label: `a cada ${d} dias` }))} />
                  )}
                  {(cond.forma === 'CREDITO' || cond.forma === 'PRAZO') && (
                    <CampoNumero style={{ width: 140 }} min={0} value={cond.entrada || null} prefix="Entrada R$" placeholder="0"
                      onChange={v => setCond({ ...cond, entrada: Number(v) || 0 })} />
                  )}
                  {(cond.forma === 'PIX' || cond.forma === 'DINHEIRO') && (
                    <Tooltip title="Desconto por pagar nesta forma, sobre o total da proposta (a proposta mostra o total com desconto)">
                      <CampoNumero style={{ width: 120 }} min={0} max={50} value={cond.descontoPct ? Math.round(cond.descontoPct * 10000) / 100 : null} prefix="Desc." suffix="%" placeholder="0"
                        onChange={v => {
                          const d = Math.min(0.5, Math.max(0, (Number(v) || 0) / 100));
                          // o antecipado acompanha a fração que estava escolhida (1/3 continua 1/3 do novo total)
                          const antes = totalComDesconto({ descontoPct: cond.descontoPct }, resumo.receita);
                          const fr = antes > 0 && cond.entrada > 0 ? cond.entrada / antes : 0;
                          setCond({ ...cond, descontoPct: d, entrada: fr ? Math.round(totalComDesconto({ descontoPct: d }, resumo.receita) * fr * 100) / 100 : cond.entrada });
                        }} />
                    </Tooltip>
                  )}
                  {(cond.forma === 'PIX' || cond.forma === 'DINHEIRO') && (
                    <Tooltip title="Pagamento em duas etapas: o antecipado agora e o saldo na conclusão e entrega. Vazio = tudo à vista.">
                      <CampoNumero style={{ width: 150 }} min={0} value={cond.entrada || null} prefix="Antecipado R$" placeholder="0"
                        onChange={v => setCond({ ...cond, entrada: Number(v) || 0 })} />
                    </Tooltip>
                  )}
                </Flex>
                {(cond.forma === 'PIX' || cond.forma === 'DINHEIRO') && resumo.receita > 0 && (
                  <Flex gap={4} wrap style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Dividir:</Text>
                    {([['tudo à vista', 0], ['1/3 antes', 1 / 3], ['1/2 antes', 1 / 2], ['2/3 antes', 2 / 3]] as const).map(([rotulo, f]) => (
                      <Button key={rotulo} size="small" type={Math.abs(cond.entrada - Math.round(aPagar * f * 100) / 100) < 0.01 ? 'primary' : 'default'}
                        onClick={() => setCond({ ...cond, entrada: Math.round(aPagar * f * 100) / 100 })}>{rotulo}</Button>
                    ))}
                  </Flex>
                )}
                {condicaoAtual
                  ? <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Na proposta: {textoDaCondicao(condicaoAtual, resumo.receita || undefined)}</Text>
                  : <AutoComplete style={{ width: '100%', marginTop: 6 }} options={CONDICOES_PAGAMENTO.map(value => ({ value }))} value={condicao} onChange={setCondicao}
                    placeholder="Texto livre (ex.: a combinar no fechamento)" maxLength={150} allowClear />}
              </Col>
              <Col xs={12} md={4}>
                <Text style={{ fontSize: 12 }}>Validade</Text>
                <CampoNumero style={{ width: '100%' }} min={1} max={180} value={validade} onChange={v => setValidade(v || 1)} suffix={validade === 1 ? 'dia' : 'dias'} />
              </Col>
              <Col xs={12} md={5}>
                <Text style={{ fontSize: 12 }}>Contato</Text>
                <Input value={contato} onChange={e => setContato(e.target.value)} maxLength={100} placeholder="Telefone ou pessoa" />
              </Col>
              <Col xs={24} md={6}>
                <Text style={{ fontSize: 12 }}>Observação</Text>
                <Input value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={255} />
              </Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              O cliente vê: itens por categoria, preço por unidade base, faixas por quantidade, condição, validade, vendedor e código do cliente. Custo e margem não saem.
            </Text>
          </Card>
        </Space>
      )}

      <Modal open={!!autorizar} title="Autorização: margem abaixo da mínima" okText="Autorizar e salvar" cancelText="Voltar" confirmLoading={salvando}
        onCancel={() => setAutorizar(null)} onOk={() => salvar(aut)} okButtonProps={{ disabled: !aut.senha || !aut.nome.trim() || !aut.motivo.trim() }} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }}>
          {autorizar?.motivos.map((m, i) => <Text key={i} type="danger" style={{ fontSize: 12 }}>{m}</Text>)}
          <Input.Password placeholder="Senha de autorização" value={aut.senha} onChange={e => setAut({ ...aut, senha: e.target.value })} />
          <Input placeholder="Quem autorizou" value={aut.nome} onChange={e => setAut({ ...aut, nome: e.target.value })} maxLength={60} />
          <Input placeholder="Motivo (ex.: cliente grande, concorrência)" value={aut.motivo} onChange={e => setAut({ ...aut, motivo: e.target.value })} maxLength={255} />
        </Space>
      </Modal>
    </Drawer>
  );
};
