// Módulo Rolamentos: regras puras (sem banco). Lê a descrição da nota (tipo, código, vedação, folga, marca),
// sugere as medidas pelo código padrão e monta SKU/nome. 1ª linha: a marca diferencia o item (6205-2RS-SKF);
// 2ª linha: qualquer marca vira o mesmo item (6205-2RS-2L).

export type TipoRolamento = 'RIGIDO_ESFERAS' | 'INSERCAO_UC' | 'AGULHAS' | 'ROLOS_CONICOS' | 'AUTOCOMPENSADOR' | 'ROLOS_CILINDRICOS' | 'AXIAL';

export const TIPOS: Record<TipoRolamento, { familia: string; nomeCurto: string; comVedacao: boolean }> = {
  RIGIDO_ESFERAS: { familia: 'Rolamento rígido de esferas', nomeCurto: 'Rolamento', comVedacao: true },
  INSERCAO_UC: { familia: 'Rolamento de inserção (UC)', nomeCurto: 'Rolamento de inserção', comVedacao: false },
  AGULHAS: { familia: 'Rolamento de agulhas', nomeCurto: 'Rolamento de agulha', comVedacao: true },
  ROLOS_CONICOS: { familia: 'Rolamento de rolos cônicos', nomeCurto: 'Rolamento cônico', comVedacao: false },
  AUTOCOMPENSADOR: { familia: 'Rolamento autocompensador', nomeCurto: 'Rolamento autocompensador', comVedacao: false },
  ROLOS_CILINDRICOS: { familia: 'Rolamento de rolos cilíndricos', nomeCurto: 'Rolamento de rolos cilíndricos', comVedacao: false },
  AXIAL: { familia: 'Rolamento axial', nomeCurto: 'Rolamento axial', comVedacao: false },
};

export const SIGLA_SEGUNDA_LINHA = '2L';
export const VEDACOES = ['ABERTO', '2RS', 'RS', 'ZZ', 'Z'];

export interface Medidas { d: number; D: number; B: number }
export type OrigemMedidas = 'TABELA' | 'APRENDIDA' | null;

// ---------------------------------------------------------------------------------------------
// Medidas padrão (ISO) por código base: d (furo) x D (externo) x B (largura), em mm
// ---------------------------------------------------------------------------------------------
const serie = (linhas: Array<[string, number, number, number]>) =>
  Object.fromEntries(linhas.map(([c, d, D, B]) => [c, { d, D, B }])) as Record<string, Medidas>;

const S60 = serie([['6000', 10, 26, 8], ['6001', 12, 28, 8], ['6002', 15, 32, 9], ['6003', 17, 35, 10], ['6004', 20, 42, 12], ['6005', 25, 47, 12],
  ['6006', 30, 55, 13], ['6007', 35, 62, 14], ['6008', 40, 68, 15], ['6009', 45, 75, 16], ['6010', 50, 80, 16], ['6011', 55, 90, 18],
  ['6012', 60, 95, 18], ['6013', 65, 100, 18], ['6014', 70, 110, 20], ['6015', 75, 115, 20], ['6016', 80, 125, 22], ['6017', 85, 130, 22],
  ['6018', 90, 140, 24], ['6019', 95, 145, 24], ['6020', 100, 150, 24]]);
const S62 = serie([['6200', 10, 30, 9], ['6201', 12, 32, 10], ['6202', 15, 35, 11], ['6203', 17, 40, 12], ['6204', 20, 47, 14], ['6205', 25, 52, 15],
  ['6206', 30, 62, 16], ['6207', 35, 72, 17], ['6208', 40, 80, 18], ['6209', 45, 85, 19], ['6210', 50, 90, 20], ['6211', 55, 100, 21],
  ['6212', 60, 110, 22], ['6213', 65, 120, 23], ['6214', 70, 125, 24], ['6215', 75, 130, 25], ['6216', 80, 140, 26], ['6217', 85, 150, 28],
  ['6218', 90, 160, 30], ['6219', 95, 170, 32], ['6220', 100, 180, 34]]);
