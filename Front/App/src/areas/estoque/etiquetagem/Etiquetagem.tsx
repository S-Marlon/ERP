// Etiquetagem (modelo novo): a fila é a lista de trabalho com a tag "Tirar etiqueta" — não se perde ao trocar de tela.
// Saídas: PRN para a térmica Elgin (a etiqueta vai como imagem: sai igual à pré-visualização) ou impressão pelo
// navegador (qualquer impressora / PDF), com código de barras real.
import React, { useEffect, useMemo, useState } from 'react';
import {
  AutoComplete, Button, Card, Checkbox, Col, Collapse, Empty, Input, InputNumber, Modal, Row, Segmented, Select, Slider, Space, Switch, Table, Tag, Tooltip, message,
} from 'antd';
import { CheckOutlined, DeleteOutlined, DownloadOutlined, PrinterOutlined, SettingOutlined, TagsOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';
import { ListaTrabalhoDrawer } from '../../../shared/core/listaTrabalho/ListaTrabalhoDrawer';
import { ItemListaTrabalho } from '../../../shared/core/listaTrabalho/listaTrabalho';
import {
  CSS_ETIQUETAS, EtiquetaDados, gerarHtmlEtiquetas, htmlPreviewEtiqueta, MODELOS_ETIQUETA, ModeloEtiquetaId,
} from '../../../shared/core/impressao/etiquetas';
import { DIMENSOES_ETIQUETA, previaTermica, renderizarEtiqueta, renderizarTeste } from '../../../shared/core/impressao/etiquetaCanvas';
import { montarPrnBitmap, PERFIL_PADRAO, PerfilTermica, PONTOS_POR_MM } from '../../../shared/core/impressao/prnBitmap';
import { escolherCodigo } from '../../../shared/core/impressao/codigoBarras';
import { baixarBinario, imprimirHtml } from '../../../shared/core/impressao/saida';
import {
  buscarItensEtiqueta, EtiquetaDesatualizada, getDadosEtiquetas, getEtiquetasDesatualizadas, ItemEtiquetaApi, registrarEtiquetasImpressas,
} from '../api/etiquetasApi';
import { operadorAtual } from '../../vendas/caixa/caixaApi';

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const lerPreferencia = <T,>(chave: string, padrao: T): T => {
  try { const v = localStorage.getItem(chave); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; }
};
const salvarPreferencia = (chave: string, valor: unknown) => {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento */ }
};

