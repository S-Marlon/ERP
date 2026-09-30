// Consulta de saldo (modelo novo): saldos por item, extrato, ajuste avulso e inventário em lote.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, Drawer, Dropdown, Input, InputNumber, Modal, Radio, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, message,
} from 'antd';
import {
  AuditOutlined, EnvironmentOutlined, HistoryOutlined, PlusSquareOutlined, ReloadOutlined, SettingOutlined, SlidersOutlined, UnorderedListOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useListaTrabalho } from '../../../../core/listaTrabalho/ListaTrabalhoContext';
import { ListaTrabalhoDrawer } from '../../../../core/listaTrabalho/ListaTrabalhoDrawer';
import { TAGS_LISTA, TagLista } from '../../../../core/listaTrabalho/listaTrabalho';
import {
  AjusteItem, getCategoriasEstoque, getMovimentos, getSaldos, lancarAjuste, Movimento, ORIGENS_MOVIMENTO,
  ResumoSaldos, ROTULO_SITUACAO, SaldoItem, salvarParametrosEstoque, TipoAjuste,
} from '../../api/estoqueItensApi';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const dataHora = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

// Extrato do item (mais recente primeiro)
const ExtratoItem: React.FC<{ item: SaldoItem | null; onClose: () => void }> = ({ item, onClose }) => {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!item) return;
    setCarregando(true);
    getMovimentos({ idItem: item.idItem, limit: 200 })
      .then(r => setMovimentos(r.data))
      .catch(e => message.error(e.message))
      .finally(() => setCarregando(false));
  }, [item]);

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      width={860}
      title={item ? `Extrato: ${item.sku} · ${item.nome}` : ''}
      extra={item && <Tag color="blue">Saldo {qtd(item.quantidade)} {item.unidade}</Tag>}
    >
      <Table
        size="small"
        rowKey="idMovimento"
        loading={carregando}
        dataSource={movimentos}
        pagination={{ pageSize: 50, hideOnSinglePage: true }}
        columns={[
          { title: 'Data', dataIndex: 'criadoEm', width: 120, render: (v: string) => dataHora(v) },
          {
            title: 'Origem', dataIndex: 'origem', width: 150,
            render: (o: string, m: Movimento) => (
              <Tooltip title={m.documento || ''}>
                <Tag color={ORIGENS_MOVIMENTO[o]?.color}>{ORIGENS_MOVIMENTO[o]?.label || o}</Tag>
              </Tooltip>
            ),
          },
          {
            title: 'Quantidade', key: 'q', width: 120, align: 'right' as const,
            render: (_: unknown, m: Movimento) => (
              <Tooltip title={m.fatorConversao !== 1 && m.quantidadeDocumento !== null ? `${qtd(m.quantidadeDocumento)} ${m.unidadeDocumento || ''} no documento` : undefined}>
                <b style={{ color: m.tipo === 'ENTRADA' ? '#16a34a' : '#dc2626' }}>
                  {m.tipo === 'ENTRADA' ? '+' : '-'}{qtd(m.quantidade)}
                </b>
              </Tooltip>
            ),
          },
          { title: 'Saldo', key: 's', width: 110, align: 'right' as const, render: (_: unknown, m: Movimento) => `${qtd(m.saldoAnterior)} → ${qtd(m.saldoPosterior)}` },
          { title: 'Custo un.', dataIndex: 'custoUnitario', width: 100, align: 'right' as const, render: (v: number) => money(v) },
          { title: 'Observação', dataIndex: 'observacao', ellipsis: true },
        ]}
      />
    </Drawer>
  );
};

