// Impressões de uma venda já feita: reimprimir o comprovante (o mesmo da finalização, 80 mm) e o espelho da nota fiscal
// em A4 (para digitar a NF à mão no emissor da SEFAZ; na janela de impressão, "Salvar como PDF").
import { API_URL } from '../../../shared/api/config';
import { imprimirExtratoElgin } from '../../../shared/utils/printService';

const ROTULO_FORMA: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'PIX', DEBITO: 'Débito', CREDITO: 'Crédito', PRAZO: 'Crediário', TRANSFERENCIA: 'Transferência', ADIANTAMENTO: 'Sinal / crédito',
};

const lerJson = async (url: string, erro: string) => {
  const r = await fetch(url);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || erro);
  return d;
};

/** Reimprime o comprovante da venda (mesmo layout da finalização). */
export const reimprimirComprovante = async (idVenda: number) => {
  const v = await lerJson(`${API_URL}/api/vendas/pdv/vendas/${idVenda}`, 'Não foi possível carregar a venda.');
  imprimirExtratoElgin({
    cliente: v.cliente_nome || 'CONSUMIDOR',
    cpf: '',
    numero: String(v.id_venda),
    itens: (v.itens || []).map((i: any) => ({
      codigo: String(i.sku_snapshot || i.id_item),
      name: i.nome_snapshot,
      quantity: Number(i.quantidade),
      price: Number(i.preco_unitario),
      desconto: 0,
      unidade: i.unidade_sigla || 'UN',
    })),
    total: Number(v.total_liquido),
    pagamentos: (v.pagamentos || []).map((p: any) => ({ metodo: ROTULO_FORMA[p.forma] || p.forma, valor: Number(p.valor), parcelas: Number(p.parcelas) || 1 })),
    troco: (v.pagamentos || []).reduce((a: number, p: any) => a + (Number(p.troco) || 0), 0),
  });
};

// ---------------------------------------------------------------- espelho da NF (A4)

const TPAG: Record<string, string> = {
  '01': 'Dinheiro', '03': 'Cartão de crédito', '04': 'Cartão de débito', '05': 'Crédito loja (crediário)', '17': 'PIX',
  '18': 'Transferência bancária', '90': 'Sem pagamento', '99': 'Outros',
};
const ORIGEM: Record<number, string> = {
  0: 'Nacional', 1: 'Estrangeira – importação direta', 2: 'Estrangeira – mercado interno', 3: 'Nacional, importado 40–70%',
  4: 'Nacional, processo básico', 5: 'Nacional, importado ≤ 40%', 6: 'Estrangeira – importação direta, sem similar', 7: 'Estrangeira – mercado interno, sem similar', 8: 'Nacional, importado > 70%',
};
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const moeda = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const doc = (d: string | null | undefined) => {
  const s = String(d || '').replace(/\D/g, '');
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return s;
};
const cep = (c: string | null | undefined) => String(c || '').replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
const campo = (rotulo: string, valor: unknown, falta = false) =>
  `<div class="campo${falta ? ' falta' : ''}"><span>${esc(rotulo)}</span><b>${valor === null || valor === undefined || valor === '' ? (falta ? 'FALTA' : '—') : esc(valor)}</b></div>`;

