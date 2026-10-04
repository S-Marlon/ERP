// Mapa único do menu: usado pela barra lateral (itens) e pelo cabeçalho (título da tela atual).
import React from 'react';
import { menuComModulos } from '../../modulos/registroModulos';
import {
  AppstoreOutlined, DollarOutlined, FileTextOutlined, HomeOutlined, InboxOutlined, ShopOutlined,
  ShoppingCartOutlined, ShopTwoTone, TeamOutlined, ToolOutlined,
} from '@ant-design/icons';

export interface ItemMenu {
  key: string;          // rota (folha) ou identificador do grupo (começa com "grp:")
  label: string;
  rota?: string;        // grupo: tela principal do módulo (abre com duplo clique na barra lateral)
  icon?: React.ReactNode;
  children?: ItemMenu[];
}

export const MENU_PRINCIPAL: ItemMenu[] = [
  { key: '/', icon: <HomeOutlined />, label: 'Dashboard' },
  {
    key: 'grp:vendas', icon: <ShopTwoTone />, label: 'Vendas', rota: '/vendas',
    children: [
      { key: '/vendas', label: 'Central de Vendas' },
      { key: '/vendas/pdv', label: 'PDV' },
      { key: '/vendas/do-dia', label: 'Vendas do Dia' },
      { key: '/vendas/orcamentos', label: 'Orçamentos' },
      { key: '/vendas/notas-fiscais', label: 'Notas fiscais' },
      { key: '/vendas/caixas', label: 'Caixas' },
      { key: '/vendas/regras', label: 'Regras de venda' },
      { key: '/vendas/taxas', label: 'Taxas de pagamento' },
    ],
  },
  {
    key: 'grp:catalogo', icon: <AppstoreOutlined />, label: 'Catálogo', rota: '/catalogo',
    children: [
      { key: '/catalogo', label: 'Painel do catálogo' },
      { key: '/catalogo/gerenciador', label: 'Produtos (SKUs)' },
      { key: '/catalogo/pendencias', label: 'Pendências do PIM' },
      { key: '/catalogo/duplicados', label: 'Itens duplicados' },
      { key: '/catalogo/familias', label: 'Famílias' },
      { key: '/catalogo/categorias', label: 'Categorias' },
      { key: '/catalogo/atributos', label: 'Atributos' },
      { key: '/catalogo/marcas', label: 'Marcas' },
      { key: '/catalogo/unidades', label: 'Unidades' },
      { key: '/catalogo/preco', label: 'Precificação' },
    ],
  },
  {
    key: 'grp:estoque', icon: <InboxOutlined />, label: 'Estoque', rota: '/estoque',
    children: [
      { key: '/estoque', label: 'Painel de Estoque' },
      { key: '/estoque/consulta', label: 'Consulta de Saldo' },
      { key: '/estoque/operacoes', label: 'Movimentações' },
      { key: '/estoque/etiquetagem', label: 'Etiquetagem' },
    ],
  },
  {
    key: 'grp:compras', icon: <ShoppingCartOutlined />, label: 'Compras', rota: '/compras',
    children: [
      { key: '/compras', label: 'Painel de Compras' },
      { key: '/compras/entrada-nfe', label: 'Entrada de NF-e' },
      { key: '/compras/notas', label: 'Notas de Entrada' },
      { key: '/stagings', label: 'Staging (Revisão de Lotes)' },
      { key: '/compras/ListaCompras', label: 'Lista de Compras' },
    ],
  },
  {
    key: 'grp:parceiros', icon: <TeamOutlined />, label: 'Parceiros', rota: '/parceiros',
    children: [
      { key: '/parceiros', label: 'Painel' },
      { key: '/parceiros/clientes', label: 'Clientes' },
      { key: '/parceiros/fornecedores', label: 'Fornecedores' },
      { key: '/parceiros/funcionarios', label: 'Funcionários' },
    ],
  },
  {
    key: 'grp:financeiro', icon: <DollarOutlined />, label: 'Financeiro', rota: '/financeiro',
    children: [
      { key: '/financeiro', label: 'Contas a Receber' },
      { key: '/financeiro/faturamento', label: 'Faturamento' },
    ],
  },
  { key: '/ecommerce', icon: <ShopOutlined />, label: 'E-commerce' },
  { key: '/relatorios', icon: <FileTextOutlined />, label: 'Relatórios' },
  { key: '/obras', icon: <ToolOutlined />, label: 'Obras / Projetos' },
];

// Telas de configuração (abertas pelo botão Configurações da barra lateral): entram no título e na busca
export const MENU_CONFIGURACOES: ItemMenu = {
  key: 'grp:configuracoes', label: 'Configurações',
  children: [
    { key: '/configuracoes/perfil', label: 'Meu Perfil' },
    { key: '/configuracoes/empresa', label: 'Dados da Empresa' },
    { key: '/configuracoes/preferencias', label: 'Preferências do Sistema' },
    { key: '/configuracoes/notificacoes', label: 'Central de Notificações' },
    { key: '/configuracoes/modulos', label: 'Módulos' },
    { key: '/ajuda', label: 'Ajuda e Suporte' },
  ],
};

const folhas = (itens: ItemMenu[], pai?: ItemMenu): Array<{ item: ItemMenu; pai?: ItemMenu }> =>
  itens.flatMap(i => (i.children ? folhas(i.children, i) : [{ item: i, pai }]));

/** Item do menu que corresponde à rota atual (a rota mais longa que é prefixo do caminho). */
export const itemDaRota = (pathname: string) => {
  const candidatos = folhas([...menuComModulos(MENU_PRINCIPAL, 'todos'), MENU_CONFIGURACOES]).filter(({ item }) =>
    item.key === pathname || (item.key !== '/' && pathname.startsWith(`${item.key}/`)));
  return candidatos.sort((a, b) => b.item.key.length - a.item.key.length)[0] || null;
};

/** Título da tela para o cabeçalho (ex.: "Estoque › Consulta de Saldo"). */
export const tituloDaRota = (pathname: string): string => {
  const achado = itemDaRota(pathname);
  if (!achado) return 'ERP';
  return achado.pai ? `${achado.pai.label} › ${achado.item.label}` : achado.item.label;
};
