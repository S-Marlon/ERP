// Papel da marca na família (comercial_familias.comportamento_marca):
//  - ficha: informativa; cada item tem a sua (cpd.id_marca). {MARCA} usa a do item e, sem ela, a da família.
//  - dna:   identidade da família (ex.: "Bombas Ebara"); todos os itens recebem a marca da família.
//  - grade: diferencia os itens (ex.: bomba 1cv Ebara x Schneider); cada item precisa da sua marca.
import { normalizarToken } from './saudeFamilia';

export type PapelMarca = 'ficha' | 'dna' | 'grade';

// Chave da marca nos valores do item (a tela trata a marca como um "atributo" do sistema)
export const CHAVE_MARCA = 'atributo-marca-virtual';

export const papelMarca = (valor: unknown): PapelMarca =>
  (valor === 'dna' || valor === 'grade' ? valor : 'ficha');

// "Sem Marca" (id 1, padrão do banco) vale como ausência de marca
export const marcaReal = (nome: unknown): boolean => {
  const n = normalizarToken(nome);
  return n !== '' && n !== 'semmarca';
};

export const marcaEfetiva = (papel: PapelMarca, marcaFamilia: string | null | undefined, marcaItem: string | null | undefined): string => {
  const familia = marcaReal(marcaFamilia) ? String(marcaFamilia) : '';
  const item = marcaReal(marcaItem) ? String(marcaItem) : '';
  if (papel === 'dna') return familia;
  if (papel === 'grade') return item;
  return item || familia;
};

export interface PendenciaMarca {
  atributoId: string;
  nome: string;
  codigo: string;
  motivo: string;
}

export const pendenciaMarca = (
  papel: PapelMarca,
  marcaFamilia: string | null | undefined,
  marcaItem: string | null | undefined,
  templateUsaMarca: boolean
): PendenciaMarca | null => {
  const base = { atributoId: CHAVE_MARCA, nome: 'Marca', codigo: 'MARCA' };
  if (papel === 'grade' && !marcaReal(marcaItem)) {
    return { ...base, motivo: 'A marca gera variação nesta família e o item está sem marca' };
  }
  if (papel === 'dna' && !marcaReal(marcaFamilia)) {
    return { ...base, motivo: 'A marca é DNA da família, mas a família não tem marca definida' };
  }
  if (templateUsaMarca && marcaEfetiva(papel, marcaFamilia, marcaItem) === '') {
    return { ...base, motivo: 'Usada no código/nome e sem marca' };
  }
  return null;
};

export interface MarcaCadastro {
  id: number;
  nome: string;
}

/** Marca informada na tela (id ou nome) -> cadastro. Vazio = sem alteração; não encontrada = erro. */
export const resolverMarcaInformada = (
  valor: unknown,
  marcas: MarcaCadastro[]
): { ok: true; marca: MarcaCadastro | null } | { ok: false; erro: string } => {
  const texto = String(valor ?? '').trim();
  if (!texto) return { ok: true, marca: null };
  const porId = /^\d+$/.test(texto) ? marcas.find(m => m.id === Number(texto)) : undefined;
  const marca = porId || marcas.find(m => normalizarToken(m.nome) === normalizarToken(texto));
  if (!marca) return { ok: false, erro: `Marca "${texto}" não cadastrada.` };
  return { ok: true, marca };
};
