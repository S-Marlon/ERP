import { Item, Group } from './types'; // Ajuste o caminho conforme seu projeto

/**
 * Gera UUID simples para o Grupo
 */
export function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Gera cores estáveis via HSL baseadas no ID do grupo
 */
function getHslHue(groupId: string): number {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function getColorFromGroupId(groupId: string): string {
  return `hsl(${getHslHue(groupId)}, 60%, 92%)`;
}

export function getBorderColorFromGroupId(groupId: string): string {
  return `hsl(${getHslHue(groupId)}, 70%, 50%)`;
}

/**
 * Verifica se o item tem override de atributos
 */
export function hasAttributeOverride(item: Item): boolean {
  return !!item.atributosCustomizados && item.atributosCustomizados.length > 0;
}

/**
 * Gera nome de exibição para item (baseado em grupo + atributos)
 */
export function generateItemDisplayName(item: Item, group?: Group | null): string {
  if (!group) return 'Aguardando vínculo';

  // Se tem customizado, usa eles. Se não, idealmente pegaria os valores preenchidos no item.
  const atributos = item.atributosCustomizados?.length
    ? item.atributosCustomizados
    : [];

  const valores = atributos
    .map(a => a.valor)
    .filter(Boolean);

  return valores.length > 0 
    ? [group.nome, ...valores].join(' - ') 
    : group.nome;
}