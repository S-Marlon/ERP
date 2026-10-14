// Editor de imagem simplificado: a foto do produto num quadro 1200×1200 e, por cima, setas, cotas com medida, textos,
// balões e destaques que se movem, giram e esticam. O texto aceita {Campo} (ex.: {Comprimento}); o mesmo modelo é
// aplicado em todos os itens do anúncio, cada um com a sua medida e a sua foto, e salvo no cadastro do ERP.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Divider, Flex, Input, Modal, Progress, Segmented, Select, Slider, Space, Switch, Tag, Tooltip, Typography, Upload, message } from 'antd';
import {
  ArrowRightOutlined, BorderOutlined, ColumnWidthOutlined, CommentOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined, FontSizeOutlined,
  PictureOutlined, RedoOutlined, SaveOutlined, UndoOutlined, UploadOutlined, VerticalAlignBottomOutlined, VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { Canvas, FabricImage, FabricObject, IText, StaticCanvas } from 'fabric';
import { enviarArquivoAnexo } from '../../../../areas/catalogo/skus/CatalogSku.service';
import type { AnuncioDetalhe, ItemDoAnuncio } from '../mercadoLivreApi';
import { camposDoItem, converterMedidas, modeloPadrao, textoDoModelo } from '../etiquetaFoto';
import { enderecoParaDesenho } from '../desenhoEtiqueta';
import {
  criarElemento, dadosDe, DadosElemento, encaixarFoto, LadoTexto, parametrosAposEsticar, Pontas, precisaRedesenharAoGirar, PROPRIEDADES, recriarElemento, TipoElemento,
  trocarImagemDaFoto,
} from './elementos';

const { Text } = Typography;
const LADO = 1200;
const TELA = 600;
const CORES = ['#731717', '#111111', '#d4380d', '#1554c0', '#15803d', '#ffffff'];
const chaveModelo = (id: number) => `ml-editor-imagem-${id}`;

interface Props { det: AnuncioDetalhe | null; onFechar: () => void; onSalvo: () => void }

const EditorImagemModal: React.FC<Props> = ({ det, onFechar, onSalvo }) => {
  const elCanvas = useRef<HTMLCanvasElement>(null);
  const fab = useRef<Canvas | null>(null);
  const historico = useRef<string[]>([]);
  const refeitos = useRef<string[]>([]);
  const carregando = useRef(false);
  const [selecionado, setSelecionado] = useState<FabricObject | null>(null);
  const [, setVersao] = useState(0);
  const atualizarPainel = () => setVersao(v => v + 1);
  const [idItem, setIdItem] = useState<number | null>(null);
  const [unidade, setUnidade] = useState<'original' | 'mm' | 'cm'>('original');
  const [fotoPorItem, setFotoPorItem] = useState(true);
  const [aplicando, setAplicando] = useState<{ feitos: number; total: number } | null>(null);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [corAtual, setCorAtual] = useState(CORES[0]);

  const item = useMemo(() => det?.itens.find(i => i.idItem === idItem) || det?.itens[0] || null, [det, idItem]);
  const campos = useMemo(() => (det && item ? camposDoItem(det, item) : []), [det, item]);
  const textoPara = useCallback((modelo: string | undefined, it: ItemDoAnuncio | null) =>
    (det && it ? converterMedidas(textoDoModelo(modelo || '', camposDoItem(det, it)), unidade) : modelo || ''), [det, unidade]);

  // ---------------------------------------------------------------- histórico
  const estadoAtual = () => JSON.stringify(fab.current!.toObject(PROPRIEDADES));
  const guardar = () => {
    if (!fab.current || carregando.current) return;
    historico.current.push(estadoAtual());
    if (historico.current.length > 50) historico.current.shift();
    refeitos.current = [];
    atualizarPainel();
  };
  const carregarEstado = async (json: string) => {
    const c = fab.current!;
    carregando.current = true;
    await c.loadFromJSON(json);
    c.getObjects().forEach(o => o.set({ cornerColor: '#1677ff', cornerStyle: 'circle', borderColor: '#1677ff', transparentCorners: false, cornerSize: 16 }));
    c.requestRenderAll();
    carregando.current = false;
    setSelecionado(null);
  };
  const desfazer = async () => {
    if (historico.current.length < 2) return;
    refeitos.current.push(historico.current.pop()!);
    await carregarEstado(historico.current[historico.current.length - 1]);
    atualizarPainel();
  };
  const refazer = async () => {
    const proximo = refeitos.current.pop();
    if (!proximo) return;
    historico.current.push(proximo);
    await carregarEstado(proximo);
    atualizarPainel();
  };

  // ---------------------------------------------------------------- textos com {Campo}
  const substituir = (antigo: FabricObject, novo: FabricObject) => {
    const c = fab.current!;
    const i = c.getObjects().indexOf(antigo);
    c.remove(antigo);
    c.insertAt(i < 0 ? c.getObjects().length : i, novo);
    return novo;
  };
  /** Redesenha os textos de todos os elementos para o item da prévia. */
  const renderizarTextos = useCallback((it: ItemDoAnuncio | null) => {
    const c = fab.current;
    if (!c) return;
    carregando.current = true;
    for (const o of [...c.getObjects()]) {
      const d = dadosDe(o);
      if (!d || d.modelo === undefined) continue;
      if (d.tipo === 'TEXTO') { if (!(o as IText).isEditing) (o as IText).set('text', textoPara(d.modelo, it) || ' '); }
      else substituir(o, recriarElemento(o, d, textoPara(d.modelo, it)));
    }
    c.discardActiveObject();
    c.requestRenderAll();
    carregando.current = false;
    setSelecionado(null);
  }, [textoPara]);

  // ---------------------------------------------------------------- foto de base
  const colocarFoto = async (url: string) => {
    const c = fab.current!;
    const atual = c.getObjects().find(o => dadosDe(o)?.tipo === 'FOTO') as FabricImage | undefined;
    try {
      if (atual) { await trocarImagemDaFoto(atual, enderecoParaDesenho(url)); c.requestRenderAll(); }
      else {
        const img = encaixarFoto(await FabricImage.fromURL(enderecoParaDesenho(url), { crossOrigin: 'anonymous' }), LADO);
        c.add(img);
        c.sendObjectToBack(img);
      }
      guardar();
    } catch {
      message.error('Não foi possível abrir a foto.');
    }
  };

  // ---------------------------------------------------------------- abrir / fechar
  useEffect(() => {
    if (!det) return;
    const primeiro = det.itens.find(i => i.fotoUrl) || det.itens[0];
    setIdItem(primeiro?.idItem ?? null);
    setMarcados(det.itens.map(i => i.idItem));
    let vivo = true;
    const t = window.setTimeout(async () => {
      if (!elCanvas.current || !vivo) return;
      const c = new Canvas(elCanvas.current, { width: LADO, height: LADO, backgroundColor: '#ffffff', preserveObjectStacking: true });
      c.setDimensions({ width: TELA, height: TELA }, { cssOnly: true });
      fab.current = c;
      historico.current = [];
      refeitos.current = [];
      c.on('selection:created', e => setSelecionado(e.selected?.[0] || null));
      c.on('selection:updated', e => setSelecionado(e.selected?.[0] || null));
      c.on('selection:cleared', () => setSelecionado(null));
      c.on('object:modified', e => {
        const o = e.target as FabricObject;
        const novos = o ? parametrosAposEsticar(o) || (precisaRedesenharAoGirar(o) ? dadosDe(o) : null) : null;
        if (o && novos) {
          const novo = substituir(o, recriarElemento(o, novos, textoPara(novos.modelo, itemAtual.current)));
          c.setActiveObject(novo);
          c.requestRenderAll();
        }
        guardar();
      });
      c.on('text:editing:entered', e => {
        const o = e.target as IText;
        const d = dadosDe(o);
        if (d?.modelo !== undefined) { o.set('text', d.modelo); c.requestRenderAll(); }
      });
      c.on('text:editing:exited', e => {
        const o = e.target as IText;
        const d = dadosDe(o);
        if (d) { (o as any).dadosElemento = { ...d, modelo: o.text }; o.set('text', textoPara(o.text, itemAtual.current) || ' '); c.requestRenderAll(); guardar(); }
      });
      const salvo = (() => { try { return localStorage.getItem(chaveModelo(det.id)); } catch { return null; } })();
      if (salvo) {
        await carregarEstado(salvo);
        renderizarTextos(primeiro || null);
        message.info('Abri o último modelo deste anúncio. "Começar do zero" limpa.');
      } else {
        const foto = primeiro?.fotoUrl || det.fotoFamilia;
        if (foto) await colocarFoto(foto);
        // começa com uma cota da medida do anúncio, embaixo
        const d: DadosElemento = { tipo: 'COTA', cor: CORES[0], modelo: modeloPadrao(det) || '{Comprimento}', comprimento: 800, textoDePe: true, ladoTexto: 'ACIMA' };
        const cota = criarElemento(d, textoPara(d.modelo, primeiro || null));
        cota.set({ left: LADO / 2, top: LADO - 150, originX: 'center', originY: 'center' });
        c.add(cota);
      }
      guardar();
    }, 50);
    return () => { vivo = false; window.clearTimeout(t); fab.current?.dispose(); fab.current = null; setSelecionado(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [det]);

  const itemAtual = useRef<ItemDoAnuncio | null>(null);
  useEffect(() => { itemAtual.current = item; }, [item]);

  // trocou o item da prévia ou a unidade: textos e (se for por item) a foto
  const trocarItem = async (id: number) => {
    setIdItem(id);
    const it = det?.itens.find(i => i.idItem === id) || null;
    itemAtual.current = it;
    if (fotoPorItem && it) { const f = it.fotoUrl || det?.fotoFamilia; if (f) await colocarFoto(f); }
    renderizarTextos(it);
  };
  useEffect(() => { renderizarTextos(itemAtual.current); }, [unidade]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- ferramentas
  const adicionar = (tipo: TipoElemento) => {
    const c = fab.current;
    if (!c) return;
    const base: Record<string, DadosElemento> = {
      SETA: { tipo: 'SETA', cor: corAtual, comprimento: 320, pontas: 'FIM' },
      COTA: { tipo: 'COTA', cor: corAtual, modelo: modeloPadrao(det!) || '{Comprimento}', comprimento: 600, textoDePe: true, ladoTexto: 'ACIMA' },
      TEXTO: { tipo: 'TEXTO', cor: corAtual, modelo: 'Texto', tamanhoFonte: 80, fundoTexto: true },
      BALAO: { tipo: 'BALAO', cor: corAtual, modelo: 'Explique aqui', largura: 440 },
      DESTAQUE: { tipo: 'DESTAQUE', cor: corAtual, largura: 320, altura: 220 },
    };
    const d = base[tipo];
    const o = criarElemento(d, textoPara(d.modelo, item));
    o.set({ left: LADO / 2, top: LADO / 2, originX: 'center', originY: 'center' });
    c.add(o);
    c.setActiveObject(o);
    c.requestRenderAll();
    guardar();
  };

  const d = dadosDe(selecionado);
  const mudarSelecionado = (novos: Partial<DadosElemento>) => {
    const c = fab.current;
    if (!c || !selecionado || !d) return;
    const dados = { ...d, ...novos };
    if (d.tipo === 'TEXTO') {
      const t = selecionado as IText;
      (t as any).dadosElemento = dados;
      t.set({ fill: dados.cor, fontSize: dados.tamanhoFonte || 80, backgroundColor: dados.fundoTexto ? '#ffffff' : '', text: textoPara(dados.modelo, item) || ' ' });
      c.requestRenderAll();
      atualizarPainel();
    } else if (d.tipo !== 'FOTO') {
      const novo = substituir(selecionado, recriarElemento(selecionado, dados, textoPara(dados.modelo, item)));
      c.setActiveObject(novo);
      setSelecionado(novo);
      c.requestRenderAll();
    }
    if (novos.cor) setCorAtual(novos.cor);
    guardar();
  };

  const acao = async (qual: 'duplicar' | 'girar' | 'frente' | 'tras' | 'apagar' | 'encaixar') => {
    const c = fab.current;
    if (!c || !selecionado) return;
    if (qual === 'apagar') { c.getActiveObjects().forEach(o => c.remove(o)); c.discardActiveObject(); }
    if (qual === 'girar') selecionado.rotate(((selecionado.angle || 0) + 90) % 360);
    if (qual === 'frente') c.bringObjectToFront(selecionado);
    if (qual === 'tras') { c.sendObjectToBack(selecionado); const foto = c.getObjects().find(o => dadosDe(o)?.tipo === 'FOTO'); if (foto && foto !== selecionado) c.sendObjectToBack(foto); }
    if (qual === 'encaixar' && d?.tipo === 'FOTO') encaixarFoto(selecionado as FabricImage, LADO);
    if (qual === 'duplicar' && d && d.tipo !== 'FOTO') {
      const copia = d.tipo === 'TEXTO' ? criarElemento(d, textoPara(d.modelo, item)) : recriarElemento(selecionado, d, textoPara(d.modelo, item));
      copia.set({ angle: selecionado.angle, scaleX: selecionado.scaleX, scaleY: selecionado.scaleY });
      copia.setPositionByOrigin(selecionado.getCenterPoint().add({ x: 40, y: 40 } as any), 'center', 'center');
      c.add(copia);
      c.setActiveObject(copia);
    }
    selecionado.setCoords();
    c.requestRenderAll();
    guardar();
  };

  // teclado: Delete apaga, Ctrl+Z desfaz, Ctrl+Y refaz (fora de campos de texto)
  useEffect(() => {
    if (!det) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo && /input|textarea/i.test(alvo.tagName)) return;
      if ((fab.current?.getActiveObject() as IText | undefined)?.isEditing) return;
      if (e.key === 'Delete') { e.preventDefault(); acao('apagar'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); desfazer(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); refazer(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  // ---------------------------------------------------------------- salvar
  const modeloAtual = () => { fab.current!.discardActiveObject(); return estadoAtual(); };
  const salvarModelo = () => {
    try { localStorage.setItem(chaveModelo(det!.id), modeloAtual()); message.success('Modelo guardado: abre assim da próxima vez neste anúncio.'); }
    catch { message.error('Não foi possível guardar o modelo neste navegador.'); }
  };
  const comecarDoZero = async () => {
    try { localStorage.removeItem(chaveModelo(det!.id)); } catch { /* sem armazenamento */ }
    const c = fab.current!;
    c.getObjects().filter(o => dadosDe(o)?.tipo !== 'FOTO').forEach(o => c.remove(o));
    c.discardActiveObject();
    c.requestRenderAll();
    guardar();
  };

  /** Aplica o modelo num item (texto e, se for por item, a foto) e devolve a imagem em JPEG. */
  const gerarParaItem = async (modelo: string, it: ItemDoAnuncio) => {
    const el = document.createElement('canvas');
    const sc = new StaticCanvas(el, { width: LADO, height: LADO, backgroundColor: '#ffffff' });
    await sc.loadFromJSON(modelo);
    for (const o of [...sc.getObjects()]) {
      const dd = dadosDe(o);
      if (!dd) continue;
      if (dd.tipo === 'FOTO') {
        const f = fotoPorItem ? it.fotoUrl || det!.fotoFamilia : null;
        if (f) await trocarImagemDaFoto(o as FabricImage, enderecoParaDesenho(f));
      } else if (dd.tipo === 'TEXTO') (o as IText).set('text', textoPara(dd.modelo, it) || ' ');
      else if (dd.modelo !== undefined) {
        const i = sc.getObjects().indexOf(o);
        sc.remove(o);
        sc.insertAt(i, recriarElemento(o, dd, textoPara(dd.modelo, it)));
      }
    }
    sc.renderAll();
    const dataUrl = sc.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: 1 });
    sc.dispose();
    return dataUrl;
  };

  const salvarEm = async (itens: ItemDoAnuncio[], comoPrincipal: boolean) => {
    if (!det || !itens.length) return;
    const modelo = modeloAtual();
    try { localStorage.setItem(chaveModelo(det.id), modelo); } catch { /* sem armazenamento */ }
    setAplicando({ feitos: 0, total: itens.length });
    const falhas: string[] = [];
    for (const [k, it] of itens.entries()) {
      try {
        const dataUrl = await gerarParaItem(modelo, it);
        const blob = await (await fetch(dataUrl)).blob();
        const nome = `${it.sku}-editada.jpg`.replace(/[^\w.-]+/g, '-');
        await enviarArquivoAnexo(it.idItem, new File([blob], nome, { type: 'image/jpeg' }), comoPrincipal ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA');
      } catch (e) {
        falhas.push(`${it.sku}: ${e instanceof Error ? e.message : 'erro'}`);
      }
      setAplicando({ feitos: k + 1, total: itens.length });
    }
    setAplicando(null);
    if (falhas.length) message.warning(`${itens.length - falhas.length} salva(s); ${falhas.length} com erro: ${falhas[0]}`, 8);
    else message.success(`${itens.length} imagem(ns) salvas no cadastro${itens.some(i => i.ml.mlbId) ? '. Para os itens já no ML, use "Enviar atributos, fotos e descrição".' : '.'}`, 8);
    onSalvo();
  };

  const baixar = () => {
    if (!fab.current) return;
    fab.current.discardActiveObject();
    fab.current.requestRenderAll();
    const a = document.createElement('a');
    a.href = fab.current.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: 1 });
    a.download = `${item?.sku || 'imagem'}.jpg`;
    a.click();
  };

  const fotosDisponiveis = useMemo(() => [...new Set([det?.fotoFamilia, ...(det?.itens || []).map(i => i.fotoUrl)].filter((f): f is string => !!f))], [det]);
  const temTexto = d && d.modelo !== undefined;
  const botao = (icone: React.ReactNode, rotulo: string, tipo: TipoElemento, dica: string) => (
    <Tooltip title={dica} placement="right"><Button block icon={icone} onClick={() => adicionar(tipo)} style={{ justifyContent: 'flex-start' }}>{rotulo}</Button></Tooltip>
  );

  return (
    <Modal
      open={!!det} onCancel={aplicando ? undefined : onFechar} width="min(1280px, 98vw)" style={{ top: 12 }} destroyOnHidden maskClosable={false} keyboard={false}
      title={<Space><PictureOutlined />Editor de imagem</Space>}
      footer={(
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space wrap>
            <Button icon={<SaveOutlined />} onClick={salvarModelo}>Guardar modelo</Button>
            <Button onClick={comecarDoZero}>Começar do zero</Button>
            <Button icon={<DownloadOutlined />} onClick={baixar}>Baixar esta imagem</Button>
          </Space>
          <Space wrap>
            {aplicando && <Progress percent={Math.round((aplicando.feitos / aplicando.total) * 100)} style={{ width: 160, margin: 0 }} size="small" />}
            <Button onClick={onFechar} disabled={!!aplicando}>Fechar</Button>
            <Button disabled={!item || !!aplicando} onClick={() => item && salvarEm([item], true)}>Salvar só em {item?.sku}</Button>
            <Button type="primary" disabled={!marcados.length || !!aplicando} loading={!!aplicando}
              onClick={() => det && salvarEm(det.itens.filter(i => marcados.includes(i.idItem)), true)}>
              Aplicar em {marcados.length} item(ns)
            </Button>
          </Space>
        </Flex>
      )}
    >
      {det && (
        <Flex gap={16} align="flex-start" wrap>
          {/* ferramentas */}
          <Flex vertical gap={6} style={{ width: 150 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Adicionar</Text>
            {botao(<ColumnWidthOutlined />, 'Cota', 'COTA', 'Linha com setas e a medida (estique para mudar o comprimento)')}
            {botao(<ArrowRightOutlined />, 'Seta', 'SETA', 'Seta para apontar um detalhe')}
            {botao(<FontSizeOutlined />, 'Texto', 'TEXTO', 'Texto solto (duplo clique para escrever na imagem)')}
            {botao(<CommentOutlined />, 'Balão', 'BALAO', 'Balão explicativo com pontinha')}
            {botao(<BorderOutlined />, 'Destaque', 'DESTAQUE', 'Contorno para chamar atenção')}
            <Divider style={{ margin: '6px 0' }} />
            <Flex gap={6}>
              <Tooltip title="Desfazer (Ctrl+Z)"><Button icon={<UndoOutlined />} onClick={desfazer} disabled={historico.current.length < 2} /></Tooltip>
              <Tooltip title="Refazer (Ctrl+Y)"><Button icon={<RedoOutlined />} onClick={refazer} disabled={!refeitos.current.length} /></Tooltip>
            </Flex>
            <Text type="secondary" style={{ fontSize: 11 }}>Arraste para mover, use as bolinhas para girar e esticar. Delete apaga.</Text>
          </Flex>

          {/* quadro */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,.06)' }}>
            <canvas ref={elCanvas} />
          </div>

          {/* propriedades */}
          <Flex vertical gap={10} style={{ flex: 1, minWidth: 260 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Prévia do item (o texto troca {'{Campo}'} pela medida dele)</Text>
              <Select style={{ width: '100%' }} value={item?.idItem} onChange={trocarItem} showSearch optionFilterProp="label"
                options={det.itens.map(i => ({ value: i.idItem, label: `${i.sku} · ${i.tituloMl || i.nome}` }))} />
            </div>
            <Flex gap={8} wrap>
              <Segmented size="small" value={unidade} onChange={v => setUnidade(v as typeof unidade)} options={[{ value: 'original', label: 'Medida como está' }, { value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }]} />
              <Tooltip title="Ligado: cada item sai com a própria foto (no mesmo lugar e tamanho). Desligado: todos com esta foto.">
                <Space size={4}><Switch size="small" checked={fotoPorItem} onChange={setFotoPorItem} /><Text style={{ fontSize: 12 }}>foto de cada item</Text></Space>
              </Tooltip>
            </Flex>

            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background: '#fafafa' }}>
              {!d ? <Text type="secondary">Clique num elemento do quadro para editar.</Text> : (
                <Flex vertical gap={10}>
                  <Text strong>{{ SETA: 'Seta', COTA: 'Cota', TEXTO: 'Texto', BALAO: 'Balão', DESTAQUE: 'Destaque', FOTO: 'Foto do produto' }[d.tipo]}</Text>
                  {temTexto && (
                    <div>
                      <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} value={d.modelo} onChange={e => mudarSelecionado({ modelo: e.target.value })} />
                      <Flex wrap gap={4} style={{ marginTop: 4 }}>
                        {campos.map(cp => (
                          <Tooltip key={cp.chave} title={`neste item: ${cp.valor}`}>
                            <Tag style={{ cursor: 'pointer', margin: 0 }} onClick={() => mudarSelecionado({ modelo: `${d.modelo || ''}${d.modelo ? ' ' : ''}{${cp.chave}}` })}>+ {cp.chave}</Tag>
                          </Tooltip>
                        ))}
                      </Flex>
                    </div>
                  )}
                  {d.tipo !== 'FOTO' && (
                    <Flex gap={6} align="center" wrap>
                      {CORES.map(cor => (
                        <div key={cor} onClick={() => mudarSelecionado({ cor })}
                          style={{ width: 24, height: 24, borderRadius: 6, background: cor, cursor: 'pointer', border: '1px solid #d9d9d9', outline: d.cor === cor ? '3px solid #91caff' : 'none' }} />
                      ))}
                    </Flex>
                  )}
                  {(d.tipo === 'TEXTO' || d.tipo === 'COTA' || d.tipo === 'BALAO') && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Tamanho do texto</Text>
                      <Slider min={30} max={200} value={d.tamanhoFonte || (d.tipo === 'COTA' ? 90 : d.tipo === 'BALAO' ? 52 : 80)} onChange={(v: number) => mudarSelecionado({ tamanhoFonte: v })} />
                    </div>
                  )}
                  {d.tipo === 'TEXTO' && <Space><Switch size="small" checked={!!d.fundoTexto} onChange={v => mudarSelecionado({ fundoTexto: v })} /><Text style={{ fontSize: 12 }}>fundo branco atrás do texto</Text></Space>}
                  {d.tipo === 'COTA' && (
                    <Flex vertical gap={8}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>Lado do texto</Text>
                        <Segmented block size="small" value={d.ladoTexto || 'ACIMA'} onChange={v => mudarSelecionado({ ladoTexto: v as LadoTexto })}
                          options={[{ value: 'ACIMA', label: 'Acima' }, { value: 'SOBRE', label: 'Sobre a linha' }, { value: 'ABAIXO', label: 'Abaixo' }]} />
                      </div>
                      <Space wrap>
                        <Tooltip title="O texto fica na horizontal, com a cota em pé ou inclinada"><Space size={4}><Switch size="small" checked={!!d.textoDePe} onChange={v => mudarSelecionado({ textoDePe: v })} /><Text style={{ fontSize: 12 }}>texto sempre de pé</Text></Space></Tooltip>
                        <Button size="small" icon={<RedoOutlined />} onClick={() => mudarSelecionado({ textoVirado: !d.textoVirado })}>Virar texto 180°</Button>
                      </Space>
                      <Space size={4}><Switch size="small" checked={!d.semExtremidades} onChange={v => mudarSelecionado({ semExtremidades: !v })} /><Text style={{ fontSize: 12 }}>traços nas pontas</Text></Space>
                    </Flex>
                  )}
                  {d.tipo === 'SETA' && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Pontas</Text>
                      <Segmented block size="small" value={d.pontas || 'FIM'} onChange={v => mudarSelecionado({ pontas: v as Pontas })}
                        options={[{ value: 'FIM', label: '——►' }, { value: 'AMBAS', label: '◄——►' }, { value: 'NENHUMA', label: '——' }]} />
                    </div>
                  )}
                  {d.tipo === 'DESTAQUE' && (
                    <Segmented block size="small" value={d.forma || 'ELIPSE'} onChange={v => mudarSelecionado({ forma: v as 'ELIPSE' | 'RETANGULO' })}
                      options={[{ value: 'ELIPSE', label: 'Elipse' }, { value: 'RETANGULO', label: 'Retângulo' }]} />
                  )}
                  {(d.tipo === 'SETA' || d.tipo === 'COTA' || d.tipo === 'DESTAQUE') && (
                    <Flex gap={12} align="center" wrap>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Espessura</Text>
                        <Slider min={3} max={30} value={d.espessura || (d.tipo === 'COTA' ? 9 : 12)} onChange={(v: number) => mudarSelecionado({ espessura: v })} />
                      </div>
                      <Space size={4}><Switch size="small" checked={!!d.tracejado} onChange={v => mudarSelecionado({ tracejado: v })} /><Text style={{ fontSize: 12 }}>tracejado</Text></Space>
                    </Flex>
                  )}
                  {d.tipo === 'FOTO' && (
                    <Flex vertical gap={6}>
                      <Select placeholder="Trocar a foto" style={{ width: '100%' }} value={undefined} onChange={(f: string) => colocarFoto(f)}
                        options={fotosDisponiveis.map((f, k) => ({ value: f, label: <Space><img src={f} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />{f === det.fotoFamilia ? 'Foto da família' : `Foto ${k + 1}`}</Space> }))} />
                      <Upload accept="image/*" showUploadList={false} beforeUpload={f => { colocarFoto(URL.createObjectURL(f)); return false; }}>
                        <Button size="small" icon={<UploadOutlined />}>Foto do computador</Button>
                      </Upload>
                      <Button size="small" onClick={() => acao('encaixar')}>Encaixar no quadro</Button>
                    </Flex>
                  )}
                  <Flex gap={6} wrap>
                    {d.tipo !== 'FOTO' && <Tooltip title="Duplicar"><Button size="small" icon={<CopyOutlined />} onClick={() => acao('duplicar')} /></Tooltip>}
                    <Tooltip title="Girar 90°"><Button size="small" icon={<RedoOutlined />} onClick={() => acao('girar')} /></Tooltip>
                    <Tooltip title="Trazer para a frente"><Button size="small" icon={<VerticalAlignTopOutlined />} onClick={() => acao('frente')} /></Tooltip>
                    <Tooltip title="Mandar para trás"><Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => acao('tras')} /></Tooltip>
                    <Tooltip title="Apagar (Delete)"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => acao('apagar')} /></Tooltip>
                  </Flex>
                </Flex>
              )}
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Aplicar em</Text>
              <Select mode="multiple" style={{ width: '100%' }} value={marcados} onChange={setMarcados} maxTagCount="responsive"
                options={det.itens.map(i => ({ value: i.idItem, label: i.sku }))} />
              <Text type="secondary" style={{ fontSize: 11 }}>Salva como foto principal (a atual vai para a galeria). O modelo fica guardado neste anúncio.</Text>
            </div>
          </Flex>
        </Flex>
      )}
    </Modal>
  );
};

export default EditorImagemModal;