const S63 = serie([['6300', 10, 35, 11], ['6301', 12, 37, 12], ['6302', 15, 42, 13], ['6303', 17, 47, 14], ['6304', 20, 52, 15], ['6305', 25, 62, 17],
  ['6306', 30, 72, 19], ['6307', 35, 80, 21], ['6308', 40, 90, 23], ['6309', 45, 100, 25], ['6310', 50, 110, 27], ['6311', 55, 120, 29],
  ['6312', 60, 130, 31], ['6313', 65, 140, 33], ['6314', 70, 150, 35], ['6315', 75, 160, 37], ['6316', 80, 170, 39], ['6317', 85, 180, 41],
  ['6318', 90, 190, 43], ['6319', 95, 200, 45], ['6320', 100, 215, 47]]);
const S68 = serie([['6800', 10, 19, 5], ['6801', 12, 21, 5], ['6802', 15, 24, 5], ['6803', 17, 26, 5], ['6804', 20, 32, 7], ['6805', 25, 37, 7],
  ['6806', 30, 42, 7], ['6807', 35, 47, 7], ['6808', 40, 52, 7], ['6809', 45, 58, 7], ['6810', 50, 65, 7]]);
const S69 = serie([['6900', 10, 22, 6], ['6901', 12, 24, 6], ['6902', 15, 28, 7], ['6903', 17, 30, 7], ['6904', 20, 37, 9], ['6905', 25, 42, 9],
  ['6906', 30, 47, 9], ['6907', 35, 55, 10], ['6908', 40, 62, 12], ['6909', 45, 68, 12], ['6910', 50, 72, 12]]);
const S160 = serie([['16001', 12, 28, 7], ['16002', 15, 32, 8], ['16003', 17, 35, 8], ['16004', 20, 42, 8], ['16005', 25, 47, 8], ['16006', 30, 55, 9],
  ['16007', 35, 62, 9], ['16008', 40, 68, 9]]);
const MINIATURAS = serie([['604', 4, 12, 4], ['605', 5, 14, 5], ['606', 6, 17, 6], ['607', 7, 19, 6], ['608', 8, 22, 7], ['609', 9, 24, 7],
  ['623', 3, 10, 4], ['624', 4, 13, 5], ['625', 5, 16, 5], ['626', 6, 19, 6], ['627', 7, 22, 7], ['628', 8, 24, 8], ['629', 9, 26, 8],
  ['634', 4, 16, 5], ['635', 5, 19, 6]]);
const S22 = serie([['2200', 10, 30, 14], ['2201', 12, 32, 14], ['2202', 15, 35, 14], ['2203', 17, 40, 16], ['2204', 20, 47, 18], ['2205', 25, 52, 18],
  ['2206', 30, 62, 20], ['2207', 35, 72, 23], ['2208', 40, 80, 23], ['2209', 45, 85, 23], ['2210', 50, 90, 23]]);
const S302 = serie([['30203', 17, 40, 13.25], ['30204', 20, 47, 15.25], ['30205', 25, 52, 16.25], ['30206', 30, 62, 17.25], ['30207', 35, 72, 18.25],
  ['30208', 40, 80, 19.75], ['30209', 45, 85, 20.75], ['30210', 50, 90, 21.75], ['30211', 55, 100, 22.75], ['30212', 60, 110, 23.75]]);
const S320 = serie([['32004', 20, 42, 15], ['32005', 25, 47, 15], ['32006', 30, 55, 17], ['32007', 35, 62, 18], ['32008', 40, 68, 19],
  ['32009', 45, 75, 20], ['32010', 50, 80, 20]]);
const S511 = serie([['51100', 10, 24, 9], ['51101', 12, 26, 9], ['51102', 15, 28, 9], ['51103', 17, 30, 9], ['51104', 20, 35, 10], ['51105', 25, 42, 11],
  ['51106', 30, 47, 11], ['51107', 35, 52, 12], ['51108', 40, 60, 13], ['51109', 45, 65, 14], ['51110', 50, 70, 14]]);
