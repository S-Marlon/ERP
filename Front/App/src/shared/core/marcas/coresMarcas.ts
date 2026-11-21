// Cores das marcas (Catálogo › Marcas): carregadas uma vez e compartilhadas por todas as etiquetas de marca (TagMarca).
// Recarrega quando uma marca é salva (invalidarCoresMarcas).
import { useEffect, useSyncExternalStore } from 'react';
import { API_URL } from '../../api/config';

export interface CoresMarca { cor: string | null; corSecundaria: string | null }

let mapa = new Map<string, CoresMarca>();
let estado: 'vazio' | 'carregando' | 'pronto' = 'vazio';
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(f => f());

const carregar = async () => {
  if (estado !== 'vazio') return;
  estado = 'carregando';
  try {
    const r = await fetch(`${API_URL}/api/catalogo/marcas`);
    const lista = r.ok ? await r.json() : [];
    mapa = new Map((Array.isArray(lista) ? lista : []).map((m: any) => [String(m.nome).trim().toUpperCase(), { cor: m.cor || null, corSecundaria: m.cor_secundaria || null }]));
    estado = 'pronto';
  } catch {
    estado = 'vazio';
  }
  avisar();
};

export const invalidarCoresMarcas = () => { estado = 'vazio'; carregar(); };

/** Cores cadastradas da marca (pelo nome), ou nulas (cor automática). */
export const useCoresMarca = (nome: string | null | undefined): CoresMarca => {
  useEffect(() => { carregar(); }, []);
  const versao = useSyncExternalStore(f => { ouvintes.add(f); return () => ouvintes.delete(f); }, () => mapa);
  return versao.get(String(nome || '').trim().toUpperCase()) || { cor: null, corSecundaria: null };
};

/** Texto que dá para ler sobre a cor: preto em fundo claro, branco em fundo escuro (luminância). */
export const textoSobre = (hex: string) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#1a1a1a' : '#ffffff';
};
