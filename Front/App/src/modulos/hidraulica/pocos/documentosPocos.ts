// Obras de poços › documentos para imprimir (ou "Salvar como PDF" no navegador): o orçamento, o contrato, o termo aditivo,
// o laudo de entrega e o adesivo do quadro, com o logo e os dados da empresa da configuração do processo. Funções puras:
// recebem os dados da obra e devolvem a página HTML completa. Contrato e aditivo saem de modelos de texto com {campos}.
import type { Aditivo, DocumentoObra, ItemOrcamentoForm } from './obrasApi';

const SERVICOS_TXT: Record<string, string> = {
  PERFURACAO: 'Perfuração', INSTALACAO: 'Instalação da bomba', LIMPEZA: 'Limpeza', MANUTENCAO: 'Manutenção', TROCA_BOMBA: 'Troca de bomba',
  TESTE_VAZAO: 'Teste de vazão', OUTRO: 'Outro',
};
export const escapar = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
export const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const num = (v: number | null | undefined, un: string) => (v === null || v === undefined ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${un}`);
const dataBr = (s: string | null | undefined) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');
const fone = (s: string | null | undefined) => {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
};
const doc = (d: string | null | undefined) => {
  const x = String(d ?? '').replace(/\D/g, '');
  return x.length === 14 ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}`
    : x.length === 11 ? `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}` : x;
};
export const paragrafos = (t: string | null | undefined) => escapar(t || '').split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('');

// Visual dos documentos: papel timbrado (logo e dados da empresa à esquerda, quadro do documento à direita), seções
// numeradas, tabelas com cabeçalho escuro e o total em destaque. Na tela (pré-visualização) a página aparece como folha A4.
const ESTILO = `<style>
  :root { --a: #12456b; --t: #1f2a37; --m: #5b6876; --b: #d6dee6; --c: #e8f0f7; }
  @page { size: A4; margin: 13mm 14mm 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 10pt; color: var(--t); margin: 0; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen {
    html { background: #e5e7eb; }
    body { width: 210mm; min-height: 297mm; margin: 14px auto; padding: 13mm 14mm 15mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,.18); }
  }
  p { margin: 1.2mm 0; }
  .topo { display: flex; justify-content: space-between; align-items: stretch; gap: 8mm; padding-bottom: 4mm; border-bottom: 2.5pt solid var(--a); margin-bottom: 6mm; }
  .marca { display: flex; gap: 4mm; align-items: center; }
  .marca img { max-height: 20mm; max-width: 50mm; }
  .marca .nome { font-size: 15pt; font-weight: 700; color: var(--a); line-height: 1.15; }
  .marca .dados { font-size: 8pt; color: var(--m); line-height: 1.55; margin-top: 1mm; }
  .docbox { text-align: right; border-left: 1px solid var(--b); padding-left: 6mm; min-width: 48mm; display: flex; flex-direction: column; justify-content: center; }
  .docbox .tipo { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 1.2pt; color: var(--m); }
  .docbox .num { font-size: 17pt; font-weight: 700; color: var(--a); line-height: 1.15; }
  .docbox .data { font-size: 8pt; color: var(--m); }
  h1 { font-size: 14pt; margin: 0 0 .5mm; font-weight: 700; }
  .sub { color: var(--m); font-size: 9pt; margin-bottom: 5mm; }
  h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1pt; color: var(--a); margin: 6mm 0 2.5mm; padding-bottom: 1.2mm;
    border-bottom: 1px solid var(--b); font-weight: 700; break-after: avoid; }
  h2 .n { display: inline-block; min-width: 4.6mm; text-align: center; background: var(--a); color: #fff; border-radius: 2px; margin-right: 2mm; }
  /* as linhas entre as células são o vão da grade (fundo cinza aparecendo), então nunca desalinham */
  .ficha { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--b); border: 1px solid var(--b); border-radius: 1.5mm; overflow: hidden; break-inside: avoid; }
  .ficha > div { padding: 1.8mm 3mm; background: #fff; }
  .ficha .largo { grid-column: 1 / -1; }
  .ficha.tres { grid-template-columns: 1fr 1fr 1fr; }
  .ficha.branco .v { font-weight: 400; }
  .r { font-size: 7pt; text-transform: uppercase; letter-spacing: .6pt; color: var(--m); }
  .v { font-weight: 600; min-height: 5mm; }
  .v small { font-weight: 400; color: var(--m); }
  table { border-collapse: collapse; width: 100%; }
  table.itens th { background: var(--a); color: #fff; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5pt; font-weight: 600; padding: 1.8mm 2.5mm; text-align: left; }
  table.itens th.n { text-align: right; }
  table.itens td { padding: 1.6mm 2.5mm; border-bottom: 1px solid var(--b); vertical-align: top; }
  table.itens tr:nth-child(even) td { background: #f7f9fb; }
  table.itens .n { text-align: right; white-space: nowrap; width: 1%; }
  table.itens tr.total td { background: var(--c); font-weight: 700; font-size: 10.5pt; border-top: 1.5pt solid var(--a); border-bottom: 0; color: var(--a); }
  table.itens tr.grupo td { background: #fff; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5pt; color: var(--m); padding-top: 4mm; font-weight: 600; }
  table.itens tr.opcional td { color: var(--m); }
  tr { break-inside: avoid; }
  .pill { display: inline-block; font-size: 6.8pt; font-weight: 700; letter-spacing: .5pt; text-transform: uppercase; padding: .2mm 1.8mm; border-radius: 8px; background: #e3f1e8; color: #1e6b3a; }
  .resumo { display: flex; gap: 3mm; margin: 3mm 0; break-inside: avoid; }
  .resumo > div { flex: 1; border: 1px solid var(--b); border-radius: 1.5mm; padding: 2.2mm 3mm; }
  .resumo .v { font-size: 13pt; }
  .resumo .destaque { background: var(--a); border-color: var(--a); color: #fff; } .resumo .destaque .r { color: rgba(255,255,255,.75); }
  .nota { font-size: 8.5pt; color: var(--m); }
  .condicoes { border: 1px solid var(--b); background: #fafbfc; border-radius: 1.5mm; padding: 3mm 4mm 2mm 7mm; margin: 0; font-size: 8pt; color: #374151;
    column-count: 2; column-gap: 7mm; }
  .condicoes li { margin: 0 0 1.6mm; break-inside: avoid; }
  .condicoes b { color: var(--t); }
  .local-data { margin-top: 8mm; }
  .assinaturas { display: flex; gap: 12mm; margin-top: 16mm; break-inside: avoid; }
  .assinaturas > div { flex: 1; border-top: 1px solid #374151; padding-top: 1.5mm; text-align: center; font-size: 8pt; color: var(--m); line-height: 1.4; }
  .assinaturas b { display: block; color: var(--t); font-size: 9pt; }
  .assinaturas.quatro { flex-wrap: wrap; row-gap: 16mm; } .assinaturas.quatro > div { flex: 1 1 40%; }
  .campo { display: inline-block; border-bottom: 1px solid #6b7280; height: 4.3mm; vertical-align: bottom; max-width: 100%; }
  .caixa { display: inline-block; width: 3.3mm; height: 3.3mm; border: 1px solid #374151; border-radius: .6mm; vertical-align: -.5mm; margin: 0 1mm 0 3mm; }
  .caixa:first-child { margin-left: 0; }
  .rodape { margin-top: 8mm; padding-top: 2mm; border-top: 1px solid var(--b); font-size: 7.5pt; color: var(--m); text-align: center; }
  /* documento de uma folha só (proposta "basicão"): menos respiro entre as partes */
  .compacta .topo { margin-bottom: 3.5mm; padding-bottom: 3mm; }
  .compacta h1 { font-size: 13pt; } .compacta .sub { margin-bottom: 2.5mm; font-size: 8.5pt; }
  .compacta h2 { margin: 3.5mm 0 1.8mm; }
  .compacta .ficha > div { padding: 1.2mm 3mm; }
  .compacta table.itens td { padding: 1.2mm 2.5mm; }
  .compacta .nota { font-size: 8pt; }
  .compacta .condicoes { font-size: 7.3pt; padding: 2mm 3mm .5mm 6mm; line-height: 1.35; }
  .compacta .condicoes li { margin-bottom: 1.1mm; }
  .compacta .local-data { margin-top: 4mm; }
  .compacta .assinaturas { margin-top: 10mm; }
  .pagina-contrato { page: contrato; }
  .contrato { font-family: Cambria, 'Times New Roman', serif; font-size: 10pt; line-height: 1.6; text-align: justify; }
  .contrato h1 { font-family: 'Segoe UI', Arial, sans-serif; text-align: center; font-size: 12.5pt; letter-spacing: .6pt; margin: 1mm 0 5mm; }
  .contrato h3 { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .8pt; color: var(--a);
    margin: 5mm 0 1.5mm; break-after: avoid; }
  .contrato p { margin: 1.4mm 0; }
  .contrato table.itens { font-family: 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; margin: 2mm 0; text-align: left; }
</style>`;

