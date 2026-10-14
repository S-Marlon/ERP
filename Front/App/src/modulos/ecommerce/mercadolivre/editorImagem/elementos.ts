// Elementos do editor de imagem (Fabric.js): seta, cota com medida, texto, balão explicativo e destaque. Cada um guarda os
// próprios parâmetros (dadosElemento) e é recriado a partir deles: esticar a cota aumenta o comprimento sem deformar o
// texto, e o mesmo modelo serve para todos os itens (o texto tem {Campo} trocado pela medida de cada item).
import { Ellipse, FabricImage, FabricObject, FabricText, Group, IText, Path, Rect, Textbox } from 'fabric';

export type TipoElemento = 'SETA' | 'COTA' | 'TEXTO' | 'BALAO' | 'DESTAQUE' | 'FOTO';
export interface DadosElemento {
  tipo: TipoElemento;
  cor: string;
  modelo?: string;          // texto com {Campo}
  comprimento?: number;     // seta e cota
  largura?: number;         // balão e destaque
  altura?: number;          // destaque
  tamanhoFonte?: number;
  fundoTexto?: boolean;     // texto solto com fundo branco
}

/** Propriedades próprias que vão junto quando o modelo é salvo. */
export const PROPRIEDADES = ['dadosElemento', 'papel'];

const FONTE = 'Arial, Helvetica, sans-serif';
export const dadosDe = (o: FabricObject | undefined | null): DadosElemento | null => (o ? ((o as any).dadosElemento as DadosElemento) || null : null);
const marcar = <T extends FabricObject>(o: T, papel: string) => { (o as any).papel = papel; return o; };

/** Cria o elemento a partir dos parâmetros, com o texto já trocado (`texto`). */
export const criarElemento = (d: DadosElemento, texto: string): FabricObject => {
  let o: FabricObject;
  if (d.tipo === 'SETA') {
    const L = d.comprimento || 300;
    o = new Group([
      marcar(new Path(`M 0 0 L ${L - 40} 0`, { stroke: d.cor, strokeWidth: 12, fill: '', strokeLineCap: 'round' }), 'traco'),
      marcar(new Path(`M ${L - 55} -30 L ${L} 0 L ${L - 55} 30 Z`, { fill: d.cor }), 'ponta'),
    ]);
  } else if (d.tipo === 'COTA') {
    const L = d.comprimento || 600;
    const fonte = d.tamanhoFonte || 90;
    const rotulo = marcar(new FabricText(texto || ' ', {
      fontFamily: FONTE, fontWeight: '800', fontSize: fonte, fill: d.cor, backgroundColor: '#ffffff',
      originX: 'center', originY: 'bottom', left: L / 2, top: -26,
    }), 'texto');
    o = new Group([
      marcar(new Path(`M 6 0 L ${L - 6} 0 M 0 -42 L 0 42 M ${L} -42 L ${L} 42`, { stroke: d.cor, strokeWidth: 9, fill: '', strokeLineCap: 'round' }), 'traco'),
      marcar(new Path(`M 4 0 L 50 -24 L 50 24 Z`, { fill: d.cor }), 'ponta'),
      marcar(new Path(`M ${L - 4} 0 L ${L - 50} -24 L ${L - 50} 24 Z`, { fill: d.cor }), 'ponta'),
      rotulo,
    ]);
  } else if (d.tipo === 'BALAO') {
    const W = d.largura || 440;
    const caixa = marcar(new Textbox(texto || ' ', {
      fontFamily: FONTE, fontWeight: '700', fontSize: d.tamanhoFonte || 52, fill: '#ffffff', textAlign: 'center', width: W - 60, left: 30, top: 24,
    }), 'texto');
    const H = (caixa.height || 60) + 48;
    o = new Group([
      marcar(new Rect({ left: 0, top: 0, width: W, height: H, rx: 30, ry: 30, fill: d.cor }), 'fundo'),
      marcar(new Path(`M 70 ${H - 2} L 40 ${H + 70} L 150 ${H - 2} Z`, { fill: d.cor }), 'fundo'),
      caixa,
    ]);
  } else if (d.tipo === 'DESTAQUE') {
    o = marcar(new Ellipse({ rx: (d.largura || 300) / 2, ry: (d.altura || 200) / 2, fill: '', stroke: d.cor, strokeWidth: 12, strokeUniform: true }), 'traco');
  } else {
    // texto solto: editável direto na imagem (duplo clique)
    o = new IText(texto || 'Texto', {
      fontFamily: FONTE, fontWeight: '800', fontSize: d.tamanhoFonte || 80, fill: d.cor,
      backgroundColor: d.fundoTexto ? '#ffffff' : '', padding: 10,
    });
  }
  (o as any).dadosElemento = d;
  o.set({ cornerColor: '#1677ff', cornerStyle: 'circle', borderColor: '#1677ff', transparentCorners: false, cornerSize: 16 });
  return o;
};