// UC 2xx (inserção): D e B pelo número; o furo vem do número (métrico) ou do sufixo -NN em 1/16" (UC208-24 = 1.1/2")
const UC_DB: Record<string, [number, number]> = {
  '201': [40, 27.4], '202': [40, 27.4], '203': [40, 27.4], '204': [47, 31], '205': [52, 34.1], '206': [62, 38.1], '207': [72, 42.9],
  '208': [80, 49.2], '209': [85, 49.2], '210': [90, 51.6], '211': [100, 55.6], '212': [110, 65.1],
};
const UC_FURO: Record<string, number> = { '201': 12, '202': 15, '203': 17 };
// HK (bucha de agulhas): HK FwC -> furo Fw, largura C; diâmetro externo pela tabela do furo
const HK_D: Record<number, number> = { 6: 10, 8: 12, 10: 14, 12: 18, 14: 20, 15: 21, 16: 22, 17: 23, 18: 24, 20: 26, 22: 28, 25: 32, 28: 35, 30: 37, 35: 42, 40: 47, 45: 52, 50: 58 };

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Medidas pelo código padrão (null quando o código não está na tabela). */
export const medidasDoCodigo = (tipo: TipoRolamento | null, codigo: string): Medidas | null => {
  // Prefixo de material (SS608, W6205) não muda as medidas
  const c = codigo.toUpperCase().replace(/^(SS|W)(?=\d)/, '');
  if (tipo === 'INSERCAO_UC') {
    const m = /^UC(\d{3})(?:-(\d{1,2}))?$/.exec(c);
    if (!m || !UC_DB[m[1]]) return null;
    const [D, B] = UC_DB[m[1]];
    const d = m[2] ? r3((Number(m[2]) / 16) * 25.4) : (UC_FURO[m[1]] ?? Number(m[1].slice(1)) * 5);
    return { d, D, B };
  }
  if (tipo === 'AGULHAS') {
    const m = /^(?:HK|BK)(\d{2})(\d{2})$/.exec(c);
    if (!m || !HK_D[Number(m[1])]) return null;
    return { d: Number(m[1]), D: HK_D[Number(m[1])], B: Number(m[2]) };
  }
  if (tipo === 'ROLOS_CILINDRICOS') {
    // NU/NJ/NUP 2xx e 3xx têm as medidas da série 62/63 (mesma série de dimensões)
    const m = /^N[A-Z]{0,2}(2|3|10)(\d{2})$/.exec(c);
    if (!m) return null;
    return ({ '2': S62, '3': S63, '10': S60 } as Record<string, Record<string, Medidas>>)[m[1]][`6${m[1] === '10' ? '0' : m[1]}${m[2]}`] ?? null;
  }
  if (tipo === 'AUTOCOMPENSADOR') {
    // 12xx/13xx: medidas da série 62/63; 22xx: tabela própria
    if (/^12\d{2}$/.test(c)) return S62[`62${c.slice(2)}`] ?? null;
    if (/^13\d{2}$/.test(c)) return S63[`63${c.slice(2)}`] ?? null;
    return S22[c] ?? null;
  }
  return S60[c] ?? S62[c] ?? S63[c] ?? S68[c] ?? S69[c] ?? S160[c] ?? MINIATURAS[c] ?? S302[c] ?? S320[c] ?? S511[c] ?? null;
};

// ---------------------------------------------------------------------------------------------
// Leitura da descrição da nota
// ---------------------------------------------------------------------------------------------
export interface MarcaModulo { id: number; nome: string; codigo: string | null; linha: 1 | 2 | null; apelidos: string[] }

export type CategoriaSufixo = 'VEDACAO' | 'FOLGA' | 'CONSTRUCAO' | 'GAIOLA' | 'PRECISAO' | 'MATERIAL' | 'GRAXA' | 'COMERCIAL' | 'OUTRO';
export interface Sufixo { codigo: string; categoria: CategoriaSufixo | null; significado: string | null; provavel?: boolean }

export interface LeituraRolamento {
  ehRolamento: boolean;
  tipo: TipoRolamento | null;
  codigo: string | null;      // código usado no SKU (com prefixo de material, ex.: SS608)
  codigoCompleto: string | null; // como o fabricante escreveu (ex.: 6201-2RSR-CO7-C3#N1)
  prefixo: string | null;     // SS / W (inox)
  vedacao: string;            // ABERTO, 2RS, RS, ZZ, Z
  folga: string | null;       // C2, C3, C4, C5
  sufixos: Sufixo[];          // cada código do fabricante com o significado (null = desconhecido)
  marca: MarcaModulo | null;  // marca cadastrada reconhecida
  marcaTexto: string | null;  // palavra que parece marca, quando não é cadastrada (ex.: NTN)
}

// Dicionário dos códigos com significado conhecido (o operador completa os demais no módulo)
interface EntradaDicionario { categoria: CategoriaSufixo; significado: string; vedacao?: string; folga?: string }
const borracha = (lados: 'dois' | 'um', extra = ''): EntradaDicionario =>
  ({ categoria: 'VEDACAO', significado: `vedação de borracha ${lados === 'dois' ? 'nos dois lados' : 'em um lado'}${extra}`, vedacao: lados === 'dois' ? '2RS' : 'RS' });
