// Editor de imagem simplificado: a foto do produto num quadro 1200×1200 e, por cima, setas, cotas com medida, textos,
// balões e destaques que se movem, giram e esticam. O texto aceita {Campo} (ex.: {Comprimento}); o mesmo modelo é
// aplicado em todos os itens (variações), cada um com a sua medida, e salvo no cadastro do ERP. Ao abrir, escolhe-se a
// foto que vai ser editada (da família ou de um item). Usado pela família (catálogo) e pelo anúncio do ML.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Divider, Empty, Flex, Input, InputNumber, Modal, Progress, Segmented, Select, Slider, Space, Spin, Switch, Tag, Tooltip, Typography, Upload, message } from 'antd';
import {
  AppstoreOutlined, ArrowRightOutlined, BgColorsOutlined, BorderOutlined, ColumnWidthOutlined, CommentOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined,
  ExpandOutlined, FileImageOutlined, FontSizeOutlined, PictureOutlined, RedoOutlined, SaveOutlined, ScissorOutlined, UndoOutlined, UploadOutlined,
  SwapOutlined, VerticalAlignBottomOutlined, VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { Canvas, FabricImage, FabricObject, IText, Point, Rect, StaticCanvas, util } from 'fabric';
import { enviarArquivoAnexo } from '../../skus/CatalogSku.service';
import { FotoFamilia, fotosFamiliaApi } from '../../familias/FamilyManager.api';
import { converterMedidas, textoDoModelo } from '../etiqueta';
import { enderecoParaDesenho } from '../enderecoImagem';
import type { EntradaEditor, ItemDoEditor } from './entradaEditor';
import {
  aplicarCorte, criarElemento, dadosDe, DadosElemento, encaixarFoto, LadoTexto, montarFoto, origemDaFoto, parametrosAposEsticar, Pontas,
  precisaRedesenharAoGirar, PROPRIEDADES, recriarElemento, refazerFotosTratadas, soltarFotosTratadas, TipoElemento, vezesDaFoto,
} from './elementos';
import { CORTE_INTEIRO, corteDoQuadro } from './fotoPixels';
import { limparModelo } from './modeloSalvo';

const { Text } = Typography;
const LADO = 1200;
const TELA = 600;
const CORES = ['#731717', '#111111', '#d4380d', '#1554c0', '#15803d', '#ffffff'];
// "ml-4" é o nome antigo (anúncio 4): mantém o modelo que já estava guardado no navegador
const chaveModelo = (chave: string) => (chave.startsWith("ml-") ? `ml-editor-imagem-${chave.slice(3)}` : `editor-imagem-${chave}`);
const TOLERANCIA_PADRAO = 40;
type Proporcao = 'LIVRE' | 'QUADRADO';

interface Props { entrada: EntradaEditor | null; onFechar: () => void; onSalvo: () => void }

/** Foto escolhida para editar: url (null = a do modelo guardado), a foto da família dela e se vem com as cotas guardadas. */
/** porItem: cada variação sai com a própria foto; sem ele, todas saem sobre a foto escolhida. */
interface Escolha { url: string | null; idFotoFamilia: number | null; usarModelo: boolean; porItem?: boolean }

const EditorImagemModal: React.FC<Props> = ({ entrada, onFechar, onSalvo }) => {
  const elCanvas = useRef<HTMLCanvasElement>(null);
  const fab = useRef<Canvas | null>(null);
  const historico = useRef<string[]>([]);
  const refeitos = useRef<string[]>([]);
  const carregando = useRef(false);
  // foto-modelo da família (a principal da galeria): o modelo do editor fica guardado nela e vale para todos os anúncios
  const fotoModelo = useRef<{ idFamilia: number; idFoto: number } | null>(null);
  const [selecionado, setSelecionado] = useState<FabricObject | null>(null);
  const [, setVersao] = useState(0);
  const atualizarPainel = () => setVersao(v => v + 1);
  const [idItem, setIdItem] = useState<number | null>(null);
  const [unidade, setUnidade] = useState<'original' | 'mm' | 'cm'>('original');
  const [fotoPorItem, setFotoPorItem] = useState(entrada?.fotoPorItem ?? true);
  // escolha da foto ao abrir: a galeria da família e se há modelo guardado
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [galeria, setGaleria] = useState<FotoFamilia[] | null>(null);
  const [usarModelo, setUsarModelo] = useState(true);
  const sufixoArquivo = useRef('');                      // foto da família que não é a modelo: imagem com nome próprio
  const [aplicando, setAplicando] = useState<{ feitos: number; total: number } | null>(null);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [corAtual, setCorAtual] = useState(CORES[0]);
  // a regra do ML pede a foto principal sem textos: o padrão é a 2ª foto
  const [destino, setDestino] = useState<'SEGUNDA' | 'PRINCIPAL'>('SEGUNDA');
  const [cortando, setCortando] = useState<Proporcao | null>(null);
  const quadroCorte = useRef<Rect | null>(null);
  const [tratandoFoto, setTratandoFoto] = useState(false);
  const [tolerancia, setTolerancia] = useState(TOLERANCIA_PADRAO);

  const item = useMemo(() => entrada?.itens.find(i => i.idItem === idItem) || entrada?.itens[0] || null, [entrada, idItem]);
  const campos = item?.campos || [];
  const textoPara = useCallback((modelo: string | undefined, it: ItemDoEditor | null) =>
    (it ? converterMedidas(textoDoModelo(modelo || '', it.campos), unidade) : modelo || ''), [unidade]);
  const principalFamilia = galeria?.find(f => f.uso === 'PRINCIPAL')?.url || galeria?.[0]?.url || null;

  // ---------------------------------------------------------------- histórico
  /** O modelo guarda a foto pela origem (sem tratamento); o fundo é tirado de novo ao abrir. */
  const estadoAtual = () => {
    const modelo = fab.current!.toObject(PROPRIEDADES) as { objects?: Array<Record<string, any>> };
    for (const o of modelo.objects || []) if (o.dadosElemento?.tipo === 'FOTO' && o.dadosElemento.origem) o.src = o.dadosElemento.origem;
    return JSON.stringify(modelo);
  };
  const guardar = () => {
    if (!fab.current || carregando.current || quadroCorte.current) return;
    const estado = estadoAtual();
    if (estado === historico.current[historico.current.length - 1]) return;
    historico.current.push(estado);
    if (historico.current.length > 30) historico.current.shift();
    refeitos.current = [];
    atualizarPainel();
  };
  const carregarEstado = async (json: string) => {
    const c = fab.current!;
    carregando.current = true;
    try {
      await c.loadFromJSON(json);
      await refazerFotosTratadas(c);
      c.getObjects().forEach(o => o.set({ cornerColor: '#1677ff', cornerStyle: 'circle', borderColor: '#1677ff', transparentCorners: false, cornerSize: 16 }));
      c.requestRenderAll();
    } finally {
      carregando.current = false;
      setSelecionado(null);
    }
  };
  const desfazer = async () => {
    if (historico.current.length < 2) return;
    refeitos.current.push(historico.current.pop()!);
    try { await carregarEstado(historico.current[historico.current.length - 1]); } catch { message.error('Não foi possível abrir a foto.'); }
    atualizarPainel();
  };
  const refazer = async () => {
    const proximo = refeitos.current.pop();
    if (!proximo) return;
    historico.current.push(proximo);
    try { await carregarEstado(proximo); } catch { message.error('Não foi possível abrir a foto.'); }
    atualizarPainel();
  };

  // ---------------------------------------------------------------- textos com {Campo}
  const substituir = (antigo: FabricObject, novo: FabricObject) => {
    const c = fab.current!;
    const i = c.getObjects().indexOf(antigo);
    if (i < 0) return null;   // o antigo já saiu do quadro: não acrescenta uma cópia
    c.remove(antigo);
    c.insertAt(i, novo);
    return novo;
  };
  /** Redesenha os textos de todos os elementos para o item da prévia. */
  const renderizarTextos = useCallback((it: ItemDoEditor | null) => {
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
    const endereco = enderecoParaDesenho(url);
    setTratandoFoto(true);
    try {
      if (atual) { await montarFoto(atual, endereco); c.requestRenderAll(); }
      else {
        const img = encaixarFoto(await FabricImage.fromURL(endereco, { crossOrigin: 'anonymous' }), LADO);
        (img as any).dadosElemento = { ...dadosDe(img), origem: endereco };
        c.add(img);
        c.sendObjectToBack(img);
      }
      guardar();
    } catch {
      message.error('Não foi possível abrir a foto.');
    } finally {
      setTratandoFoto(false);
    }
  };

  // ---------------------------------------------------------------- foto: cortar e tirar o fundo
  const fotoDoQuadro = () => fab.current?.getObjects().find(o => dadosDe(o)?.tipo === 'FOTO') as FabricImage | undefined;
  const selecionarFoto = () => {
    const c = fab.current;
    const foto = fotoDoQuadro();
    if (!c || !foto) { message.info('Este quadro está sem foto.'); return; }
    c.setActiveObject(foto);
    c.requestRenderAll();
  };

  /** Mostra um quadro azul sobre a foto; o que ficar dentro dele é o que sobra. */
  const iniciarCorte = () => {
    const c = fab.current;
    const foto = fotoDoQuadro();
    if (!c || !foto || quadroCorte.current) return;
    c.discardActiveObject();
    foto.set({ selectable: false, evented: false });
    const b = foto.getBoundingRect();
    const x0 = Math.max(0, b.left);
    const y0 = Math.max(0, b.top);
    const quadro = new Rect({
      left: x0, top: y0, width: Math.min(LADO, b.left + b.width) - x0, height: Math.min(LADO, b.top + b.height) - y0,
      fill: 'rgba(22,119,255,0.08)', stroke: '#1677ff', strokeWidth: 4, strokeDashArray: [18, 10], strokeUniform: true, lockRotation: true,
      cornerColor: '#1677ff', cornerStyle: 'circle', borderColor: '#1677ff', transparentCorners: false, cornerSize: 20,
    });
    quadro.setControlsVisibility({ mtr: false });
    quadroCorte.current = quadro;
    c.add(quadro);
    c.setActiveObject(quadro);
    c.requestRenderAll();
    setCortando('LIVRE');
  };
  const mudarProporcao = (p: Proporcao) => {
    const c = fab.current;
    const q = quadroCorte.current;
    if (!c || !q) return;
    if (p === 'QUADRADO') {
      const lado = Math.min(q.width * q.scaleX, q.height * q.scaleY);
      const centro = q.getCenterPoint();
      q.set({ width: lado, height: lado, scaleX: 1, scaleY: 1 });
      q.setPositionByOrigin(centro, 'center', 'center');
    }
    const livre = p === 'LIVRE';   // quadrado: só as bolinhas dos cantos, que esticam por igual
    q.setControlsVisibility({ ml: livre, mr: livre, mt: livre, mb: livre, mtr: false });
    q.setCoords();
    c.setActiveObject(q);
    c.requestRenderAll();
    setCortando(p);
  };
  const encerrarCorte = () => {
    const c = fab.current;
    if (c && quadroCorte.current) c.remove(quadroCorte.current);
    quadroCorte.current = null;
    fotoDoQuadro()?.set({ selectable: true, evented: true });
    c?.discardActiveObject();
    c?.requestRenderAll();
    setCortando(null);
  };
  const aplicarCorteDoQuadro = () => {
    const c = fab.current;
    const q = quadroCorte.current;
    const foto = fotoDoQuadro();
    const d = dadosDe(foto);
    if (!c || !q || !foto || !d) { encerrarCorte(); return; }
    const w = foto.width || 1;
    const h = foto.height || 1;
    const x0 = q.left, y0 = q.top, x1 = x0 + q.width * q.scaleX, y1 = y0 + q.height * q.scaleY;
    // cantos do quadro no sistema da foto (desfaz posição, escala, giro e espelho)
    const inv = util.invertTransform(foto.calcTransformMatrix());
    const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => util.transformPoint(new Point(x, y), inv));
    const caixa = { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)) };
    const atual = d.corte || CORTE_INTEIRO;
    const novo = corteDoQuadro(atual, w, h, caixa);
    if (!novo) { message.warning('O quadro de corte ficou fora da foto.'); return; }
    // o pedaço escolhido fica onde está na tela
    const cx = ((novo.x - atual.x + novo.w / 2) / atual.w - 0.5) * w;
    const cy = ((novo.y - atual.y + novo.h / 2) / atual.h - 0.5) * h;
    const centro = util.transformPoint(new Point(cx, cy), foto.calcTransformMatrix());
    encerrarCorte();
    (foto as any).dadosElemento = { ...d, corte: novo, corteAuto: false };
    aplicarCorte(foto, novo);
    foto.setPositionByOrigin(centro, 'center', 'center');
    foto.setCoords();
    c.setActiveObject(foto);
    c.requestRenderAll();
    guardar();
  };
  /** Corta as sobras de cada foto (cada item com a dele) e encaixa no quadro; desligado volta a foto inteira. */
  const mudarCorteAuto = async (ligado: boolean) => {
    const c = fab.current;
    const foto = fotoDoQuadro();
    if (!c || !foto) return;
    (foto as any).dadosElemento = { ...dadosDe(foto)!, corteAuto: ligado, corte: undefined };
    setTratandoFoto(true);
    try {
      await montarFoto(foto, origemDaFoto(foto));
      const inteira = foto.getOriginalSize();
      if (ligado && (foto.width || 0) >= inteira.width - 1 && (foto.height || 0) >= inteira.height - 1) {
        message.info('Não achei sobras brancas para cortar. Tire o fundo antes, se ele não for branco.');
      }
      encaixarFoto(foto, LADO);
      foto.setCoords();
      c.requestRenderAll();
      guardar();
    } catch {
      message.error('Não foi possível tratar a foto.');
    } finally {
      setTratandoFoto(false);
      atualizarPainel();
    }
  };
  const tirarCorte = () => {
    const c = fab.current;
    const foto = fotoDoQuadro();
    if (!c || !foto) return;
    (foto as any).dadosElemento = { ...dadosDe(foto)!, corte: undefined, corteAuto: false };
    aplicarCorte(foto, CORTE_INTEIRO);
    encaixarFoto(foto, LADO);
    foto.setCoords();
    c.requestRenderAll();
    guardar();
  };
  /** Liga, desliga ou ajusta o "tirar o fundo" (undefined = fundo original). */
  const mudarFundo = async (semFundo: number | undefined) => {
    const c = fab.current;
    const foto = fotoDoQuadro();
    if (!c || !foto) return;
    (foto as any).dadosElemento = { ...dadosDe(foto)!, semFundo };
    setTratandoFoto(true);
    try {
      await montarFoto(foto, origemDaFoto(foto));
      c.requestRenderAll();
      guardar();
    } catch {
      message.error('Não foi possível tratar a foto.');
    } finally {
      setTratandoFoto(false);
      atualizarPainel();
    }
  };
  /** Repete o produto N vezes em grade (foto de kit); 1 volta a foto normal. Vale para a foto de cada item. */
  const mudarMultiplicar = async (vezes: number) => {
    const c = fab.current;
    const foto = fotoDoQuadro();
    if (!c || !foto) return;
    const n = Math.max(1, Math.min(48, Math.floor(vezes || 1)));
    (foto as any).dadosElemento = { ...dadosDe(foto)!, multiplicar: n > 1 ? n : undefined };
    setTratandoFoto(true);
    try {
      await montarFoto(foto, origemDaFoto(foto));
      encaixarFoto(foto, LADO);
      foto.setCoords();
      c.requestRenderAll();
      guardar();
    } catch {
      message.error('Não foi possível montar a foto do kit.');
    } finally {
      setTratandoFoto(false);
      atualizarPainel();
    }
  };
  const kitsDoAnuncio = useMemo(() => [...new Set((entrada?.itens || []).flatMap(i => i.kits || []))].sort((a, b) => a - b), [entrada]);

  // ---------------------------------------------------------------- abrir / fechar
  // os eventos do quadro são ligados uma vez; leem a unidade atual por aqui
  const textoParaAtual = useRef(textoPara);
  textoParaAtual.current = textoPara;
  // galeria da família e o que há guardado: é o que aparece na escolha da foto ao abrir
  useEffect(() => {
    if (!entrada) return;
    let vivo = true;
    setEscolha(null);
    setGaleria(null);
    setFotoPorItem(entrada.fotoPorItem ?? true);
    (async () => {
      const fotos = entrada.idFamilia ? await fotosFamiliaApi.listar(entrada.idFamilia).then(r => r.fotos).catch(() => []) : [];
      if (!vivo) return;
      setGaleria(fotos);
      const inicial = entrada.idFotoFamiliaInicial ? fotos.find(f => f.idFoto === entrada.idFotoFamiliaInicial) : null;
      if (inicial) setEscolha({ url: inicial.url, idFotoFamilia: inicial.idFoto, usarModelo: true, porItem: false });
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada?.chave]);

  useEffect(() => {
    if (!entrada || !escolha || !galeria) return;
    // escolheu uma foto: ela vale para todas as variações (a de cada item só se pediu "cada item com a própria foto")
    setFotoPorItem(!!escolha.porItem);
    const primeiro = entrada.itens.find(i => i.foto) || entrada.itens[0];
    setIdItem(primeiro?.idItem ?? null);
    setMarcados(entrada.itens.map(i => i.idItem));
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
          const novo = substituir(o, recriarElemento(o, novos, textoParaAtual.current(novos.modelo, itemAtual.current)));
          if (novo) c.setActiveObject(novo);
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
        if (d) { (o as any).dadosElemento = { ...d, modelo: o.text }; o.set('text', textoParaAtual.current(o.text, itemAtual.current) || ' '); c.requestRenderAll(); guardar(); }
      });
      // a foto escolhida; o modelo fica guardado nela (foto da família) ou na foto-modelo da família
      const foto = escolha.url;
      const daGaleria = escolha.idFotoFamilia ? galeria.find(f => f.idFoto === escolha.idFotoFamilia) || null : null;
      // cotas guardadas: na foto da família escolhida; escolheu foto de item: no gabarito do editor, senão na principal
      const guardarEm = daGaleria || galeria.find(f => f.uso === 'EDITOR') || galeria.find(f => f.uso === 'PRINCIPAL') || galeria[0] || null;
      fotoModelo.current = guardarEm && entrada.idFamilia ? { idFamilia: entrada.idFamilia, idFoto: guardarEm.idFoto } : null;
      // a imagem gerada sobre a principal ou o gabarito é a "-editada" de cada item; sobre uma foto comum, uma à parte
      sufixoArquivo.current = daGaleria && daGaleria.uso === 'COMUM' ? `-f${daGaleria.idFoto}` : '';
      // cotas e textos guardados: os da foto escolhida, senão os da foto-modelo, senão os deste navegador
      let salvo: string | null = null;
      let daFamilia = false;
      if (escolha.usarModelo) {
        const comModelo = [daGaleria, guardarEm, ...galeria].find(f => f?.temModelo);
        if (comModelo && entrada.idFamilia) {
          const m = await fotosFamiliaApi.lerModelo(entrada.idFamilia, comModelo.idFoto).then(r => r.modelo).catch(() => null);
          if (!vivo) return;
          if (m) { salvo = m; daFamilia = true; }
        }
        if (!salvo) salvo = (() => { try { return localStorage.getItem(chaveModelo(entrada.chave)); } catch { return null; } })();
      }
      let abriuSalvo = false;
      if (salvo) {
        try {
          const limpo = limparModelo(salvo);
          await carregarEstado(limpo.json);
          if (!vivo) return;
          // a foto do modelo é a de quando ele foi guardado: troca pela foto de hoje (mesmo lugar e tamanho)
          const fotoNoQuadro = fotoDoQuadro();
          const alvo = foto ? enderecoParaDesenho(foto) : null;
          if (foto && (limpo.fotoDescartada || (fotoNoQuadro && alvo !== origemDaFoto(fotoNoQuadro)))) await colocarFoto(foto);
          if (!vivo) return;
          renderizarTextos(primeiro || null);
          abriuSalvo = true;
          const onde = daFamilia ? `as cotas guardadas na família ${entrada.familia || ''}`.trim() : 'as últimas cotas guardadas neste navegador';
          message.info(limpo.repetidos
            ? `Abri ${onde} e tirei ${limpo.repetidos} elemento(s) repetido(s).`
            : `Abri ${onde}. "Começar do zero" limpa o quadro.`);
        } catch {
          if (!vivo) return;
          c.clear();
          c.backgroundColor = '#ffffff';
          message.warning('Não consegui abrir o modelo guardado; comecei um novo sobre a foto escolhida.');
        }
      }
      if (!abriuSalvo) {
        if (foto) await colocarFoto(foto);
        if (!vivo) return;
        // começa com uma cota da medida do anúncio, embaixo
        const d: DadosElemento = { tipo: 'COTA', cor: CORES[0], modelo: entrada.modeloPadrao || '{Comprimento}', comprimento: 800, textoDePe: true, ladoTexto: 'ACIMA' };
        const cota = criarElemento(d, textoPara(d.modelo, primeiro || null));
        cota.set({ left: LADO / 2, top: LADO - 150, originX: 'center', originY: 'center' });
        c.add(cota);
      }
      guardar();
    }, 50);
    return () => {
      vivo = false; window.clearTimeout(t); fab.current?.dispose(); fab.current = null; historico.current = []; refeitos.current = [];
      quadroCorte.current = null; setCortando(null); setSelecionado(null); soltarFotosTratadas();
    };
    // só reabre ao trocar de entrada ou de foto escolhida: depois de salvar a tela de fora recarrega e o quadro continua
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrada?.chave, escolha, galeria !== null]);

  const itemAtual = useRef<ItemDoEditor | null>(null);
  useEffect(() => { itemAtual.current = item; }, [item]);
  // a tolerância do controle acompanha a da foto selecionada
  useEffect(() => { const t = dadosDe(selecionado)?.semFundo; if (t !== undefined) setTolerancia(t); }, [selecionado]);

  // trocou o item da prévia ou a unidade: textos e (se for por item) a foto
  const trocarItem = async (id: number) => {
    setIdItem(id);
    const it = entrada?.itens.find(i => i.idItem === id) || null;
    itemAtual.current = it;
    if (fotoPorItem && it) { const f = it.foto || escolha?.url || principalFamilia; if (f) await colocarFoto(f); }
    renderizarTextos(it);
  };
  useEffect(() => { renderizarTextos(itemAtual.current); }, [unidade]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- ferramentas
  const adicionar = (tipo: TipoElemento) => {
    const c = fab.current;
    if (!c) return;
    const base: Record<string, DadosElemento> = {
      SETA: { tipo: 'SETA', cor: corAtual, comprimento: 320, pontas: 'FIM' },
      COTA: { tipo: 'COTA', cor: corAtual, modelo: entrada?.modeloPadrao || '{Comprimento}', comprimento: 600, textoDePe: true, ladoTexto: 'ACIMA' },
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
  /**
   * Muda o elemento selecionado. Lê o selecionado do próprio quadro: o do estado do React pode estar atrasado (o Slider
   * dispara vários onChange antes de a tela atualizar) e recriar a partir dele deixava cópias empilhadas.
   * `guardarAgora` false: quem chama guarda no histórico ao terminar (soltar o slider, sair do campo).
   */
  const mudarSelecionado = (novos: Partial<DadosElemento>, guardarAgora = true) => {
    const c = fab.current;
    const atual = c?.getActiveObject();
    const da = dadosDe(atual);
    if (!c || !atual || !da || !c.getObjects().includes(atual)) return;
    const dados = { ...da, ...novos };
    if (da.tipo === 'TEXTO') {
      const t = atual as IText;
      (t as any).dadosElemento = dados;
      t.set({ fill: dados.cor, fontSize: dados.tamanhoFonte || 80, backgroundColor: dados.fundoTexto ? '#ffffff' : '', text: textoPara(dados.modelo, item) || ' ' });
      c.requestRenderAll();
      atualizarPainel();
    } else if (da.tipo !== 'FOTO') {
      const novo = substituir(atual, recriarElemento(atual, dados, textoPara(dados.modelo, item)));
      if (novo) { c.setActiveObject(novo); setSelecionado(novo); }
      c.requestRenderAll();
    }
    if (novos.cor) setCorAtual(novos.cor);
    if (guardarAgora) guardar();
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

  // teclado: Delete apaga, Ctrl+Z desfaz, Ctrl+Y refaz (fora de campos de texto); cortando: Enter aplica, Esc cancela
  useEffect(() => {
    if (!entrada) return;
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo && /input|textarea/i.test(alvo.tagName)) return;
      if ((fab.current?.getActiveObject() as IText | undefined)?.isEditing) return;
      if (quadroCorte.current) {
        if (e.key === 'Enter') { e.preventDefault(); aplicarCorteDoQuadro(); }
        if (e.key === 'Escape') { e.preventDefault(); encerrarCorte(); }
        return;
      }
      if (e.key === 'Delete') { e.preventDefault(); acao('apagar'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); desfazer(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); refazer(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  // ---------------------------------------------------------------- salvar
  const modeloAtual = () => { fab.current!.discardActiveObject(); return estadoAtual(); };
  /** Guarda o modelo na foto-modelo da família (vale para todos os anúncios dela) e, de reserva, neste navegador. */
  const guardarNaFamilia = async (modelo: string, avisar: boolean) => {
    try { localStorage.setItem(chaveModelo(entrada!.chave), modelo); } catch { /* sem armazenamento */ }
    if (!fotoModelo.current) {
      if (avisar) message.success('Modelo guardado neste navegador. Com uma foto na galeria da família, ele passa a valer em qualquer lugar.');
      return;
    }
    try {
      await fotosFamiliaApi.salvarModelo(fotoModelo.current.idFamilia, fotoModelo.current.idFoto, modelo);
      if (avisar) message.success(`Modelo guardado na família${entrada!.familia ? ` ${entrada!.familia}` : ''}: abre assim em qualquer anúncio dela.`);
      setGaleria(g => g && g.map(f => (f.idFoto === fotoModelo.current?.idFoto ? { ...f, temModelo: true } : f)));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Não foi possível guardar o modelo na família.');
    }
  };
  const salvarModelo = () => guardarNaFamilia(modeloAtual(), true);
  const comecarDoZero = async () => {
    // só o quadro: o modelo guardado na família continua até você guardar outro
    try { localStorage.removeItem(chaveModelo(entrada!.chave)); } catch { /* sem armazenamento */ }
    const c = fab.current!;
    c.getObjects().filter(o => dadosDe(o)?.tipo !== 'FOTO').forEach(o => c.remove(o));
    c.discardActiveObject();
    c.requestRenderAll();
    guardar();
  };

  /** Aplica o modelo num item (texto e, se for por item, a foto) e devolve a imagem em JPEG. */
  const gerarParaItem = async (modelo: string, it: ItemDoEditor) => {
    const el = document.createElement('canvas');
    const sc = new StaticCanvas(el, { width: LADO, height: LADO, backgroundColor: '#ffffff' });
    await sc.loadFromJSON(modelo);
    for (const o of [...sc.getObjects()]) {
      const dd = dadosDe(o);
      if (!dd) continue;
      if (dd.tipo === 'FOTO') {
        const f = fotoPorItem ? it.foto || escolha?.url || principalFamilia : null;
        const alvo = f ? enderecoParaDesenho(f) : dd.semFundo !== undefined || dd.corteAuto ? dd.origem : undefined;
        if (alvo) await montarFoto(o as FabricImage, alvo);
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

  /** Salva a imagem de cada item; a gerada antes por aqui (mesmo nome) é trocada, não se acumula. */
  const salvarEm = async (itens: ItemDoEditor[], comoPrincipal: boolean) => {
    if (!entrada || !itens.length) return;
    const modelo = modeloAtual();
    await guardarNaFamilia(modelo, false);
    // foto repetida ×N = foto do kit c/N: nome próprio ("SKU-kit10.jpg"), nunca a principal do item; no ML vai como 2ª
    // foto só no anúncio do kit c/N
    const vezes = vezesDaFoto(dadosDe(fotoDoQuadro()));
    setAplicando({ feitos: 0, total: itens.length });
    const falhas: string[] = [];
    for (const [k, it] of itens.entries()) {
      try {
        const dataUrl = await gerarParaItem(modelo, it);
        const blob = await (await fetch(dataUrl)).blob();
        // uma imagem por foto-base: a da foto-modelo é "-editada"; a de outra foto da família tem o id dela no nome
        const nome = (vezes > 1 ? `${it.sku}${sufixoArquivo.current}-kit${vezes}.jpg` : `${it.sku}${sufixoArquivo.current}-editada.jpg`).replace(/[^\w.-]+/g, '-');
        const principal = comoPrincipal && vezes === 1;
        await enviarArquivoAnexo(it.idItem, new File([blob], nome, { type: 'image/jpeg' }), principal ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA',
          { substituir: true, posicao: principal || vezes > 1 ? undefined : 2 });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erro';
        // a foto não abriu (arquivo que não existe mais no servidor ou link fora do ar)
        falhas.push(`${it.sku}: ${/error loading/i.test(msg) ? `a foto não abriu (${msg.replace(/^.*error loading\s*/i, '').split('/').pop()}): confira se ela ainda existe` : msg}`);
      }
      setAplicando({ feitos: k + 1, total: itens.length });
    }
    setAplicando(null);
    if (falhas.length) message.warning(`${itens.length - falhas.length} salva(s); ${falhas.length} com erro: ${falhas[0]}`, 8);
    else message.success(`${itens.length} ${vezes > 1 ? `foto(s) do kit c/${vezes}` : 'imagem(ns)'} salvas no cadastro${vezes > 1 ? ' (vão como 2ª foto só no anúncio do kit)' : ''}${itens.some(i => i.noMl) ? '. Para os itens já no ML, use "Enviar atributos, fotos e descrição".' : '.'}`, 8);
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

  const fotosDisponiveis = useMemo(() => [...new Set([...(galeria || []).map(f => f.url), ...(entrada?.itens || []).flatMap(i => [i.foto, ...(i.fotos || []).map(f => f.url)])].filter((f): f is string => !!f))], [entrada, galeria]);
  // fotos para escolher ao abrir: as da família e as dos itens (uma vez cada)
  const fotosDosItens = useMemo(() => {
    const vistas = new Set((galeria || []).map(f => f.url));
    const lista: { url: string; sku: string }[] = [];
    for (const i of entrada?.itens || []) for (const u of [i.foto, ...(i.fotos || []).map(f => f.url)]) if (u && !vistas.has(u)) { vistas.add(u); lista.push({ url: u, sku: i.sku }); }
    return lista;
  }, [entrada, galeria]);
  const haModelo = !!galeria?.some(f => f.temModelo) || (() => { try { return !!entrada && !!localStorage.getItem(chaveModelo(entrada.chave)); } catch { return false; } })();
  const temTexto = d && d.modelo !== undefined;
  const botao = (icone: React.ReactNode, rotulo: string, tipo: TipoElemento, dica: string) => (
    <Tooltip title={dica} placement="right"><Button block icon={icone} disabled={!!cortando} onClick={() => adicionar(tipo)} style={{ justifyContent: 'flex-start' }}>{rotulo}</Button></Tooltip>
  );

  return (
    <Modal
      open={!!entrada} onCancel={aplicando ? undefined : onFechar} width="min(1280px, 98vw)" style={{ top: 12 }} destroyOnHidden maskClosable={false} keyboard={false}
      title={<Space><PictureOutlined />Editor de imagem{entrada?.familia && <Tag color="purple">família {entrada.familia}</Tag>}</Space>}
      footer={!escolha ? null : (
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space wrap>
            <Button icon={<SaveOutlined />} onClick={salvarModelo} disabled={!!cortando}>Guardar modelo</Button>
            <Button onClick={comecarDoZero} disabled={!!cortando}>Começar do zero</Button>
            <Button icon={<DownloadOutlined />} onClick={baixar} disabled={!!cortando}>Baixar esta imagem</Button>
          </Space>
          <Space wrap>
            {aplicando && <Progress percent={Math.round((aplicando.feitos / aplicando.total) * 100)} style={{ width: 160, margin: 0 }} size="small" />}
            <Button onClick={onFechar} disabled={!!aplicando}>Fechar</Button>
            <Tooltip title="O Mercado Livre pede a foto principal com fundo branco e sem textos; a imagem com medidas vai melhor como 2ª foto">
              <Segmented size="small" value={destino} onChange={v => setDestino(v as typeof destino)}
                options={[{ value: 'SEGUNDA', label: 'Como 2ª foto' }, { value: 'PRINCIPAL', label: 'Como principal' }]} />
            </Tooltip>
            <Button disabled={!item || !!aplicando || !!cortando || tratandoFoto} onClick={() => item && salvarEm([item], destino === 'PRINCIPAL')}>Salvar só em {item?.sku}</Button>
            <Button type="primary" disabled={!marcados.length || !!aplicando || !!cortando || tratandoFoto} loading={!!aplicando}
              onClick={() => entrada && salvarEm(entrada.itens.filter(i => marcados.includes(i.idItem)), destino === 'PRINCIPAL')}>
              Aplicar em {marcados.length} item(ns)
            </Button>
          </Space>
        </Flex>
      )}
    >
      {entrada && !escolha && (
        !galeria ? <div style={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><Spin /></div> : (
          <Flex vertical gap={14}>
            <Text>Qual foto você quer editar? As cotas e textos que você montar valem para as {entrada.itens.length} variações, cada uma com a sua medida.</Text>
            {haModelo && (
              <Checkbox checked={usarModelo} onChange={e => setUsarModelo(e.target.checked)}>Abrir com as cotas e textos guardados (se a foto escolhida não tiver, vêm os da foto-modelo)</Checkbox>
            )}
            {entrada.itens.some(i => i.foto) && (
              <div
                onClick={() => { const p = entrada.itens.find(i => i.foto)!; setEscolha({ url: p.foto, idFotoFamilia: null, usarModelo: usarModelo && haModelo, porItem: true }); }}
                style={{ padding: '10px 12px', border: '1px dashed #91caff', borderRadius: 8, cursor: 'pointer', background: '#f5faff' }}
              >
                <Text strong>Cada item com a própria foto</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>As cotas e textos vão por cima da foto de cada variação ({entrada.itens.filter(i => i.foto).length} de {entrada.itens.length} têm foto; as outras usam a da família). Escolhendo uma foto abaixo, todas saem sobre ela.</Text></div>
              </div>
            )}
            {([['Da família', (galeria || []).map(f => ({ url: f.url, idFoto: f.idFoto, rotulo: f.uso === 'PRINCIPAL' ? 'principal' : f.uso === 'EDITOR' ? 'só editor' : 'comum', temModelo: f.temModelo }))],
              ['Dos itens', fotosDosItens.map(f => ({ url: f.url, idFoto: null as number | null, rotulo: f.sku, temModelo: false }))]] as const).map(([titulo, lista]) => (
              <div key={titulo}>
                <Text strong>{titulo}{titulo === 'Da família' && entrada.familia ? ` ${entrada.familia}` : ''}</Text>
                {!lista.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={titulo === 'Da família' ? 'A família ainda não tem fotos (adicione na aba Fotos)' : 'Os itens não têm foto própria'} /> : (
                  <Flex wrap gap={10} style={{ marginTop: 6 }}>
                    {lista.map(f => (
                      <div key={f.url} onClick={() => setEscolha({ url: f.url, idFotoFamilia: f.idFoto, usarModelo: usarModelo && haModelo })}
                        style={{ width: 132, padding: 6, border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>
                        <img src={f.url} alt="" style={{ width: 120, height: 120, objectFit: 'contain', background: '#fafafa', borderRadius: 4, display: 'block' }} />
                        <Space size={4} wrap style={{ marginTop: 4 }}>
                          <Tag color={f.rotulo === 'principal' ? 'purple' : undefined} style={{ margin: 0, fontSize: 11 }}>{f.rotulo}</Tag>
                          {f.temModelo && <Tooltip title="Tem cotas e textos guardados"><Tag color="blue" style={{ margin: 0, fontSize: 11 }}>cotas</Tag></Tooltip>}
                        </Space>
                      </div>
                    ))}
                  </Flex>
                )}
              </div>
            ))}
            <Upload accept="image/*" showUploadList={false} beforeUpload={f => { setEscolha({ url: URL.createObjectURL(f), idFotoFamilia: null, usarModelo: usarModelo && haModelo }); return false; }}>
              <Button icon={<UploadOutlined />}>Outra foto do computador</Button>
            </Upload>
          </Flex>
        )
      )}
      {entrada && escolha && (
        <Flex gap={16} align="flex-start" wrap>
          {/* ferramentas */}
          <Flex vertical gap={6} style={{ width: 150 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Adicionar</Text>
            {botao(<ColumnWidthOutlined />, 'Cota', 'COTA', 'Linha com setas e a medida (estique para mudar o comprimento)')}
            {botao(<ArrowRightOutlined />, 'Seta', 'SETA', 'Seta para apontar um detalhe')}
            {botao(<FontSizeOutlined />, 'Texto', 'TEXTO', 'Texto solto (duplo clique para escrever na imagem)')}
            {botao(<CommentOutlined />, 'Balão', 'BALAO', 'Balão explicativo com pontinha')}
            {botao(<BorderOutlined />, 'Destaque', 'DESTAQUE', 'Contorno para chamar atenção')}
            <Tooltip title="Seleciona a foto do produto: cortar, tirar o fundo, trocar" placement="right">
              <Button block icon={<FileImageOutlined />} disabled={!!cortando} onClick={selecionarFoto} style={{ justifyContent: 'flex-start' }}>Foto</Button>
            </Tooltip>
            <Tooltip title="Voltar à escolha da foto (o que não foi guardado se perde)" placement="right">
              <Button block icon={<SwapOutlined />} disabled={!!cortando || !!aplicando} onClick={() => setEscolha(null)} style={{ justifyContent: 'flex-start' }}>Outra foto</Button>
            </Tooltip>
            <Divider style={{ margin: '6px 0' }} />
            <Flex gap={6}>
              <Tooltip title="Desfazer (Ctrl+Z)"><Button icon={<UndoOutlined />} onClick={desfazer} disabled={!!cortando || historico.current.length < 2} /></Tooltip>
              <Tooltip title="Refazer (Ctrl+Y)"><Button icon={<RedoOutlined />} onClick={refazer} disabled={!!cortando || !refeitos.current.length} /></Tooltip>
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
              <Select style={{ width: '100%' }} value={item?.idItem} onChange={trocarItem} disabled={!!cortando} showSearch optionFilterProp="label"
                options={entrada.itens.map(i => ({ value: i.idItem, label: `${i.sku} · ${i.nome}` }))} />
            </div>
            <Flex gap={8} wrap>
              <Segmented size="small" value={unidade} onChange={v => setUnidade(v as typeof unidade)} options={[{ value: 'original', label: 'Medida como está' }, { value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }]} />
              <Tooltip title="Ligado: cada item sai com a própria foto (no mesmo lugar e tamanho). Desligado: todos com esta foto.">
                <Space size={4}><Switch size="small" checked={fotoPorItem} onChange={setFotoPorItem} /><Text style={{ fontSize: 12 }}>foto de cada item</Text></Space>
              </Tooltip>
            </Flex>

            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, background: '#fafafa' }}>
              {cortando ? (
                <Flex vertical gap={10}>
                  <Text strong><ScissorOutlined /> Cortar a foto</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>Arraste e estique o quadro azul: o que ficar dentro dele é o que sobra. Enter aplica, Esc cancela.</Text>
                  <Segmented block size="small" value={cortando} onChange={v => mudarProporcao(v as Proporcao)}
                    options={[{ value: 'LIVRE', label: 'Livre' }, { value: 'QUADRADO', label: 'Quadrado' }]} />
                  <Flex gap={6}>
                    <Button type="primary" icon={<ScissorOutlined />} onClick={aplicarCorteDoQuadro}>Aplicar corte</Button>
                    <Button onClick={encerrarCorte}>Cancelar</Button>
                  </Flex>
                </Flex>
              ) : !d ? <Text type="secondary">Clique num elemento do quadro para editar.</Text> : (
                <Flex vertical gap={10}>
                  <Text strong>{{ SETA: 'Seta', COTA: 'Cota', TEXTO: 'Texto', BALAO: 'Balão', DESTAQUE: 'Destaque', FOTO: 'Foto do produto' }[d.tipo]}</Text>
                  {temTexto && (
                    <div>
                      <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} value={d.modelo} onChange={e => mudarSelecionado({ modelo: e.target.value }, false)} onBlur={guardar} />
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
                      <Slider min={30} max={200} value={d.tamanhoFonte || (d.tipo === 'COTA' ? 90 : d.tipo === 'BALAO' ? 52 : 80)} onChange={(v: number) => mudarSelecionado({ tamanhoFonte: v }, false)} onChangeComplete={guardar} />
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
                        <Slider min={3} max={30} value={d.espessura || (d.tipo === 'COTA' ? 9 : 12)} onChange={(v: number) => mudarSelecionado({ espessura: v }, false)} onChangeComplete={guardar} />
                      </div>
                      <Space size={4}><Switch size="small" checked={!!d.tracejado} onChange={v => mudarSelecionado({ tracejado: v })} /><Text style={{ fontSize: 12 }}>tracejado</Text></Space>
                    </Flex>
                  )}
                  {d.tipo === 'FOTO' && (
                    <Flex vertical gap={6}>
                      <Select placeholder="Trocar a foto" style={{ width: '100%' }} value={undefined} onChange={(f: string) => colocarFoto(f)}
                        options={fotosDisponiveis.map((f, k) => ({ value: f, label: <Space><img src={f} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />{f === principalFamilia ? 'Foto-modelo da família' : `Foto ${k + 1}`}</Space> }))} />
                      <Upload accept="image/*" showUploadList={false} beforeUpload={f => { colocarFoto(URL.createObjectURL(f)); return false; }}>
                        <Button size="small" icon={<UploadOutlined />}>Foto do computador</Button>
                      </Upload>
                      <Flex gap={6} wrap>
                        <Tooltip title={vezesDaFoto(d) > 1 ? 'Volte a foto para ×1 para cortar à mão (ou use "cortar as sobras")' : undefined}>
                          <Button size="small" icon={<ScissorOutlined />} onClick={iniciarCorte} disabled={tratandoFoto || vezesDaFoto(d) > 1}>Cortar</Button>
                        </Tooltip>
                        {(d.corte || d.corteAuto) && <Button size="small" onClick={tirarCorte} disabled={tratandoFoto}>Foto inteira</Button>}
                        <Button size="small" icon={<ExpandOutlined />} onClick={() => acao('encaixar')}>Encaixar no quadro</Button>
                      </Flex>
                      <Tooltip title="Corta o espaço vazio em volta do produto e encaixa no quadro; com a foto de cada item, cada foto é cortada no seu produto">
                        <Space size={4}><Switch size="small" checked={!!d.corteAuto} loading={tratandoFoto} onChange={mudarCorteAuto} /><Text style={{ fontSize: 12 }}>cortar as sobras</Text></Space>
                      </Tooltip>
                      <Divider style={{ margin: '4px 0' }} />
                      <Tooltip title="Tira o fundo que encosta nas bordas da foto (funciona melhor com fundo liso); no quadro ele fica branco">
                        <Space size={4}>
                          <Switch size="small" checked={d.semFundo !== undefined} loading={tratandoFoto} onChange={v => mudarFundo(v ? tolerancia : undefined)} />
                          <Text style={{ fontSize: 12 }}><BgColorsOutlined /> tirar o fundo (fica branco)</Text>
                        </Space>
                      </Tooltip>
                      {d.semFundo !== undefined && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Quanto tirar (comeu o produto? diminua; sobrou fundo? aumente)</Text>
                          <Slider min={8} max={120} value={tolerancia} disabled={tratandoFoto} onChange={(v: number) => setTolerancia(v)} onChangeComplete={(v: number) => mudarFundo(v)} />
                        </div>
                      )}
                      <Divider style={{ margin: '4px 0' }} />
                      <Tooltip title="Repete o produto N vezes em grade, como nos anúncios de kit (copia a foto da unidade; com fundo branco não dá diferença). Salva como foto do kit c/N: no ML ela vai como 2ª foto só no anúncio do kit (a unidade continua com a foto normal). O ML recomenda, como foto principal do kit, uma foto real das N unidades juntas.">
                        <Space size={6} wrap>
                          <Text style={{ fontSize: 12 }}><AppstoreOutlined /> repetir a foto</Text>
                          <InputNumber size="small" min={1} max={48} precision={0} value={vezesDaFoto(d)} disabled={tratandoFoto}
                            onChange={v => { if (v && v !== vezesDaFoto(d)) mudarMultiplicar(Number(v)); }} style={{ width: 70 }} />
                          <Text type="secondary" style={{ fontSize: 12 }}>vezes</Text>
                        </Space>
                      </Tooltip>
                      {kitsDoAnuncio.length > 0 && (
                        <Space size={4} wrap>
                          <Text type="secondary" style={{ fontSize: 12 }}>kits do anúncio:</Text>
                          {kitsDoAnuncio.map(n => (
                            <Button key={n} size="small" type={vezesDaFoto(d) === n ? 'primary' : 'default'} disabled={tratandoFoto} onClick={() => mudarMultiplicar(n)}>×{n}</Button>
                          ))}
                          {vezesDaFoto(d) > 1 && <Button size="small" disabled={tratandoFoto} onClick={() => mudarMultiplicar(1)}>×1</Button>}
                        </Space>
                      )}
                      {vezesDaFoto(d) > 1 && (
                        <Text type="warning" style={{ fontSize: 12 }}>
                          Foto do kit c/{vezesDaFoto(d)}: vai como 2ª foto do anúncio do kit. Para a 1ª, o ML recomenda foto real das unidades juntas, sem texto nem selo.
                        </Text>
                      )}
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
                options={entrada.itens.map(i => ({ value: i.idItem, label: i.sku }))} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {destino === 'PRINCIPAL' ? 'Salva como foto principal (a atual vai para a galeria).' : 'Salva como 2ª foto, logo depois da principal.'} Salvar de novo troca a imagem anterior do editor. O modelo (cotas e textos) fica guardado na foto-modelo da família.
              </Text>
            </div>
          </Flex>
        </Flex>
      )}
    </Modal>
  );
};

export default EditorImagemModal;
