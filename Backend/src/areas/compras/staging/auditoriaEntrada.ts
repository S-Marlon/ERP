// Sinais de que uma linha de NF já aprovada entrou errado (vínculo ou conversão).
// Regras puras: o controller carrega os dados; aqui só se decide o alerta.

export type CodigoAlertaEntrada = 'CUSTO_DESTOA' | 'CODIGO_EM_OUTRO_ITEM' | 'GTIN_DIVERGENTE';

export interface AlertaEntrada {
  codigo: CodigoAlertaEntrada;
  mensagem: string;
}

export interface LinhaParaAuditoria {
  custoEntrada: number | null;        // custo por unidade base com que a linha entrou
  custosAnteriores: number[];         // custos (unidade base) das outras entradas por NF do mesmo item
  custoGerencial: number | null;      // referência quando o item não tem outras entradas
  outrosItensMesmoCodigo: string[];   // SKUs de outros itens que já entraram com o mesmo código deste fornecedor
  gtinLinha: string | null;           // GTIN da nota (válido)
  gtinsDoItem: string[];              // GTINs cadastrados no item vinculado
}

// Custo fora desta faixa em relação à referência indica fator de conversão ou vínculo errado
export const LIMITE_CUSTO_ALTO = 1.6;
export const LIMITE_CUSTO_BAIXO = 0.6;

export const mediana = (valores: number[]): number | null => {
  const v = valores.filter(x => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export const alertasDaLinha = (l: LinhaParaAuditoria): AlertaEntrada[] => {
  const alertas: AlertaEntrada[] = [];

  const referenciaCompras = mediana(l.custosAnteriores);
  const referencia = referenciaCompras ?? (l.custoGerencial && l.custoGerencial > 0 ? l.custoGerencial : null);
  if (l.custoEntrada && l.custoEntrada > 0 && referencia) {
    const razao = l.custoEntrada / referencia;
    if (razao >= LIMITE_CUSTO_ALTO || razao <= LIMITE_CUSTO_BAIXO) {
      const pct = Math.round((razao - 1) * 100);
      const base = referenciaCompras !== null ? 'das compras anteriores' : 'do custo do cadastro';
      alertas.push({
        codigo: 'CUSTO_DESTOA',
        mensagem: `Custo ${brl(l.custoEntrada)} está ${pct > 0 ? `${pct}% acima` : `${Math.abs(pct)}% abaixo`} ${base} (${brl(referencia)}): confira a conversão (fator) ou o vínculo.`,
      });
    }
  }

  if (l.outrosItensMesmoCodigo.length > 0) {
    alertas.push({
      codigo: 'CODIGO_EM_OUTRO_ITEM',
      mensagem: `Este código do fornecedor já entrou como ${l.outrosItensMesmoCodigo.join(', ')} em outra nota: pode ser item duplicado ou vínculo errado.`,
    });
  }

  if (l.gtinLinha && l.gtinsDoItem.length > 0 && !l.gtinsDoItem.includes(l.gtinLinha)) {
    alertas.push({
      codigo: 'GTIN_DIVERGENTE',
      mensagem: `GTIN da nota (${l.gtinLinha}) não é nenhum dos códigos de barras do item vinculado.`,
    });
  }

  return alertas;
};