const metalica = (lados: 'dois' | 'um', extra = ''): EntradaDicionario =>
  ({ categoria: 'VEDACAO', significado: `placa de proteção metálica ${lados === 'dois' ? 'nos dois lados' : 'em um lado'}${extra}`, vedacao: lados === 'dois' ? 'ZZ' : 'Z' });

export const DICIONARIO: Record<string, EntradaDicionario> = {
  '2RS': borracha('dois'), RS: borracha('um'),
  '2RS1': borracha('dois', ', de contato (SKF)'), '2RSH': borracha('dois', ', de contato (SKF)'), '2RSL': borracha('dois', ', de baixo atrito (SKF)'),
  '2RSR': borracha('dois', ' (FAG)'), '2HRS': borracha('dois', ' (FAG)'), LLU: borracha('dois', ', de contato (NTN)'), DDU: borracha('dois', ', de contato (NSK)'),
  LLB: borracha('dois', ', sem contato (NTN)'), '2RZ': borracha('dois', ', sem contato'), VV: borracha('dois', ', sem contato (NSK)'),
  ZZ: metalica('dois'), '2Z': metalica('dois', ' (SKF)'), '2ZR': metalica('dois', ' (FAG)'), Z: metalica('um'),
  C2: { categoria: 'FOLGA', significado: 'folga radial interna menor que a normal', folga: 'C2' },
  CN: { categoria: 'FOLGA', significado: 'folga radial interna normal' },
  C3: { categoria: 'FOLGA', significado: 'folga radial interna maior que a normal (calor ou ajuste apertado)', folga: 'C3' },
  C4: { categoria: 'FOLGA', significado: 'folga radial interna bem maior que a normal (maior que C3)', folga: 'C4' },
  C5: { categoria: 'FOLGA', significado: 'folga radial interna maior que C4', folga: 'C5' },
  N: { categoria: 'CONSTRUCAO', significado: 'ranhura para anel de retenção no anel externo' },
  NR: { categoria: 'CONSTRUCAO', significado: 'ranhura no anel externo com anel de retenção' },
  K: { categoria: 'CONSTRUCAO', significado: 'furo cônico' },
  M: { categoria: 'GAIOLA', significado: 'gaiola de latão' },
  TN9: { categoria: 'GAIOLA', significado: 'gaiola de poliamida (SKF)' },
  TVH: { categoria: 'GAIOLA', significado: 'gaiola de poliamida (FAG)' },
  P6: { categoria: 'PRECISAO', significado: 'precisão P6 (melhor que a normal)' },
  P5: { categoria: 'PRECISAO', significado: 'precisão P5 (alta precisão)' },
  SS: { categoria: 'MATERIAL', significado: 'aço inoxidável' },
  W: { categoria: 'MATERIAL', significado: 'aço inoxidável (SKF)' },
  NCZADO: { categoria: 'COMERCIAL', significado: 'importado e nacionalizado' },
  NACIONALIZADO: { categoria: 'COMERCIAL', significado: 'importado e nacionalizado' },
};

/** Significado de um código: dicionário do operador, depois o padrão, depois regras (variações de vedação, graxa FAG). */
export const significadoSufixo = (codigo: string, doOperador: Record<string, string> = {}): Sufixo => {
  const c = codigo.toUpperCase();
  const proprio = Object.entries(doOperador).find(([k]) => k.toUpperCase() === c);
  const padrao = DICIONARIO[c];
  if (proprio) return { codigo: c, categoria: padrao?.categoria ?? 'OUTRO', significado: proprio[1] };
  if (padrao) return { codigo: c, categoria: padrao.categoria, significado: padrao.significado };
  if (/^2?[A-Z]{0,2}RS[A-Z0-9]?$/.test(c)) return { codigo: c, ...borracha(c.startsWith('2') ? 'dois' : 'um', ` (variante do fabricante: ${c})`), provavel: true };
  if (/^L\d{3}$/.test(c)) return { codigo: c, categoria: 'GRAXA', significado: `graxa especial (código ${c} do fabricante)`, provavel: true };
  return { codigo: c, categoria: null, significado: null };
};
const vedacaoDe = (s: Sufixo) => (s.categoria === 'VEDACAO' ? (DICIONARIO[s.codigo]?.vedacao ?? (s.codigo.startsWith('2') ? '2RS' : 'RS')) : null);

