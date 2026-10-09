// Módulos plugáveis do front: telas, itens de menu e pontos de extensão (ex.: botão no PDV).
// Cada módulo vive em src/modulos/<area>/<assunto>. O restante do sistema só conhece este registro.
// Para remover um módulo: tirar a pasta e a entrada dele em MODULOS_FRONT.
import React, { lazy } from 'react';
import type { ItemMenu } from '../app/layout/menuRotas';
import type { MappingPayload } from '../areas/compras/entradaNf/itens/ProductMappingModal';

const MontagensPagina = lazy(() => import('./hidraulica/montagens/MontagensPagina'));
const MontagemPdv = lazy(() => import('./hidraulica/montagens/MontagemPdv'));
const RolamentosConfig = lazy(() => import('./transmissao/rolamentos/RolamentosConfig'));
const RolamentosEntrada = lazy(() => import('./transmissao/rolamentos/RolamentosEntrada'));
const RolamentoPorMedida = lazy(() => import('./transmissao/rolamentos/RolamentoPorMedida'));
const RelatorioPocoPage = lazy(() => import('./hidraulica/pocos/RelatorioPocoPage'));

/** O que o PDV entrega a um botão de módulo (o módulo não acessa o carrinho de outro jeito). */
export interface PdvExtensaoProps {
  // Acrescenta (ou substitui) linhas no carrinho; precoFixo congela o preço da linha (ex.: preço combinado na OS)
  adicionarItens: (
    linhas: Array<{ idItem: number; nome: string; quantidade: number; idUnidade: number | null; unidadeBase?: boolean; precoFixo?: number }>,
    opcoes?: { substituir?: boolean }
  ) => Promise<string[]>;
  clienteId: number | null;
  cliente: string;
  // Cliente do cadastro (ou só o nome, sem cadastro)
  definirCliente: (c: { id: number; nome: string } | null, nomeLivre?: string) => void;
  // Liga a venda a algo do módulo: os sinais dessa origem aparecem no pagamento e uma faixa avisa no PDV
  vincularOrigem: (o: { origem: string; idOrigem: number; rotulo: string } | null) => void;
}

/** O que a entrada de NF entrega a um botão de módulo: as linhas da nota e como vincular/cadastrar nelas. */
export interface LinhaEntradaNf {
  tempId: string | number;
  nItem?: number;
  descricao: string;
  sku?: string;                 // código do produto no fornecedor (cProd)
  ean?: string;
  unidade?: string;
  quantidade?: number;
  valorUnitario?: number;       // custo final por unidade da nota
  tipoRecurso?: string;
  mapeamento?: MappingPayload | null;
  produtoIdSistema?: number | null;
}
export interface EntradaNfExtensaoProps {
  linhas: LinhaEntradaNf[];
  // Aplica o mapeamento (vínculo a item existente ou item novo) nas linhas; elas voltam para conferência
  aplicarMapeamentos: (lista: Array<{ tempId: string | number; mapping: MappingPayload }>) => void;
  readOnly?: boolean;
}

export interface ModuloFront {
  codigo: string;                                         // igual a sistema_modulos.codigo
  menu: Array<{ grupo: string; itens: ItemMenu[] }>;      // grupo do menu principal (ex.: grp:vendas)
  rotas: Array<{ path: string; element: React.ReactNode }>;
  pdv?: Array<React.ComponentType<PdvExtensaoProps>>;       // botões no cabeçalho do PDV
  entradaNf?: Array<React.ComponentType<EntradaNfExtensaoProps>>; // botões na conferência da nota de entrada
  relatorios?: Array<{ categoria: string; titulo: string; descricao: string; path: string }>; // atalhos na Central de Relatórios
}

export const MODULOS_FRONT: ModuloFront[] = [
  {
    codigo: 'HIDRAULICA_MONTAGENS',
    menu: [{ grupo: 'grp:vendas', itens: [{ key: '/modulos/hidraulica/montagens', label: 'Montagens (OS)' }] }],
    rotas: [{ path: '/modulos/hidraulica/montagens', element: <MontagensPagina /> }],
    pdv: [MontagemPdv],
  },
  {
    codigo: 'TRANSMISSAO_ROLAMENTOS',
    menu: [{ grupo: 'grp:compras', itens: [{ key: '/modulos/transmissao/rolamentos', label: 'Rolamentos' }] }],
    rotas: [{ path: '/modulos/transmissao/rolamentos', element: <RolamentosConfig /> }],
    entradaNf: [RolamentosEntrada],
    pdv: [RolamentoPorMedida],
  },
  {
    codigo: 'HIDRAULICA_POCOS',
    menu: [{ grupo: 'grp:vendas', itens: [{ key: '/modulos/hidraulica/pocos', label: 'Poços (relatórios)' }] }],
    // /relatorios/poco: endereço antigo da tela, mantido para quem tem o link salvo
    rotas: [
      { path: '/modulos/hidraulica/pocos', element: <RelatorioPocoPage /> },
      { path: '/relatorios/poco', element: <RelatorioPocoPage /> },
    ],
    relatorios: [{
      categoria: 'Serviços técnicos e obras', titulo: 'Poços artesianos',
      descricao: 'Relatório técnico completo, cobrança da obra, teste de vazão, garantia e formulário de campo.', path: '/modulos/hidraulica/pocos',
    }],
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

export const extensoesEntradaNf = (ativos: Set<string>) => MODULOS_FRONT.filter(m => ativos.has(m.codigo)).flatMap(m => m.entradaNf || []);

export const relatoriosDosModulos = (ativos: Set<string>) => MODULOS_FRONT.filter(m => ativos.has(m.codigo)).flatMap(m => m.relatorios || []);
