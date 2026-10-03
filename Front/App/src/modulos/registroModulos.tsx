// Módulos plugáveis do front: telas, itens de menu e pontos de extensão (ex.: botão no PDV).
// Cada módulo vive em src/modulos/<area>/<assunto>. O restante do sistema só conhece este registro.
// Para remover um módulo: tirar a pasta e a entrada dele em MODULOS_FRONT.
import React, { lazy } from 'react';
import type { ItemMenu } from '../components/Layout/menuRotas';

const MontagensPagina = lazy(() => import('./hidraulica/montagens/MontagensPagina'));
const MontagemPdv = lazy(() => import('./hidraulica/montagens/MontagemPdv'));

/** O que o PDV entrega a um botão de módulo (o módulo não acessa o carrinho de outro jeito). */
export interface PdvExtensaoProps {
  adicionarItens: (linhas: Array<{ idItem: number; nome: string; quantidade: number; idUnidade: number | null; unidadeBase?: boolean }>) => Promise<string[]>;
  clienteId: number | null;
  cliente: string;
}

export interface ModuloFront {
  codigo: string;                                         // igual a sistema_modulos.codigo
  menu: Array<{ grupo: string; itens: ItemMenu[] }>;      // grupo do menu principal (ex.: grp:vendas)
  rotas: Array<{ path: string; element: React.ReactNode }>;
  pdv?: Array<React.ComponentType<PdvExtensaoProps>>;       // botões no cabeçalho do PDV
}

export const MODULOS_FRONT: ModuloFront[] = [
  {
    codigo: 'HIDRAULICA_MONTAGENS',
    menu: [{ grupo: 'grp:vendas', itens: [{ key: '/modulos/hidraulica/montagens', label: 'Montagens (OS)' }] }],
    rotas: [{ path: '/modulos/hidraulica/montagens', element: <MontagensPagina /> }],
    pdv: [MontagemPdv],
  },
];

/** Menu com os itens dos módulos ativos (ou de todos, para títulos e busca). */
export const menuComModulos = (menu: ItemMenu[], ativos: Set<string> | 'todos'): ItemMenu[] => {
  const modulos = MODULOS_FRONT.filter(m => ativos === 'todos' || ativos.has(m.codigo));
  return menu.map(g => {
    const extras = modulos.flatMap(m => m.menu.filter(x => x.grupo === g.key).flatMap(x => x.itens));
    return extras.length ? { ...g, children: [...(g.children || []), ...extras] } : g;
  });
};

export const rotasDosModulos = (ativos: Set<string>) => MODULOS_FRONT.filter(m => ativos.has(m.codigo)).flatMap(m => m.rotas);

export const extensoesPdv = (ativos: Set<string>) => MODULOS_FRONT.filter(m => ativos.has(m.codigo)).flatMap(m => m.pdv || []);
