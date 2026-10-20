// Ajudas dos formulários das contas da loja: o primeiro mês sugerido para a conta fixa (não nascer vencida) e as opções
// de categoria agrupadas.
import type { CategoriaConta } from './pagarApi';

/** Mês ('AAAA-MM') da primeira conta: este mês se o dia ainda não passou; senão, o próximo. */
export const primeiroMesSugerido = (hoje: string, dia: number) => {
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7)), diaHoje = Number(hoje.slice(8, 10));
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  if (Math.min(dia, ultimo) >= diaHoje) return hoje.slice(0, 7);
  const d = new Date(Date.UTC(ano, mes, 1));   // mês seguinte
  return d.toISOString().slice(0, 7);
};

/** Opções do Select de categoria, por grupo (só as ativas e do tipo pedido; a já escolhida aparece mesmo desativada). */
export const opcoesDeCategoria = (lista: CategoriaConta[], tipo: CategoriaConta['tipo'] = 'DESPESA', atual?: number | null) => {
  const grupos = new Map<string, { value: number; label: string }[]>();
  for (const c of lista) {
    if (c.tipo !== tipo || (!c.ativo && c.idCategoria !== atual)) continue;
    if (!grupos.has(c.grupo)) grupos.set(c.grupo, []);
    grupos.get(c.grupo)!.push({ value: c.idCategoria, label: c.nome });
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([grupo, options]) => ({ label: grupo, options }));
};