/** Papel timbrado: logo (ou nome) e dados da empresa à esquerda; à direita, o quadro do documento (tipo, número, data). */
export const cabecalho = (d: Pick<DocumentoObra, 'empresa'>, logo: string | null, documento?: { tipo: string; numero?: string; data?: string }) => {
  const e = d.empresa;
  const linha1 = [e.empresaDocumento && `CNPJ ${doc(e.empresaDocumento)}`, e.empresaTelefone && `Tel. ${fone(e.empresaTelefone)}`,
    e.empresaWhatsapp && `WhatsApp ${fone(e.empresaWhatsapp)}`].filter(Boolean).map(escapar).join(' · ');
  const linha2 = [e.empresaEmail, e.empresaEndereco].filter(Boolean).map(escapar).join(' · ');
  return `<div class="topo">
    <div class="marca">${logo ? `<img src="${escapar(logo)}" alt="logo">` : ''}
      <div><div class="nome">${escapar(e.empresaNome || '')}</div><div class="dados">${linha1}${linha1 && linha2 ? '<br>' : ''}${linha2}</div></div></div>
    ${documento ? `<div class="docbox"><div class="tipo">${escapar(documento.tipo)}</div>${documento.numero ? `<div class="num">${escapar(documento.numero)}</div>` : ''}
      ${documento.data ? `<div class="data">${escapar(documento.data)}</div>` : ''}</div>` : ''}
  </div>`;
};

/** Sequências de "_____" viram linhas de preencher (para os modelos em branco e os campos que faltam). */
const linhasDePreencher = (html: string) =>
  html.replace(/_{4,}/g, m => `<span class="campo" style="width:${Math.min(170, Math.round(m.length * 1.9))}mm"></span>`);

/**
 * Rodapé das folhas do contrato (página nomeada "contrato"): o visto do CONTRATANTE e da CONTRATADA em todas as
 * folhas e a paginação "3 de 5". Sai na impressão (margem da folha), não na pré-visualização da tela.
 */
const fonteRodape = `font-family: 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #374151;`;
export const RODAPE_VISTO = `@page contrato { margin-bottom: 24mm;
    @bottom-left { content: "CONTRATANTE: ________________________\\A CONTRATADA:  ________________________"; white-space: pre; ${fonteRodape} vertical-align: middle; }
  }`;
export const RODAPE_PAGINAS = `@page contrato { @bottom-right { content: counter(page) " de " counter(pages); ${fonteRodape} vertical-align: middle; } }`;

export const pagina = (titulo: string, corpo: string, css = '') =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>${ESTILO}${css ? `<style>${css}</style>` : ''}</head><body>${linhasDePreencher(corpo)}<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;

/** Rótulo pequeno em cima e o valor embaixo (as "fichas" dos documentos). */
export const celula = (rotulo: string, valor: string, largo = false) =>
  `<div${largo ? ' class="largo"' : ''}><div class="r">${escapar(rotulo)}</div><div class="v">${valor}</div></div>`;

