// Estrutura (perfil construtivo) do poço: perfuração por diâmetro, revestimentos (o de fora, o interno de complemento,
// filtro e tubo de boca), perfil geológico e o que ficou sem revestimento (parede na rocha). Daqui saem o resumo em
// texto ("48 a 120 m: parede em rocha sã, sem revestimento") e o desenho do perfil (SVG) para a tela, a impressão e a
// ficha do poço. Puro, com teste.

export type Dados = Record<string, any>;

export const TIPOS_REVESTIMENTO: Array<{ valor: string; rotulo: string; curto: string }> = [
  { valor: 'EXTERNO', rotulo: 'Revestimento', curto: 'Revestimento' },
  { valor: 'INTERNO', rotulo: 'Revestimento interno (complemento)', curto: 'Rev. interno' },
  { valor: 'FILTRO', rotulo: 'Filtro (tubo ranhurado)', curto: 'Filtro' },
  { valor: 'BOCA', rotulo: 'Tubo de boca / proteção sanitária', curto: 'Tubo de boca' },
];
export const tipoRevestimento = (v: unknown) => TIPOS_REVESTIMENTO.find(t => t.valor === v) || TIPOS_REVESTIMENTO[0];

/** Camadas do perfil geológico (cor para o desenho). */
export const CAMADAS_GEOLOGICAS: Array<{ valor: string; cor: string }> = [
  { valor: 'Solo / aterro', cor: '#c8a27a' },
  { valor: 'Argila', cor: '#d9b38c' },
  { valor: 'Areia', cor: '#f0dc9a' },
  { valor: 'Silte (caxeta)', cor: '#cdbf9e' },
  { valor: 'Rocha alterada', cor: '#b8a89a' },
  { valor: 'Rocha sã', cor: '#8c8c8c' },
  { valor: "Fratura com água", cor: '#69b1ff' },
];
const corDaCamada = (v: unknown) => CAMADAS_GEOLOGICAS.find(c => c.valor === v)?.cor || '#d9d9d9';

