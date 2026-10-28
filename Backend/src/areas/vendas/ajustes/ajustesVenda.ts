// Ajuste de venda a prazo já concluída: mudar quantidade e preço das linhas, tirar linha (fica com quantidade 0) e
// incluir item. Regras puras: o que muda em cada linha (e no estoque) e como a diferença vai para as parcelas abertas.

export class ErroAjuste extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const DESTINOS = ['ESPALHAR', 'ULTIMA', 'NOVA'] as const;
export type Destino = typeof DESTINOS[number];

const c = (v: number) => Math.round(Number(v || 0) * 100);
const r = (v: number) => v / 100;
const arred4 = (v: number) => Math.round(Number(v || 0) * 10000) / 10000;

/** Linha da venda como está no banco. */
export interface LinhaAtual {
  idVendaItem: number; idItem: number; nome: string; quantidade: number; fator: number; precoTabela: number; precoUnitario: number;
  totalItem: number; devolvido: number; kit: boolean;
}
export interface PedidoLinha { idVendaItem: number; quantidade: number; precoUnitario: number }
/** Item novo já calculado (preço de tabela da faixa, fator da unidade). */
export interface LinhaNova { idItem: number; nome: string; quantidade: number; fator: number; precoTabela: number; precoUnitario: number; idUnidade: number | null; sigla: string | null }

export interface MudancaLinha {
  idVendaItem: number | null; idItem: number; tipo: 'ALTERADO' | 'INCLUIDO' | 'REMOVIDO';
  quantidadeAntes: number; quantidadeDepois: number; precoAntes: number; precoDepois: number; totalAntes: number; totalDepois: number;
  /** Na unidade base: positivo = sai do estoque, negativo = volta. */
  deltaBase: number; descontoValor: number; nova?: LinhaNova;
}

const totalDaLinha = (quantidade: number, preco: number) => r(c(quantidade * preco));
const descontoDaLinha = (quantidade: number, precoTabela: number, total: number) => r(Math.max(0, c(Math.max(precoTabela, total / (quantidade || 1)) * quantidade) - c(total)));

/**
 * O que muda na venda. Linha sem mudança fica de fora. Quantidade não desce abaixo do já devolvido; linha de kit não
 * muda (as saídas são dos componentes: use a devolução); a venda precisa continuar com algum item.
 */
export const planejarAjuste = (atuais: LinhaAtual[], pedidos: PedidoLinha[], novas: LinhaNova[]) => {
  const porId = new Map(atuais.map(l => [l.idVendaItem, l]));
  const mudancas: MudancaLinha[] = [];
  const vistos = new Set<number>();
  for (const p of pedidos) {
    const l = porId.get(Number(p.idVendaItem));
    if (!l) throw new ErroAjuste(`Linha ${p.idVendaItem} não é desta venda.`);
    if (vistos.has(l.idVendaItem)) throw new ErroAjuste(`Linha "${l.nome}" repetida no ajuste.`);
    vistos.add(l.idVendaItem);
    const qtd = arred4(Number(p.quantidade));
    const preco = arred4(Number(p.precoUnitario));
    if (!Number.isFinite(qtd) || qtd < 0) throw new ErroAjuste(`Quantidade inválida em "${l.nome}".`);
    if (!Number.isFinite(preco) || preco < 0) throw new ErroAjuste(`Preço inválido em "${l.nome}".`);
    const mudouQtd = Math.abs(qtd - l.quantidade) >= 0.00005;
    const mudouPreco = Math.abs(preco - l.precoUnitario) >= 0.00005;
    if (!mudouQtd && !mudouPreco) continue;
    if (l.kit) throw new ErroAjuste(`"${l.nome}" é um kit: para tirar ou mudar, use a devolução.`);
    if (qtd < l.devolvido - 1e-9) throw new ErroAjuste(`"${l.nome}": já foram devolvidos ${l.devolvido}; a quantidade não pode ficar menor.`);
    // só mudou a quantidade: mantém o preço final da linha; mudou o preço: total = quantidade × preço novo
    const total = qtd === 0 ? 0 : totalDaLinha(qtd, preco);
    mudancas.push({
      idVendaItem: l.idVendaItem, idItem: l.idItem, tipo: qtd === 0 ? 'REMOVIDO' : 'ALTERADO',
      quantidadeAntes: l.quantidade, quantidadeDepois: qtd, precoAntes: l.precoUnitario, precoDepois: preco, totalAntes: l.totalItem, totalDepois: total,
      deltaBase: arred4((qtd - l.quantidade) * l.fator), descontoValor: descontoDaLinha(qtd, l.precoTabela, total),
    });
  }
  for (const n of novas) {
    const qtd = arred4(Number(n.quantidade));
    if (!(qtd > 0)) throw new ErroAjuste(`Quantidade inválida em "${n.nome}".`);
    if (!(n.precoUnitario >= 0)) throw new ErroAjuste(`Preço inválido em "${n.nome}".`);
    const total = totalDaLinha(qtd, n.precoUnitario);
    mudancas.push({
      idVendaItem: null, idItem: n.idItem, tipo: 'INCLUIDO', quantidadeAntes: 0, quantidadeDepois: qtd, precoAntes: 0, precoDepois: arred4(n.precoUnitario),
      totalAntes: 0, totalDepois: total, deltaBase: arred4(qtd * n.fator), descontoValor: descontoDaLinha(qtd, n.precoTabela, total), nova: { ...n, quantidade: qtd },
    });
  }
  if (!mudancas.length) throw new ErroAjuste('Nada mudou na venda.');
  const sobram = atuais.filter(l => {
    const m = mudancas.find(x => x.idVendaItem === l.idVendaItem);
    return (m ? m.quantidadeDepois : l.quantidade) > 0;
  }).length + novas.length;
  if (!sobram) throw new ErroAjuste('A venda ficaria sem itens: para desfazer tudo, cancele a venda.');
  const diferenca = r(mudancas.reduce((s, m) => s + c(m.totalDepois) - c(m.totalAntes), 0));
  return { mudancas, diferenca };
};