const linhaCliente = (d: DocumentoObra) => {
  const c = d.cliente;
  const local = d.poco ? [d.poco.endereco, d.poco.cidade && `${d.poco.cidade}${d.poco.uf ? `/${d.poco.uf}` : ''}`].filter(Boolean).join(' · ')
    : [c?.endereco, c?.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ''}`].filter(Boolean).join(' · ');
  return `<div class="ficha">
    ${celula('Cliente', escapar(c?.nome || '—'))}${celula('CPF / CNPJ', escapar(doc(c?.documento) || '—'))}
    ${celula('Telefone', escapar(fone(c?.telefone) || '—'))}${celula('E-mail', escapar(c?.email || '—'))}
    ${celula('Local da obra', `${escapar(local || '—')}${d.poco?.latitude != null ? ` <small>· GPS ${d.poco.latitude}, ${d.poco.longitude}</small>` : ''}`, true)}
  </div>`;
};

/** Condição com a primeira parte ("Risco geológico:") em negrito. */
const condicao = (t: string) => { const i = t.indexOf(':'); return i > 0 ? `<b>${escapar(t.slice(0, i + 1))}</b>${escapar(t.slice(i + 1))}` : escapar(t); };
export const listaCondicoes = (lista: string[]) => `<ul class="condicoes">${lista.map(t => `<li>${condicao(t)}</li>`).join('')}</ul>`;

/** Blocos de assinatura: nome em cima da linha e o papel embaixo. */
export const blocoAssinaturas = (blocos: { nome: string; papel: string }[], quatro = false) =>
  `<div class="assinaturas${quatro ? ' quatro' : ''}">${blocos.map(b => `<div><b>${b.nome || '&nbsp;'}</b>${b.papel}</div>`).join('')}</div>`;

/**
 * Tabela dos itens: descrição, quantidade, unidade, valor unitário e total. Os inclusos mostram o valor de referência e
 * "Incluso" no total; os opcionais ("se necessário") vêm depois do total, num grupo à parte. Nenhum dos dois soma.
 */
export const tabelaItens = (itens: ItemOrcamentoForm[], adicionais: { descricao: string; valor: number }[] = []) => {
  const linha = (i: ItemOrcamentoForm) => `<tr${i.opcional ? ' class="opcional"' : ''}><td>${escapar(i.descricao)}</td>
    <td class="n">${num(i.quantidade, i.unidade)}</td><td class="n">${i.valorUnitario ? brl(i.valorUnitario) : i.incluso ? '—' : brl(0)}</td>
    <td class="n">${i.opcional ? `${brl(i.valorUnitario)}/${escapar(i.unidade)}` : i.incluso ? '<span class="pill">Incluso</span>' : brl(i.valorTotal)}</td></tr>`;
  const base = itens.filter(i => !i.opcional), opc = itens.filter(i => i.opcional);
  const total = (base.filter(i => !i.incluso).reduce((s, i) => s + Math.round(i.valorTotal * 100), 0) + adicionais.reduce((s, a) => s + Math.round(a.valor * 100), 0)) / 100;
  return `<table class="itens"><tr><th>Descrição</th><th class="n">Qtd.</th><th class="n">Valor unit.</th><th class="n">Total</th></tr>
    ${base.map(linha).join('')}
    ${adicionais.map(a => `<tr><td>${escapar(a.descricao)} <span class="nota">(adicional aprovado)</span></td><td class="n"></td><td class="n"></td><td class="n">${brl(a.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">Total</td><td class="n">${brl(total)}</td></tr>
    ${opc.length ? `<tr class="grupo"><td colspan="4">Se necessário, não incluso no total · cobrado só se for usado</td></tr>${opc.map(linha).join('')}` : ''}
  </table>`;
};

/** Condições gerais do orçamento (das propostas da empresa): o que é do cliente, risco geológico, metragem adicional e autorização digital. */
export const CONDICOES_ORCAMENTO = [
  'Responsabilidade do cliente: garantir livre acesso ao local para as máquinas, fornecer água e energia elétrica para o apoio operacional e providenciar as licenças e outorgas necessárias.',
  'Risco geológico (obrigação de meio): a perfuração depende das condições do subsolo. Aplicamos a melhor técnica disponível, mas não há garantia de vazão, quantidade ou qualidade da água, fatores que dependem da natureza geológica do local.',
  'Metragem adicional: se a profundidade prevista for atingida sem vazão suficiente, a continuidade depende de nova autorização do cliente, pelo valor do metro excedente indicado, que pode ser readequado conforme o solo e a profundidade, com o preço final aprovado antes do reinício dos trabalhos.',
  'Imprevistos no solo: em caso de rochas muito duras, cavernas, solo colapsável ou interferências não informadas (entulho, tubulações, fundações), o ponto de perfuração pode ser ajustado dentro da mesma propriedade, sem mudar o valor contratado.',
  'Autorizações digitais: autorização de continuidade, alteração de escopo ou serviço adicional enviada por WhatsApp ou e-mail tem validade e força contratual para execução e cobrança.',
];

/** Orçamento: escopo, valores (itens ou pacote, metro excedente, sinal, adicionais aprovados), prazo, garantia, pagamento e validade. */
export const htmlOrcamento = (d: DocumentoObra, logo: string | null, hoje: string) => {
  const o = d.obra;
  const servicos = o.servicos.map(s => SERVICOS_TXT[s] || s).join(' + ');
  const adic = o.adicionais.map(a => `<tr><td>${escapar(a.descricao)}</td><td class="n"></td><td class="n"></td><td class="n">${brl(a.valor)}</td></tr>`).join('');
  const total = (o.valorContratado || 0) + o.adicionais.reduce((s, a) => s + a.valor, 0);
  const itens = o.itens || [];
  const validade = new Date(`${hoje}T12:00:00`); validade.setDate(validade.getDate() + o.validadeOrcamentoDias);
  const cartao = (rotulo: string, valor: string, destaque = false) => `<div${destaque ? ' class="destaque"' : ''}><div class="r">${rotulo}</div><div class="v">${valor}</div></div>`;
  return pagina(`Orçamento ${o.idObra}`, `${cabecalho(d, logo, { tipo: 'Orçamento', numero: `Nº ${o.idObra}`, data: `Emitido em ${dataBr(hoje)}` })}
    <h1>${escapar(o.titulo || servicos)}</h1>
    <div class="sub">Orçamento nº ${o.idObra} · Válido até ${dataBr(validade.toISOString().slice(0, 10))} (${o.validadeOrcamentoDias} dias)</div>
    ${linhaCliente(d)}
    <h2><span class="n">1</span>Serviço</h2>
    <p><b>${escapar(servicos)}</b>${o.metrosPrevistos ? ` · profundidade prevista: ${num(o.metrosPrevistos, 'm')}` : ''}</p>
    ${o.escopo ? paragrafos(o.escopo) : ''}
    <h2><span class="n">2</span>Valores</h2>${itens.length ? tabelaItens(itens, o.adicionais) : `<table class="itens"><tr><th>Descrição</th><th class="n"></th><th class="n"></th><th class="n">Valor</th></tr>
      <tr><td>${escapar(servicos)}${o.metrosPrevistos ? ` (até ${num(o.metrosPrevistos, 'm')})` : ''}</td><td class="n"></td><td class="n"></td><td class="n">${brl(o.valorContratado)}</td></tr>
      ${adic}
      <tr class="total"><td colspan="3">Total</td><td class="n">${brl(total)}</td></tr>
      ${o.valorMetroExcedente ? `<tr class="grupo"><td colspan="4">Se necessário, não incluso no total · cobrado só se for usado</td></tr>
        <tr class="opcional"><td>Metro excedente (acima do previsto)</td><td class="n"></td><td class="n"></td><td class="n">${brl(o.valorMetroExcedente)}/m</td></tr>` : ''}
    </table>`}
    <h2><span class="n">3</span>Pagamento</h2>
    <div class="resumo">
      ${cartao(o.valorParcelado ? 'Total à vista' : 'Total', brl(total), true)}
      ${o.valorParcelado ? cartao('Parcelado (cartão de crédito)', brl(o.valorParcelado)) : ''}
      ${o.valorSinal ? cartao('Sinal / entrada', brl(o.valorSinal)) : ''}
    </div>
    ${o.valorSinal ? `<p>Sinal de ${brl(o.valorSinal)} ${o.sinalQuando === 'NO_ATO' ? 'no dia do início da obra' : 'para agendar o início da obra'}.</p>` : ''}
    ${o.formaPagamento ? paragrafos(o.formaPagamento) : '<p>A combinar.</p>'}
    <h2><span class="n">4</span>Prazo e garantia</h2>
    <div class="ficha">
      ${celula('Prazo de execução', o.prazoExecucaoDias ? `Em até ${o.prazoExecucaoDias} dia(s) a partir do início <small>· salvo chuva ou condições do terreno</small>` : 'A combinar na aprovação')}
      ${celula('Garantia', o.garantiaMeses ? `${o.garantiaMeses} meses <small>a partir da conclusão</small>` : 'Conforme o contrato')}
    </div>
    ${paragrafos(d.empresa.textoGarantia)}
    <h2><span class="n">5</span>Condições gerais</h2>${listaCondicoes(CONDICOES_ORCAMENTO)}
    <p class="local-data">${escapar(d.empresa.foroCidade || d.cliente?.cidade || '')}${d.empresa.foroCidade || d.cliente?.cidade ? ', ' : ''}${dataPorExtenso(hoje).trim()}.</p>
    ${blocoAssinaturas([{ nome: escapar(d.empresa.empresaNome || 'Empresa'), papel: 'Contratada' }, { nome: escapar(d.cliente?.nome || 'Cliente'), papel: 'De acordo do cliente' }])}`);
};

/** Laudo de entrega: o poço como ficou (profundidade, vazão, níveis, diâmetro, bomba) e a garantia. */
export const htmlLaudo = (d: DocumentoObra, logo: string | null, hoje: string) => {
  const o = d.obra, m = d.medido, p = d.poco;
  const v = <T,>(a: T | null | undefined, b: T | null | undefined) => (a ?? b ?? null);
  const rebaixamento = v(m.nivelDinamicoM, p?.nivelDinamicoM) !== null && v(m.nivelEstaticoM, p?.nivelEstaticoM) !== null
    ? (v(m.nivelDinamicoM, p?.nivelDinamicoM) as number) - (v(m.nivelEstaticoM, p?.nivelEstaticoM) as number) : null;
  const solo = v(m.tipoSolo, p?.tipoSolo);
  return pagina(`Laudo ${o.idObra}`, `${cabecalho(d, logo, { tipo: 'Laudo de entrega', numero: `Obra nº ${o.idObra}`, data: `Emitido em ${dataBr(hoje)}` })}
    <h1>Laudo de entrega · obra nº ${o.idObra}</h1>
    <div class="sub">${escapar(o.servicos.map(s => SERVICOS_TXT[s] || s).join(' + '))}${o.dataTermino ? ` · obra concluída em ${dataBr(o.dataTermino)}` : ''}</div>
    ${linhaCliente(d)}
    <h2><span class="n">1</span>O poço</h2>
    <div class="ficha tres">
      ${celula('Identificação', escapar(p?.identificacao || '—'))}${celula('Profundidade', num(v(m.profundidadeM, p?.profundidadeM), 'm'))}${celula('Diâmetro', escapar(v(m.diametro, p?.diametro) || '—'))}
      ${celula('Vazão', num(v(m.vazaoLh, p?.vazaoLh), 'L/h'))}${celula('Nível estático', `${num(v(m.nivelEstaticoM, p?.nivelEstaticoM), 'm')} <small>água parada</small>`)}${celula('Nível dinâmico', `${num(v(m.nivelDinamicoM, p?.nivelDinamicoM), 'm')} <small>bomba ligada</small>`)}
      ${celula('Rebaixamento', rebaixamento !== null ? num(rebaixamento, 'm') : '—')}${celula('Solo', escapar(solo || '—'))}${celula('Bomba', escapar(m.bomba || '—'))}
    </div>
    <p class="nota">Níveis medidos a partir da boca do poço.</p>
    <h2><span class="n">2</span>Garantia</h2>
    <p>${o.garantiaMeses ? `<b>${o.garantiaMeses} meses</b>${o.garantiaAte ? `, até ${dataBr(o.garantiaAte)}` : ''}.` : 'Conforme o contrato.'}</p>${paragrafos(d.empresa.textoGarantia)}
    <h2><span class="n">3</span>Recomendações</h2>
    ${listaCondicoes([
      'Bomba: não deixe trabalhar sem água (a seco); se desarmar com frequência, desligue e chame a assistência.',
      'Poço: mantenha a tampa fechada e a área em volta limpa, sem fossa ou lixo por perto.',
      'Quadro de comando: proteja da chuva e do sol direto; não altere as proteções.',
      'Sinais de atenção: queda de vazão, água turva ou com cheiro, barulho diferente na bomba.',
      'Revisão: recomendamos uma revisão preventiva a cada 12 meses.',
    ])}
    ${blocoAssinaturas([
      { nome: escapar(d.empresa.responsavelTecnico || d.empresa.empresaNome || ''), papel: `Responsável técnico${d.empresa.registroTecnico ? ` · ${escapar(d.empresa.registroTecnico)}` : ''}` },
      { nome: escapar(d.cliente?.nome || ''), papel: 'Recebido por (cliente)' },
    ])}`);
};

/** Adesivo do quadro (10 × 6 cm): empresa, telefone e WhatsApp, nº da obra e do poço. Sai 4 por folha para recortar. */
export const htmlAdesivo = (d: DocumentoObra, logo: string | null) => {
  const e = d.empresa;
  const um = `<div class="adesivo">
    ${logo ? `<img src="${escapar(logo)}" alt="">` : ''}
    <div class="nome">${escapar(e.empresaNome || '')}</div>
    <div class="info">Assistência e manutenção do poço${e.empresaWhatsapp ? ' · WhatsApp' : ''}</div>
    <div class="tel">${escapar(fone(e.empresaWhatsapp || e.empresaTelefone) || '')}</div>
    <div class="obra">Obra nº ${d.obra.idObra}${d.poco ? ` · Poço ${escapar(d.poco.identificacao)}` : ''}${d.obra.dataTermino ? ` · ${dataBr(d.obra.dataTermino)}` : ''}</div>
  </div>`;
  return pagina(`Adesivo ${d.obra.idObra}`, `<style>
      .folha { display: flex; flex-wrap: wrap; gap: 6mm; }
      .adesivo { width: 100mm; height: 60mm; border: 1px dashed #9aa5b1; border-radius: 4mm; padding: 4mm; text-align: center; display: flex;
        flex-direction: column; justify-content: center; border-top: 3mm solid var(--a); }
      .adesivo img { max-height: 15mm; max-width: 60mm; margin: 0 auto 2mm; }
      .adesivo .nome { font-weight: 700; font-size: 13pt; color: var(--a); } .adesivo .tel { font-size: 21pt; font-weight: 800; color: var(--t); margin: 1mm 0; letter-spacing: .5pt; }
      .adesivo .info { font-size: 8.5pt; color: var(--m); text-transform: uppercase; letter-spacing: .6pt; margin-top: 1.5mm; }
      .adesivo .obra { font-size: 7.5pt; color: var(--m); margin-top: 2mm; }
    </style><div class="folha">${um}${um}${um}${um}</div>`);
};

// ------------------------------------------------------------------ contrato e termo aditivo

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze',
  'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ate999 = (n: number): string => {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100, d = Math.floor(r / 10), u = r % 10;
  const resto = r < 20 ? UNIDADES[r] : [DEZENAS[d], UNIDADES[u]].filter(Boolean).join(' e ');
  return [CENTENAS[c], resto].filter(Boolean).join(' e ');
};
/** Número inteiro por extenso (até 999 bilhões): 1250 → "mil duzentos e cinquenta". */
export const inteiroPorExtenso = (n: number): string => {
  if (n === 0) return 'zero';
  const grupos: number[] = [];
  for (let x = Math.floor(n); x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000);
  const nomes: [string, string][] = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
  const partes = grupos.map((g, i) => {
    if (!g) return '';
    if (i === 1 && g === 1) return 'mil';
    return `${ate999(g)}${i ? ` ${nomes[i][g === 1 ? 0 : 1]}` : ''}`;
  }).reverse().filter(Boolean);
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda (mil e cinquenta, dois mil e trezentos)
  const ultimo = grupos[0];
  if (partes.length > 1 && ultimo && (ultimo < 100 || ultimo % 100 === 0)) return `${partes.slice(0, -1).join(' ')} e ${partes[partes.length - 1]}`;
  return partes.join(' ');
};
/** Valor em reais por extenso: 18500.5 → "dezoito mil e quinhentos reais e cinquenta centavos". */
export const valorPorExtenso = (v: number) => {
  const centavos = Math.round(Math.abs(v) * 100);
  const reais = Math.floor(centavos / 100), cent = centavos % 100;
  const milhaoRedondo = reais >= 1000000 && reais % 1000000 === 0;
  const r = reais ? `${inteiroPorExtenso(reais)}${milhaoRedondo ? ' de' : ''} ${reais === 1 ? 'real' : 'reais'}` : '';
  const c = cent ? `${inteiroPorExtenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}` : '';
  return [r, c].filter(Boolean).join(' e ') || 'zero reais';
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "Itupeva, 24 de outubro de 2026" */
export const dataPorExtenso = (iso: string, cidade?: string | null) =>
  `${cidade ? `${cidade}, ` : ''}${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`;

/** Qualificação do cliente para o contrato (PF: estado civil, profissão, RG, CPF e endereço; PJ: CNPJ, IE, sede e representante). */
export const qualificacaoCliente = (c: DocumentoObra['cliente']) => {
  if (!c) return '__________ (dados do cliente)';
  const endereco = [c.endereco, c.bairro, c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ''}`, c.cep && `CEP ${c.cep}`].filter(Boolean).join(', ');
  if (c.tipoPessoa === 'PJ') {
    return [`${c.nome.toUpperCase()}, pessoa jurídica de direito privado`, c.documento && `inscrita no CNPJ sob o nº ${doc(c.documento)}`,
      c.rgIe && `inscrição estadual ${c.rgIe}`, endereco && `com sede em ${endereco}`,
      c.representante && `neste ato representada por ${c.representante}${c.representanteDocumento ? `, CPF nº ${doc(c.representanteDocumento)}` : ''}`]
      .filter(Boolean).join(', ');
  }
  return [c.nome.toUpperCase(), c.estadoCivil, c.profissao, c.rgIe && `portador(a) do RG nº ${c.rgIe}`, c.documento && `inscrito(a) no CPF sob o nº ${doc(c.documento)}`,
    endereco && `residente em ${endereco}`].filter(Boolean).join(', ');
};
export const qualificacaoEmpresa = (d: Pick<DocumentoObra, 'empresa'>) => [(d.empresa.empresaNome || '__________').toUpperCase(),
  d.empresa.empresaDocumento && `inscrita no CNPJ/CPF sob o nº ${doc(d.empresa.empresaDocumento)}`, d.empresa.empresaEndereco && `com endereço em ${d.empresa.empresaEndereco}`,
  d.empresa.empresaRepresentante && `neste ato representada por ${d.empresa.empresaRepresentante}${d.empresa.empresaRepresentanteCpf ? `, CPF nº ${doc(d.empresa.empresaRepresentanteCpf)}` : ''}`]
  .filter(Boolean).join(', ');

/** Os {campos} que os modelos de contrato e aditivo podem usar (para a tela de configuração mostrar). */
export const CAMPOS_MODELO: Record<string, string> = {
  numero: 'nº do orçamento/contrato', empresa: 'nome da empresa', empresa_qualificacao: 'empresa com CNPJ e endereço', cliente: 'nome do cliente',
  cliente_qualificacao: 'cliente com documento, estado civil, endereço…', local_obra: 'endereço/GPS do poço', servicos: 'serviços contratados',
  escopo: 'escopo do orçamento', tabela_itens: 'tabela dos itens (linha sozinha)', metros: 'profundidade prevista', valor_total: 'valor total',
  valor_total_extenso: 'valor total por extenso', valor_metro_excedente: 'valor do metro excedente', sinal: 'frase do sinal', forma_pagamento: 'forma de pagamento',
  prazo_dias: 'prazo de execução em dias', data_inicio: 'início previsto da obra', condicao_parcelada: 'frase do valor parcelado (vazia se não houver)',
  valor_parcelado: 'valor parcelado (cartão)', garantia_meses: 'meses de garantia', texto_garantia: 'texto de garantia da configuração', foro: 'cidade do foro',
  responsavel_tecnico: 'responsável técnico', registro_tecnico: 'CREA/registro', cidade_data: 'cidade e data por extenso',
  numero_aditivo: 'nº do aditivo', data_contrato: 'data do contrato', tabela_adicionais: 'tabela do aditivo (linha sozinha)', valor_aditivo: 'valor do aditivo',
  valor_aditivo_extenso: 'valor do aditivo por extenso', novo_total: 'novo valor do contrato', novo_total_extenso: 'novo valor por extenso', observacao: 'observação do aditivo',
};

export const MODELO_CONTRATO_PADRAO = `CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS Nº {numero}

CONTRATADA: {empresa_qualificacao}.
CONTRATANTE: {cliente_qualificacao}.

As partes acima identificadas têm entre si justo e contratado o seguinte:

CLÁUSULA 1ª – DO OBJETO
O presente contrato tem como objeto a prestação de serviços de {servicos}, com os materiais e serviços relacionados abaixo, nas condições aqui estabelecidas.
{tabela_itens}
{escopo}
Parágrafo único – As especificações técnicas, a profundidade contratada, os prazos, os valores e as demais condições do serviço estão descritos neste contrato e, quando houver, na proposta comercial (orçamento nº {numero}) assinada pelas partes, que faz parte integrante deste instrumento. Tratativas, negociações ou entendimentos prévios, sejam verbais, por telefone, por mensagens eletrônicas ou presenciais, somente terão validade se transcritos por escrito e assinados por ambas as partes ou registrados em meio eletrônico com confirmação expressa.

CLÁUSULA 2ª – DO LOCAL DA PRESTAÇÃO DOS SERVIÇOS
Os serviços serão executados em {local_obra}, ou em outro local indicado pelo CONTRATANTE, desde que previamente acordado entre as partes.

CLÁUSULA 3ª – DO PRAZO DE EXECUÇÃO
A execução dos serviços terá início em {data_inicio} e deverá ser concluída no prazo estimado de {prazo_dias} dias úteis, salvo prorrogação justificada em razão de condições climáticas adversas, dificuldades técnicas imprevistas, necessidade de manutenção de equipamentos, adversidades geológicas ou quaisquer outros fatores alheios à vontade da CONTRATADA que interfiram no andamento dos serviços.

CLÁUSULA 4ª – DO VALOR E DAS CONDIÇÕES DE PAGAMENTO
O valor total do presente contrato é de {valor_total} ({valor_total_extenso}){condicao_parcelada}, referente aos serviços descritos na cláusula 1ª, com a profundidade prevista de {metros} e os materiais inclusos, pago pelo CONTRATANTE à CONTRATADA da seguinte forma:
{sinal}
{forma_pagamento}
Metragem excedente: caso seja necessária a perfuração além da profundidade contratada de {metros}, será cobrado o valor adicional de {valor_metro_excedente} por metro perfurado a mais, mediante autorização do CONTRATANTE, nos termos da cláusula 5ª.
Inadimplemento: o não cumprimento das condições de pagamento poderá implicar a suspensão dos serviços. Sobre o valor em atraso incidirão multa moratória de 2% (dois por cento), juros de mora de 1% (um por cento) ao mês e correção monetária pelo IPCA (Índice Nacional de Preços ao Consumidor Amplo), calculada pro rata die, do vencimento até o efetivo pagamento.
Suspensão dos serviços: a inadimplência superior a 15 (quinze) dias autoriza a CONTRATADA a suspender os serviços até a regularização dos valores pendentes, sem prejuízo das demais sanções previstas neste contrato ou na legislação vigente.

CLÁUSULA 5ª – DAS OBRIGAÇÕES DA CONTRATADA
A CONTRATADA se compromete a:
a) executar os serviços contratados com a melhor técnica disponível, utilizando materiais de qualidade e mão de obra especializada;
b) respeitar as normas ambientais e de segurança aplicáveis;
c) fornecer ao CONTRATANTE as informações necessárias sobre o andamento dos serviços;
d) realizar a perfuração no solo até atingir o embasamento rochoso, sendo o limite da perfuração na parte de aluvião até o início da rocha, independentemente da metragem, observado o limite contratado de {metros};
e) caso a perfuração atinja os {metros} contratados sem localizar um aquífero ou sem vazão suficiente, comunicar formalmente o CONTRATANTE sobre a necessidade de continuidade da perfuração;
f) continuar a perfuração somente mediante anuência expressa do CONTRATANTE, que poderá ser formalizada por escrito, inclusive por termo aditivo ou por mensagens eletrônicas (como WhatsApp ou e-mail), as quais terão validade jurídica plena para todos os fins;
g) informar o valor do metro adicional no momento da solicitação de autorização, considerando o tipo de solo, a profundidade atingida, os custos operacionais e a região, a partir de {valor_metro_excedente} por metro perfurado;
h) garantir o bom funcionamento dos equipamentos utilizados, providenciando sua manutenção ou substituição quando necessário, sem prejuízo do previsto na cláusula 3ª.
Parágrafo único – A autorização do CONTRATANTE para a continuidade da perfuração implica ciência e obrigação de pagamento integral do valor acordado referente à metragem adicional, conforme registrado no canal de comunicação utilizado.

