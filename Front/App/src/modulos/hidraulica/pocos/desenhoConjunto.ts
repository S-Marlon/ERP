// Desenho do conjunto instalado (ficha do poço › Bomba e instalação): o que desce no poço — tubo edutor contado por barra
// (as emendas marcadas: 6 barras de 6 m = 36 m), o fio da bomba, a corda — e a bomba (bombeador em cima do motor), com o
// quadro e a cabeça do poço na superfície. E a conferência: os tubos batem com a profundidade da bomba? o fio e a corda
// chegam lá? a bomba está abaixo do nível dinâmico e acima do fundo? Puro, com teste.
import { corPadrao } from './materiaisPoco';

export interface ConjuntoDesenho {
  bombaTipo?: string | null; bombaMarca?: string | null; bombaModelo?: string | null; potenciaCv?: number | null; tensao?: string | null; estagios?: number | null;
  motorMarca?: string | null; motorModelo?: string | null; bombeadorMarca?: string | null; bombeadorModelo?: string | null;
  profundidadeBombaM?: number | null; tuboMaterial?: string | null; tuboDiametro?: string | null; tuboBarras?: number | null; tuboMetros?: number | null;
  fioTipo?: string | null; fioBitola?: string | null; fioMetros?: number | null; cordaMaterial?: string | null; cordaMetros?: number | null;
  quadroComando?: string | null; cabecaPoco?: string | null;
}
export interface PocoDoConjunto { profundidadeM?: number | null; nivelEstaticoM?: number | null; nivelDinamicoM?: number | null }

const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const fmt = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const junta = (...v: unknown[]) => v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').join(' ');

/** Tubo por barra: quantas, de quantos metros cada e o total (o comprimento sai de metros ÷ barras). */
export const barrasDoConjunto = (c: ConjuntoDesenho) => {
  const barras = num(c.tuboBarras), metros = num(c.tuboMetros);
  const comprimento = barras > 0 && metros > 0 ? Math.round((metros / barras) * 100) / 100 : null;
  return { barras: barras || null, comprimento, total: metros || null };
};

/** "6 barras de 6 m = 36 m" (ou só "6 barras" / "36 m" com o que se sabe). */
export const textoTubo = (c: ConjuntoDesenho) => {
  const { barras, comprimento, total } = barrasDoConjunto(c);
  if (barras && comprimento) return `${barras} ${barras === 1 ? 'barra' : 'barras'} de ${fmt(comprimento)} m = ${fmt(total!)} m`;
  if (barras) return `${barras} ${barras === 1 ? 'barra' : 'barras'} (metros não informados)`;
  return total ? `${fmt(total)} m` : '';
};

export interface Conferencia { ok: boolean; texto: string }

/** O que dá para conferir com o que foi registrado (só aparece o que tem dado). */
export const conferirConjunto = (c: ConjuntoDesenho, p: PocoDoConjunto = {}): Conferencia[] => {
  const r: Conferencia[] = [];
  const bomba = num(c.profundidadeBombaM);
  const { total } = barrasDoConjunto(c);
  if (bomba && total) {
    const dif = total - bomba;
    r.push(Math.abs(dif) <= 1
      ? { ok: true, texto: `Tubos (${fmt(total)} m) batem com a bomba a ${fmt(bomba)} m.` }
      : { ok: false, texto: `Tubos somam ${fmt(total)} m e a bomba está a ${fmt(bomba)} m (${dif > 0 ? 'sobram' : 'faltam'} ${fmt(Math.abs(dif))} m): confira as barras.` });
  }
  const fio = num(c.fioMetros);
  if (bomba && fio) {
    r.push(fio < bomba ? { ok: false, texto: `Fio de ${fmt(fio)} m não chega à bomba a ${fmt(bomba)} m.` }
      : fio - bomba < 3 ? { ok: false, texto: `Fio com só ${fmt(fio - bomba)} m de sobra até o quadro.` }
        : { ok: true, texto: `Fio de ${fmt(fio)} m: sobram ${fmt(fio - bomba)} m até o quadro.` });
  }
  const corda = num(c.cordaMetros);
  if (bomba && corda) r.push(corda < bomba ? { ok: false, texto: `Corda de ${fmt(corda)} m não chega à bomba a ${fmt(bomba)} m.` } : { ok: true, texto: `Corda de ${fmt(corda)} m segura a bomba.` });
  if (bomba && !corda && c.bombaTipo !== 'SUPERFICIE') r.push({ ok: false, texto: 'Sem corda de segurança registrada.' });
  const fundo = num(p.profundidadeM), nd = num(p.nivelDinamicoM);
  if (bomba && fundo && bomba > fundo) r.push({ ok: false, texto: `Bomba a ${fmt(bomba)} m, abaixo do fundo do poço (${fmt(fundo)} m): confira.` });
  else if (bomba && fundo && fundo - bomba < 2) r.push({ ok: false, texto: `Bomba a ${fmt(fundo - bomba)} m do fundo: risco de puxar areia.` });
  if (bomba && nd && bomba <= nd) r.push({ ok: false, texto: `Bomba a ${fmt(bomba)} m, acima do nível dinâmico (${fmt(nd)} m): pode puxar ar.` });
  else if (bomba && nd) r.push({ ok: true, texto: `Bomba ${fmt(bomba - nd)} m abaixo do nível dinâmico.` });
  return r;
};

