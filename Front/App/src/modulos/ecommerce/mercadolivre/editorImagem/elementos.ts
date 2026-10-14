// Elementos do editor de imagem (Fabric.js): seta, cota com medida, texto, balão explicativo e destaque. Cada um guarda os
// próprios parâmetros (dadosElemento) e é recriado a partir deles: esticar a cota aumenta o comprimento sem deformar o
// texto, o texto da cota pode ficar sempre de pé (com a cota em qualquer ângulo) e o mesmo modelo serve para todos os
// itens (o texto tem {Campo} trocado pela medida de cada item).
import { Ellipse, FabricImage, FabricObject, FabricText, Group, IText, Path, Rect, Textbox } from 'fabric';

export type TipoElemento = 'SETA' | 'COTA' | 'TEXTO' | 'BALAO' | 'DESTAQUE' | 'FOTO';
export type LadoTexto = 'ACIMA' | 'SOBRE' | 'ABAIXO';
export type Pontas = 'FIM' | 'AMBAS' | 'NENHUMA';
export interface DadosElemento {
  tipo: TipoElemento;
  cor: string;
  modelo?: string;          // texto com {Campo}
  comprimento?: number;     // seta e cota
  largura?: number;         // balão e destaque
  altura?: number;          // destaque
  tamanhoFonte?: number;
  fundoTexto?: boolean;     // texto solto com fundo branco
  espessura?: number;       // traço de seta, cota e destaque
  tracejado?: boolean;
  pontas?: Pontas;          // seta
  ladoTexto?: LadoTexto;    // cota
  textoDePe?: boolean;      // cota: o texto fica na horizontal com a cota em qualquer ângulo
  textoVirado?: boolean;    // cota: texto girado 180°
  semExtremidades?: boolean; // cota sem os traços das pontas
  forma?: 'ELIPSE' | 'RETANGULO'; // destaque
}

/** Propriedades próprias que vão junto quando o modelo é salvo. */
export const PROPRIEDADES = ['dadosElemento', 'papel'];

const FONTE = 'Arial, Helvetica, sans-serif';
export const dadosDe = (o: FabricObject | undefined | null): DadosElemento | null => (o ? ((o as any).dadosElemento as DadosElemento) || null : null);
const marcar = <T extends FabricObject>(o: T, papel: string) => { (o as any).papel = papel; return o; };
const traco = (d: DadosElemento, padrao: number) => {
  const e = d.espessura || padrao;
  return { stroke: d.cor, strokeWidth: e, fill: '', strokeLineCap: 'round' as const, strokeDashArray: d.tracejado ? [e * 2.2, e * 1.6] : undefined };
};

/**
 * Posição do texto da cota (no sistema da cota, com a linha de 0 a L no eixo x): o centro do texto fica afastado da linha
 * pela metade da altura que ele ocupa naquela direção, então não encosta na linha em nenhum ângulo.
 */
const posicaoTextoCota = (L: number, largura: number, altura: number, anguloTexto: number, lado: LadoTexto, folga: number) => {
  if (lado === 'SOBRE') return { x: L / 2, y: 0 };
  const rad = (anguloTexto * Math.PI) / 180;
  const meiaAltura = Math.abs((largura / 2) * Math.sin(rad)) + Math.abs((altura / 2) * Math.cos(rad));
  const dist = folga + meiaAltura;
  return { x: L / 2, y: lado === 'ACIMA' ? -dist : dist };
};

/** Cria o elemento a partir dos parâmetros, com o texto já trocado (`texto`). `anguloGrupo` mantém o texto da cota de pé. */
export const criarElemento = (d: DadosElemento, texto: string, anguloGrupo = 0): FabricObject => {
  let o: FabricObject;
  if (d.tipo === 'SETA') {
    const L = d.comprimento || 300;
    const pontas = d.pontas || 'FIM';
    const e = d.espessura || 12;
    const cab = Math.max(40, e * 4.5);
    const ini = pontas === 'AMBAS' ? cab * 0.8 : 0;
    const fim = pontas === 'NENHUMA' ? L : L - cab * 0.8;
    const partes: FabricObject[] = [marcar(new Path(`M ${ini} 0 L ${fim} 0`, traco(d, 12)), 'traco')];
    if (pontas !== 'NENHUMA') partes.push(marcar(new Path(`M ${L - cab} ${-cab * 0.55} L ${L} 0 L ${L - cab} ${cab * 0.55} Z`, { fill: d.cor }), 'ponta'));
    if (pontas === 'AMBAS') partes.push(marcar(new Path(`M ${cab} ${-cab * 0.55} L 0 0 L ${cab} ${cab * 0.55} Z`, { fill: d.cor }), 'ponta'));
    o = new Group(partes);
  } else if (d.tipo === 'COTA') {
    const L = d.comprimento || 600;
    const e = d.espessura || 9;
    const cab = Math.max(40, e * 5);
    const lado = d.ladoTexto || 'ACIMA';
    const anguloTexto = (d.textoDePe ? -anguloGrupo : 0) + (d.textoVirado ? 180 : 0);
    const rotulo = marcar(new FabricText(texto || ' ', {
      fontFamily: FONTE, fontWeight: '800', fontSize: d.tamanhoFonte || 90, fill: d.cor, backgroundColor: '#ffffff', padding: 6,
      originX: 'center', originY: 'center', angle: anguloTexto,
    }), 'texto');
    const pos = posicaoTextoCota(L, rotulo.width || 0, rotulo.height || 0, anguloTexto, lado, 22 + e);
    rotulo.set({ left: pos.x, top: pos.y });
    const extremidades = d.semExtremidades ? '' : ` M 0 ${-cab} L 0 ${cab} M ${L} ${-cab} L ${L} ${cab}`;
    o = new Group([
      marcar(new Path(`M ${cab * 0.6} 0 L ${L - cab * 0.6} 0${extremidades}`, traco(d, 9)), 'traco'),
      marcar(new Path(`M 2 0 L ${cab} ${-cab * 0.55} L ${cab} ${cab * 0.55} Z`, { fill: d.cor }), 'ponta'),
      marcar(new Path(`M ${L - 2} 0 L ${L - cab} ${-cab * 0.55} L ${L - cab} ${cab * 0.55} Z`, { fill: d.cor }), 'ponta'),
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
    const estilo = { ...traco(d, 12), strokeUniform: true };
    o = marcar(d.forma === 'RETANGULO'
      ? new Rect({ width: d.largura || 300, height: d.altura || 200, rx: 18, ry: 18, ...estilo })
      : new Ellipse({ rx: (d.largura || 300) / 2, ry: (d.altura || 200) / 2, ...estilo }), 'traco');
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
  const novo = criarElemento(d, texto, antigo.angle || 0);
  novo.set({ angle: antigo.angle, scaleX: antigo.scaleY, scaleY: antigo.scaleY, flipX: antigo.flipX, flipY: antigo.flipY });
  novo.setPositionByOrigin(antigo.getCenterPoint(), 'center', 'center');
  return novo;
};

/** A cota com texto de pé precisa ser redesenhada quando gira (o texto compensa o giro). */
export const precisaRedesenharAoGirar = (o: FabricObject) => {
  const d = dadosDe(o);
  return !!d && d.tipo === 'COTA' && !!d.textoDePe;
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