CLÁUSULA 6ª – DAS OBRIGAÇÕES DO CONTRATANTE
O CONTRATANTE se obriga a:
a) fornecer as informações e os documentos necessários à execução dos serviços contratados;
b) disponibilizar livre acesso ao local da perfuração, assegurando condições mínimas de segurança e o deslocamento de equipamentos e pessoal;
c) garantir, quando necessário, o fornecimento de energia elétrica e água para apoio operacional;
d) informar previamente a existência de obstáculos, estruturas subterrâneas, redes elétricas, hidráulicas ou de esgoto, rochas ou demais interferências que possam afetar os serviços; a omissão dessas informações poderá implicar custos adicionais e/ou prorrogação do prazo, conforme avaliação da CONTRATADA;
e) obter, às suas expensas, as licenças, autorizações e outorgas exigidas pelos órgãos competentes para a utilização do poço, quando aplicável, isentando a CONTRATADA de qualquer responsabilidade decorrente da ausência desses documentos;
f) efetuar os pagamentos nas condições combinadas.

CLÁUSULA 7ª – DA GARANTIA
A CONTRATADA oferece garantia de {garantia_meses} meses para os serviços prestados, a contar da conclusão, cobrindo defeitos de execução ou de materiais, desde que utilizados em condições normais. A garantia não cobre danos causados por mau uso, falta de manutenção ou intervenções realizadas por terceiros.
{texto_garantia}

