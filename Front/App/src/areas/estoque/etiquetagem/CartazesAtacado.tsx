// Cartazes de atacado em A4: lista de cartazes, pré-visualização da folha e editor do cartaz escolhido.
// O preço vem sempre da precificação (não se edita aqui); o editor ajusta só textos e o que aparece no cartaz.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, AutoComplete, Button, Card, Checkbox, Col, DatePicker, Divider, Empty, Flex, Input, InputNumber, List, Modal, Row, Select, Space, Switch, Tag, Tooltip, Typography, message, theme,
} from 'antd';
import { DeleteOutlined, LeftOutlined, PrinterOutlined, RightOutlined, TagsOutlined, UndoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useListaTrabalho } from '../../../shared/core/listaTrabalho/ListaTrabalhoContext';
import {
  CartazDados, CSS_CARTAZES, gerarHtmlCartazes, htmlPreviewCartaz, linhasDoCartaz, MODELOS_CARTAZ, ModeloCartazId, OPCOES_CARTAZ_PADRAO, OpcoesCartaz,
} from '../../../shared/core/impressao/cartazes';
import { imprimirHtml } from '../../../shared/core/impressao/saida';
import { buscarItensEtiqueta, getDadosEtiquetas, ItemEtiquetaApi } from '../api/etiquetasApi';

const { Text } = Typography;
const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CHAVE = 'erp.cartazes.v1';

type Ajustes = Pick<CartazDados, 'detalhe' | 'observacao' | 'mostrarVarejo' | 'mostrarCodigo' | 'faixasOcultas'> & { nome?: string };
interface ItemCartaz { idItem: number; sku: string; nome: string; copias: number; ajustes: Ajustes }
interface Guardado { modelo: ModeloCartazId; opcoes: OpcoesCartaz; itens: ItemCartaz[] }

const lerGuardado = (): Guardado => {
  try {
    const g = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (g && MODELOS_CARTAZ[g.modelo as ModeloCartazId]) return { modelo: g.modelo, opcoes: { ...OPCOES_CARTAZ_PADRAO, ...g.opcoes }, itens: g.itens || [] };
  } catch { /* sem armazenamento */ }
  return { modelo: 'A4_ATACADO_2', opcoes: OPCOES_CARTAZ_PADRAO, itens: [] };
};

interface Props { onVoltar: () => void }