/** Recria o elemento com novos parâmetros mantendo posição, giro e altura (o comprimento vem do esticar). */
export const recriarElemento = (antigo: FabricObject, d: DadosElemento, texto: string) => {
  const novo = criarElemento(d, texto);
  novo.set({ angle: antigo.angle, scaleX: antigo.scaleY, scaleY: antigo.scaleY, flipX: antigo.flipX, flipY: antigo.flipY });
  novo.setPositionByOrigin(antigo.getCenterPoint(), 'center', 'center');
  return novo;
};

/**
 * Depois de esticar: seta, cota, balão e destaque viram parâmetros (comprimento/largura) e a escala volta a ser a mesma
 * nos dois eixos; assim o texto não deforma. Devolve os parâmetros novos (ou null se nada mudou).
 */
export const parametrosAposEsticar = (o: FabricObject): DadosElemento | null => {
  const d = dadosDe(o);
  if (!d || d.tipo === 'TEXTO' || d.tipo === 'FOTO') return null;
  const sx = o.scaleX || 1;
  const sy = o.scaleY || 1;
  if (Math.abs(sx - sy) < 0.01) return null;
  const fator = sx / sy;
  if (d.tipo === 'SETA' || d.tipo === 'COTA') return { ...d, comprimento: Math.max(80, Math.round((d.comprimento || (d.tipo === 'COTA' ? 600 : 300)) * fator)) };
  if (d.tipo === 'BALAO') return { ...d, largura: Math.max(200, Math.round((d.largura || 440) * fator)) };
  return { ...d, largura: Math.max(60, Math.round((d.largura || 300) * fator)) };
};

/** Foto do produto ocupando o quadro (com margem), centrada. */
export const encaixarFoto = (img: FabricImage, lado: number, margem = 60) => {
  const escala = Math.min((lado - 2 * margem) / (img.width || 1), (lado - 2 * margem) / (img.height || 1));
  img.set({ scaleX: escala, scaleY: escala, originX: 'center', originY: 'center', left: lado / 2, top: lado / 2 });
  (img as any).dadosElemento = { tipo: 'FOTO', cor: '' } as DadosElemento;
  img.set({ cornerColor: '#1677ff', cornerStyle: 'circle', borderColor: '#1677ff', transparentCorners: false, cornerSize: 16 });
  return img;
};

/** Troca a imagem da foto mantendo o lugar e o tamanho (a nova cabe na mesma caixa). */
export const trocarImagemDaFoto = async (foto: FabricImage, url: string) => {
  const largura = (foto.width || 1) * (foto.scaleX || 1);
  const altura = (foto.height || 1) * (foto.scaleY || 1);
  const centro = foto.getCenterPoint();
  await foto.setSrc(url, { crossOrigin: 'anonymous' });
  const escala = Math.min(largura / (foto.width || 1), altura / (foto.height || 1));
  foto.set({ scaleX: escala, scaleY: escala });
  foto.setPositionByOrigin(centro, 'center', 'center');
  foto.setCoords();
};