CLÁUSULA 8ª – DAS CONDIÇÕES GEOLÓGICAS E DAS INTERFERÊNCIAS NO LOCAL
A perfuração depende das condições do subsolo. Por se tratar de obrigação de meio e não de resultado, a CONTRATADA não garante vazão, quantidade ou qualidade da água, fatores que dependem da natureza geológica local.
Caso sejam identificadas condições geológicas adversas que impeçam ou dificultem significativamente a perfuração, tais como rochas extremamente duras, cavernas, lençol freático em profundidade atípica ou outras formações imprevistas, a CONTRATADA comunicará imediatamente o CONTRATANTE e os serviços serão suspensos até a avaliação da viabilidade de continuidade, podendo ser apresentada nova proposta técnica e financeira. A retomada dependerá da anuência expressa do CONTRATANTE.
Na ausência de prospecção prévia pela CONTRATADA (sondagem geofísica, radiestesia ou outro método técnico), caso sejam identificadas interferências artificiais no ponto demarcado, como entulho, restos de construção ou compactação de terraplanagem, a CONTRATADA poderá ajustar o ponto de perfuração para local próximo, dentro da mesma propriedade, sem necessidade de anuência prévia, priorizando o posicionamento técnico mais adequado e informando o CONTRATANTE em seguida.
A CONTRATADA não se responsabiliza por atrasos decorrentes das situações previstas nesta cláusula, que ficam sujeitos à prorrogação do prazo contratual.