const CartazesAtacado: React.FC<Props> = ({ onVoltar }) => {
  const { token } = theme.useToken();
  const lista = useListaTrabalho();
  const filaEtiquetas = lista.comTag('ETIQUETAR');
  const [estado, setEstado] = useState<Guardado>(lerGuardado);
  const { modelo, opcoes, itens } = estado;
  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* sem armazenamento */ } }, [estado]);
  const mudar = (patch: Partial<Guardado>) => setEstado(e => ({ ...e, ...patch }));
  const mudarItem = (idItem: number, patch: Partial<ItemCartaz>) =>
    setEstado(e => ({ ...e, itens: e.itens.map(i => (i.idItem === idItem ? { ...i, ...patch } : i)) }));
  const ajustar = (idItem: number, patch: Partial<Ajustes>) =>
    setEstado(e => ({ ...e, itens: e.itens.map(i => (i.idItem === idItem ? { ...i, ajustes: { ...i.ajustes, ...patch } } : i)) }));

  // Dados atuais do servidor (preço, faixas, foto) de cada cartaz
  const [dados, setDados] = useState<Record<number, ItemEtiquetaApi>>({});
  const [carregando, setCarregando] = useState(false);
  const ids = itens.map(i => i.idItem).join(',');
  useEffect(() => {
    const faltando = itens.map(i => i.idItem).filter(id => !dados[id]);
    if (!faltando.length) return;
    setCarregando(true);
    getDadosEtiquetas(faltando)
      .then(r => setDados(prev => ({ ...prev, ...Object.fromEntries(r.map(d => [d.id, d])) })))
      .catch(e => message.error(e.message))
      .finally(() => setCarregando(false));
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const atualizarPrecos = () => {
    if (!itens.length) return;
    setCarregando(true);
    getDadosEtiquetas(itens.map(i => i.idItem))
      .then(r => setDados(Object.fromEntries(r.map(d => [d.id, d]))))
      .catch(e => message.error(e.message))
      .finally(() => setCarregando(false));
  };

  const [selecionado, setSelecionado] = useState<number | null>(itens[0]?.idItem ?? null);
  const atual = itens.find(i => i.idItem === selecionado) || itens[0] || null;
  const indice = atual ? itens.indexOf(atual) : -1;

  const incluir = (novos: Array<{ idItem: number; sku: string; nome: string }>) => {
    const ja = new Set(itens.map(i => i.idItem));
    const entram = novos.filter(n => !ja.has(n.idItem));
    if (!entram.length) { message.info('Os itens já estão nos cartazes.'); return; }
    mudar({ itens: [...itens, ...entram.map(n => ({ ...n, copias: 1, ajustes: {} }))] });
    setSelecionado(entram[0].idItem);
  };
  const tirar = (idItem: number) => {
    const resto = itens.filter(i => i.idItem !== idItem);
    mudar({ itens: resto });
    if (selecionado === idItem) setSelecionado(resto[Math.max(0, indice - 1)]?.idItem ?? null);
  };

  // Busca para incluir
  const [termo, setTermo] = useState('');
  const [opcoesBusca, setOpcoesBusca] = useState<ItemEtiquetaApi[]>([]);
  useEffect(() => {
    if (termo.trim().length < 2) { setOpcoesBusca([]); return; }
    const t = setTimeout(() => { buscarItensEtiqueta(termo.trim()).then(setOpcoesBusca).catch(() => setOpcoesBusca([])); }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  const cartazDe = (i: ItemCartaz): CartazDados => {
    const d = dados[i.idItem];
    const { nome, ...resto } = i.ajustes;
    return {
      nome: nome ?? d?.name ?? i.nome,
      sku: d?.sku || i.sku,
      marca: d?.brand || undefined,
      preco: d?.salePrice || 0,
      unidade: d?.unitOfMeasure || undefined,
      gtin: d?.barcode || '',
      imagemUrl: d?.pictureUrl || null,
      // Sem a lista completa (backend antigo) não monta com só a faixa mais barata: o cartaz sairia errado
      faixas: d?.atacadoFaixas || [],
      copias: i.copias,
      ...resto,
    };
  };
  const cartazes = useMemo(() => itens.map(cartazDe), [itens, dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const totalFolhas = cartazes.reduce((a, c) => a + Math.max(1, c.copias), 0);
  const faixasNoCartaz = (c: CartazDados) => linhasDoCartaz(c, MODELOS_CARTAZ[modelo].faixas).atacado.length;

  // Backend sem reiniciar manda só a faixa mais barata (sem atacadoFaixas)
  const servidorAntigo = itens.some(i => dados[i.idItem] && !dados[i.idItem].atacadoFaixas);

  const imprimir = async () => {
    if (!itens.length) { message.warning('Nenhum cartaz na lista.'); return; }
    if (servidorAntigo) { message.error('O servidor não mandou as faixas de atacado: reinicie o backend e clique em "Atualizar preços".'); return; }
    const semPreco = cartazes.filter(c => !(c.preco > 0));
    if (semPreco.length) { message.warning(`${semPreco.length} item(ns) sem preço de venda: precifique antes do cartaz.`); return; }
    const semAtacado = cartazes.filter(c => faixasNoCartaz(c) === 0);
    const seguir = () => imprimirHtml(gerarHtmlCartazes(cartazes, modelo, opcoes));
    if (semAtacado.length) {
      Modal.confirm({
        title: `${semAtacado.length} cartaz(es) sem preço de atacado`,
        content: `${semAtacado.map(c => c.sku).join(', ')}: sairiam só com o varejo. Cadastre as faixas de atacado na precificação ou imprima assim mesmo.`,
        okText: 'Imprimir assim mesmo', cancelText: 'Voltar', onOk: seguir,
      });
      return;
    }
    await seguir();
  };

  const cartazAtual = atual ? cartazDe(atual) : null;
  const faixasDoAtual = atual ? [...(cartazAtual?.faixas || [])].sort((a, b) => a.quantidadeMinima - b.quantidadeMinima) : [];
  const ocultas = atual?.ajustes.faixasOcultas || [];
  const linhasAtual = cartazAtual ? linhasDoCartaz(cartazAtual, MODELOS_CARTAZ[modelo].faixas).atacado : [];

  return (
    <div style={{ padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <style>{CSS_CARTAZES}{`
        .folha-previa { background: #475569; padding: 16px; border-radius: 8px; display: flex; justify-content: center; overflow: auto; max-height: 78vh; }
        .folha-previa .cartaz { zoom: 0.5; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
        @media (min-width: 1600px) { .folha-previa .cartaz { zoom: 0.62; } }
      `}</style>

      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 12 }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={onVoltar}>Etiquetas</Button>
          <h2 style={{ margin: 0, fontSize: 18 }}>Cartazes de atacado (A4)</h2>
        </Space>
        <Space wrap>
          <Tooltip title="Traz os itens que estão na fila de etiquetas">
            <Button icon={<TagsOutlined />} disabled={!filaEtiquetas.length}
              onClick={() => incluir(filaEtiquetas.map(f => ({ idItem: f.idItem, sku: f.sku, nome: f.nome })))}>
              Trazer da fila de etiquetas ({filaEtiquetas.length})
            </Button>
          </Tooltip>
          <Button onClick={atualizarPrecos} loading={carregando} disabled={!itens.length}>Atualizar preços</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={imprimir} disabled={!itens.length}>
            Imprimir {totalFolhas > 0 ? `(${totalFolhas} folha${totalFolhas > 1 ? 's' : ''})` : ''}
          </Button>
        </Space>
      </Flex>

      {servidorAntigo && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} title="Faixas de atacado incompletas"
          description='O backend em execução é anterior aos cartazes e manda só a faixa mais barata. Reinicie o backend e clique em "Atualizar preços".'
          action={<Button size="small" onClick={atualizarPrecos} loading={carregando}>Atualizar preços</Button>} />
      )}
      <Row gutter={[12, 12]}>
        {/* Lista de cartazes */}
        <Col xs={24} lg={8} xl={6}>
          <Card size="small" title={`Cartazes (${itens.length})`}
            extra={itens.length > 0 && <Button size="small" type="text" danger onClick={() => Modal.confirm({ title: 'Tirar todos os cartazes da lista?', okText: 'Tirar todos', onOk: () => mudar({ itens: [] }) })}>Limpar</Button>}>
            <AutoComplete style={{ width: '100%', marginBottom: 8 }} value={termo} onChange={setTermo}
              placeholder="Incluir item: SKU, nome ou código"
              options={opcoesBusca.map(o => ({
                value: String(o.id),
                label: <Flex justify="space-between" gap={8}><span><b>{o.name}</b><br /><small style={{ color: '#64748b' }}>{o.sku}</small></span><span>{money(o.salePrice)}</span></Flex>,
              }))}
              onSelect={(v: string) => { const o = opcoesBusca.find(x => String(x.id) === v); if (o) incluir([{ idItem: o.id, sku: o.sku, nome: o.name }]); setTermo(''); }} />
            {itens.length === 0
              ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Inclua itens pela busca ou traga da fila de etiquetas" />
              : (
                <List size="small" dataSource={itens} style={{ maxHeight: '64vh', overflow: 'auto' }}
                  renderItem={i => {
                    const c = cartazes[itens.indexOf(i)];
                    const n = faixasNoCartaz(c);
                    const ativo = atual?.idItem === i.idItem;
                    return (
                      <List.Item onClick={() => setSelecionado(i.idItem)}
                        style={{ cursor: 'pointer', paddingInline: 8, borderRadius: 6, background: ativo ? token.colorPrimaryBg : undefined }}
                        actions={[
                          <InputNumber key="c" size="small" min={1} max={99} style={{ width: 58 }} value={i.copias} title="Cópias"
                            onClick={e => e.stopPropagation()} onChange={v => mudarItem(i.idItem, { copias: Math.max(1, Number(v) || 1) })} />,
                          <Button key="x" size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => { e.stopPropagation(); tirar(i.idItem); }} />,
                        ]}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                          <Space size={4}>
                            <Text type="secondary" style={{ fontSize: 11 }}>{c.sku}</Text>
                            {dados[i.idItem] && (n > 0
                              ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>{n} faixa(s)</Tag>
                              : <Tag color="red" style={{ margin: 0, fontSize: 10 }}>sem atacado</Tag>)}
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }} />
              )}
          </Card>
        </Col>

        {/* Pré-visualização da folha */}
        <Col xs={24} lg={16} xl={10}>
          <Card size="small" title="Como fica a folha"
            extra={atual && itens.length > 1 && (
              <Space size={4}>
                <Button size="small" icon={<LeftOutlined />} disabled={indice <= 0} onClick={() => setSelecionado(itens[indice - 1].idItem)} />
                <Text type="secondary">{indice + 1} de {itens.length}</Text>
                <Button size="small" icon={<RightOutlined />} disabled={indice >= itens.length - 1} onClick={() => setSelecionado(itens[indice + 1].idItem)} />
              </Space>
            )}>
            <div className="folha-previa">
              {cartazAtual
                // Conteúdo gerado pelo núcleo de cartazes (texto escapado)
                ? <div dangerouslySetInnerHTML={{ __html: htmlPreviewCartaz(cartazAtual, modelo, opcoes) }} />
                : <span style={{ color: '#cbd5e1', padding: 40 }}>A folha aparece aqui.</span>}
            </div>
          </Card>
        </Col>

        {/* Editor */}
        <Col xs={24} xl={8}>
          <Flex vertical gap={12}>
            <Card size="small" title="Todos os cartazes">
              <Flex vertical gap={8}>
                <Select value={modelo} onChange={v => mudar({ modelo: v })}
                  options={Object.values(MODELOS_CARTAZ).map(m => ({ value: m.id, label: `${m.nome} — ${m.descricao}` }))} />
                {MODELOS_CARTAZ[modelo].imagem && cartazAtual && !cartazAtual.imagemUrl && (
                  <Text type="warning" style={{ fontSize: 12 }}>Este item não tem foto: o cartaz sai como o modelo sem imagem.</Text>
                )}
                <div>
                  <Text style={{ fontSize: 12 }}>Título</Text>
                  <Input maxLength={24} value={opcoes.titulo} onChange={e => mudar({ opcoes: { ...opcoes, titulo: e.target.value } })} />
                  <Space size={4} wrap style={{ marginTop: 4 }}>
                    {['ATACADO', 'LEVE MAIS', 'PREÇO DE ATACADO', 'OFERTA'].map(t => (
                      <Tag key={t} style={{ cursor: 'pointer' }} color={opcoes.titulo === t ? 'blue' : undefined} onClick={() => mudar({ opcoes: { ...opcoes, titulo: t } })}>{t}</Tag>
                    ))}
                  </Space>
                </div>
                <div>
                  <Text style={{ fontSize: 12 }}>Frase abaixo do título</Text>
                  <Input maxLength={60} allowClear value={opcoes.subtitulo} onChange={e => mudar({ opcoes: { ...opcoes, subtitulo: e.target.value } })} />
                </div>
                <Flex gap={12} wrap align="center">
                  <div>
                    <Text style={{ fontSize: 12 }}>Preços válidos até</Text><br />
                    <DatePicker format="DD/MM/YYYY" allowClear value={opcoes.validade ? dayjs(opcoes.validade) : null}
                      onChange={d => mudar({ opcoes: { ...opcoes, validade: d ? d.format('YYYY-MM-DD') : undefined } })} />
                  </div>
                  <Tooltip title="Sem fundos chapados: a cor fica só em contornos e textos">
                    <Space size={4}><Switch size="small" checked={!!opcoes.economico} onChange={v => mudar({ opcoes: { ...opcoes, economico: v } })} /> Economizar tinta</Space>
                  </Tooltip>
                </Flex>
              </Flex>
            </Card>

            <Card size="small" title={atual ? `Este cartaz · ${cartazAtual?.sku}` : 'Este cartaz'}
              extra={atual && Object.keys(atual.ajustes).length > 0 && (
                <Button size="small" icon={<UndoOutlined />} onClick={() => mudarItem(atual.idItem, { ajustes: {} })}>Voltar ao original</Button>
              )}>
              {!atual || !cartazAtual ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Escolha um cartaz na lista" /> : (
                <Flex vertical gap={8}>
                  <div>
                    <Text style={{ fontSize: 12 }}>Nome no cartaz</Text>
                    <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} maxLength={120} value={cartazAtual.nome}
                      onChange={e => ajustar(atual.idItem, { nome: e.target.value })} />
                    <Text type="secondary" style={{ fontSize: 11 }}>Só muda o cartaz; o cadastro do item fica como está.</Text>
                  </div>
                  <div>
                    <Text style={{ fontSize: 12 }}>Linha abaixo do nome</Text>
                    <Input maxLength={80} allowClear value={cartazAtual.detalhe ?? [cartazAtual.marca, cartazAtual.sku].filter(Boolean).join(' · ')}
                      onChange={e => ajustar(atual.idItem, { detalhe: e.target.value })} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 12 }}>Destaque no rodapé</Text>
                    <Input maxLength={60} allowClear placeholder='Ex.: "Caixa fechada com 100 unidades"' value={cartazAtual.observacao || ''}
                      onChange={e => ajustar(atual.idItem, { observacao: e.target.value || undefined })} />
                  </div>
                  <Divider style={{ margin: '4px 0' }} />
                  <Text strong style={{ fontSize: 12 }}>Preços no cartaz <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>(o valor vem da precificação)</Text></Text>
                  <Space size={4}><Switch size="small" checked={cartazAtual.mostrarVarejo !== false} onChange={v => ajustar(atual.idItem, { mostrarVarejo: v })} /> Varejo: {money(cartazAtual.preco)} /{cartazAtual.unidade || 'UN'}</Space>
                  {faixasDoAtual.length === 0
                    ? <Text type="danger" style={{ fontSize: 12 }}>Sem faixas de atacado: cadastre na precificação (Preço do item › atacado).</Text>
                    : faixasDoAtual.map(f => {
                      const linha = linhasAtual.find(l => l.quantidadeMinima === f.quantidadeMinima);
                      const un = cartazAtual.unidade || 'UN';
                      const rotulo = linha?.rotulo || (f.quantidadeMaxima ? `${f.quantidadeMinima.toLocaleString('pt-BR')} a ${f.quantidadeMaxima.toLocaleString('pt-BR')} ${un}` : `A partir de ${f.quantidadeMinima.toLocaleString('pt-BR')} ${un}`);
                      const entra = !!linha;
                      return (
                        <Checkbox key={f.quantidadeMinima} checked={!ocultas.includes(f.quantidadeMinima)}
                          onChange={e => ajustar(atual.idItem, {
                            faixasOcultas: e.target.checked ? ocultas.filter(q => q !== f.quantidadeMinima) : [...ocultas, f.quantidadeMinima],
                          })}>
                          {rotulo}: <b>{money(f.preco)}</b>
                          {!ocultas.includes(f.quantidadeMinima) && !entra && (
                            <Tooltip title={`O modelo mostra até ${MODELOS_CARTAZ[modelo].faixas} faixas (ou o preço não é menor que o varejo)`}><Tag style={{ marginLeft: 6 }}>não cabe</Tag></Tooltip>
                          )}
                        </Checkbox>
                      );
                    })}
                  <Space size={4}><Switch size="small" checked={cartazAtual.mostrarCodigo !== false} onChange={v => ajustar(atual.idItem, { mostrarCodigo: v })} /> Código de barras no rodapé</Space>
                </Flex>
              )}
            </Card>
          </Flex>
        </Col>
      </Row>
    </div>
  );
};

export default CartazesAtacado;
