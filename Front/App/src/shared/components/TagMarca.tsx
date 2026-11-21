// Etiqueta de marca: cada marca ganha sempre a mesma cor (pelo nome), em qualquer tela. Vermelho e verde ficam de fora
// (são usados para "trava" e "vende").
import React from 'react';
import { Tag } from 'antd';

const CORES = ['geekblue', 'purple', 'magenta', 'volcano', 'orange', 'gold', 'cyan', 'blue', 'lime'];

export const corDaMarca = (nome: string | null | undefined) => {
  const s = String(nome || '').trim().toUpperCase();
  if (!s) return 'default';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CORES[h % CORES.length];
};

export const TagMarca: React.FC<{ marca: string | null | undefined; vazio?: string; style?: React.CSSProperties }> = ({ marca, vazio = 'sem marca', style }) => (marca
  ? <Tag color={corDaMarca(marca)} style={{ margin: 0, fontWeight: 600, ...style }}>{marca}</Tag>
  : <Tag style={{ margin: 0, color: '#999', ...style }}>{vazio}</Tag>);

export default TagMarca;