CLÁUSULA 9ª – DA RESCISÃO
Qualquer das partes poderá rescindir o presente contrato, a qualquer tempo, mediante comunicação por escrito à outra parte com antecedência mínima de 5 (cinco) dias úteis.
Na rescisão por iniciativa do CONTRATANTE, este pagará à CONTRATADA o valor proporcional aos serviços já executados até a data da rescisão e ressarcirá os custos operacionais comprovadamente incorridos.
Na rescisão por iniciativa da CONTRATADA, esta restituirá os valores pagos pelo CONTRATANTE, descontado o montante correspondente aos serviços efetivamente prestados e aos custos comprovadamente incorridos até a data da rescisão.
O contrato poderá ser rescindido de forma imediata, por qualquer das partes, em caso de descumprimento de obrigações contratuais, atraso no pagamento superior a 15 (quinze) dias, situações que impeçam a continuidade dos serviços por motivos alheios à vontade da CONTRATADA ou atitudes que comprometam a segurança da equipe, dos equipamentos ou da obra.
A rescisão não exime as partes das obrigações pendentes até a data em que se efetivar, incluindo os pagamentos devidos e a responsabilidade por eventuais danos.

CLÁUSULA 10ª – DAS DISPOSIÇÕES GERAIS
Este contrato constitui o entendimento integral entre as partes, substituindo acordos, negociações e entendimentos anteriores, verbais ou escritos, relacionados ao seu objeto.
Qualquer alteração ou aditamento somente terá validade se feito por escrito e assinado por ambas as partes (termo aditivo), observado o previsto na cláusula 5ª para a metragem adicional.
As comunicações entre as partes serão feitas por escrito, por e-mail, correspondência registrada, WhatsApp ou outro meio eletrônico que permita comprovar o envio e o recebimento, usando os contatos constantes neste contrato ou outros informados por escrito.
As partes manterão sigilo sobre informações técnicas, comerciais, estratégicas ou confidenciais obtidas em razão deste contrato, salvo autorização expressa da outra parte ou determinação legal.
A invalidade de qualquer cláusula não afetará as demais, que permanecerão em pleno vigor.

