// Limpeza do modelo guardado do editor de imagem (JSON do Fabric), antes de abrir: tira elementos repetidos empilhados
// no mesmo lugar (sobra de uma versão que duplicava ao mexer nos controles) e a foto com endereço `blob:`, que só vale
// enquanto a tela que a abriu está aberta (abrir com ela trava o carregamento).

interface ObjetoSalvo {
  left?: number; top?: number; angle?: number; scaleX?: number; scaleY?: number; flipX?: boolean; flipY?: boolean;
  src?: string;
  dadosElemento?: { tipo?: string } & Record<string, unknown>;
  [k: string]: unknown;
}

const r = (n: number | undefined, casas = 0) => Math.round((n || 0) * 10 ** casas) / 10 ** casas;
const chave = (o: ObjetoSalvo) => JSON.stringify([o.dadosElemento, r(o.left), r(o.top), r(o.angle), r(o.scaleX, 3), r(o.scaleY, 3), !!o.flipX, !!o.flipY]);

export interface ModeloLimpo { json: string; repetidos: number; fotoDescartada: boolean }

export const limparModelo = (json: string): ModeloLimpo => {
  const modelo = JSON.parse(json) as { objects?: ObjetoSalvo[] };
  const vistos = new Set<string>();
  let repetidos = 0;
  let fotoDescartada = false;
  modelo.objects = (modelo.objects || []).filter(o => {
    const tipo = o.dadosElemento?.tipo;
    if (tipo === 'FOTO') {
      if (typeof o.src === 'string' && /^blob:/i.test(o.src)) { fotoDescartada = true; return false; }
      return true;
    }
    if (!tipo) return true;
    const k = chave(o);
    if (vistos.has(k)) { repetidos++; return false; }
    vistos.add(k);
    return true;
  });
  return { json: repetidos || fotoDescartada ? JSON.stringify(modelo) : json, repetidos, fotoDescartada };
};