const num = (v: unknown) => { const x = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Diâmetro em polegadas (o relatório aceita " ou mm). */
export const emPolegadas = (diam: unknown, unidade: unknown) => (unidade === 'mm' ? num(diam) / 25.4 : num(diam));
const textoDiametro = (diam: unknown, unidade: unknown) => (num(diam) ? `${fmt(num(diam))}${unidade === 'mm' ? ' mm' : '"'}` : '');

export interface Trecho { de: number; ate: number }
export interface Revestimento extends Trecho { tipo: string; diametro: number; texto: string; material: string; obs: string; origem?: string }
export interface Perfuracao extends Trecho { diametro: number; texto: string }
export interface Camada extends Trecho { tipo: string; obs: string }

export const perfuracoesDe = (d: Dados): Perfuracao[] => (d.perfuracoes || [])
  .filter((p: Dados) => num(p?.perfAte) > num(p?.perfDe))
  .map((p: Dados) => ({ de: num(p.perfDe), ate: num(p.perfAte), diametro: emPolegadas(p.perfDiam, p.perfDiamUnidade), texto: textoDiametro(p.perfDiam, p.perfDiamUnidade) }));

export const revestimentosDe = (d: Dados): Revestimento[] => (d.revestimentos || [])
  .filter((r: Dados) => num(r?.revAte) > num(r?.revDe))
  .map((r: Dados) => ({
    de: num(r.revDe), ate: num(r.revAte), tipo: tipoRevestimento(r.revTipo).valor, diametro: emPolegadas(r.revDiam, r.revDiamUnidade),
    texto: textoDiametro(r.revDiam, r.revDiamUnidade), material: String(r.revMaterial || '').trim(), obs: String(r.revObs || '').trim(), origem: r.origem,
  }));

export const camadasDe = (d: Dados): Camada[] => (d.perfilGeologico || [])
  .filter((c: Dados) => num(c?.geoAte) > num(c?.geoDe) && c?.geoTipo)
  .map((c: Dados) => ({ de: num(c.geoDe), ate: num(c.geoAte), tipo: String(c.geoTipo), obs: String(c.geoObs || '').trim() }));

/** Fundo do poço: a profundidade informada ou o fim da perfuração. */
export const fundoDoPoco = (d: Dados) => Math.max(num(d.profundidade), ...perfuracoesDe(d).map(p => p.ate), 0);

/** Trechos perfurados sem nenhum revestimento (parede direto na formação). */
export const trechosSemRevestimento = (d: Dados): Trecho[] => {
  // revestimento não informado (só o cadastro do poço): não dá para dizer que é parede na rocha
  if (d.revestimentoDesconhecido) return [];
  const fundo = Math.max(...perfuracoesDe(d).map(p => p.ate), 0) || num(d.profundidade);
  if (!fundo) return [];
  const cobertos = revestimentosDe(d).map(r => ({ de: r.de, ate: Math.min(r.ate, fundo) })).sort((a, b) => a.de - b.de);
  const abertos: Trecho[] = [];
  let pos = 0;
  for (const c of cobertos) {
    if (c.de > pos + 0.001) abertos.push({ de: pos, ate: c.de });
    pos = Math.max(pos, c.ate);
  }
  if (fundo > pos + 0.001) abertos.push({ de: pos, ate: fundo });
  return abertos;
};

/** Formações num trecho ("rocha sã", "rocha alterada e rocha sã"); vazio se não há perfil geológico ali. */
export const formacaoNoTrecho = (d: Dados, t: Trecho) => {
  const tipos = camadasDe(d).filter(c => c.ate > t.de && c.de < t.ate).map(c => c.tipo.toLowerCase());
  const unicos = [...new Set(tipos)];
  return unicos.length <= 1 ? (unicos[0] || '') : `${unicos.slice(0, -1).join(', ')} e ${unicos[unicos.length - 1]}`;
};

/** Resumo da estrutura em frases, de cima para baixo. */
export const resumoEstrutura = (d: Dados): string[] => {
  const linhas: string[] = [];
  const perf = perfuracoesDe(d);
  if (perf.length) linhas.push(`Perfuração: ${perf.map(p => `${fmt(p.de)} a ${fmt(p.ate)} m${p.texto ? ` em ${p.texto}` : ''}`).join('; ')}.`);
  for (const r of revestimentosDe(d).sort((a, b) => a.de - b.de || b.diametro - a.diametro)) {
    linhas.push(`${tipoRevestimento(r.tipo).rotulo}${r.texto ? ` ${r.texto}` : ''}${r.material ? ` ${r.material}` : ''} de ${fmt(r.de)} a ${fmt(r.ate)} m${r.obs ? ` (${r.obs})` : ''}${r.origem ? ` · ${r.origem}` : ''}.`);
  }
  for (const t of trechosSemRevestimento(d)) {
    const f = formacaoNoTrecho(d, t);
    linhas.push(`Sem revestimento de ${fmt(t.de)} a ${fmt(t.ate)} m: parede ${f ? `em ${f}` : 'na formação'}.`);
  }
  if (d.revestimentoDesconhecido) linhas.push('Revestimento ainda não informado.');
  const fraturas = camadasDe(d).filter(c => c.tipo === 'Fratura com água');
  if (fraturas.length) linhas.push(`Entradas de água (fraturas): ${fraturas.map(c => `${fmt(c.de)}${c.ate !== c.de ? `–${fmt(c.ate)}` : ''} m`).join(', ')}.`);
  const extra = [num(d.bombaNivelEstatico) ? `nível estático ${fmt(num(d.bombaNivelEstatico))} m` : '', num(d.bombaProfundidade) ? `bomba a ${fmt(num(d.bombaProfundidade))} m` : ''].filter(Boolean);
  if (extra.length) linhas.push(`${extra.join(' · ').replace(/^./, c => c.toUpperCase())}.`);
  return linhas;
};

/** Tem o mínimo para desenhar (alguma perfuração ou revestimento com profundidade). */
export const temEstrutura = (d: Dados) => fundoDoPoco(d) > 0 && (perfuracoesDe(d).length > 0 || revestimentosDe(d).length > 0);

// ---------------------------------------------------------------- desenho do perfil (SVG)
const passoDaEscala = (fundo: number) => [5, 10, 20, 25, 50, 100].find(p => fundo / p <= 8) || 200;

/**
 * Perfil construtivo: escala de profundidade, coluna geológica, o furo com a largura de cada diâmetro, os revestimentos
 * (o interno dentro do de fora), o trecho sem revestimento hachurado, a água a partir do NE e a bomba.
 */
export const svgPerfil = (d: Dados, opcoes: { largura?: number; altura?: number } = {}) => {
  const W = opcoes.largura || 460;
  const H = opcoes.altura || 520;
  const fundo = fundoDoPoco(d) || 1;
  const topo = 22;
  const base = H - 14;
  const y = (m: number) => topo + (Math.min(Math.max(m, 0), fundo) / fundo) * (base - topo);
  const cx = 150;
  const perf = perfuracoesDe(d);
  const revs = revestimentosDe(d);
  const maiorPol = Math.max(...perf.map(p => p.diametro), ...revs.map(r => r.diametro), 6);
  const k = 70 / maiorPol;                      // px por polegada (o maior diâmetro ocupa ~140 px)
  const meia = (pol: number) => Math.max(4, (pol || maiorPol * 0.6) * k);

  const partes: string[] = [];
  partes.push(`<defs><pattern id="rocha" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#8c8c8c" stroke-width="1.2"/></pattern></defs>`);

  // escala
  const passo = passoDaEscala(fundo);
  for (let m = 0; m <= fundo + 0.001; m += passo) {
    partes.push(`<line x1="34" x2="40" y1="${y(m)}" y2="${y(m)}" stroke="#999"/><text x="30" y="${y(m) + 3}" font-size="9" text-anchor="end" fill="#666">${fmt(m)} m</text>`);
  }
  if (fundo % passo) partes.push(`<text x="30" y="${y(fundo) + 3}" font-size="9" text-anchor="end" fill="#333" font-weight="bold">${fmt(fundo)} m</text>`);
  partes.push(`<line x1="40" x2="40" y1="${topo}" y2="${base}" stroke="#bbb"/>`);

  // coluna geológica
  for (const c of camadasDe(d)) {
    partes.push(`<rect x="46" y="${y(c.de)}" width="26" height="${Math.max(1.5, y(c.ate) - y(c.de))}" fill="${corDaCamada(c.tipo)}"><title>${esc(`${c.tipo}: ${fmt(c.de)} a ${fmt(c.ate)} m${c.obs ? ` · ${c.obs}` : ''}`)}</title></rect>`);
  }
  partes.push(`<text x="59" y="${topo - 8}" font-size="8" text-anchor="middle" fill="#666">geologia</text>`);

  // furo (perfuração) — sem perfuração informada, usa o maior revestimento até o fundo
  const furo = perf.length ? perf : [{ de: 0, ate: fundo, diametro: Math.max(...revs.map(r => r.diametro), 6), texto: '' }];
  for (const p of furo) partes.push(`<rect x="${cx - meia(p.diametro)}" y="${y(p.de)}" width="${meia(p.diametro) * 2}" height="${y(p.ate) - y(p.de)}" fill="#efe6d6" stroke="#b39b7a" stroke-width="1"/>`);
  // trecho sem revestimento: parede hachurada (rocha)
  for (const t of trechosSemRevestimento(d)) {
    const p = furo.find(f => f.ate > t.de && f.de < t.ate) || furo[furo.length - 1];
    partes.push(`<rect x="${cx - meia(p.diametro)}" y="${y(t.de)}" width="${meia(p.diametro) * 2}" height="${y(t.ate) - y(t.de)}" fill="url(#rocha)" opacity="0.55"/>`);
  }
  // água a partir do NE (dentro do menor diâmetro)
  const ne = num(d.bombaNivelEstatico);
  if (ne > 0 && ne < fundo) {
    const menor = Math.min(...furo.map(f => f.diametro), ...revs.map(r => r.diametro || 99));
    partes.push(`<rect x="${cx - meia(menor) + 2}" y="${y(ne)}" width="${meia(menor) * 2 - 4}" height="${y(fundo) - y(ne)}" fill="#91caff" opacity="0.45"/>`);
    partes.push(`<line x1="${cx - meia(maiorPol) - 8}" x2="${cx + meia(maiorPol) + 8}" y1="${y(ne)}" y2="${y(ne)}" stroke="#1677ff" stroke-dasharray="4 3"/>`);
  }
  // revestimentos: o de fora mais grosso, o interno azul, o filtro tracejado
  const estilo = (t: string) => (t === 'INTERNO' ? 'stroke="#0958d9" stroke-width="2.5"' : t === 'FILTRO' ? 'stroke="#555" stroke-width="2.5" stroke-dasharray="3 3"' : 'stroke="#333" stroke-width="3"');
  for (const r of [...revs].sort((a, b) => b.diametro - a.diametro)) {
    const x = meia(r.diametro);
    partes.push(`<g><title>${esc(`${tipoRevestimento(r.tipo).rotulo} ${r.texto} ${r.material}: ${fmt(r.de)} a ${fmt(r.ate)} m`)}</title>`
      + `<line x1="${cx - x}" x2="${cx - x}" y1="${y(r.de)}" y2="${y(r.ate)}" ${estilo(r.tipo)}/><line x1="${cx + x}" x2="${cx + x}" y1="${y(r.de)}" y2="${y(r.ate)}" ${estilo(r.tipo)}/></g>`);
  }
  // bomba
  const bomba = num(d.bombaProfundidade);
  if (bomba > 0) {
    const menor = Math.min(...revs.map(r => r.diametro || 99), ...furo.map(f => f.diametro));
    const lb = Math.max(4, meia(menor) * 0.55);
    partes.push(`<line x1="${cx}" x2="${cx}" y1="${topo}" y2="${y(bomba) - 10}" stroke="#595959" stroke-width="1.5"/>`);
    partes.push(`<rect x="${cx - lb}" y="${y(bomba) - 10}" width="${lb * 2}" height="20" rx="3" fill="#434343"><title>Bomba a ${fmt(bomba)} m</title></rect>`);
  }

  // legendas à direita, sem sobrepor (mínimo 13 px entre elas)
  const legendas: Array<{ y: number; texto: string; cor: string }> = [
    ...revs.map(r => ({ y: y((r.de + r.ate) / 2), texto: `${tipoRevestimento(r.tipo).curto} ${r.texto} · ${fmt(r.de)}–${fmt(r.ate)} m`, cor: r.tipo === 'INTERNO' ? '#0958d9' : '#333' })),
    ...trechosSemRevestimento(d).map(t => ({ y: y((t.de + t.ate) / 2), texto: `Sem revestimento · ${fmt(t.de)}–${fmt(t.ate)} m`, cor: '#8c6d3f' })),
    ...(ne > 0 && ne < fundo ? [{ y: y(ne), texto: `NE (nível estático) · ${fmt(ne)} m`, cor: '#1677ff' }] : []),
    ...(bomba > 0 ? [{ y: y(bomba), texto: `Bomba · ${fmt(bomba)} m`, cor: '#434343' }] : []),
  ].sort((a, b) => a.y - b.y);
  let ultimo = -99;
  for (const l of legendas) {
    const ly = Math.max(l.y, ultimo + 13);
    ultimo = ly;
    partes.push(`<text x="${cx + meia(maiorPol) + 14}" y="${Math.min(ly, base) + 3}" font-size="9.5" fill="${l.cor}">${esc(l.texto)}</text>`);
  }
  partes.push(`<line x1="${cx - meia(maiorPol) - 16}" x2="${cx + meia(maiorPol) + 16}" y1="${topo}" y2="${topo}" stroke="#7c5c2c" stroke-width="2"/><text x="${cx}" y="${topo - 8}" font-size="8" text-anchor="middle" fill="#7c5c2c">superfície</text>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">${partes.join('')}</svg>`;
};
