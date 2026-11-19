// Mapa único do menu: usado pela barra lateral (itens) e pelo cabeçalho (título da tela atual).
import React from 'react';
import { menuComModulos } from '../../modulos/registroModulos';
import {
  AimOutlined, AppstoreOutlined, CarOutlined, DollarOutlined, FileTextOutlined, HomeOutlined, InboxOutlined, ShopOutlined,
  ShoppingCartOutlined, ShopTwoTone, TeamOutlined, ToolOutlined,
} from '@ant-design/icons';

export interface ItemMenu {
  key: string;          // rota (folha) ou identificador do grupo (começa com "grp:")
  label: string;
  rota?: string;        // grupo: tela principal do módulo (abre ao clicar no nome na barra lateral)
  icon?: React.ReactNode;
  children?: ItemMenu[];
  /** Outras rotas que marcam este item (telas do mesmo grupo que não têm item próprio na barra lateral). */
  tambem?: string[];
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
      { key: '/vendas/pedidos-faturados', label: 'Pedidos faturados' },
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
      { key: '/catalogo/tags', label: 'Tags' },
      { key: '/catalogo/logistica', label: 'Logística em lote' },
      { key: '/catalogo/unidades', label: 'Unidades' },
      { key: '/catalogo/kits', label: 'Kits de venda' },
      { key: '/catalogo/preco', label: 'Precificação' },
      { key: '/catalogo/preco/atacado', label: 'Varejo e atacado em lote' },
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
      { key: '/compras/inteligente', label: 'Compra inteligente' },
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
      { key: '/financeiro/painel', label: 'Painel' },
      { key: '/financeiro/resultado', label: 'Resultado do mês' },
      { key: '/financeiro', label: 'Contas a Receber' },
      { key: '/financeiro/pagar', label: 'Contas a Pagar' },
      { key: '/financeiro/contas-fixas', label: 'Contas Fixas' },
      { key: '/financeiro/faturamento', label: 'Faturamento' },
    ],
  },
  // Só os módulos de canal (Mercado Livre...) preenchem: sem módulo ligado o grupo não aparece
  { key: 'grp:ecommerce', icon: <ShopOutlined />, label: 'E-commerce', children: [] },
  { key: 'grp:frota', icon: <CarOutlined />, label: 'Frota', children: [] },
  { key: 'grp:pocos', icon: <AimOutlined />, label: 'Poços artesianos', rota: '/modulos/hidraulica/pocos', children: [] },
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
  const casa = (rota: string) => rota === pathname || (rota !== '/' && pathname.startsWith(`${rota}/`));
  const candidatos = folhas([...menuComModulos(MENU_PRINCIPAL, 'todos'), MENU_CONFIGURACOES])
    .map(f => ({ ...f, tamanho: Math.max(-1, ...[f.item.key, ...(f.item.tambem || [])].filter(casa).map(r => r.length)) }))
    .filter(f => f.tamanho >= 0);
  const melhor = candidatos.sort((a, b) => b.tamanho - a.tamanho)[0];
  return melhor ? { item: melhor.item, pai: melhor.pai } : null;
};

/** Título da tela para o cabeçalho (ex.: "Estoque › Consulta de Saldo"). */
export const tituloDaRota = (pathname: string): string => {
  const achado = itemDaRota(pathname);
  if (!achado) return 'ERP';
  return achado.pai ? `${achado.pai.label} › ${achado.item.label}` : achado.item.label;
};
