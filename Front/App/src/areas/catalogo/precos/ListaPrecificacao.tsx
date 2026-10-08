// Lista de precificação: vários itens numa grade, com ações em massa (custo, markup, ajuste %, arredondamento)
// e gravação de uma vez. As ações valem para as linhas marcadas (ou para todas, se nenhuma estiver marcada).
import React, { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Flex, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography, message, theme } from 'antd';
import { DeleteOutlined, SaveOutlined, SlidersOutlined, UndoOutlined } from '@ant-design/icons';
import { API_URL } from '../../../shared/api/config';
import ProductCommercialSalesConfig from './ProductCommercialSalesConfig';
import { fatorTaxaPreco, useTaxaPreco } from '../../../shared/core/precos/taxaPreco';
import {
  AcaoLote, aplicarAcao, Arredondamento, comCusto, comMarkup, comPreco, faltaUnidade, LinhaLote, linhaAlterada, linhaDoPainel, margemLiquida, pedidoDaLinha,
} from './precificacaoLote';
import SeletorUnidade from '../unidades/SeletorUnidade';
import { salvarPrecosLote } from './precificacaoLote.api';

const brl = (v: number | null | undefined, casas = 2) => (v === null || v === undefined ? '—'
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas }));

interface Props {
  aberta: boolean;
  linhas: LinhaLote[];
  onChange: (linhas: LinhaLote[]) => void;
  onFechar: () => void;
  /** Itens gravados com sucesso (saem da lista) */
  onSalvo: (ids: number[]) => void;
}

