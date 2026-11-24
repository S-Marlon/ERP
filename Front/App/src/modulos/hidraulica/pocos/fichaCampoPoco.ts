// Ficha do poço › "Ficha de campo (A4)": a ficha de campo da perfuração (o mesmo modelo do Kit de visita) já preenchida
// com o que se sabe do poço — cliente, local e GPS, profundidade, diâmetro, vazão e níveis, solo, as etapas de
// perfuração e os revestimentos da estrutura (até 3 de cada, como na folha) e a bomba instalada. O que faltar sai em
// linha para anotar à mão na obra. Puro, com teste.
import type { ValoresKit } from './camposKit';
import { camadasDe, perfuracoesDe, revestimentosDe, tipoRevestimento } from './estruturaPoco';

type Dados = Record<string, any>;
export interface PocoParaFicha {
  identificacao: string; endereco: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  latitude: number | null; longitude: number | null; profundidadeM: number | null; diametro: string | null; vazaoLh: number | null;
  nivelEstaticoM: number | null; nivelDinamicoM: number | null; tipoSolo: string | null; observacao?: string | null;
}
export interface BombaParaFicha {
  bombaMarca: string | null; bombaModelo: string | null; potenciaCv: number | null; motorMarca: string | null; motorModelo: string | null;
  profundidadeBombaM: number | null; tuboMaterial: string | null; tuboDiametro: string | null; tuboBarras: number | null; tuboMetros: number | null;
  fioTipo: string | null; fioBitola: string | null; fioMetros: number | null; instaladoEm: string | null;
}

const junta = (xs: Array<string | number | null | undefined>, sep = ' ') => xs.filter(x => x !== null && x !== undefined && String(x).trim() !== '').join(sep);
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const valoresFichaDoPoco = (
  p: PocoParaFicha, cliente: { nome: string; telefone: string | null } | null, estrutura: Dados | null | undefined,
  bomba: BombaParaFicha | null | undefined, hoje: string,
): ValoresKit => {
  const v: ValoresKit = {
    doc_data: hoje,
    cliente_nome: cliente?.nome || null,
    cliente_tel: cliente?.telefone || null,
    obra_endereco: junta([p.endereco, p.bairro], ', ') || null,
    obra_cidade: junta([p.cidade, p.uf], ' / ') || null,
    obra_ref: junta([p.identificacao, p.latitude !== null && p.longitude !== null ? `GPS ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}` : null], ' · ') || null,
    prof_atingida: p.profundidadeM ?? (estrutura?.profundidade ? Number(estrutura.profundidade) : null),
    poco_diametro: p.diametro || null,
    vazao: p.vazaoLh ? `${num(p.vazaoLh)} L/h` : null,
    nivel_estatico: p.nivelEstaticoM ?? null,
    nivel_dinamico: p.nivelDinamicoM ?? null,
    ficha_obs: p.observacao || null,
  };
  const est = estrutura || {};
  // solo: o do cadastro ou o perfil geológico em uma linha
  const camadas = camadasDe(est);
  v.solo = p.tipoSolo || (camadas.length ? camadas.map(c => `${num(c.de)}–${num(c.ate)} m ${c.tipo.toLowerCase()}`).join('; ') : null);
  perfuracoesDe(est).slice(0, 3).forEach((x, i) => {
    v[`perf_de_${i + 1}`] = x.de; v[`perf_ate_${i + 1}`] = x.ate; v[`perf_diam_${i + 1}`] = x.texto || null;
  });
  revestimentosDe(est).slice(0, 3).forEach((x, i) => {
    v[`rev_de_${i + 1}`] = x.de; v[`rev_ate_${i + 1}`] = x.ate; v[`rev_diam_${i + 1}`] = x.texto || null;
    v[`rev_material_${i + 1}`] = junta([x.tipo !== 'EXTERNO' ? tipoRevestimento(x.tipo).curto : null, x.material], ' · ') || null;
  });
  if (bomba) {
    v.bomba_marca = junta([bomba.bombaMarca, bomba.bombaModelo]) || null;
    v.bomba_motor = junta([bomba.motorMarca, bomba.motorModelo, bomba.potenciaCv ? `${num(bomba.potenciaCv)} CV` : null]) || null;
    v.bomba_cabo = junta([bomba.fioTipo, bomba.fioBitola, bomba.fioMetros ? `${num(bomba.fioMetros)} m` : null]) || null;
    v.bomba_prof = bomba.profundidadeBombaM ?? null;
    v.bomba_tubulacao = junta([
      bomba.tuboBarras ? `${bomba.tuboBarras} barras` : null, bomba.tuboMaterial, bomba.tuboDiametro,
      bomba.tuboMetros ? `(${num(bomba.tuboMetros)} m)` : null,
    ]) || null;
    v.bomba_data = bomba.instaladoEm || null;
  }
  return v;
};