const Etiquetagem: React.FC = () => {
  const lista = useListaTrabalho();
  const fila = lista.comTag('ETIQUETAR');

  const [modelo, setModelo] = useState<ModeloEtiquetaId>(() => lerPreferencia('erp.etiquetas.modelo', '105x27'));
  const [mostrarAtacado, setMostrarAtacado] = useState<boolean>(() => lerPreferencia('erp.etiquetas.atacado', true));
  const [mostrarLocal, setMostrarLocal] = useState<boolean>(() => lerPreferencia('erp.etiquetas.local', false));
  useEffect(() => salvarPreferencia('erp.etiquetas.modelo', modelo), [modelo]);
  useEffect(() => salvarPreferencia('erp.etiquetas.atacado', mostrarAtacado), [mostrarAtacado]);
  useEffect(() => salvarPreferencia('erp.etiquetas.local', mostrarLocal), [mostrarLocal]);

  // Ajustes da térmica por modelo de etiqueta (posição, escurecimento, giro...), guardados neste computador
  const [perfis, setPerfis] = useState<Record<string, PerfilTermica>>(() => lerPreferencia('erp.etiquetas.termica', {}));
  const perfil: PerfilTermica = { ...PERFIL_PADRAO[modelo], ...(perfis[modelo] || {}) };
  const ajustar = (patch: Partial<PerfilTermica>) => setPerfis(atual => {
    const novo = { ...atual, [modelo]: { ...PERFIL_PADRAO[modelo], ...(atual[modelo] || {}), ...patch } };
    salvarPreferencia('erp.etiquetas.termica', novo);
    return novo;
  });
  const [previa, setPrevia] = useState<'modelo' | 'termica'>('modelo');

  // Dados atuais do servidor (preço, GTIN, unidade) para os itens da fila
  const [dados, setDados] = useState<Record<number, ItemEtiquetaApi>>({});
  const [carregando, setCarregando] = useState(false);
  const idsFila = fila.map(i => i.idItem).sort((a, b) => a - b).join(',');
  useEffect(() => {
    const ids = idsFila ? idsFila.split(',').map(Number) : [];
    const faltando = ids.filter(id => !dados[id]);
    if (faltando.length === 0) return;
    setCarregando(true);
    getDadosEtiquetas(faltando)
      .then(r => setDados(prev => ({ ...prev, ...Object.fromEntries(r.map(d => [d.id, d])) })))
      .catch(e => message.error(e.message))
      .finally(() => setCarregando(false));
  }, [idsFila]);

  const recarregarDados = () => {
    const ids = fila.map(i => i.idItem);
    if (ids.length === 0) return;
    setCarregando(true);
    getDadosEtiquetas(ids)
      .then(r => setDados(Object.fromEntries(r.map(d => [d.id, d]))))
      .catch(e => message.error(e.message))
      .finally(() => setCarregando(false));
  };

  // Etiquetas da gôndola com preço/unidade antigos (ou faltando, em categoria "sempre")
  const [desatualizadas, setDesatualizadas] = useState<EtiquetaDesatualizada[]>([]);
  const [carregandoDesat, setCarregandoDesat] = useState(false);
  const carregarDesatualizadas = () => {
    setCarregandoDesat(true);
    getEtiquetasDesatualizadas().then(setDesatualizadas).catch(e => message.error(e.message)).finally(() => setCarregandoDesat(false));
  };
  useEffect(() => { carregarDesatualizadas(); }, []);
  const porNaFila = (lista_: EtiquetaDesatualizada[]) => {
    const novos = lista_.filter(d => !lista.temItem(d.idItem, 'ETIQUETAR'));
    novos.forEach(d => lista.adicionar(
      { idItem: d.idItem, sku: d.sku, nome: d.nome, unidade: d.unidade || undefined },
      { tags: ['ETIQUETAR'], origem: 'Etiqueta desatualizada' }
    ));
    if (novos.length) message.success(`${novos.length} item(ns) na fila de etiquetas.`);
  };

  // Busca para incluir
  const [termo, setTermo] = useState('');
  const [opcoes, setOpcoes] = useState<ItemEtiquetaApi[]>([]);
  useEffect(() => {
    if (termo.trim().length < 2) { setOpcoes([]); return; }
    const t = setTimeout(() => {
      buscarItensEtiqueta(termo.trim()).then(setOpcoes).catch(() => setOpcoes([]));
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  const incluir = (item: ItemEtiquetaApi) => {
    lista.adicionar(
      { idItem: item.id, sku: item.sku, nome: item.name, unidade: item.unitOfMeasure },
      { tags: ['ETIQUETAR'], origem: 'Etiquetagem' }
    );
    setDados(prev => ({ ...prev, [item.id]: { ...item, atacado: prev[item.id]?.atacado ?? null } }));
    setTermo('');
    // Recarrega para trazer o atacado (a busca não traz)
    getDadosEtiquetas([item.id]).then(r => r[0] && setDados(prev => ({ ...prev, [item.id]: r[0] }))).catch(() => undefined);
  };

  const montarEtiqueta = (i: ItemListaTrabalho): EtiquetaDados => {
    const d = dados[i.idItem];
    return {
      nome: d?.name || i.nome,
      sku: d?.sku || i.sku,
      preco: d?.salePrice || 0,
      unidade: d?.unitOfMeasure || i.unidade,
      gtin: d?.barcode || '',
      promo: !!i.etiqueta?.promo,
      lote: i.etiqueta?.lote,
      validade: i.etiqueta?.validade,
      localizacao: mostrarLocal ? d?.location : undefined,
      atacado: mostrarAtacado ? d?.atacado ?? null : null,
      copias: i.etiqueta?.copias || 1,
    };
  };

  const etiquetas = useMemo(() => fila.map(montarEtiqueta), [fila, dados, mostrarAtacado, mostrarLocal]);
  const totalEtiquetas = etiquetas.reduce((a, e) => a + e.copias, 0);
  const semPreco = fila.filter(i => dados[i.idItem] && !(dados[i.idItem].salePrice > 0)).length;

  const atualizarEtiqueta = (i: ItemListaTrabalho, patch: Partial<NonNullable<ItemListaTrabalho['etiqueta']>>) =>
    lista.atualizar(i.idItem, { etiqueta: { copias: 1, ...(i.etiqueta || {}), ...patch } });

  // Preço/unidade que ficaram na gôndola: base do aviso de etiqueta desatualizada
  const registrarFila = async () => {
    const itens = fila.map(i => ({ idItem: i.idItem, unidade: dados[i.idItem]?.unitOfMeasure || i.unidade || '', preco: dados[i.idItem]?.salePrice || 0 }))
      .filter(i => i.preco > 0);
    if (itens.length) await registrarEtiquetasImpressas(itens, operadorAtual());
  };

  const perguntarConclusao = () => {
    Modal.confirm({
      title: 'As etiquetas saíram certas?',
      content: 'Confirmando, o preço de cada etiqueta fica registrado (para avisar quando ele mudar) e os itens saem da fila de etiquetas.',
      okText: 'Sim, tirar da fila',
      cancelText: 'Manter na fila',
      onOk: async () => {
        try { await registrarFila(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao registrar as etiquetas.'); }
        lista.concluirTag('ETIQUETAR');
        carregarDesatualizadas();
      },
    });
  };

  // Itens que já têm etiqueta certa na loja: registra o preço atual sem imprimir
  const marcarJaEtiquetado = () => {
    if (!validar()) return;
    Modal.confirm({
      title: `Marcar ${fila.length} item(ns) como já etiquetados?`,
      content: 'Use para itens que já estão com a etiqueta certa na gôndola: o preço atual fica registrado (para avisar quando mudar) sem imprimir, e eles saem da fila.',
      okText: 'Marcar como etiquetados',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          await registrarFila();
          lista.concluirTag('ETIQUETAR');
          message.success('Etiquetas registradas.');
          carregarDesatualizadas();
        } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao registrar as etiquetas.'); }
      },
    });
  };

  const validar = () => {
    if (fila.length === 0) { message.warning('A fila está vazia.'); return false; }
    if (semPreco > 0) { message.warning(`${semPreco} item(ns) sem preço: a etiqueta sairia com R$ 0,00.`); return false; }
    return true;
  };

  const imprimir = async () => {
    if (!validar()) return;
    await imprimirHtml(gerarHtmlEtiquetas(etiquetas, modelo));
    perguntarConclusao();
  };

  // Etiqueta desenhada na grade da térmica (8 pontos/mm), com o ajuste fino de posição
  const imagemTermica = (e: EtiquetaDados) =>
    renderizarEtiqueta(e, modelo, PONTOS_POR_MM, true, { x: perfil.deslocXmm, y: perfil.deslocYmm });

  const prnDe = (canvases: Array<{ canvas: HTMLCanvasElement; copias: number }>) => montarPrnBitmap(
    canvases.map(({ canvas, copias }) => ({
      rgba: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data,
      largura: canvas.width, altura: canvas.height, copias,
    })),
    perfil
  );

  const baixarPrn = () => {
    if (!validar()) return;
    baixarBinario(prnDe(etiquetas.map(e => ({ canvas: imagemTermica(e), copias: e.copias }))), `ETIQUETAS_${modelo}_${Date.now()}.prn`);
    message.success('Arquivo .PRN gerado (envie para a impressora térmica).');
    perguntarConclusao();
  };

  const baixarTeste = () => {
    const canvas = renderizarTeste(modelo, PONTOS_POR_MM, { x: perfil.deslocXmm, y: perfil.deslocYmm });
    baixarBinario(prnDe([{ canvas, copias: 1 }]), `TESTE_${modelo}.prn`);
    message.info('Etiqueta de teste gerada: a moldura deve sair inteira, a 1 mm da borda. Ajuste a posição se sair deslocada.');
  };

  // Pré-visualização da térmica: os pontos exatos que a impressora vai imprimir
  const previasTermica = useMemo(() => (previa === 'termica'
    ? etiquetas.slice(0, 20).map(e => previaTermica(imagemTermica(e), perfil.limiar))
    : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previa, etiquetas, modelo, perfil.deslocXmm, perfil.deslocYmm, perfil.limiar]);

  const [listaAberta, setListaAberta] = useState(false);

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <style>{CSS_ETIQUETAS}{`
        .preview-fita { background: #475569; padding: 14px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; gap: 10px; max-height: 70vh; overflow: auto; }
        .preview-fita .etq { box-shadow: 0 1px 4px rgba(0,0,0,.35); border-radius: 1.5mm; zoom: 1.35; }
      `}</style>

      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Etiquetagem</h2>
          <Space wrap>
            <Button icon={<UnorderedListOutlined />} onClick={() => setListaAberta(true)}>
              Lista de trabalho ({lista.itens.length})
            </Button>
            <Button icon={<DownloadOutlined />} onClick={baixarPrn} disabled={fila.length === 0}>Baixar .PRN (térmica)</Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={imprimir} disabled={fila.length === 0}>
              Imprimir {totalEtiquetas > 0 ? `(${totalEtiquetas})` : ''}
            </Button>
          </Space>
        </div>

        {desatualizadas.length > 0 && (
          <Card size="small" style={{ borderColor: '#faad14' }}
            title={<span><TagsOutlined style={{ color: '#d48806' }} /> Etiquetas desatualizadas na loja ({desatualizadas.length})</span>}
            extra={
              <Space>
                <Button size="small" onClick={carregarDesatualizadas} loading={carregandoDesat}>Atualizar</Button>
                <Button size="small" type="primary" onClick={() => porNaFila(desatualizadas)}>Pôr todas na fila</Button>
              </Space>
            }>
            <Table<EtiquetaDesatualizada>
              size="small"
              rowKey="idItem"
              dataSource={desatualizadas}
              pagination={{ pageSize: 5, hideOnSinglePage: true, size: 'small' }}
              columns={[
                {
                  title: 'Item', key: 'item',
                  render: (_, d) => <div><div style={{ fontWeight: 600 }}>{d.nome}</div><div style={{ fontSize: 11, color: '#64748b' }}>{d.sku}</div></div>,
                },
                {
                  title: 'Na gôndola → atual', key: 'preco', width: 230,
                  render: (_, d) => d.motivo === 'SEM_ETIQUETA'
                    ? <span><Tag color="blue">sem etiqueta</Tag>{money(d.precoAtual)}</span>
                    : (
                      <span>
                        <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{money(d.precoImpresso || 0)}{d.unidadeImpressa ? ` /${d.unidadeImpressa}` : ''}</span>
                        {' → '}<b>{money(d.precoAtual)}{d.unidade ? ` /${d.unidade}` : ''}</b>
                        {d.motivo === 'UNIDADE_MUDOU' && <Tag color="orange" style={{ marginLeft: 6 }}>unidade mudou</Tag>}
                      </span>
                    ),
                },
                {
                  title: '', key: 'acao', width: 110, align: 'right' as const,
                  render: (_, d) => lista.temItem(d.idItem, 'ETIQUETAR')
                    ? <Tag color="blue">na fila</Tag>
                    : <Button size="small" onClick={() => porNaFila([d])}>Pôr na fila</Button>,
                },
              ]}
            />
          </Card>
        )}

        <Row gutter={12}>
          <Col xs={24} xl={15}>
            <Card
              size="small"
              title={`Fila de etiquetas (${fila.length} item(ns), ${totalEtiquetas} etiqueta(s))`}
              extra={
                <Space>
                  <Tooltip title="Itens que já estão com a etiqueta certa na loja: registra o preço sem imprimir">
                    <Button size="small" icon={<CheckOutlined />} disabled={fila.length === 0} onClick={marcarJaEtiquetado}>Já etiquetados</Button>
                  </Tooltip>
                  <Button size="small" onClick={recarregarDados} loading={carregando}>Atualizar preços</Button>
                  <Button size="small" danger disabled={fila.length === 0}
                    onClick={() => Modal.confirm({ title: 'Esvaziar a fila de etiquetas?', okText: 'Esvaziar', onOk: () => lista.concluirTag('ETIQUETAR') })}>
                    Esvaziar fila
                  </Button>
                </Space>
              }
            >
              <AutoComplete
                style={{ width: '100%', marginBottom: 10 }}
                value={termo}
                onChange={setTermo}
                placeholder="Incluir item: digite SKU, nome ou bipe o código de barras"
                options={opcoes.map(o => ({
                  value: String(o.id),
                  label: (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span><b>{o.name}</b><br /><small style={{ color: '#64748b' }}>{o.sku} · {o.unitOfMeasure || '-'}</small></span>
                      <span style={{ textAlign: 'right' }}>{money(o.salePrice)}{lista.temItem(o.id, 'ETIQUETAR') && <><br /><Tag color="blue">na fila</Tag></>}</span>
                    </div>
                  ),
                }))}
                onSelect={(v: string) => { const o = opcoes.find(x => String(x.id) === v); if (o) incluir(o); }}
              />
              <Table<ItemListaTrabalho>
                size="small"
                rowKey="idItem"
                loading={carregando}
                dataSource={fila}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                locale={{ emptyText: <Empty description="Nenhum item para etiquetar. Busque acima ou envie itens pela Consulta de Saldo." /> }}
                scroll={{ x: 820 }}
                columns={[
                  {
                    title: 'Item', key: 'item',
                    render: (_, i) => {
                      const d = dados[i.idItem];
                      const codigo = escolherCodigo(d?.barcode, d?.sku || i.sku);
                      return (
                        <div>
                          <div style={{ fontWeight: 600 }}>{d?.name || i.nome}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {d?.sku || i.sku}
                            {codigo && <Tag style={{ marginLeft: 6, fontSize: 10 }}>{codigo.tipo === 'EAN13' ? 'EAN-13' : 'Code 128 (SKU)'}</Tag>}
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Preço', key: 'preco', width: 120, align: 'right' as const,
                    render: (_, i) => {
                      const d = dados[i.idItem];
                      if (!d) return '-';
                      return (
                        <Tooltip title={d.origemPreco === 'FAIXA' ? 'Preço da faixa de varejo' : d.origemPreco === 'CADASTRO' ? 'Preço do cadastro' : 'Item sem preço'}>
                          <span style={{ color: d.salePrice > 0 ? undefined : '#dc2626', fontWeight: 600 }}>{money(d.salePrice)}</span>
                          <span style={{ color: '#64748b' }}> /{d.unitOfMeasure || 'un'}</span>
                          {d.atacado && <div style={{ fontSize: 11, color: '#16a34a' }}>{d.atacado.quantidadeMinima}+ : {money(d.atacado.preco)}</div>}
                        </Tooltip>
                      );
                    },
                  },
                  {
                    title: 'Cópias', key: 'copias', width: 90,
                    render: (_, i) => (
                      <InputNumber size="small" min={1} max={999} style={{ width: '100%' }} value={i.etiqueta?.copias || 1}
                        onChange={v => atualizarEtiqueta(i, { copias: Math.max(1, Number(v) || 1) })} />
                    ),
                  },
                  {
                    title: 'Oferta', key: 'promo', width: 70, align: 'center' as const,
                    render: (_, i) => <Checkbox checked={!!i.etiqueta?.promo} onChange={e => atualizarEtiqueta(i, { promo: e.target.checked })} />,
                  },
                  {
                    title: 'Lote', key: 'lote', width: 110,
                    render: (_, i) => <Input size="small" value={i.etiqueta?.lote || ''} placeholder="-" onChange={e => atualizarEtiqueta(i, { lote: e.target.value })} />,
                  },
                  {
                    title: 'Validade', key: 'validade', width: 140,
                    render: (_, i) => <Input size="small" type="date" value={i.etiqueta?.validade || ''} onChange={e => atualizarEtiqueta(i, { validade: e.target.value })} />,
                  },
                  {
                    title: '', key: 'x', width: 40,
                    render: (_, i) => (
                      <Tooltip title="Tirar da fila de etiquetas">
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => lista.removerTag(i.idItem, 'ETIQUETAR')} />
                      </Tooltip>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} xl={9}>
            <Card size="small" title="Modelo e pré-visualização">
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                <Select
                  style={{ width: '100%' }}
                  value={modelo}
                  onChange={setModelo}
                  options={Object.values(MODELOS_ETIQUETA).map(m => ({ value: m.id, label: `${m.nome} — ${m.descricao}` }))}
                />
                <Space wrap>
                  <Space size={4}><Switch size="small" checked={mostrarAtacado} onChange={setMostrarAtacado} /> Preço de atacado</Space>
                  <Space size={4}><Switch size="small" checked={mostrarLocal} onChange={setMostrarLocal} /> Localização (só na impressão comum)</Space>
                </Space>
                <Segmented block value={previa} onChange={v => setPrevia(v as 'modelo' | 'termica')}
                  options={[{ value: 'modelo', label: 'Modelo (impressão comum)' }, { value: 'termica', label: 'Como sai na térmica' }]} />
                <div className="preview-fita">
                  {etiquetas.length === 0
                    ? <span style={{ color: '#cbd5e1' }}>A pré-visualização aparece aqui.</span>
                    : previa === 'termica'
                      ? previasTermica.map((src, idx) => (
                        <img key={idx} src={src} alt="Etiqueta como sai na térmica"
                          style={{ width: `${DIMENSOES_ETIQUETA[modelo].larguraMm * 1.35}mm`, imageRendering: 'pixelated', background: '#fff', borderRadius: '1.5mm', boxShadow: '0 1px 4px rgba(0,0,0,.35)' }} />
                      ))
                      : etiquetas.slice(0, 20).map((e, idx) => (
                        // Conteúdo gerado pelo núcleo de etiquetas (texto escapado)
                        <div key={idx} dangerouslySetInnerHTML={{ __html: htmlPreviewEtiqueta(e, modelo) }} />
                      ))}
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  "Imprimir" abre a impressão do navegador (impressora comum, Elgin instalada no Windows ou "Salvar como PDF") no tamanho da etiqueta.
                  "Baixar .PRN" gera o arquivo da térmica com a etiqueta como imagem: sai igual a "Como sai na térmica".
                </span>

                <Collapse size="small" items={[{
                  key: 'termica',
                  label: <span><SettingOutlined /> Ajustes da térmica ({modelo})</span>,
                  children: (
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <Button block icon={<DownloadOutlined />} onClick={baixarTeste}>Baixar etiqueta de teste (.PRN)</Button>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        Imprima o teste: a moldura deve sair inteira e centrada. Se sair cortada ou torta para um lado, ajuste a posição abaixo e teste de novo.
                      </span>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Tooltip title="+ empurra para a direita, − para a esquerda">
                            <div style={{ fontSize: 12 }}>Posição horizontal (mm)</div>
                            <InputNumber size="small" step={0.5} min={-20} max={20} style={{ width: '100%' }} value={perfil.deslocXmm} onChange={v => ajustar({ deslocXmm: Number(v) || 0 })} />
                          </Tooltip>
                        </Col>
                        <Col span={12}>
                          <Tooltip title="+ desce, − sobe">
                            <div style={{ fontSize: 12 }}>Posição vertical (mm)</div>
                            <InputNumber size="small" step={0.5} min={-20} max={20} style={{ width: '100%' }} value={perfil.deslocYmm} onChange={v => ajustar({ deslocYmm: Number(v) || 0 })} />
                          </Tooltip>
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={8}>
                          <div style={{ fontSize: 12 }}>Altura (mm)</div>
                          <InputNumber size="small" min={10} max={200} style={{ width: '100%' }} value={perfil.alturaMm} onChange={v => ajustar({ alturaMm: Number(v) || PERFIL_PADRAO[modelo].alturaMm })} />
                        </Col>
                        <Col span={8}>
                          <Tooltip title="Espaço entre uma etiqueta e a próxima no rolo">
                            <div style={{ fontSize: 12 }}>Espaço (mm)</div>
                            <InputNumber size="small" min={0} max={20} step={0.5} style={{ width: '100%' }} value={perfil.espacoMm} onChange={v => ajustar({ espacoMm: Number(v) || 0 })} />
                          </Tooltip>
                        </Col>
                        <Col span={8}>
                          <Tooltip title="Largura máxima que a cabeça da impressora imprime (L42: 104 mm)">
                            <div style={{ fontSize: 12 }}>Cabeça (mm)</div>
                            <InputNumber size="small" min={40} max={120} style={{ width: '100%' }} value={perfil.larguraMaxMm} onChange={v => ajustar({ larguraMaxMm: Number(v) || 104 })} />
                          </Tooltip>
                        </Col>
                      </Row>
                      <div>
                        <div style={{ fontSize: 12 }}>Escurecimento: {perfil.escurecimento}</div>
                        <Slider min={0} max={15} value={perfil.escurecimento} onChange={v => ajustar({ escurecimento: v })} />
                      </div>
                      <div>
                        <Tooltip title="Quanto do cinza vira preto: mais alto deixa letras e traços mais grossos">
                          <div style={{ fontSize: 12 }}>Espessura do traço: {perfil.limiar}</div>
                        </Tooltip>
                        <Slider min={80} max={220} value={perfil.limiar} onChange={v => ajustar({ limiar: v })} />
                      </div>
                      <Space wrap>
                        <Space size={4}><Switch size="small" checked={perfil.girar180} onChange={v => ajustar({ girar180: v })} /> Girar 180°</Space>
                        <Space size={4}><Switch size="small" checked={perfil.inverter} onChange={v => ajustar({ inverter: v })} /> Inverter preto/branco</Space>
                        <Button size="small" type="link" onClick={() => setPerfis(atual => { const novo = { ...atual }; delete novo[modelo]; salvarPreferencia('erp.etiquetas.termica', novo); return novo; })}>
                          Voltar ao padrão
                        </Button>
                      </Space>
                    </Space>
                  ),
                }]} />
              </Space>
            </Card>
          </Col>
        </Row>
      </Space>

      <ListaTrabalhoDrawer open={listaAberta} onClose={() => setListaAberta(false)} tagInicial="ETIQUETAR" />
    </div>
  );
};

export default Etiquetagem;