CLÁUSULA 11ª – DO FORO
Fica eleito o foro da Comarca de {foro}, com exclusão de qualquer outro, por mais privilegiado que seja, para dirimir dúvidas ou litígios decorrentes deste contrato.

E, por estarem de acordo, as partes assinam este contrato em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.

{cidade_data}`;

export const MODELO_ADITIVO_PADRAO = `TERMO ADITIVO Nº {numero_aditivo} AO CONTRATO Nº {numero}

CONTRATADA: {empresa_qualificacao}.
CONTRATANTE: {cliente_qualificacao}.

As partes resolvem aditar o contrato nº {numero}, de {data_contrato}, referente aos serviços de {servicos} no local {local_obra}, nas condições abaixo:

CLÁUSULA 1ª – DO OBJETO
Ficam incluídos no contrato os serviços e materiais abaixo, aprovados pelo CONTRATANTE:
{tabela_adicionais}
{observacao}

CLÁUSULA 2ª – DO VALOR
O valor do contrato fica acrescido de {valor_aditivo} ({valor_aditivo_extenso}), passando o valor total a {novo_total} ({novo_total_extenso}).

CLÁUSULA 3ª – DA RATIFICAÇÃO
Ficam mantidas todas as demais cláusulas e condições do contrato original que não conflitem com este termo.

E, por estarem de acordo, as partes assinam este termo em duas vias de igual teor.

