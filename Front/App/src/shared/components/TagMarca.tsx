// Etiqueta de marca: usa as cores cadastradas da marca (principal no fundo, secundária no texto/borda; sem secundária,
// texto branco ou preto pelo contraste). Sem cor cadastrada, a marca ganha sempre a mesma cor automática pelo nome.
// Vermelho e verde automáticos ficam de fora (são usados para "trava" e "vende").
import React from 'react';
import { Tag } from 'antd';
import { textoSobre, useCoresMarca } from '../core/marcas/coresMarcas';

const CORES = ['geekblue', 'purple', 'magenta', 'volcano', 'orange', 'gold', 'cyan', 'blue', 'lime'];

export const corDaMarca = (nome: string | null | undefined) => {
  const s = String(nome || '').trim().toUpperCase();
  if (!s) return 'default';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
};

/** Estilo da etiqueta com as cores cadastradas (para prévia no cadastro e para a TagMarca). */
export const estiloCores = (cor: string, corSecundaria?: string | null): React.CSSProperties => ({
  background: cor, color: corSecundaria || textoSobre(cor), borderColor: corSecundaria || cor,
});

export const TagMarca: React.FC<{ marca: string | null | undefined; vazio?: string; style?: React.CSSProperties }> = ({ marca, vazio = 'sem marca', style }) => {
  const { cor, corSecundaria } = useCoresMarca(marca);
  if (!marca) return <Tag style={{ margin: 0, color: '#999', ...style }}>{vazio}</Tag>;
  if (cor) return <Tag style={{ margin: 0, fontWeight: 600, ...estiloCores(cor, corSecundaria), ...style }}>{marca}</Tag>;
  return <Tag color={corDaMarca(marca)} style={{ margin: 0, fontWeight: 600, ...style }}>{marca}</Tag>;
};

export default TagMarca;
