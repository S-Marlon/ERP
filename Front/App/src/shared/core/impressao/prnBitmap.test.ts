import { bitmapParaGw, cabecalhoPrn, larguraImpressao, montarPrnBitmap, PERFIL_PADRAO } from './prnBitmap';

const ok = (cond: unknown, msg: string) => { if (!cond) throw new Error(`prnBitmap: ${msg}`); };

// Imagem 10 x 2: primeira linha com os 3 primeiros pontos pretos; segunda toda branca
const px = (preto: boolean) => (preto ? [0, 0, 0, 255] : [255, 255, 255, 255]);
const rgba = [
  ...Array.from({ length: 10 }, (_, x) => px(x < 3)).flat(),
  ...Array.from({ length: 10 }, () => px(false)).flat(),
];
const g = bitmapParaGw(rgba, 10, 2, { limiar: 128, inverter: false });
ok(g.bytesLinha === 2 && g.dados.length === 4, '10 pontos = 2 bytes por linha');
ok(g.dados[0] === 0b00011111, 'preto = bit 0 (imprime), branco = bit 1');
ok(g.dados[1] === 0xff && g.dados[2] === 0xff && g.dados[3] === 0xff, 'branco e sobra do byte não imprimem');
ok(bitmapParaGw(rgba, 10, 2, { limiar: 128, inverter: true }).dados[0] === 0b11100000, 'inverter troca preto e branco');
ok(bitmapParaGw([128, 128, 128, 255], 1, 1, { limiar: 150, inverter: false }).dados[0] === 0b01111111, 'cinza abaixo do limiar vira preto');
ok(bitmapParaGw([0, 0, 0, 0], 1, 1, { limiar: 150, inverter: false }).dados[0] === 0xff, 'transparente é branco');
console.log('bitmap: ok');

// Largura: 105 mm passa da cabeça (104 mm) → 832 pontos; 60 mm → 480
ok(larguraImpressao(PERFIL_PADRAO['105x27']) === 832, 'etiqueta mais larga que a cabeça');
ok(larguraImpressao(PERFIL_PADRAO['60x40']) === 480, 'largura do 60x40 (antes saía 819 e deslocava)');
const cab = cabecalhoPrn(PERFIL_PADRAO['105x27']);
ok(cab.includes('q832') && cab.includes('Q216,24') && cab.includes('D10') && cab.includes('ZB'), 'cabeçalho: largura, altura+espaço, escurecimento, giro');
ok(cabecalhoPrn({ ...PERFIL_PADRAO['60x40'], girar180: false, escurecimento: 30 }).includes('ZT') , 'sem giro: ZT');
ok(cabecalhoPrn({ ...PERFIL_PADRAO['60x40'], escurecimento: 30 }).includes('D15'), 'escurecimento limitado a 15');
console.log('cabeçalho: ok');

// Arquivo: GW com a imagem, cópias no P, binário logo depois do cabeçalho do GW
const arq = montarPrnBitmap([{ rgba, largura: 10, altura: 2, copias: 3 }], { ...PERFIL_PADRAO['105x27'], limiar: 128 });
const texto = Array.from(arq).map(b => String.fromCharCode(b)).join('');
const ini = texto.indexOf('GW0,0,2,2,') + 'GW0,0,2,2,'.length;
ok(ini > 10 && arq[ini] === 0b00011111 && arq[ini + 3] === 0xff, 'dados da imagem logo após o GW');
ok(texto.slice(ini + 4).startsWith('\nP3\n'), 'cópias pelo P');
ok(texto.startsWith('\nI8,1,001\nq832'), 'começa pelo cabeçalho');
console.log('arquivo: ok');