export const ListaPrecificacao: React.FC<Props> = ({ aberta, linhas, onChange, onFechar, onSalvo }) => {
  const { token } = theme.useToken();
  const taxa = useTaxaPreco();
  const fator = fatorTaxaPreco();
  const [marcadas, setMarcadas] = useState<React.Key[]>([]);
  const [markupMassa, setMarkupMassa] = useState<number | null>(1.8);
  const [ajustePct, setAjustePct] = useState<number | null>(5);
  const [arredondamento, setArredondamento] = useState<Arredondamento>('CENTAVOS_90');
  const [salvando, setSalvando] = useState(false);
  const [unidadeMassa, setUnidadeMassa] = useState('UN');
  const semUnidade = linhas.filter(faltaUnidade).length;
  // Editor completo do item (unidades, fracionamento, atacado) aberto pela linha
  const [editando, setEditando] = useState<LinhaLote | null>(null);

  // Ao fechar o editor a linha volta com o que ficou gravado (a lista não sobrescreve o que foi acertado lá)
  const recarregarLinha = async (l: LinhaLote) => {
    try {
      const r = await fetch(`${API_URL}/api/catalogo/precos/painel?tenant_id=1&limit=50&busca=${encodeURIComponent(l.sku)}`);
      const d = await r.json();
      const item = (d.data || []).find((i: { idItem: number }) => i.idItem === l.idItem);
      if (item) onChange(linhas.map(x => (x.idItem === l.idItem ? linhaDoPainel(item, fatorTaxaPreco()) : x)));
    } catch {
      message.warning('Não foi possível recarregar o item: confira os valores antes de gravar.');
    }
  };

  const alteradas = useMemo(() => linhas.filter(linhaAlterada), [linhas]);

  // Ação em massa: nas marcadas, ou em todas se nenhuma marcada
  const aplicar = (acao: AcaoLote) => {
    const alvo = new Set(marcadas.length ? marcadas.map(Number) : linhas.map(l => l.idItem));
    const atualizadas = aplicarAcao(linhas.filter(l => alvo.has(l.idItem)), acao, fator);
    const porId = new Map(atualizadas.map(l => [l.idItem, l]));
    onChange(linhas.map(l => porId.get(l.idItem) || l));
  };
  const editar = (id: number, f: (l: LinhaLote) => LinhaLote) => onChange(linhas.map(l => (l.idItem === id ? f(l) : l)));
  const alvoTexto = marcadas.length ? `${marcadas.length} marcada(s)` : 'todas';

  const salvar = async () => {
    if (!alteradas.length) { message.info('Nenhuma alteração para gravar.'); return; }
    const semPreco = alteradas.filter(l => !(Number(l.preco) > 0) || !(Number(l.custo) > 0));
    if (semPreco.length) { message.warning(`${semPreco.length} item(ns) sem custo ou sem preço: preencha ou tire da lista.`); return; }
    const faltando = alteradas.filter(faltaUnidade);
    if (faltando.length) { message.warning(`${faltando.length} item(ns) sem unidade base: escolha a unidade na linha (ou em massa) antes de gravar.`); return; }
    setSalvando(true);
    try {
      const r = await salvarPrecosLote(alteradas.map(pedidoDaLinha));
      const okIds = r.resultados.filter(x => x.ok).map(x => x.idItem);
      const erros = r.resultados.filter(x => !x.ok);
      if (okIds.length) onSalvo(okIds);
      setMarcadas([]);
      if (erros.length) {
        const nomes = new Map(linhas.map(l => [l.idItem, `${l.sku} · ${l.nome}`]));
        Modal.warning({
          title: `${okIds.length} item(ns) gravado(s); ${erros.length} com problema`,
          content: <Flex vertical gap={4}>{erros.map(e => <span key={e.idItem}><b>{nomes.get(e.idItem) || e.idItem}</b>: {e.erro}</span>)}</Flex>,
        });
      } else {
        message.success(`${okIds.length} item(ns) precificado(s). Se tiverem etiqueta na gôndola, aparecem em Etiquetagem › desatualizadas.`);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao gravar os preços.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Drawer open={aberta} onClose={onFechar} size={Math.min(1250, window.innerWidth - 40)}
      title={`Lista de precificação (${linhas.length} item(ns))`}
      extra={
        <Space>
          <Popconfirm title="Tirar todos os itens da lista?" okText="Limpar" cancelText="Cancelar" onConfirm={() => { onChange([]); setMarcadas([]); }} disabled={!linhas.length}>
            <Button danger disabled={!linhas.length}>Limpar lista</Button>
          </Popconfirm>
          <Button type="primary" icon={<SaveOutlined />} loading={salvando} disabled={!alteradas.length} onClick={salvar}>
            Gravar {alteradas.length} alteração(ões)
          </Button>
        </Space>
      }>
      {linhas.length === 0 ? (
        <Empty description='Lista vazia. No painel, marque os itens (ou use "Todos do filtro") e clique em "Adicionar à lista".' />
      ) : (
        <Flex vertical gap={10}>
          {/* Ações em massa */}
          <Flex gap={16} wrap align="center" style={{ padding: 10, borderRadius: token.borderRadiusLG, background: token.colorFillQuaternary }}>
            <Typography.Text type="secondary">Aplicar em <b>{alvoTexto}</b>:</Typography.Text>
            <Space size={4}>
              <span>Custo:</span>
              <Tooltip title="Custo da última entrada de NF"><Button size="small" onClick={() => aplicar({ tipo: 'CUSTO', origem: 'ULTIMO' })}>Último</Button></Tooltip>
              <Tooltip title="Custo médio do estoque"><Button size="small" onClick={() => aplicar({ tipo: 'CUSTO', origem: 'MEDIO' })}>Médio</Button></Tooltip>
              <Tooltip title="Volta ao custo gravado hoje"><Button size="small" onClick={() => aplicar({ tipo: 'CUSTO', origem: 'ATUAL' })}>Atual</Button></Tooltip>
            </Space>
            <Space size={4}>
              <span>Markup:</span>
              <InputNumber size="small" min={0.01} step={0.1} precision={4} decimalSeparator="," style={{ width: 90 }} value={markupMassa} onChange={setMarkupMassa} />
              <Button size="small" disabled={!markupMassa} onClick={() => markupMassa && aplicar({ tipo: 'MARKUP', valor: markupMassa })}>Aplicar</Button>
            </Space>
            <Space size={4}>
              <span>Preço:</span>
              <InputNumber size="small" step={1} precision={2} decimalSeparator="," suffix="%" style={{ width: 95 }} value={ajustePct} onChange={setAjustePct} />
              <Button size="small" disabled={!ajustePct} onClick={() => ajustePct && aplicar({ tipo: 'AJUSTE_PCT', pct: ajustePct })}>Ajustar</Button>
            </Space>
            <Space size={4}>
              <span>Arredondar:</span>
              <Select size="small" style={{ width: 130 }} value={arredondamento} onChange={setArredondamento} options={[
                { value: 'CENTAVOS_90', label: 'para ,90' }, { value: 'CENTAVOS_99', label: 'para ,99' },
                { value: 'MEIO', label: 'para ,00 ou ,50' }, { value: 'INTEIRO', label: 'para real inteiro' },
              ]} />
              <Button size="small" onClick={() => aplicar({ tipo: 'ARREDONDAR', modo: arredondamento })}>Aplicar</Button>
            </Space>
            {semUnidade > 0 && (
              <Space size={4}>
                <Tooltip title="Itens antigos sem unidade base: a unidade é criada junto com o preço">
                  <span style={{ color: token.colorErrorText }}>Unidade ({semUnidade} sem):</span>
                </Tooltip>
                <SeletorUnidade size="small" style={{ width: 150 }} value={unidadeMassa} onChange={s => setUnidadeMassa(s)} />
                <Button size="small" disabled={!unidadeMassa.trim()} onClick={() => aplicar({ tipo: 'UNIDADE', sigla: unidadeMassa })}>Aplicar</Button>
              </Space>
            )}
            <Button size="small" icon={<UndoOutlined />} onClick={() => aplicar({ tipo: 'DESFAZER' })}>Desfazer</Button>
          </Flex>
          {taxa.percentual > 0 && (
            <Alert type="info" showIcon title={`Preço = custo × markup com a taxa de ${taxa.percentual.toFixed(2)}% embutida. Custo novo recalcula também as outras unidades e o atacado do item (mantendo o markup de cada faixa); markup e preço valem para o varejo da unidade base.`} />
          )}

          <Table<LinhaLote>
            size="small"
            rowKey="idItem"
            dataSource={linhas}
            pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
            rowSelection={{ selectedRowKeys: marcadas, onChange: setMarcadas }}
            onRow={l => ({ style: linhaAlterada(l) ? { background: token.colorWarningBg } : undefined })}
            scroll={{ x: 1270 }}
            columns={[
              {
                title: 'Item', key: 'item',
                render: (_, l) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{l.nome}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{l.sku}{l.unidade ? ` · ${l.unidade}` : ''}</Typography.Text>
                    {!l.unidade && (
                      <Flex gap={4} align="center" style={{ marginTop: 2 }}>
                        <Typography.Text type="danger" style={{ fontSize: 11 }}>Sem unidade:</Typography.Text>
                        <SeletorUnidade size="small" style={{ width: 150 }} placeholder="Escolha"
                          status={l.unidadeNova ? undefined : 'error'} value={l.unidadeNova || null}
                          onChange={s => editar(l.idItem, x => ({ ...x, unidadeNova: s }))} />
                      </Flex>
                    )}
                    {((l.faixasAtacado || 0) > 0 || (l.unidadesVenda || 1) > 1) && (
                      <div>
                        {(l.faixasAtacado || 0) > 0 && <Tag color="orange" style={{ fontSize: 10, margin: '2px 4px 0 0' }}>{l.faixasAtacado} atacado</Tag>}
                        {(l.unidadesVenda || 1) > 1 && <Tag style={{ fontSize: 10, margin: '2px 0 0' }}>{l.unidadesVenda} unidades</Tag>}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: 'Custo', key: 'custo', width: 210,
                render: (_, l) => (
                  <Flex vertical gap={2}>
                    <InputNumber size="small" min={0} precision={4} decimalSeparator="," prefix="R$" style={{ width: '100%' }}
                      value={l.custo} onChange={v => editar(l.idItem, x => comCusto(x, v, fator))} />
                    <Flex gap={4} wrap style={{ fontSize: 11 }}>
                      {l.ultimoCusto !== null && Math.abs((l.ultimoCusto || 0) - (l.custo || 0)) >= 0.0001 && (
                        <Tag style={{ margin: 0, cursor: 'pointer' }} color="orange" onClick={() => editar(l.idItem, x => comCusto(x, l.ultimoCusto, fator))}>últ. {brl(l.ultimoCusto, 4)}</Tag>
                      )}
                      {l.custoMedio !== null && Math.abs((l.custoMedio || 0) - (l.custo || 0)) >= 0.0001 && (
                        <Tag style={{ margin: 0, cursor: 'pointer' }} onClick={() => editar(l.idItem, x => comCusto(x, l.custoMedio, fator))}>méd. {brl(l.custoMedio, 4)}</Tag>
                      )}
                    </Flex>
                  </Flex>
                ),
              },
              {
                title: 'Markup', key: 'markup', width: 110,
                render: (_, l) => (
                  <InputNumber size="small" min={0.01} step={0.1} precision={4} decimalSeparator="," style={{ width: '100%' }}
                    value={l.markup} onChange={v => editar(l.idItem, x => comMarkup(x, v, fator))} />
                ),
              },
              {
                title: 'Preço novo', key: 'preco', width: 170,
                render: (_, l) => (
                  <Flex vertical gap={2}>
                    <InputNumber size="small" min={0} precision={2} decimalSeparator="," prefix="R$" style={{ width: '100%', fontWeight: 600 }}
                      value={l.preco} onChange={v => editar(l.idItem, x => comPreco(x, v, fator))} />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>atual {brl(l.precoAtual)}</Typography.Text>
                  </Flex>
                ),
              },
              {
                // Como no card das faixas do editor: venda = custo + taxa + lucro
                title: <Tooltip title={`Taxa da maquininha embutida no preço (${taxa.percentual.toFixed(2)}%): o que fica com a operadora`}>Taxa</Tooltip>,
                key: 'taxa', width: 120, align: 'right' as const,
                render: (_, l) => (l.preco && l.preco > 0
                  ? <span style={{ color: token.colorWarningText, whiteSpace: 'nowrap' }}>{brl(l.preco * taxa.percentual / 100)}<Typography.Text type="secondary" style={{ fontSize: 11 }}> ({taxa.percentual.toFixed(2)}%)</Typography.Text></span>
                  : '—'),
              },
              {
                title: <Tooltip title="Lucro líquido por unidade: venda − taxa − custo">Lucro</Tooltip>, key: 'lucro', width: 100, align: 'right' as const,
                render: (_, l) => {
                  if (!l.preco || !l.custo) return '—';
                  const lucro = l.preco * (1 - taxa.percentual / 100) - l.custo;
                  return <b style={{ color: lucro < 0 ? token.colorError : token.colorPrimary, whiteSpace: 'nowrap' }}>{lucro < 0 ? '−' : '+'}{brl(Math.abs(lucro))}</b>;
                },
              },
              {
                title: 'Variação', key: 'var', width: 90, align: 'right' as const,
                render: (_, l) => {
                  if (!l.precoAtual || !l.preco) return <Typography.Text type="secondary">—</Typography.Text>;
                  const v = ((l.preco - l.precoAtual) / l.precoAtual) * 100;
                  if (Math.abs(v) < 0.005) return <Typography.Text type="secondary">0%</Typography.Text>;
                  return <Typography.Text type={v > 0 ? 'warning' : 'success'}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</Typography.Text>;
                },
              },
              {
                title: <Tooltip title="Depois da taxa embutida, sobre o preço">Margem líq.</Tooltip>, key: 'margem', width: 100, align: 'right' as const,
                render: (_, l) => {
                  const m = margemLiquida(l.preco, l.custo, taxa.percentual);
                  return m === null ? '—' : <Tag color={m < 0 ? 'red' : m < 15 ? 'orange' : 'green'} style={{ margin: 0 }}>{m.toFixed(1)}%</Tag>;
                },
              },
              {
                title: '', key: 'faixas', width: 44,
                render: (_, l) => (
                  <Tooltip title="Editor completo: unidades, fracionamento e faixas de atacado (markup, taxa e lucro de cada uma)">
                    <Button size="small" icon={<SlidersOutlined />} onClick={() => (linhaAlterada(l)
                      ? Modal.confirm({
                        title: 'Abrir o editor completo deste item?',
                        content: 'As alterações desta linha que ainda não foram gravadas serão descartadas: ao fechar o editor, a linha volta com o que ficou gravado nele.',
                        okText: 'Abrir o editor', cancelText: 'Voltar',
                        onOk: () => setEditando(l),
                      })
                      : setEditando(l))} />
                  </Tooltip>
                ),
              },
              {
                title: '', key: 'x', width: 40,
                render: (_, l) => (
                  <Tooltip title="Tirar da lista">
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => { onChange(linhas.filter(x => x.idItem !== l.idItem)); setMarcadas(m => m.filter(k => Number(k) !== l.idItem)); }} />
                  </Tooltip>
                ),
              },
            ]}
          />
        </Flex>
      )}

      {/* Editor completo do item: o mesmo da Precificação (atacado, unidades, fracionamento) */}
      <Drawer open={!!editando} size={1100} title={editando ? `${editando.sku} · ${editando.nome}` : ''} destroyOnHidden
        onClose={() => { const l = editando; setEditando(null); if (l) recarregarLinha(l); }}>
        {editando && <ProductCommercialSalesConfig idItem={editando.idItem} />}
      </Drawer>
    </Drawer>
  );
};

export default ListaPrecificacao;
