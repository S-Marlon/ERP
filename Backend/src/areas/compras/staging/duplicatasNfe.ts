// Duplicatas (boletos/parcelas) da NF-e: grupo <cobr><dup> do XML. O resumo salvo no lote não guarda esse grupo,
// então a lista lê só o trecho <cobr>…</cobr> do XML e esta função monta as parcelas.

export interface DuplicataNfe { numero: string; vencimento: string | null; valor: number }

const tag = (bloco: string, nome: string) => bloco.match(new RegExp(`<(?:\\w+:)?${nome}>([^<]*)</(?:\\w+:)?${nome}>`))?.[1]?.trim() ?? null;

/** Parcelas do grupo de cobrança, na ordem do XML. Aceita o XML inteiro ou só o trecho <cobr>. */
export const duplicatasDoXml = (xml: string | null | undefined): DuplicataNfe[] => {
  if (!xml) return [];
  const blocos = String(xml).match(/<(?:\w+:)?dup>[\s\S]*?<\/(?:\w+:)?dup>/g) || [];
  return blocos.map((b, i) => {
    const venc = tag(b, 'dVenc');
    return {
      numero: tag(b, 'nDup') || String(i + 1).padStart(3, '0'),
      vencimento: venc && /^\d{4}-\d{2}-\d{2}$/.test(venc) ? venc : null,
      valor: Math.round((Number(tag(b, 'vDup')) || 0) * 100) / 100,
    };
  });
};

/** Filtro da lista: 'com' (tem duplicata), 'sem' ou qualquer outra coisa (todas). */
export const passaFiltroDuplicatas = (filtro: unknown, quantidade: number) =>
  filtro === 'com' ? quantidade > 0 : filtro === 'sem' ? quantidade === 0 : true;
