// Etiquetagem (modelo novo): a fila é a lista de trabalho com a tag "Tirar etiqueta" — não se perde ao trocar de tela.
// Saídas: PRN para a térmica Elgin ou impressão pelo navegador (qualquer impressora / PDF), com código de barras real.
import React, { useEffect, useMemo, useState } from 'react';
import {
  AutoComplete, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Row, Select, Space, Switch, Table, Tag, Tooltip, message,
} from 'antd';
import { DeleteOutlined, DownloadOutlined, PrinterOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';
import { ListaTrabalhoDrawer } from '../../../shared/core/listaTrabalho/ListaTrabalhoDrawer';
import { ItemListaTrabalho } from '../../../shared/core/listaTrabalho/listaTrabalho';
import {
  CSS_ETIQUETAS, EtiquetaDados, gerarHtmlEtiquetas, gerarPrn, htmlPreviewEtiqueta, MODELOS_ETIQUETA, ModeloEtiquetaId,
} from '../../../shared/core/impressao/etiquetas';
import { escolherCodigo } from '../../../shared/core/impressao/codigoBarras';
import { baixarArquivo, imprimirHtml } from '../../../shared/core/impressao/saida';
import { buscarItensEtiqueta, getDadosEtiquetas, ItemEtiquetaApi } from '../api/etiquetasApi';

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

  const perguntarConclusao = () => {
    Modal.confirm({
      title: 'As etiquetas saíram certas?',
      content: 'Confirmando, os itens saem da fila de etiquetas (continuam na lista se tiverem outras tarefas).',
      okText: 'Sim, tirar da fila',
      cancelText: 'Manter na fila',
      onOk: () => lista.concluirTag('ETIQUETAR'),
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

  const baixarPrn = () => {
    if (!validar()) return;
    baixarArquivo(gerarPrn(etiquetas, modelo), `ETIQUETAS_${modelo}_${Date.now()}.prn`);
    message.success('Arquivo .PRN gerado (envie para a impressora térmica).');
    perguntarConclusao();
  };

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

        <Row gutter={12}>
          <Col xs={24} xl={15}>
            <Card
              size="small"
              title={`Fila de etiquetas (${fila.length} item(ns), ${totalEtiquetas} etiqueta(s))`}
              extra={
                <Space>
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
                <div className="preview-fita">
                  {etiquetas.length === 0
                    ? <span style={{ color: '#cbd5e1' }}>A pré-visualização aparece aqui.</span>
                    : etiquetas.slice(0, 20).map((e, idx) => (
                      // Conteúdo gerado pelo núcleo de etiquetas (texto escapado)
                      <div key={idx} dangerouslySetInnerHTML={{ __html: htmlPreviewEtiqueta(e, modelo) }} />
                    ))}
                </div>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  "Imprimir" abre a impressão do navegador (impressora comum, Elgin instalada no Windows ou "Salvar como PDF") no tamanho da etiqueta.
                  "Baixar .PRN" gera o arquivo nativo da térmica Elgin (PPLB).
                </span>
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
