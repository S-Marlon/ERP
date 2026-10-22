// Mapa regional dos poços: regras puras da tela (cores, legenda, enquadramento e as camadas ligadas).
import type { PocoNoMapa, SituacaoObra } from './obrasApi';

/** Escala de cor do potencial hídrico (a mesma do maperf): quanto mais escuro o azul, mais água. */
export const FAIXAS_POTENCIAL: { acima: number; cor: string }[] = [
  { acima: 110, cor: '#0B0033' }, { acima: 90, cor: '#1C1C6C' }, { acima: 70, cor: '#3B4CCA' }, { acima: 50, cor: '#6699FF' },
  { acima: 30, cor: '#A3C4F3' }, { acima: 20, cor: '#D6E4F0' }, { acima: 10, cor: '#EEEEEE' }, { acima: -Infinity, cor: '#FFFFFF' },
];
export const corPotencial = (valor: number) => FAIXAS_POTENCIAL.find(f => valor > f.acima)!.cor;

/** Cor do marcador do poço do cliente: a situação da última obra (sem obra: verde se ativo, cinza se seco/desativado). */
const COR_OBRA: Record<SituacaoObra, string> = {
  ORCAMENTO: '#8c8c8c', AGUARDANDO_SINAL: '#faad14', EM_EXECUCAO: '#1677ff', CONCLUIDA: '#52c41a', CANCELADA: '#bfbfbf',
};
export const corDoPoco = (p: Pick<PocoNoMapa, 'situacao' | 'ultimaObra'>) => {
  if (p.situacao !== 'ATIVO') return '#595959';
  return p.ultimaObra && p.ultimaObra.situacao !== 'CANCELADA' ? COR_OBRA[p.ultimaObra.situacao] : '#52c41a';
};
export const LEGENDA_POCOS: { cor: string; texto: string }[] = [
  { cor: '#52c41a', texto: 'ativo / obra concluída' }, { cor: '#1677ff', texto: 'obra em execução' }, { cor: '#faad14', texto: 'aguardando sinal' },
  { cor: '#8c8c8c', texto: 'em orçamento' }, { cor: '#595959', texto: 'seco ou desativado' },
];

/** Camadas que o operador liga e desliga (lembradas no navegador). */
export interface Camadas { nossos: boolean; referencias: boolean; potencial: boolean; satelite: boolean }
export const CAMADAS_PADRAO: Camadas = { nossos: true, referencias: true, potencial: false, satelite: false };
export const lerCamadas = (texto: string | null): Camadas => {
  try {
    const c = JSON.parse(texto || '{}');
    return Object.fromEntries(Object.entries(CAMADAS_PADRAO).map(([k, v]) => [k, typeof c[k] === 'boolean' ? c[k] : v])) as unknown as Camadas;
  } catch { return { ...CAMADAS_PADRAO }; }
};

/** Centro do maperf (região de Jundiaí/Atibaia/Guarulhos), usado quando ainda não há poço nenhum. */
export const CENTRO_PADRAO: [number, number] = [-23.1171, -46.5565];

/** Onde o mapa abre: no foco pedido, senão no meio dos nossos poços, senão no centro padrão. */
export const enquadramento = (pocos: { latitude: number; longitude: number }[], foco?: { latitude: number; longitude: number } | null) => {
  if (foco) return { centro: [foco.latitude, foco.longitude] as [number, number], zoom: 15 };
  if (!pocos.length) return { centro: CENTRO_PADRAO, zoom: 10 };
  const lat = pocos.reduce((s, p) => s + p.latitude, 0) / pocos.length;
  const lon = pocos.reduce((s, p) => s + p.longitude, 0) / pocos.length;
  return { centro: [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6] as [number, number], zoom: pocos.length === 1 ? 14 : 11 };
};

/** "1,5 km" / "800 m" */
export const textoRaio = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${m} m`);

/** "-23.55, -46.63" (vírgula, ponto e vírgula ou espaço) → latitude e longitude; null quando não dá para ler. */
export const lerGpsTexto = (v: string | null | undefined): { latitude: number; longitude: number } | null => {
  const m = String(v ?? '').match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
  if (!m) return null;
  const [latitude, longitude] = [Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))];
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
};
