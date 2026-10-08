// Taxa da maquininha usada no cálculo de cada preço (comercial_precos_faixas.taxa_embutida).
// Mudar a taxa em Vendas › Taxas NÃO muda preço: a faixa guarda a taxa com que foi calculada e a precificação
// acusa a diferença até alguém atualizar. Enquanto o script da coluna não roda, o sistema funciona sem ela.
type Conn = { execute: (sql: string, params?: any[]) => Promise<any> };

let existe = false;

/** A coluna existe? (só o "sim" fica guardado: depois do script, passa a valer sem reiniciar) */
export const temTaxaEmbutida = async (conn: Conn): Promise<boolean> => {
  if (existe) return true;
  try {
    const [rows] = await conn.execute(`SHOW COLUMNS FROM comercial_precos_faixas LIKE 'taxa_embutida'`);
    existe = (rows as unknown[]).length > 0;
  } catch {
    existe = false;
  }
  return existe;
};

/** Trecho de SELECT: a coluna, ou NULL enquanto ela não existe. */
export const colunaTaxaEmbutida = (alias: string, tem: boolean) => (tem ? `${alias}.taxa_embutida` : 'NULL');

export interface FaixaGravada { sigla: string; tipo: string; ordem: number; preco: number; taxa: number | null }

/**
 * Taxa a gravar numa faixa ao salvar a configuração: preço igual ao que já estava gravado mantém a taxa antiga
 * (salvar outra coisa do item não esconde a defasagem); preço novo ou recalculado leva a taxa atual.
 */
export const taxaParaGravar = (
  faixa: { sigla: string; tipo: string; ordem: number; preco: number },
  anteriores: FaixaGravada[],
  taxaAtual: number
): number | null => {
  const igual = anteriores.find(a =>
    a.sigla === faixa.sigla && a.tipo === faixa.tipo && a.ordem === faixa.ordem && Math.abs(a.preco - faixa.preco) < 0.005);
  return igual ? igual.taxa : taxaAtual;
};