export interface TituloDaVenda { idTitulo: number; parcela: number; vencimento: string | null; valor: number; valorPago: number; status: string }
export interface AlteracaoTitulo { idTitulo: number; novoValor: number; status: 'ABERTO' | 'PAGO' | 'CANCELADO' }

/** Ordem das parcelas: por vencimento (sem prazo por último), depois pelo número. */
const ordem = (a: TituloDaVenda, b: TituloDaVenda) =>
  (a.vencimento || '9999-12-31').localeCompare(b.vencimento || '9999-12-31') || a.parcela - b.parcela;

/**
 * Leva a diferença do ajuste às parcelas em aberto. Acréscimo: espalhado igual, todo na última ou numa parcela nova.
 * Redução: tirada das parcelas abertas (igual ou a partir da última), sem passar do que falta receber de cada uma.
 * Parcela paga não muda; redução maior que o saldo em aberto é recusada (use a devolução, que devolve o dinheiro).
 */
export const distribuirDiferenca = (titulos: TituloDaVenda[], diferenca: number, destino: Destino, vencimentoNova?: string | null) => {
  if (!DESTINOS.includes(destino)) throw new ErroAjuste('Destino da diferença inválido.');
  const abertos = titulos.filter(t => t.status === 'ABERTO' && c(t.valor) > c(t.valorPago)).sort(ordem);
  const dif = c(diferenca);
  const alteracoes: AlteracaoTitulo[] = [];
  if (dif === 0) return { alteracoes, nova: null as null | { valor: number; vencimento: string | null } };
  if (dif > 0) {
    if (destino === 'NOVA' || !abertos.length) {
      if (destino !== 'NOVA') throw new ErroAjuste('Não há parcela em aberto: escolha "parcela nova" com o vencimento.');
      if (vencimentoNova && !/^\d{4}-\d{2}-\d{2}$/.test(vencimentoNova)) throw new ErroAjuste('Vencimento da parcela nova inválido.');
      return { alteracoes, nova: { valor: r(dif), vencimento: vencimentoNova || null } };
    }
    const alvo = destino === 'ULTIMA' ? [abertos[abertos.length - 1]] : abertos;
    const parte = Math.floor(dif / alvo.length);
    alvo.forEach((t, i) => {
      const soma = i === alvo.length - 1 ? dif - parte * (alvo.length - 1) : parte;
      alteracoes.push({ idTitulo: t.idTitulo, novoValor: r(c(t.valor) + soma), status: 'ABERTO' });
    });
    return { alteracoes, nova: null };
  }
  if (destino === 'NOVA') throw new ErroAjuste('Redução não vira parcela nova: escolha espalhar ou a última parcela.');
  let falta = -dif;
  const saldoAberto = abertos.reduce((s, t) => s + c(t.valor) - c(t.valorPago), 0);
  if (falta > saldoAberto) {
    throw new ErroAjuste(`A redução (R$ ${r(falta).toFixed(2)}) passa do que falta receber desta venda (R$ ${r(saldoAberto).toFixed(2)}): use a devolução para devolver o restante ao cliente.`, 409);
  }
  const tira = new Map<number, number>();
  if (destino === 'ULTIMA') {
    for (const t of [...abertos].reverse()) {
      if (falta <= 0) break;
      const x = Math.min(falta, c(t.valor) - c(t.valorPago));
      tira.set(t.idTitulo, x); falta -= x;
    }
  } else {
    // igual entre as abertas; a que não aguenta a parte fica zerada e o resto passa para as outras
    let restantes = [...abertos];
    while (falta > 0 && restantes.length) {
      const parte = Math.max(1, Math.floor(falta / restantes.length));
      const proximas: TituloDaVenda[] = [];
      for (const [i, t] of restantes.entries()) {
        if (falta <= 0) break;
        const saldo = c(t.valor) - c(t.valorPago) - (tira.get(t.idTitulo) || 0);
        const quer = i === restantes.length - 1 ? falta : Math.min(parte, falta);
        const x = Math.min(saldo, quer);
        tira.set(t.idTitulo, (tira.get(t.idTitulo) || 0) + x); falta -= x;
        if (saldo - x > 0) proximas.push(t);
      }
      restantes = proximas;
    }
  }
  for (const t of abertos) {
    const x = tira.get(t.idTitulo) || 0;
    if (!x) continue;
    const novo = c(t.valor) - x;
    alteracoes.push({ idTitulo: t.idTitulo, novoValor: r(novo), status: novo <= c(t.valorPago) ? (c(t.valorPago) > 0 ? 'PAGO' : 'CANCELADO') : 'ABERTO' });
  }
  return { alteracoes, nova: null };
};

/** Totais da venda depois do ajuste, pelas linhas (o frete fica como está). */
export const totaisDaVenda = (linhas: { quantidade: number; precoTabela: number; precoUnitario: number; totalItem: number }[], frete: number) => {
  const bruto = linhas.reduce((s, l) => s + c(Math.max(l.precoTabela, l.precoUnitario) * l.quantidade), 0);
  const itens = linhas.reduce((s, l) => s + c(l.totalItem), 0);
  return { totalBruto: r(bruto), totalDesconto: r(Math.max(0, bruto - itens)), totalLiquido: r(itens + c(frete)) };
};