const normalizar = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const escapar = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const decodificarXml = (v: string) => v.replace(/&gt;/gi, '>').replace(/&lt;/gi, '<').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&');

// Palavras que não são marca nem código
const RUIDO = new Set(['ROLAMENTO', 'ROLAMENTOS', 'ROL', 'ROLAM', 'PER', 'RIGIDO', 'ESFERAS', 'ESFERA', 'DE', 'AGULHA', 'AGULHAS', 'CONICO',
  'AXIAL', 'AUTOCOMPENSADOR', 'MANCAL', 'BUCHA', 'UNID', 'UN', 'PC', 'PCS', 'KIT', 'COM', 'SEM', 'P']);

/** Reconhece tipo e código; devolve onde o código começa (para ler o prefixo) e o texto depois dele. */
const lerCodigo = (t: string): { tipo: TipoRolamento; codigo: string; inicio: number; resto: string } | null => {
  const regras: Array<[TipoRolamento, RegExp, (m: RegExpExecArray) => string]> = [
    ['INSERCAO_UC', /\bUC\s*-?\s*(\d{3})(?:\s*-\s*(\d{1,2})(?!\d))?/, m => `UC${m[1]}${m[2] ? `-${m[2]}` : ''}`],
    ['AGULHAS', /\b(HK|BK)\s*(\d{4})(?!\d)/, m => `${m[1]}${m[2]}`],
    ['AGULHAS', /\b(NKI|NK|NA|RNA)\s*(\d{2,5}(?:\/\d{2})?)/, m => `${m[1]}${m[2]}`],
    ['ROLOS_CILINDRICOS', /\b(NUP|NU|NJ|NF|N)\s*-?\s*(\d{3,4})(?!\d)/, m => `${m[1]}${m[2]}`],
    ['AXIAL', /(?:^|[^\dA-Z])(51[1-4]\d{2})(?!\d)/, m => m[1]],
    ['ROLOS_CONICOS', /(?:^|[^\dA-Z])(3[0-3]\d{3})(?!\d)/, m => m[1]],
    ['AUTOCOMPENSADOR', /(?:^|[^\dA-Z])(2[2-4]\d{3})(?!\d)/, m => m[1]],
    ['RIGIDO_ESFERAS', /(?:^|[^\dA-Z])(160\d{2}|6[0-9]\d{2}|6\d{2})(?!\d)/, m => m[1]],
    ['AUTOCOMPENSADOR', /(?:^|[^\dA-Z])(1[23]\d{2}|2[23]\d{2})(?!\d)/, m => m[1]],
  ];
  for (const [tipo, re, codigo] of regras) {
    const m = re.exec(t);
    if (m) {
      const grupo = m[1];
      const inicio = m.index + m[0].indexOf(grupo);
      return { tipo, codigo: codigo(m), inicio, resto: t.slice(m.index + m[0].length) };
    }
  }
  return null;
};