{cidade_data}`;

/** Campos de tabela (HTML) só valem numa linha sozinha; os demais viram texto escapado. */
const CAMPOS_HTML = ['tabela_itens', 'tabela_adicionais'];

/** Troca os {campos} do modelo; campo que não existe fica como está (para o operador ver que errou o nome). */
export const preencherModelo = (modelo: string, campos: Record<string, string>) =>
  modelo.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in campos && !CAMPOS_HTML.includes(k) ? campos[k] : m));

/** Texto do modelo já preenchido → HTML: linha "CLÁUSULA…" vira título, campos de tabela entram como tabela, o resto vira parágrafo. */
export const modeloEmHtml = (modelo: string, campos: Record<string, string>, html: Record<string, string>) => {
  const texto = preencherModelo(modelo, campos);
  const linhas = texto.split(/\r?\n/);
  let primeiro = true;
  return linhas.map(l => {
    const t = l.trim();
    if (!t) return '';
    const tabela = /^\{([a-z_]+)\}$/.exec(t);
    if (tabela && tabela[1] in html) return html[tabela[1]];
    if (primeiro) { primeiro = false; return `<h1 style="text-align:center">${escapar(t)}</h1>`; }
    if (/^CL[ÁA]USULA\b/i.test(t)) return `<h3>${escapar(t)}</h3>`;
    return `<p>${escapar(t)}</p>`;
  }).join('\n');
};

const camposBase = (d: DocumentoObra, hoje: string) => {
  const o = d.obra, c = d.cliente, p = d.poco;
  const total = Math.round(((o.valorContratado || 0) + o.adicionais.reduce((s, a) => s + a.valor, 0)) * 100) / 100;
  const local = p ? [p.endereco, p.cidade && `${p.cidade}${p.uf ? `/${p.uf}` : ''}`, p.latitude != null ? `GPS ${p.latitude}, ${p.longitude}` : null].filter(Boolean).join(', ')
    : [c?.endereco, c?.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ''}`].filter(Boolean).join(', ');
  const cidade = d.empresa.foroCidade || c?.cidade || null;
  return {
    numero: String(o.idObra), empresa: d.empresa.empresaNome || '__________', empresa_qualificacao: qualificacaoEmpresa(d), cliente: c?.nome || '__________',
    cliente_qualificacao: qualificacaoCliente(c), local_obra: local || '__________', servicos: o.servicos.map(s => (SERVICOS_TXT[s] || s).toLowerCase()).join(' e '),
    escopo: o.escopo || '', metros: o.metrosPrevistos ? num(o.metrosPrevistos, 'metros') : 'a definir', valor_total: brl(total), valor_total_extenso: valorPorExtenso(total),
    valor_metro_excedente: o.valorMetroExcedente ? `${brl(o.valorMetroExcedente)} (${valorPorExtenso(o.valorMetroExcedente)})` : 'o valor combinado por metro',
    sinal: o.valorSinal ? `Do total, ${brl(o.valorSinal)} (${valorPorExtenso(o.valorSinal)}) serão pagos como sinal ${o.sinalQuando === 'NO_ATO' ? 'no dia do início da obra' : 'para agendar o início da obra'}.` : '',
    forma_pagamento: o.formaPagamento || d.empresa.formaPagamentoPadrao || 'a combinar', prazo_dias: o.prazoExecucaoDias ? String(o.prazoExecucaoDias) : '__',
    garantia_meses: o.garantiaMeses ? String(o.garantiaMeses) : '__', texto_garantia: d.empresa.textoGarantia || '', foro: d.empresa.foroCidade || c?.cidade || '__________',
    responsavel_tecnico: d.empresa.responsavelTecnico || '', registro_tecnico: d.empresa.registroTecnico || '', cidade_data: dataPorExtenso(hoje, cidade),
    data_contrato: dataBr(o.contratoAssinadoEm || o.criadaEm.slice(0, 10)),
    data_inicio: o.dataPrevisao ? dataBr(o.dataPrevisao) : 'data a combinar entre as partes',
    valor_parcelado: o.valorParcelado ? brl(o.valorParcelado) : '',
    condicao_parcelada: o.valorParcelado ? ` à vista, ou ${brl(o.valorParcelado)} (${valorPorExtenso(o.valorParcelado)}) se parcelado no cartão de crédito` : '',
  };
};

const assinaturasContrato = (d: DocumentoObra) => {
  const c = d.cliente, e = d.empresa;
  return blocoAssinaturas([
    { nome: escapar(e.empresaNome || ''), papel: `CONTRATADA${e.empresaRepresentante ? `<br>${escapar(e.empresaRepresentante)}` : ''}${e.responsavelTecnico ? `<br>${escapar(e.responsavelTecnico)}${e.registroTecnico ? ` · ${escapar(e.registroTecnico)}` : ''}` : ''}` },
    { nome: escapar(c?.nome || ''), papel: `CONTRATANTE${c?.tipoPessoa === 'PJ' && c.representante ? `<br>p.p. ${escapar(c.representante)}` : ''}` },
    { nome: '', papel: 'Testemunha 1 · nome e CPF' }, { nome: '', papel: 'Testemunha 2 · nome e CPF' },
  ], true);
};

/** Contrato completo com cláusulas: o modelo da configuração (ou o padrão) preenchido com os dados da obra e do cliente. */
export const htmlContrato = (d: DocumentoObra, logo: string | null, hoje: string) => {
  const o = d.obra;
  const corpo = modeloEmHtml(d.empresa.modeloContrato || MODELO_CONTRATO_PADRAO, camposBase(d, hoje), { tabela_itens: o.itens?.length ? tabelaItens(o.itens, []) : '' });
  return pagina(`Contrato ${o.idObra}`, `<div class="pagina-contrato">${cabecalho(d, logo, { tipo: 'Contrato', numero: `Nº ${o.idObra}`, data: o.contratoAssinadoEm ? `Assinado em ${dataBr(o.contratoAssinadoEm)}` : undefined })}<div class="contrato">${corpo}</div>${assinaturasContrato(d)}</div>`,
    RODAPE_VISTO + RODAPE_PAGINAS);
};

/** Termo aditivo: os adicionais que entraram nele, o valor e o novo total do contrato (contrato + aditivos até este). */
export const htmlAditivo = (d: DocumentoObra, aditivo: Aditivo, todos: Aditivo[], logo: string | null, hoje: string) => {
  const o = d.obra;
  const ate = todos.filter(a => a.numero <= aditivo.numero).reduce((s, a) => s + Math.round(a.valor * 100), 0) / 100;
  const novoTotal = Math.round(((o.valorContratado || 0) + ate) * 100) / 100;
  const tabela = `<table class="itens"><tr><th>Descrição</th><th class="n">Qtd.</th><th class="n">Valor unit.</th><th class="n">Total</th></tr>
    ${aditivo.adicionais.map(a => `<tr><td>${escapar(a.descricao)}</td><td class="n">${num(a.quantidade, '')}</td><td class="n">${brl(a.valorUnitario)}</td><td class="n">${brl(a.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">Total do aditivo</td><td class="n">${brl(aditivo.valor)}</td></tr></table>`;
  const campos = {
    ...camposBase(d, hoje), numero_aditivo: String(aditivo.numero), valor_aditivo: brl(aditivo.valor), valor_aditivo_extenso: valorPorExtenso(aditivo.valor),
    novo_total: brl(novoTotal), novo_total_extenso: valorPorExtenso(novoTotal), observacao: aditivo.observacao || '',
  };
  const corpo = modeloEmHtml(d.empresa.modeloAditivo || MODELO_ADITIVO_PADRAO, campos, { tabela_adicionais: tabela });
  return pagina(`Aditivo ${aditivo.numero} · obra ${o.idObra}`, `<div class="pagina-contrato">${cabecalho(d, logo, { tipo: 'Termo aditivo', numero: `Nº ${aditivo.numero}`, data: `Contrato nº ${o.idObra}` })}<div class="contrato">${corpo}</div>${assinaturasContrato(d)}</div>`,
    RODAPE_VISTO + RODAPE_PAGINAS);
};