/** Desenho do que desce no poço (SVG). */
export const svgConjunto = (c: ConjuntoDesenho, p: PocoDoConjunto = {}, opcoes: { largura?: number; altura?: number } = {}) => {
  const W = opcoes.largura || 460, H = opcoes.altura || 480;
  const bomba = num(c.profundidadeBombaM);
  const fundo = Math.max(num(p.profundidadeM), bomba + 6, num(c.tuboMetros), 10);
  const topo = 70, base = H - 16;
  const y = (m: number) => topo + (Math.min(Math.max(m, 0), fundo) / fundo) * (base - topo);
  const cx = 130, larg = 38;
  const partes: string[] = [];
  const legendas: Array<{ y: number; texto: string; cor: string; negrito?: boolean }> = [];

  // superfície: quadro de comando e cabeça do poço
  partes.push(`<line x1="20" x2="${cx + 120}" y1="${topo}" y2="${topo}" stroke="#7c5c2c" stroke-width="2"/>`);
  partes.push(`<rect x="24" y="${topo - 46}" width="44" height="34" rx="3" fill="#f0f0f0" stroke="#595959"/><text x="46" y="${topo - 25}" font-size="8" text-anchor="middle" fill="#333">quadro</text>`);
  partes.push(`<rect x="${cx - 16}" y="${topo - 22}" width="32" height="14" rx="2" fill="#d9d9d9" stroke="#595959"><title>${esc(c.cabecaPoco || 'Cabeça do poço')}</title></rect>`);
  partes.push(`<line x1="${cx + 16}" x2="${cx + 52}" y1="${topo - 15}" y2="${topo - 15}" stroke="#595959" stroke-width="3"/>`);
  // poço (paredes) e níveis
  partes.push(`<rect x="${cx - larg}" y="${topo}" width="${larg * 2}" height="${y(fundo) - topo}" fill="#f5efe4" stroke="#b39b7a"/>`);
  const ne = num(p.nivelEstaticoM), nd = num(p.nivelDinamicoM);
  if (ne > 0 && ne < fundo) {
    partes.push(`<rect x="${cx - larg + 1}" y="${y(ne)}" width="${larg * 2 - 2}" height="${y(fundo) - y(ne)}" fill="#91caff" opacity="0.4"/>`);
    partes.push(`<line x1="${cx - larg - 6}" x2="${cx + larg + 6}" y1="${y(ne)}" y2="${y(ne)}" stroke="#1677ff" stroke-dasharray="4 3"/>`);
    legendas.push({ y: y(ne), texto: `NE · ${fmt(ne)} m`, cor: '#1677ff' });
  }
  if (nd > 0 && nd < fundo) {
    partes.push(`<line x1="${cx - larg - 6}" x2="${cx + larg + 6}" y1="${y(nd)}" y2="${y(nd)}" stroke="#d46b08" stroke-dasharray="2 3"/>`);
    legendas.push({ y: y(nd), texto: `ND · ${fmt(nd)} m`, cor: '#d46b08' });
  }

  const alturaBomba = 34;
  const topoBomba = bomba ? y(bomba) - alturaBomba : y(fundo) - alturaBomba;
  // fio da bomba (do quadro até o motor) e corda
  if (num(c.fioMetros) || c.fioBitola || c.fioTipo) {
    partes.push(`<polyline points="46,${topo - 12} 46,${topo + 4} ${cx + 10},${topo + 4} ${cx + 10},${topoBomba + alturaBomba * 0.6}" fill="none" stroke="#cf1322" stroke-width="1.6"><title>${esc(junta('Fio', c.fioTipo, c.fioBitola, c.fioMetros ? `${fmt(num(c.fioMetros))} m` : ''))}</title></polyline>`);
    legendas.push({ y: y(Math.max(bomba * 0.5, 2)) + 13, texto: junta('Fio', c.fioTipo, c.fioBitola, c.fioMetros ? `· ${fmt(num(c.fioMetros))} m` : ''), cor: '#cf1322' });
  }
  if (num(c.cordaMetros) || c.cordaMaterial) {
    partes.push(`<line x1="${cx - 11}" x2="${cx - 11}" y1="${topo - 8}" y2="${topoBomba}" stroke="#ad8b00" stroke-width="1.3" stroke-dasharray="5 2"><title>${esc(junta('Corda', c.cordaMaterial, c.cordaMetros ? `${fmt(num(c.cordaMetros))} m` : ''))}</title></line>`);
    // "Corda de nylon" já diz que é corda
    const corda = /corda|cabo de a/i.test(String(c.cordaMaterial || '')) ? c.cordaMaterial : junta('Corda', c.cordaMaterial);
    legendas.push({ y: y(Math.max(bomba * 0.5, 2)) + 26, texto: junta(corda, c.cordaMetros ? `· ${fmt(num(c.cordaMetros))} m` : ''), cor: '#ad8b00' });
  }
  // tubo edutor com as emendas de cada barra
  const { barras, comprimento } = barrasDoConjunto(c);
  const corTubo = corPadrao(junta(c.tuboMaterial, 'edutor'));
  const fimTubo = bomba || num(c.tuboMetros);
  if (fimTubo > 0) {
    partes.push(`<line x1="${cx}" x2="${cx}" y1="${topo - 8}" y2="${topoBomba}" stroke="${corTubo}" stroke-width="5"><title>${esc(junta('Tubo edutor', c.tuboMaterial, c.tuboDiametro, textoTubo(c)))}</title></line>`);
    if (barras && comprimento && barras <= 60) {
      for (let i = 1; i < barras; i++) {
        const m = i * comprimento;
        if (m >= fimTubo) break;
        partes.push(`<rect x="${cx - 5}" y="${y(m) - 2}" width="10" height="4" fill="#262626"><title>Emenda ${i}/${i + 1} · ${fmt(m)} m</title></rect>`);
        if (barras <= 20) partes.push(`<text x="${cx - larg - 4}" y="${y(m) + 3}" font-size="8" text-anchor="end" fill="#8c8c8c">${fmt(m)} m</text>`);
      }
    }
    legendas.push({ y: y(Math.max(bomba * 0.5, 2)), texto: junta('Tubo edutor', c.tuboDiametro, c.tuboMaterial, textoTubo(c) ? `· ${textoTubo(c)}` : ''), cor: corTubo, negrito: true });
  }
  // bomba: bombeador em cima, motor embaixo
  if (bomba || c.bombaMarca || c.bombaModelo) {
    const metade = alturaBomba / 2;
    partes.push(`<rect x="${cx - 13}" y="${topoBomba}" width="26" height="${metade}" rx="3" fill="#1d39c4"><title>${esc(junta('Bombeador', c.bombeadorMarca || c.bombaMarca, c.bombeadorModelo || c.bombaModelo, c.estagios ? `${c.estagios} estágios` : ''))}</title></rect>`);
    partes.push(`<rect x="${cx - 13}" y="${topoBomba + metade}" width="26" height="${metade}" rx="3" fill="#434343"><title>${esc(junta('Motor', c.motorMarca, c.motorModelo, c.potenciaCv ? `${fmt(num(c.potenciaCv))} CV` : '', c.tensao))}</title></rect>`);
    const bombaTexto = junta(c.bombaMarca || c.bombeadorMarca, c.bombaModelo || c.bombeadorModelo, c.potenciaCv ? `· ${fmt(num(c.potenciaCv))} CV` : '', c.tensao ? `· ${c.tensao}` : '', c.estagios ? `· ${c.estagios} estágios` : '');
    legendas.push({ y: topoBomba + metade, texto: `Bomba${bomba ? ` a ${fmt(bomba)} m` : ''}${bombaTexto ? ` · ${bombaTexto}` : ''}`, cor: '#1d39c4', negrito: true });
    const motor = junta(c.motorMarca, c.motorModelo);
    if (motor) legendas.push({ y: topoBomba + alturaBomba, texto: `Motor ${motor}`, cor: '#434343' });
  }
  // fundo
  if (num(p.profundidadeM)) legendas.push({ y: y(fundo), texto: `Fundo · ${fmt(fundo)} m`, cor: '#8c6d3f' });
  partes.push(`<text x="${cx}" y="${topo - 54}" font-size="9" text-anchor="middle" fill="#7c5c2c">${esc(c.cabecaPoco ? 'cabeça do poço' : 'superfície')}</text>`);

  // legendas à direita, sem sobrepor
  let ultimo = -99;
  for (const l of legendas.sort((a, b) => a.y - b.y)) {
    const ly = Math.min(Math.max(l.y, ultimo + 13), base);
    ultimo = ly;
    partes.push(`<text x="${cx + larg + 14}" y="${ly + 3}" font-size="9.5" fill="${l.cor}"${l.negrito ? ' font-weight="600"' : ''}>${esc(l.texto)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">${partes.join('')}</svg>`;
};