/** Abre o espelho da nota da venda para imprimir ou salvar em PDF. */
export const imprimirEspelhoNf = async (idVenda: number, modelo?: '55' | '65') => {
  const janela = window.open('', '_blank');
  if (!janela) throw new Error('O navegador bloqueou a janela: libere os pop-ups deste site.');
  janela.document.write('<p style="font-family:Arial;padding:24px">Montando o espelho da nota…</p>');
  let e: any;
  try {
    e = await lerJson(`${API_URL}/api/fiscal/vendas/${idVenda}/espelho${modelo ? `?modelo=${modelo}` : ''}`, 'Não foi possível montar o espelho da nota.');
  } catch (err) {
    janela.close();
    throw err;
  }
  const n = e.nota;
  const em = e.emitente;
  const d = n?.destinatario;
  const end = d?.endereco;
  const nomeModelo = e.modelo === '55' ? 'NF-e (modelo 55)' : 'NFC-e (modelo 65)';
  const pj = String(d?.documento || '').replace(/\D/g, '').length === 14;

  const linhas = (n?.itens || []).map((i: any) => `
    <tr>
      <td class="c">${i.numero}</td><td>${esc(i.codigo)}</td><td class="desc">${esc(i.descricao)}</td>
      <td class="c${i.ncm ? '' : ' falta'}">${i.ncm || 'FALTA'}</td><td class="c">${i.cest || ''}</td><td class="c">${i.cfop}</td><td class="c">${i.csosn}</td>
      <td class="c" title="${esc(ORIGEM[i.origem] || '')}">${i.origem}</td><td class="c">${esc(i.unidade)}</td>
      <td class="r">${qtd(i.quantidade)}</td><td class="r">${moeda(i.valorUnitario)}</td><td class="r">${moeda(i.valorBruto)}</td>
      <td class="r">${i.desconto ? moeda(i.desconto) : ''}</td><td class="r">${i.outros ? moeda(i.outros) : ''}</td>
      <td class="r b">${moeda(i.valorBruto - i.desconto + i.outros)}</td>
    </tr>`).join('');

  const pagamentos = (n?.pagamentos || []).map((p: any) =>
    `<tr><td>${p.tPag} – ${esc(p.descricao || TPAG[p.tPag] || '')}</td><td class="r">${moeda(p.valor)}</td></tr>`).join('');

  janela.document.open();
  janela.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Espelho NF - venda ${idVenda}</title><style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 12px; }
    h1 { font-size: 16px; margin: 0; } h2 { font-size: 12px; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: .4px; color: #731717; border-bottom: 1px solid #731717; padding-bottom: 2px; }
    .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #731717; padding-bottom: 8px; }
    .aviso { background: #fff7e6; border: 1px solid #ffd591; padding: 6px 10px; margin-top: 8px; font-size: 11px; }
    .pend { background: #fff1f0; border: 1px solid #ffa39e; padding: 6px 10px; margin-top: 8px; }
    .pend li { margin: 2px 0; }
    .grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; }
    .campo { display: flex; flex-direction: column; border-bottom: 1px dotted #bbb; padding: 2px 0; }
    .campo span { font-size: 9px; color: #666; text-transform: uppercase; } .campo b { font-size: 12px; }
    .campo.falta b, td.falta { color: #cf1322; }
    .larga { grid-column: span 2; }
    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ccc; padding: 3px 4px; vertical-align: top; }
    th { background: #f3f3f3; font-size: 9px; text-transform: uppercase; } td.c { text-align: center; } td.r { text-align: right; white-space: nowrap; } td.b { font-weight: bold; }
    td.desc { min-width: 220px; }
    .baixo { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .tot td { font-size: 12px; } .tot tr:last-child td { font-weight: bold; font-size: 14px; background: #fafafa; }
    .rodape { margin-top: 12px; font-size: 9px; color: #777; display: flex; justify-content: space-between; }
    @media print { .naoimprime { display: none; } }
  </style></head><body>
    <div class="topo">
      <div>
        <h1>Espelho para emissão da nota fiscal</h1>
        <div>Venda <b>Nº ${idVenda}</b> · ${esc(e.venda.data)} · operador ${esc(e.venda.operador || '—')} · total da venda <b>R$ ${moeda(e.venda.total)}</b></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px"><b>${nomeModelo}</b></div>
        <div>Natureza: ${esc(n?.naturezaOperacao || 'VENDA DE MERCADORIA')}</div>
        <button class="naoimprime" onclick="window.print()" style="margin-top:6px;padding:4px 12px;cursor:pointer">Imprimir / Salvar PDF</button>
      </div>
    </div>
    <div class="aviso"><b>Não é documento fiscal.</b> Use estes dados para digitar a nota no emissor (SEFAZ / emissor gratuito).
      ${e.notaEmitida ? `<br>Esta venda já tem nota no ERP: <b>${esc(e.notaEmitida.status)}</b> (modelo ${esc(e.notaEmitida.modelo)}${e.notaEmitida.numero ? `, nº ${esc(e.notaEmitida.numero)}` : ''}).` : ''}</div>
    ${e.pendencias?.length ? `<div class="pend"><b>Falta no cadastro (resolva antes de emitir):</b><ul style="margin:4px 0 0 18px;padding:0">${e.pendencias.map((p: string) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}

    <h2>Emitente</h2>
    <div class="grade">
      ${campo('Razão social', em?.razaoSocial, !em)} ${campo('CNPJ', doc(em?.cnpj), !em)} ${campo('Inscrição estadual', em?.inscricaoEstadual, !em)} ${campo('Regime (CRT)', em ? (Number(em.crt) === 1 ? '1 – Simples Nacional' : em.crt) : null)}
      ${campo('Endereço', em ? `${em.logradouro || ''}, ${em.numero || ''}${em.complemento ? ` ${em.complemento}` : ''} – ${em.bairro || ''}` : null)} ${campo('Município / UF', em ? `${em.municipio || ''} / ${em.uf || ''}` : null)} ${campo('CEP', cep(em?.cep))} ${campo('Telefone', em?.telefone)}
    </div>

    <h2>Destinatário</h2>
    ${d ? `<div class="grade">
      <div class="campo larga"><span>${pj ? 'Razão social' : 'Nome'}</span><b>${esc(d.nome || '—')}</b></div>
      ${campo(pj ? 'CNPJ' : 'CPF', doc(d.documento), e.modelo === '55')} ${campo('Inscrição estadual', pj ? (d.inscricaoEstadual || 'ISENTO / não contribuinte?') : 'Não contribuinte')}
      <div class="campo larga"><span>Endereço</span><b>${end ? esc(`${end.logradouro}, ${end.numero} – ${end.bairro}`) : (e.modelo === '55' ? '<span style="color:#cf1322">FALTA</span>' : '—')}</b></div>
      ${campo('Município / UF', end ? `${end.municipio} / ${end.uf}` : null)} ${campo('CEP', cep(end?.cep))}
      ${campo('E-mail', d.email)} ${campo('Telefone', d.celular)}
    </div>` : '<div>Consumidor não identificado (NFC-e sem CPF).</div>'}

    <h2>Produtos</h2>
    ${n ? `<table>
      <thead><tr><th>#</th><th>Código</th><th>Descrição</th><th>NCM</th><th>CEST</th><th>CFOP</th><th>CSOSN</th><th>Orig.</th><th>Un</th><th>Qtd</th><th>V. unit.</th><th>V. bruto</th><th>Desconto</th><th>Outras</th><th>V. líquido</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>` : '<div>Venda só de serviço: não tem nota de produto (o serviço vai em nota de serviço/ISS).</div>'}
    ${e.servicos?.length ? `<div class="aviso">Serviços da venda fora desta nota (ISS): ${e.servicos.map((s: any) => `${esc(s.descricao)} (${qtd(s.quantidade)}) R$ ${moeda(s.total)}`).join('; ')}.</div>` : ''}

    ${n ? `<div class="baixo">
      <div><h2>Totais</h2><table class="tot">
        <tr><td>Valor dos produtos</td><td class="r">${moeda(n.totais.produtos)}</td></tr>
        <tr><td>Desconto</td><td class="r">${moeda(n.totais.desconto)}</td></tr>
        <tr><td>Outras despesas acessórias</td><td class="r">${moeda(n.totais.outros)}</td></tr>
        <tr><td>Frete / seguro</td><td class="r">0,00</td></tr>
        <tr><td>Valor total da nota</td><td class="r">${moeda(n.totais.total)}</td></tr>
      </table></div>
      <div><h2>Pagamento (tPag)</h2><table>${pagamentos}${n.troco ? `<tr><td>Troco</td><td class="r">${moeda(n.troco)}</td></tr>` : ''}</table>
        <div style="margin-top:6px;font-size:10px;color:#555">Simples Nacional: CSOSN 102/103 sem destaque de ICMS; 500 para itens com ST (CEST).</div></div>
      <div><h2>Informações complementares</h2><div style="border:1px solid #ccc;padding:6px;min-height:60px">${esc(n.informacoesComplementares)}${e.venda.observacao ? `<br>${esc(e.venda.observacao)}` : ''}</div>
        <div style="margin-top:6px;font-size:10px;color:#555">Origem: ${[...new Set((n.itens || []).map((i: any) => i.origem))].map((o: any) => `${o} = ${ORIGEM[o] || ''}`).join('; ')}</div></div>
    </div>` : ''}

    <div class="rodape"><span>Gerado pelo ERP em ${new Date().toLocaleString('pt-BR')}</span><span>Confira NCM, CFOP e CSOSN com a contabilidade quando tiver dúvida.</span></div>
  </body></html>`);
  janela.document.close();
};