export const lerDescricao = (descricao: string, marcas: MarcaModulo[], doOperador: Record<string, string> = {}): LeituraRolamento => {
  const t = normalizar(decodificarXml(descricao));
  // Marca: o nome ou apelido mais longo que aparece na descrição (ex.: apelido "PEER/SKF" ganha de "SKF")
  const candidatos = marcas.flatMap(m => [m.nome, ...m.apelidos].filter(Boolean).map(alias => ({ m, alias: normalizar(alias).trim() })))
    .filter(c => c.alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length);
  const achada = candidatos.find(c => new RegExp(`(^|[^A-Z0-9])${escapar(c.alias)}($|[^A-Z0-9])`).test(t));
  const semMarca = achada ? t.replace(new RegExp(`(^|[^A-Z0-9])${escapar(achada.alias)}(?=$|[^A-Z0-9])`, 'g'), '$1 ') : t;

  const cod = lerCodigo(semMarca);
  const ehRolamento = (Boolean(cod) && /\b(ROL|ROLAMENTO|ROLAMENTOS|ROLAM|MANCAL|BUCHA)\b/.test(t))
    || Boolean(cod && cod.tipo !== 'AUTOCOMPENSADOR' && cod.tipo !== 'ROLOS_CONICOS');
  if (!cod) {
    return { ehRolamento: false, tipo: null, codigo: null, codigoCompleto: null, prefixo: null, vedacao: 'ABERTO', folga: null, sufixos: [], marca: achada?.m ?? null, marcaTexto: null };
  }

  // Prefixo de material logo antes do código: "SS 608", "W6205"
  const prefixo = /(?:^|[^A-Z0-9])(SS|W)\s*-?\s*$/.exec(semMarca.slice(0, cod.inicio))?.[1] ?? null;

  // Sufixos: o pedaço colado ao código (separado por - / . #) e as palavras seguintes que forem códigos
  const sufixos: Sufixo[] = [];
  let marcaTexto: string | null = null;
  const palavras = cod.resto.trim() ? cod.resto.split(/\s+/).filter(Boolean) : [];
  const colado = /^\S/.test(cod.resto);
  palavras.forEach((palavra, i) => {
    const partes = palavra.split(/[-/.]+/).flatMap(p => p.split(/(?=#)/)).filter(Boolean);
    const lidas = partes.map(p => significadoSufixo(p, doOperador));
    const doCodigo = i === 0 && colado;
    const pareceMarca = !doCodigo && /^[A-Z][A-Z/-]{1,}$/.test(palavra) && !RUIDO.has(palavra) && lidas.every(s => !s.significado);
    if (pareceMarca) {
      if (!achada && !marcaTexto) marcaTexto = palavra.split('/')[0];
      return;
    }
    if (!doCodigo && partes.length === 1 && RUIDO.has(partes[0])) return;
    sufixos.push(...lidas.filter(s => s.codigo));
  });

  const vedacao = TIPOS[cod.tipo].comVedacao ? (sufixos.map(vedacaoDe).find(Boolean) ?? 'ABERTO') : 'ABERTO';
  const folga = sufixos.map(s => DICIONARIO[s.codigo]?.folga).find(Boolean) ?? null;
  const codigoCompleto = `${prefixo ? `${prefixo}` : ''}${cod.codigo}${palavras.length && colado ? palavras[0] : ''}`;

  return {
    ehRolamento, tipo: cod.tipo,
    codigo: `${prefixo ?? ''}${cod.codigo}`,
    codigoCompleto,
    prefixo, vedacao, folga,
    sufixos: [...(prefixo ? [significadoSufixo(prefixo, doOperador)] : []), ...sufixos],
    marca: achada?.m ?? null,
    marcaTexto,
  };
};

// ---------------------------------------------------------------------------------------------
// SKU e nome
// ---------------------------------------------------------------------------------------------
export const siglaDaMarca = (marca: { nome: string; codigo: string | null } | null) =>
  (marca?.codigo || marca?.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

/** 6205-2RS-SKF (1ª linha), 6205-2RS-C3-2L (2ª linha), UC208-24-2L, HK2220-NTN. Rolamento aberto não leva vedação. */
export const montarSku = (p: { codigo: string; vedacao: string; folga: string | null; linha: 1 | 2; marca: { nome: string; codigo: string | null } | null }) =>
  [p.codigo.toUpperCase(), p.vedacao && p.vedacao !== 'ABERTO' ? p.vedacao : null, p.folga, p.linha === 2 ? SIGLA_SEGUNDA_LINHA : siglaDaMarca(p.marca) || null]
    .filter(Boolean).join('-');

const mmNome = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

/** ROLAMENTO 6205-2RS/C3 | 25 mm × 52 mm × 15 mm | SKF — 2ª linha termina em "2ª LINHA"; sem medidas, a parte do meio sai. */
export const montarNome = (p: {
  codigo: string; vedacao: string; folga: string | null; linha: 1 | 2; marca: { nome: string } | null;
  medidas?: { d: number | null; D: number | null; B: number | null } | null;
}) => {
  const codigo = `${p.codigo.trim().toUpperCase()}${p.vedacao && p.vedacao !== 'ABERTO' ? `-${p.vedacao}` : ''}${p.folga ? `/${p.folga}` : ''}`;
  const m = p.medidas;
  const medidas = m && m.d && m.D && m.B ? `${mmNome(m.d)} mm × ${mmNome(m.D)} mm × ${mmNome(m.B)} mm` : null;
  const marca = p.linha === 2 ? '2ª LINHA' : (p.marca?.nome || '').toUpperCase() || null;
  return [`ROLAMENTO ${codigo}`, medidas, marca].filter(Boolean).join(' | ');
};
