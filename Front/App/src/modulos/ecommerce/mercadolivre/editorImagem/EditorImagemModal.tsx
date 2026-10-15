// Editor de imagem simplificado: a foto do produto num quadro 1200×1200 e, por cima, setas, cotas com medida, textos,
// balões e destaques que se movem, giram e esticam. O texto aceita {Campo} (ex.: {Comprimento}); o mesmo modelo é
// aplicado em todos os itens do anúncio, cada um com a sua medida e a sua foto, e salvo no cadastro do ERP.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Divider, Flex, Input, Modal, Progress, Segmented, Select, Slider, Space, Switch, Tag, Tooltip, Typography, Upload, message } from 'antd';
import {
  ArrowRightOutlined, BgColorsOutlined, BorderOutlined, ColumnWidthOutlined, CommentOutlined, CopyOutlined, DeleteOutlined, DownloadOutlined,
  ExpandOutlined, FileImageOutlined, FontSizeOutlined, PictureOutlined, RedoOutlined, SaveOutlined, ScissorOutlined, UndoOutlined, UploadOutlined,
  VerticalAlignBottomOutlined, VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { Canvas, FabricImage, FabricObject, IText, Point, Rect, StaticCanvas, util } from 'fabric';
import { enviarArquivoAnexo } from '../../../../areas/catalogo/skus/CatalogSku.service';
import { fotosFamiliaApi } from '../../../../areas/catalogo/familias/FamilyManager.api';
import type { AnuncioDetalhe, ItemDoAnuncio } from '../mercadoLivreApi';
import { camposDoItem, converterMedidas, fotoBaseDoItem, modeloPadrao, textoDoModelo } from '../etiquetaFoto';
import { enderecoParaDesenho } from '../desenhoEtiqueta';
import {
  aplicarCorte, criarElemento, dadosDe, DadosElemento, encaixarFoto, LadoTexto, montarFoto, origemDaFoto, parametrosAposEsticar, Pontas,
  precisaRedesenharAoGirar, PROPRIEDADES, recriarElemento, refazerFotosTratadas, soltarFotosTratadas, TipoElemento,
} from './elementos';
import { CORTE_INTEIRO, corteDoQuadro } from './fotoPixels';
import { limparModelo } from './modeloSalvo';

const { Text } = Typography;
const LADO = 1200;
const TELA = 600;
const CORES = ['#731717', '#111111', '#d4380d', '#1554c0', '#15803d', '#ffffff'];
const chaveModelo = (id: number) => `ml-editor-imagem-${id}`;
const TOLERANCIA_PADRAO = 40;
type Proporcao = 'LIVRE' | 'QUADRADO';

interface Props { det: AnuncioDetalhe | null; onFechar: () => void; onSalvo: () => void }

const EditorImagemModal: React.FC<Props> = ({ det, onFechar, onSalvo }) => {
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
  const [fotoPorItem, setFotoPorItem] = useState(true);
  const [aplicando, setAplicando] = useState<{ feitos: number; total: number } | null>(null);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [corAtual, setCorAtual] = useState(CORES[0]);
  // a regra do ML pede a foto principal sem textos: o padrão é a 2ª foto
  const [destino, setDestino] = useState<'SEGUNDA' | 'PRINCIPAL'>('SEGUNDA');
  const [cortando, setCortando] = useState<Proporcao | null>(null);
  const quadroCorte = useRef<Rect | null>(null);
  const [tratandoFoto, setTratandoFoto] = useState(false);
  const [tolerancia, setTolerancia] = useState(TOLERANCIA_PADRAO);

  const item = useMemo(() => det?.itens.find(i => i.idItem === idItem) || det?.itens[0] || null, [det, idItem]);
  const campos = useMemo(() => (det && item ? camposDoItem(det, item) : []), [det, item]);
  const textoPara = useCallback((modelo: string | undefined, it: ItemDoAnuncio | null) =>
    (det && it ? converterMedidas(textoDoModelo(modelo || '', camposDoItem(det, it)), unidade) : modelo || ''), [det, unidade]);

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

  // ---------------------------------------------------------------- abrir / fechar
  // os eventos do quadro são ligados uma vez; leem a unidade atual por aqui
  const textoParaAtual = useRef(textoPara);
  textoParaAtual.current = textoPara;
  useEffect(() => {
    if (!det) return;
    const primeiro = det.itens.find(i => fotoBaseDoItem(i)) || det.itens[0];
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
      const foto = (primeiro && fotoBaseDoItem(primeiro)) || det.fotoFamilia;
      // o modelo guardado na foto-modelo da família manda; sem ele, o último deste anúncio neste navegador
      let salvo = (() => { try { return localStorage.getItem(chaveModelo(det.id)); } catch { return null; } })();
      let daFamilia = false;
      fotoModelo.current = null;
      if (det.idFamilia) {
        try {
          const { fotos } = await fotosFamiliaApi.listar(det.idFamilia);
          if (!vivo) return;
          const modelo = fotos[0];
          if (modelo) fotoModelo.current = { idFamilia: det.idFamilia, idFoto: modelo.idFoto };
          if (modelo?.temModelo) {
            const m = (await fotosFamiliaApi.lerModelo(det.idFamilia, modelo.idFoto)).modelo;
            if (!vivo) return;
            if (m) { salvo = m; daFamilia = true; }
          }
        } catch { /* sem a galeria da família: vale o do navegador */ }
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
          const onde = daFamilia ? `o modelo da família ${det.familia || ''}`.trim() : 'o último modelo deste anúncio';
          message.info(limpo.repetidos
            ? `Abri ${onde} e tirei ${limpo.repetidos} elemento(s) repetido(s).`
            : `Abri ${onde}. "Começar do zero" limpa o quadro.`);
        } catch {
          if (!vivo) return;
          c.clear();
          c.backgroundColor = '#ffffff';
          message.warning('Não consegui abrir o modelo guardado deste anúncio; comecei um novo.');
        }
      }
      if (!abriuSalvo) {
        if (foto) await colocarFoto(foto);
        if (!vivo) return;
        // começa com uma cota da medida do anúncio, embaixo
        const d: DadosElemento = { tipo: 'COTA', cor: CORES[0], modelo: modeloPadrao(det) || '{Comprimento}', comprimento: 800, textoDePe: true, ladoTexto: 'ACIMA' };
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
    // só reabre ao trocar de anúncio: depois de salvar o anúncio recarrega e o quadro continua como está
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [det?.id]);

  const itemAtual = useRef<ItemDoAnuncio | null>(null);
  useEffect(() => { itemAtual.current = item; }, [item]);
  // a tolerância do controle acompanha a da foto selecionada
  useEffect(() => { const t = dadosDe(selecionado)?.semFundo; if (t !== undefined) setTolerancia(t); }, [selecionado]);

  // trocou o item da prévia ou a unidade: textos e (se for por item) a foto
  const trocarItem = async (id: number) => {
    setIdItem(id);
    const it = det?.itens.find(i => i.idItem === id) || null;
    itemAtual.current = it;
    if (fotoPorItem && it) { const f = fotoBaseDoItem(it) || det?.fotoFamilia; if (f) await colocarFoto(f); }
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
    if (!det) return;
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
    try { localStorage.setItem(chaveModelo(det!.id), modelo); } catch { /* sem armazenamento */ }
    if (!fotoModelo.current) {
      if (avisar) message.success('Modelo guardado neste navegador. Com uma foto na galeria da família, ele passa a valer em qualquer anúncio.');
      return;
    }
    try {
      await fotosFamiliaApi.salvarModelo(fotoModelo.current.idFamilia, fotoModelo.current.idFoto, modelo);
      if (avisar) message.success(`Modelo guardado na família${det!.familia ? ` ${det!.familia}` : ''}: abre assim em qualquer anúncio dela.`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Não foi possível guardar o modelo na família.');
    }
  };
  const salvarModelo = () => guardarNaFamilia(modeloAtual(), true);
  const comecarDoZero = async () => {
    // só o quadro: o modelo guardado na família continua até você guardar outro
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
        const f = fotoPorItem ? fotoBaseDoItem(it) || det!.fotoFamilia : null;
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
  const salvarEm = async (itens: ItemDoAnuncio[], comoPrincipal: boolean) => {
    if (!det || !itens.length) return;
    const modelo = modeloAtual();
    await guardarNaFamilia(modelo, false);
    setAplicando({ feitos: 0, total: itens.length });
    const falhas: string[] = [];
    for (const [k, it] of itens.entries()) {
      try {
        const dataUrl = await gerarParaItem(modelo, it);
        const blob = await (await fetch(dataUrl)).blob();
        const nome = `${it.sku}-editada.jpg`.replace(/[^\w.-]+/g, '-');
        await enviarArquivoAnexo(it.idItem, new File([blob], nome, { type: 'image/jpeg' }), comoPrincipal ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA',
          { substituir: true, posicao: comoPrincipal ? undefined : 2 });
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

  const fotosDisponiveis = useMemo(() => [...new Set([det?.fotoFamilia, ...(det?.itens || []).map(fotoBaseDoItem)].filter((f): f is string => !!f))], [det]);
  const temTexto = d && d.modelo !== undefined;
  const botao = (icone: React.ReactNode, rotulo: string, tipo: TipoElemento, dica: string) => (
    <Tooltip title={dica} placement="right"><Button block icon={icone} disabled={!!cortando} onClick={() => adicionar(tipo)} style={{ justifyContent: 'flex-start' }}>{rotulo}</Button></Tooltip>
  );

  return (
    <Modal
      open={!!det} onCancel={aplicando ? undefined : onFechar} width="min(1280px, 98vw)" style={{ top: 12 }} destroyOnHidden maskClosable={false} keyboard={false}
      title={<Space><PictureOutlined />Editor de imagem</Space>}
      footer={(
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
              onClick={() => det && salvarEm(det.itens.filter(i => marcados.includes(i.idItem)), destino === 'PRINCIPAL')}>
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
            <Tooltip title="Seleciona a foto do produto: cortar, tirar o fundo, trocar" placement="right">
              <Button block icon={<FileImageOutlined />} disabled={!!cortando} onClick={selecionarFoto} style={{ justifyContent: 'flex-start' }}>Foto</Button>
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
                options={det.itens.map(i => ({ value: i.idItem, label: `${i.sku} · ${i.tituloMl || i.nome}` }))} />
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
                        options={fotosDisponiveis.map((f, k) => ({ value: f, label: <Space><img src={f} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />{f === det.fotoFamilia ? 'Foto da família' : `Foto ${k + 1}`}</Space> }))} />
                      <Upload accept="image/*" showUploadList={false} beforeUpload={f => { colocarFoto(URL.createObjectURL(f)); return false; }}>
                        <Button size="small" icon={<UploadOutlined />}>Foto do computador</Button>
                      </Upload>
                      <Flex gap={6} wrap>
                        <Button size="small" icon={<ScissorOutlined />} onClick={iniciarCorte} disabled={tratandoFoto}>Cortar</Button>
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