const SaldoEstoque: React.FC = () => {
  const [itens, setItens] = useState<SaldoItem[]>([]);
  const [resumo, setResumo] = useState<ResumoSaldos | null>(null);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [categorias, setCategorias] = useState<string[]>(['Todas']);
  const [filtros, setFiltros] = useState({ busca: '', categoria: 'Todas', situacao: '', page: 1, limit: 50 });
  const [buscaDigitada, setBuscaDigitada] = useState('');

  const [itemExtrato, setItemExtrato] = useState<SaldoItem | null>(null);

  // Lista de trabalho global (etiquetar, comprar, conferir...)
  const lista = useListaTrabalho();
  const navigate = useNavigate();
  const [listaAberta, setListaAberta] = useState(false);
  const [selecionados, setSelecionados] = useState<SaldoItem[]>([]);

  const enviarParaLista = (alvos: SaldoItem[], tag: TagLista) => {
    if (alvos.length === 0) return;
    lista.adicionarVarios(
      alvos.map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, unidade: i.unidade })),
      {
        tags: [tag],
        origem: 'Consulta de Saldo',
        // Comprar: sugere a reposição até o máximo/mínimo quando houver
        quantidade: tag === 'COMPRAR' && alvos.length === 1 && alvos[0].sugestaoReposicao > 0 ? alvos[0].sugestaoReposicao : undefined,
      }
    );
    message.success(`${alvos.length} item(ns) em "${TAGS_LISTA[tag].label}".`);
  };

  const menuTags = (alvos: SaldoItem[]) => ({
    items: (Object.keys(TAGS_LISTA) as TagLista[]).map(t => ({ key: t, label: TAGS_LISTA[t].label })),
    onClick: ({ key }: { key: string }) => enviarParaLista(alvos, key as TagLista),
  });

  // Ajuste avulso
  const [itemAjuste, setItemAjuste] = useState<SaldoItem | null>(null);
  const [ajuste, setAjuste] = useState<{ tipo: TipoAjuste; quantidade: number | null; custo: number | null; motivo: string }>({ tipo: 'ENTRADA', quantidade: null, custo: null, motivo: '' });
  const [salvando, setSalvando] = useState(false);

  // Parâmetros do item: mínimo, máximo e localização
  const [itemParametros, setItemParametros] = useState<SaldoItem | null>(null);
  const [parametros, setParametros] = useState<{ minimo: number | null; maximo: number | null; localizacao: string }>({ minimo: null, maximo: null, localizacao: '' });

  const abrirParametros = (item: SaldoItem) => {
    setItemParametros(item);
    setParametros({ minimo: item.minimoItem, maximo: item.maximo, localizacao: item.localizacao });
  };

  const salvarParametros = async () => {
    if (!itemParametros) return;
    if (parametros.minimo !== null && parametros.maximo !== null && parametros.maximo < parametros.minimo) {
      return message.warning('O máximo não pode ser menor que o mínimo.');
    }
    setSalvando(true);
    try {
      await salvarParametrosEstoque(itemParametros.idItem, {
        estoqueMinimo: parametros.minimo,
        estoqueMaximo: parametros.maximo,
        localizacao: parametros.localizacao,
      });
      message.success('Parâmetros salvos.');
      setItemParametros(null);
      carregar();
    } catch (e: any) {
      Modal.error({ title: 'Parâmetros não salvos', content: e.message });
    } finally {
      setSalvando(false);
    }
  };

  // Inventário: contagens digitadas por item (acumulam entre páginas e filtros)
  const [modoInventario, setModoInventario] = useState(false);
  const [contagens, setContagens] = useState<Record<number, number>>({});

  const carregar = async () => {
    setCarregando(true);
    try {
      const r = await getSaldos({ ...filtros, categoria: filtros.categoria === 'Todas' ? '' : filtros.categoria });
      setItens(r.data);
      setResumo(r.resumo);
      setTotal(r.pagination.total);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [filtros]);
  useEffect(() => { getCategoriasEstoque().then(setCategorias); }, []);
  useEffect(() => {
    const t = setTimeout(() => setFiltros(f => (f.busca === buscaDigitada ? f : { ...f, busca: buscaDigitada, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [buscaDigitada]);

  const abrirAjuste = (item: SaldoItem) => {
    setItemAjuste(item);
    setAjuste({ tipo: 'ENTRADA', quantidade: null, custo: null, motivo: '' });
  };

  const salvarAjuste = async () => {
    if (!itemAjuste) return;
    if (ajuste.quantidade === null || (ajuste.tipo !== 'CONTAGEM' && ajuste.quantidade <= 0)) return message.warning('Informe a quantidade.');
    if (!ajuste.motivo.trim()) return message.warning('Informe o motivo.');
    setSalvando(true);
    try {
      const r = await lancarAjuste({
        origem: 'AJUSTE_MANUAL',
        motivo: ajuste.motivo.trim(),
        itens: [{ idItem: itemAjuste.idItem, tipo: ajuste.tipo, quantidade: ajuste.quantidade, custoUnitario: ajuste.tipo === 'ENTRADA' ? ajuste.custo : null }],
      });
      message.success(r.lancados > 0 ? `Ajuste lançado (${r.documento}).` : 'Contagem igual ao saldo: nada a lançar.');
      setItemAjuste(null);
      carregar();
    } catch (e: any) {
      Modal.error({ title: 'Ajuste não lançado', content: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const idsContados = Object.keys(contagens).map(Number);
  const aplicarInventario = () => {
    if (idsContados.length === 0) return message.info('Digite a quantidade contada de ao menos um item.');
    let motivo = `Inventário ${new Date().toLocaleDateString('pt-BR')}`;
    Modal.confirm({
      title: `Aplicar a contagem de ${idsContados.length} item(ns)?`,
      width: 520,
      content: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <span>O saldo de cada item passa a ser a quantidade contada; a diferença vira entrada ou saída de inventário.</span>
          <Input defaultValue={motivo} onChange={e => { motivo = e.target.value; }} placeholder="Motivo / identificação do inventário" />
        </Space>
      ),
      okText: 'Aplicar inventário',
      onOk: async () => {
        if (!motivo.trim()) { message.warning('Informe o motivo.'); throw new Error('motivo'); }
        const payload: AjusteItem[] = idsContados.map(id => ({ idItem: id, tipo: 'CONTAGEM', quantidade: contagens[id] }));
        try {
          const r = await lancarAjuste({ origem: 'INVENTARIO', motivo: motivo.trim(), itens: payload });
          message.success(`Inventário aplicado: ${r.lancados} ajuste(s), ${r.semDiferenca} sem diferença.`);
          setContagens({});
          setModoInventario(false);
          carregar();
        } catch (e: any) {
          Modal.error({ title: 'Inventário não aplicado', content: e.message });
        }
      },
    });
  };

  const colunas = useMemo(() => {
    const base: any[] = [
      { title: 'SKU', dataIndex: 'sku', width: 150 },
      {
        title: 'Item', dataIndex: 'nome',
        render: (nome: string, i: SaldoItem) => (
          <div>
            <div style={{ fontWeight: 600 }}>{nome}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {[i.categoria, i.familia].filter(Boolean).join(' · ') || 'Sem categoria'}
              {(lista.itens.find(l => l.idItem === i.idItem)?.tags || []).map(t => (
                <Tag key={t} color={TAGS_LISTA[t].color} style={{ marginLeft: 4, fontSize: 10, lineHeight: '14px' }}>{TAGS_LISTA[t].label}</Tag>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: 'Local', dataIndex: 'localizacao', width: 90,
        render: (v: string) => (v ? <Tag icon={<EnvironmentOutlined />} style={{ margin: 0 }}>{v}</Tag> : <span style={{ color: '#cbd5e1' }}>-</span>),
      },
      {
        title: 'Saldo', dataIndex: 'quantidade', width: 120, align: 'right' as const,
        render: (v: number, i: SaldoItem) => (
          <b style={{ color: v < 0 ? '#dc2626' : undefined }}>{qtd(v)} <span style={{ fontWeight: 400, color: '#64748b' }}>{i.unidade}</span></b>
        ),
      },
      {
        title: 'Mín / Máx', key: 'minmax', width: 110, align: 'right' as const,
        render: (_: unknown, i: SaldoItem) => (
          <Tooltip title={i.minimoItem === null && i.minimoFamilia !== null ? 'Mínimo herdado da família' : undefined}>
            <span style={{ color: i.minimoItem === null ? '#94a3b8' : undefined }}>
              {i.minimo !== null ? qtd(i.minimo) : '-'}
            </span>
            {' / '}
            {i.maximo !== null ? qtd(i.maximo) : '-'}
          </Tooltip>
        ),
      },
      {
        title: 'Custo médio', dataIndex: 'custoMedio', width: 110, align: 'right' as const,
        render: (v: number, i: SaldoItem) => (v > 0 ? money(v) : (
          <Tooltip title="Sem custo médio: usa o custo gerencial do cadastro">
            <span style={{ color: '#94a3b8' }}>{i.custoReferencia > 0 ? money(i.custoReferencia) : '-'}</span>
          </Tooltip>
        )),
      },
      { title: 'Valor', dataIndex: 'valorEstoque', width: 110, align: 'right' as const, render: (v: number) => money(v) },
      {
        title: 'Situação', dataIndex: 'situacao', width: 130,
        render: (s: SaldoItem['situacao'], i: SaldoItem) => (
          <Tooltip title={i.sugestaoReposicao > 0 ? `Repor ${qtd(i.sugestaoReposicao)} ${i.unidade} para chegar ao ${i.maximo !== null ? 'máximo' : 'mínimo'}` : undefined}>
            <Tag color={ROTULO_SITUACAO[s].color}>{ROTULO_SITUACAO[s].label}</Tag>
          </Tooltip>
        ),
      },
      { title: 'Último mov.', dataIndex: 'ultimoMovimento', width: 120, render: (v: string | null) => dataHora(v) },
    ];
    if (modoInventario) {
      base.push({
        title: 'Contado', key: 'contado', width: 130, fixed: 'right' as const,
        render: (_: unknown, i: SaldoItem) => (
          <InputNumber
            size="small"
            min={0}
            style={{ width: '100%' }}
            value={contagens[i.idItem]}
            placeholder={qtd(i.quantidade)}
            status={contagens[i.idItem] !== undefined && contagens[i.idItem] !== i.quantidade ? 'warning' : undefined}
            onChange={v => setContagens(prev => {
              const novo = { ...prev };
              if (v === null || v === undefined) delete novo[i.idItem];
              else novo[i.idItem] = Number(v);
              return novo;
            })}
          />
        ),
      });
    } else {
      base.push({
        title: '', key: 'acoes', width: 140, fixed: 'right' as const,
        render: (_: unknown, i: SaldoItem) => (
          <Space size={0}>
            <Dropdown menu={menuTags([i])} trigger={['click']}>
              <Tooltip title="Enviar para a lista de trabalho"><Button type="text" size="small" icon={<PlusSquareOutlined />} /></Tooltip>
            </Dropdown>
            <Tooltip title="Mínimo, máximo e localização"><Button type="text" size="small" icon={<SettingOutlined />} onClick={() => abrirParametros(i)} /></Tooltip>
            <Tooltip title="Extrato"><Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setItemExtrato(i)} /></Tooltip>
            <Tooltip title="Ajustar saldo"><Button type="text" size="small" icon={<SlidersOutlined />} onClick={() => abrirAjuste(i)} /></Tooltip>
          </Space>
        ),
      });
    }
    return base;
  }, [modoInventario, contagens, lista.itens]);

  const saldoPrevisto = itemAjuste && ajuste.quantidade !== null
    ? ajuste.tipo === 'ENTRADA' ? itemAjuste.quantidade + ajuste.quantidade
      : ajuste.tipo === 'SAIDA' ? itemAjuste.quantidade - ajuste.quantidade
      : ajuste.quantidade
    : null;

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Consulta de Saldo</h2>
          <Space wrap>
            <Space size={6}>
              <AuditOutlined />
              <span>Modo inventário</span>
              <Switch checked={modoInventario} onChange={setModoInventario} />
            </Space>
            {modoInventario && (
              <>
                <Tag color="blue">{idsContados.length} contado(s)</Tag>
                <Button onClick={() => setContagens({})} disabled={idsContados.length === 0}>Limpar contagens</Button>
                <Button type="primary" onClick={aplicarInventario} disabled={idsContados.length === 0}>Aplicar inventário</Button>
              </>
            )}
            <Button icon={<UnorderedListOutlined />} onClick={() => setListaAberta(true)}>Lista de trabalho ({lista.itens.length})</Button>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Atualizar</Button>
          </Space>
        </div>

        {resumo && (
          <Row gutter={[12, 12]}>
            {[
              { titulo: 'Valor em estoque', valor: money(resumo.valorTotal), situacao: '' },
              { titulo: 'Itens com saldo', valor: `${resumo.comSaldo} de ${resumo.itens}`, situacao: 'COM_SALDO' },
              { titulo: 'Zerados', valor: String(resumo.zerados), situacao: 'ZERADO' },
              { titulo: 'Negativos', valor: String(resumo.negativos), situacao: 'NEGATIVO' },
              { titulo: 'Abaixo do mínimo', valor: String(resumo.abaixoMinimo), situacao: 'ABAIXO_MINIMO' },
            ].map(c => (
              <Col key={c.titulo} xs={12} md={8} lg={4}>
                <Card
                  size="small"
                  hoverable={!!c.situacao}
                  onClick={() => c.situacao && setFiltros(f => ({ ...f, situacao: f.situacao === c.situacao ? '' : c.situacao, page: 1 }))}
                  style={filtros.situacao && filtros.situacao === c.situacao ? { borderColor: '#1677ff' } : undefined}
                >
                  <Statistic title={c.titulo} value={c.valor} valueStyle={{ fontSize: 18, fontWeight: 700 }} />
                </Card>
              </Col>
            ))}
          </Row>
        )}

        <Card size="small">
          <Space wrap style={{ marginBottom: 8 }}>
            <Input.Search allowClear placeholder="SKU, nome, GTIN ou local" style={{ width: 280 }} value={buscaDigitada} onChange={e => setBuscaDigitada(e.target.value)} />
            <Select
              style={{ width: 220 }}
              value={filtros.categoria}
              onChange={v => setFiltros(f => ({ ...f, categoria: v, page: 1 }))}
              options={categorias.map(c => ({ value: c, label: c }))}
              showSearch
            />
            <Select
              style={{ width: 180 }}
              value={filtros.situacao}
              onChange={v => setFiltros(f => ({ ...f, situacao: v, page: 1 }))}
              options={[
                { value: '', label: 'Todas as situações' },
                { value: 'COM_SALDO', label: 'Com saldo' },
                { value: 'ZERADO', label: 'Zerados' },
                { value: 'NEGATIVO', label: 'Negativos' },
                { value: 'ABAIXO_MINIMO', label: 'Abaixo do mínimo' },
              ]}
            />
            {!modoInventario && (
              <Dropdown menu={menuTags(selecionados)} trigger={['click']} disabled={selecionados.length === 0}>
                <Button icon={<PlusSquareOutlined />} disabled={selecionados.length === 0}>
                  Enviar {selecionados.length > 0 ? `${selecionados.length} ` : ''}selecionado(s) para...
                </Button>
              </Dropdown>
            )}
          </Space>
          <Table
            rowKey="idItem"
            size="small"
            loading={carregando}
            dataSource={itens}
            columns={colunas}
            rowSelection={modoInventario ? undefined : {
              selectedRowKeys: selecionados.map(s => s.idItem),
              onChange: (_keys, rows) => setSelecionados(rows as SaldoItem[]),
              preserveSelectedRowKeys: true,
            }}
            scroll={{ x: 1000 }}
            pagination={{
              current: filtros.page,
              pageSize: filtros.limit,
              total,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100, 200],
              onChange: (page, limit) => setFiltros(f => ({ ...f, page, limit })),
            }}
          />
        </Card>
      </Space>

      <ExtratoItem item={itemExtrato} onClose={() => setItemExtrato(null)} />

      <ListaTrabalhoDrawer
        open={listaAberta}
        onClose={() => setListaAberta(false)}
        extra={lista.contagem.ETIQUETAR > 0 && (
          <Button type="primary" onClick={() => navigate('/estoque/etiquetagem')}>Ir para Etiquetagem ({lista.contagem.ETIQUETAR})</Button>
        )}
      />

      <Modal
        open={!!itemParametros}
        title={itemParametros ? `Parâmetros de estoque: ${itemParametros.sku}` : ''}
        onCancel={() => setItemParametros(null)}
        onOk={salvarParametros}
        okText="Salvar"
        confirmLoading={salvando}
        destroyOnClose
      >
        {itemParametros && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ fontSize: 13 }}>
              {itemParametros.nome}<br />
              Saldo atual: <b>{qtd(itemParametros.quantidade)} {itemParametros.unidade}</b>
              {itemParametros.minimoFamilia !== null && <> · Mínimo da família: {qtd(itemParametros.minimoFamilia)}</>}
            </div>
            <Space wrap>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>Estoque mínimo</div>
                <InputNumber min={0} value={parametros.minimo} placeholder={itemParametros.minimoFamilia !== null ? `família: ${qtd(itemParametros.minimoFamilia)}` : 'sem mínimo'}
                  onChange={v => setParametros(p => ({ ...p, minimo: v === null ? null : Number(v) }))} addonAfter={itemParametros.unidade || undefined} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>Estoque máximo</div>
                <InputNumber min={0} value={parametros.maximo} placeholder="sem máximo"
                  onChange={v => setParametros(p => ({ ...p, maximo: v === null ? null : Number(v) }))} addonAfter={itemParametros.unidade || undefined} />
              </div>
            </Space>
            <div>
              <div style={{ fontSize: 12, color: '#475569' }}>Localização</div>
              <Input maxLength={60} prefix={<EnvironmentOutlined />} placeholder="Ex.: A-03-2 (rua, prateleira, nível)" value={parametros.localizacao}
                onChange={e => setParametros(p => ({ ...p, localizacao: e.target.value.toUpperCase() }))} />
            </div>
            <span style={{ fontSize: 11, color: '#64748b' }}>Sem mínimo no item, vale o da família. Abaixo do mínimo, a reposição sugerida leva o saldo até o máximo.</span>
          </Space>
        )}
      </Modal>

      <Modal
        open={!!itemAjuste}
        title={itemAjuste ? `Ajustar saldo: ${itemAjuste.sku}` : ''}
        onCancel={() => setItemAjuste(null)}
        onOk={salvarAjuste}
        okText="Lançar ajuste"
        confirmLoading={salvando}
        destroyOnClose
      >
        {itemAjuste && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ fontSize: 13 }}>
              {itemAjuste.nome}<br />
              Saldo atual: <b>{qtd(itemAjuste.quantidade)} {itemAjuste.unidade}</b> · Custo médio: {money(itemAjuste.custoMedio || itemAjuste.custoReferencia)}
            </div>
            <Radio.Group
              value={ajuste.tipo}
              onChange={e => setAjuste(a => ({ ...a, tipo: e.target.value }))}
              optionType="button"
              buttonStyle="solid"
              options={[
                { value: 'ENTRADA', label: 'Entrada' },
                { value: 'SAIDA', label: 'Saída' },
                { value: 'CONTAGEM', label: 'Contagem' },
              ]}
            />
            <Space wrap>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>{ajuste.tipo === 'CONTAGEM' ? 'Quantidade contada' : 'Quantidade'}</div>
                <InputNumber min={0} value={ajuste.quantidade} onChange={v => setAjuste(a => ({ ...a, quantidade: v === null ? null : Number(v) }))} addonAfter={itemAjuste.unidade || undefined} />
              </div>
              {ajuste.tipo === 'ENTRADA' && (
                <div>
                  <div style={{ fontSize: 12, color: '#475569' }}>Custo unitário (opcional)</div>
                  <InputNumber min={0} step={0.01} value={ajuste.custo} onChange={v => setAjuste(a => ({ ...a, custo: v === null ? null : Number(v) }))} placeholder="custo médio" prefix="R$" />
                </div>
              )}
            </Space>
            {saldoPrevisto !== null && (
              <Tag color={saldoPrevisto < 0 ? 'red' : 'blue'}>Saldo após o ajuste: {qtd(saldoPrevisto)} {itemAjuste.unidade}</Tag>
            )}
            <Input.TextArea rows={2} placeholder="Motivo (obrigatório): avaria, perda, correção de cadastro..." value={ajuste.motivo} onChange={e => setAjuste(a => ({ ...a, motivo: e.target.value }))} />
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default SaldoEstoque;
