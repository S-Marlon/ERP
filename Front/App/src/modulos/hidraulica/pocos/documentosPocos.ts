// Obras de poços › documentos para imprimir (ou "Salvar como PDF" no navegador): o orçamento, o contrato, o termo aditivo,
// o laudo de entrega e o adesivo do quadro, com o logo e os dados da empresa da configuração do processo. Funções puras:
// recebem os dados da obra e devolvem a página HTML completa. Contrato e aditivo saem de modelos de texto com {campos}.
import type { Aditivo, DocumentoObra, ItemOrcamentoForm } from './obrasApi';

const SERVICOS_TXT: Record<string, string> = {
  PERFURACAO: 'Perfuração', INSTALACAO: 'Instalação da bomba', LIMPEZA: 'Limpeza', MANUTENCAO: 'Manutenção', TROCA_BOMBA: 'Troca de bomba',
  TESTE_VAZAO: 'Teste de vazão', OUTRO: 'Outro',
};
export const escapar = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
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
const paragrafos = (t: string | null | undefined) => escapar(t || '').split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('');

const ESTILO = `<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; margin: 0; }
  .topo { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1677ff; padding-bottom: 10px; margin-bottom: 14px; }
  .topo img { max-height: 70px; max-width: 220px; }
  .empresa { text-align: right; font-size: 11px; line-height: 1.5; }
  .empresa b { font-size: 15px; }
  h1 { font-size: 18px; margin: 4px 0 12px; }
  h2 { font-size: 13px; margin: 16px 0 6px; color: #1677ff; text-transform: uppercase; letter-spacing: .5px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ddd; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f7fa; width: 32%; font-weight: normal; color: #555; }
  .valor { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; background: #f5f7fa; }
  .assinaturas { display: flex; gap: 40px; margin-top: 50px; }
  .assinaturas div { flex: 1; border-top: 1px solid #555; text-align: center; padding-top: 4px; font-size: 11px; }
  .rodape { margin-top: 20px; font-size: 10px; color: #777; }
  p { margin: 4px 0; }
  .itens th { width: auto; } .itens td.n { text-align: right; white-space: nowrap; width: 1%; }
  .opcional td { color: #555; font-style: italic; }
  .condicoes { margin: 4px 0; padding-left: 18px; font-size: 11px; color: #444; } .condicoes li { margin: 3px 0; }
  .contrato { font-size: 12px; line-height: 1.55; text-align: justify; }
  .contrato h3 { font-size: 12px; margin: 14px 0 4px; text-transform: uppercase; }
  .contrato p { margin: 5px 0; }
  .assinaturas.quatro { flex-wrap: wrap; row-gap: 46px; }
  .assinaturas.quatro div { flex: 1 1 40%; }
</style>`;

const cabecalho = (d: DocumentoObra, logo: string | null) => {
  const e = d.empresa;
  return `<div class="topo">
    <div>${logo ? `<img src="${escapar(logo)}" alt="logo">` : `<b style="font-size:20px">${escapar(e.empresaNome || '')}</b>`}</div>
    <div class="empresa"><b>${escapar(e.empresaNome || '')}</b><br>
      ${e.empresaDocumento ? `CNPJ/CPF ${escapar(doc(e.empresaDocumento))}<br>` : ''}
      ${[e.empresaTelefone && `Tel. ${fone(e.empresaTelefone)}`, e.empresaWhatsapp && `WhatsApp ${fone(e.empresaWhatsapp)}`].filter(Boolean).map(escapar).join(' · ')}<br>
      ${e.empresaEmail ? `${escapar(e.empresaEmail)}<br>` : ''}${e.empresaEndereco ? escapar(e.empresaEndereco) : ''}
    </div></div>`;
};
const pagina = (titulo: string, corpo: string) =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>${ESTILO}</head><body>${corpo}<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`;
const linhaCliente = (d: DocumentoObra) => {
  const c = d.cliente;
  const local = d.poco ? [d.poco.endereco, d.poco.cidade && `${d.poco.cidade}${d.poco.uf ? `/${d.poco.uf}` : ''}`].filter(Boolean).join(' · ')
    : [c?.endereco, c?.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ''}`].filter(Boolean).join(' · ');
  return `<table>
    <tr><th>Cliente</th><td>${escapar(c?.nome || '—')}${c?.documento ? ` · ${escapar(doc(c.documento))}` : ''}</td></tr>
    <tr><th>Telefone</th><td>${escapar(fone(c?.telefone) || '—')}</td></tr>
    <tr><th>Local da obra</th><td>${escapar(local || '—')}${d.poco?.latitude != null ? ` · GPS ${d.poco.latitude}, ${d.poco.longitude}` : ''}</td></tr>
  </table>`;
};

/**
 * Tabela dos itens: descrição, quantidade, unidade, valor unitário e total. Os inclusos mostram o valor de referência e
 * "Incluso" no total; os opcionais ("se necessário") vêm depois do total. Nenhum dos dois soma.
 */
export const tabelaItens = (itens: ItemOrcamentoForm[], adicionais: { descricao: string; valor: number }[] = []) => {
  const linha = (i: ItemOrcamentoForm) => `<tr${i.opcional ? ' class="opcional"' : ''}><td>${escapar(i.descricao)}${i.opcional ? ' <small>(se necessário, não incluso no total)</small>' : ''}</td>
    <td class="n">${num(i.quantidade, i.unidade)}</td><td class="n">${i.valorUnitario ? brl(i.valorUnitario) : i.incluso ? '—' : brl(0)}</td>
    <td class="n">${i.opcional ? `${brl(i.valorUnitario)}/${escapar(i.unidade)}` : i.incluso ? '<b>INCLUSO</b>' : brl(i.valorTotal)}</td></tr>`;
  const base = itens.filter(i => !i.opcional), opc = itens.filter(i => i.opcional);
  const total = (base.filter(i => !i.incluso).reduce((s, i) => s + Math.round(i.valorTotal * 100), 0) + adicionais.reduce((s, a) => s + Math.round(a.valor * 100), 0)) / 100;
  return `<table class="itens"><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr>
    ${base.map(linha).join('')}
    ${adicionais.map(a => `<tr><td>${escapar(a.descricao)} <small>(adicional aprovado)</small></td><td class="n"></td><td class="n"></td><td class="n">${brl(a.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">Total</td><td class="n">${brl(total)}</td></tr>
    ${opc.map(linha).join('')}
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
  const adic = o.adicionais.map(a => `<tr><td>${escapar(a.descricao)}</td><td class="valor">${brl(a.valor)}</td></tr>`).join('');
  const total = (o.valorContratado || 0) + o.adicionais.reduce((s, a) => s + a.valor, 0);
  const itens = o.itens || [];
  const validade = new Date(`${hoje}T12:00:00`); validade.setDate(validade.getDate() + o.validadeOrcamentoDias);
  return pagina(`Orçamento ${o.idObra}`, `${cabecalho(d, logo)}
    <h1>Orçamento nº ${o.idObra}${o.titulo ? ` · ${escapar(o.titulo)}` : ''}</h1>
    <p>Data: ${dataBr(hoje)} · Válido até ${dataBr(validade.toISOString().slice(0, 10))} (${o.validadeOrcamentoDias} dias)</p>
    ${linhaCliente(d)}
    <h2>Serviço</h2><p><b>${escapar(servicos)}</b>${o.metrosPrevistos ? ` · profundidade prevista: ${num(o.metrosPrevistos, 'm')}` : ''}</p>
    ${o.escopo ? paragrafos(o.escopo) : ''}
    <h2>Valores</h2>${itens.length ? tabelaItens(itens, o.adicionais) : `<table>
      <tr><td>${escapar(servicos)}${o.metrosPrevistos ? ` (até ${num(o.metrosPrevistos, 'm')})` : ''}</td><td class="valor">${brl(o.valorContratado)}</td></tr>
      ${o.valorMetroExcedente ? `<tr><td>Metro excedente (acima do previsto, se necessário)</td><td class="valor">${brl(o.valorMetroExcedente)} por metro</td></tr>` : ''}
      ${adic}
      <tr class="total"><td>Total</td><td class="valor">${brl(total)}</td></tr>
    </table>`}
    <h2>Pagamento</h2>
    ${o.valorParcelado ? `<table><tr><th>À vista</th><td class="valor">${brl(total)}</td></tr><tr><th>Parcelado (cartão de crédito)</th><td class="valor">${brl(o.valorParcelado)}</td></tr></table>` : ''}
    ${o.valorSinal ? `<p>Sinal de ${brl(o.valorSinal)} ${o.sinalQuando === 'NO_ATO' ? 'no dia do início da obra' : 'para agendar o início da obra'}.</p>` : ''}
    ${o.formaPagamento ? paragrafos(o.formaPagamento) : '<p>A combinar.</p>'}
    <h2>Prazo</h2><p>${o.prazoExecucaoDias ? `Execução em até ${o.prazoExecucaoDias} dia(s) a partir do início, salvo chuva ou condições do terreno.` : 'A combinar na aprovação.'}</p>
    <h2>Garantia</h2>${o.garantiaMeses ? `<p><b>${o.garantiaMeses} meses</b> a partir da conclusão.</p>` : ''}${paragrafos(d.empresa.textoGarantia)}
    <h2>Condições gerais</h2><ul class="condicoes">${CONDICOES_ORCAMENTO.map(t => `<li>${escapar(t)}</li>`).join('')}</ul>
    <div class="assinaturas"><div>${escapar(d.empresa.empresaNome || 'Empresa')}</div><div>De acordo: ${escapar(d.cliente?.nome || 'Cliente')}</div></div>`);
};

/** Laudo de entrega: o poço como ficou (profundidade, vazão, níveis, diâmetro, bomba) e a garantia. */
export const htmlLaudo = (d: DocumentoObra, logo: string | null, hoje: string) => {
  const o = d.obra, m = d.medido, p = d.poco;
  const v = <T,>(a: T | null | undefined, b: T | null | undefined) => (a ?? b ?? null);
  const rebaixamento = v(m.nivelDinamicoM, p?.nivelDinamicoM) !== null && v(m.nivelEstaticoM, p?.nivelEstaticoM) !== null
    ? (v(m.nivelDinamicoM, p?.nivelDinamicoM) as number) - (v(m.nivelEstaticoM, p?.nivelEstaticoM) as number) : null;
  return pagina(`Laudo ${o.idObra}`, `${cabecalho(d, logo)}
    <h1>Laudo de entrega · obra nº ${o.idObra}</h1>
    <p>Emitido em ${dataBr(hoje)}${o.dataTermino ? ` · obra concluída em ${dataBr(o.dataTermino)}` : ''}</p>
    ${linhaCliente(d)}
    <h2>O poço</h2><table>
      ${p ? `<tr><th>Identificação</th><td>${escapar(p.identificacao)}</td></tr>` : ''}
      <tr><th>Serviço</th><td>${escapar(o.servicos.map(s => SERVICOS_TXT[s] || s).join(' + '))}</td></tr>
      <tr><th>Profundidade</th><td>${num(v(m.profundidadeM, p?.profundidadeM), 'm')}</td></tr>
      <tr><th>Diâmetro</th><td>${escapar(v(m.diametro, p?.diametro) || '—')}</td></tr>
      <tr><th>Vazão</th><td>${num(v(m.vazaoLh, p?.vazaoLh), 'L/h')}</td></tr>
      <tr><th>Nível estático</th><td>${num(v(m.nivelEstaticoM, p?.nivelEstaticoM), 'm')} <span style="color:#777">(água parada, a partir da boca do poço)</span></td></tr>
      <tr><th>Nível dinâmico</th><td>${num(v(m.nivelDinamicoM, p?.nivelDinamicoM), 'm')} <span style="color:#777">(com a bomba ligada)</span></td></tr>
      ${rebaixamento !== null ? `<tr><th>Rebaixamento</th><td>${num(rebaixamento, 'm')}</td></tr>` : ''}
      ${v(m.tipoSolo, p?.tipoSolo) ? `<tr><th>Solo</th><td>${escapar(v(m.tipoSolo, p?.tipoSolo))}</td></tr>` : ''}
      ${m.bomba ? `<tr><th>Bomba</th><td>${escapar(m.bomba)}</td></tr>` : ''}
    </table>
    <h2>Garantia</h2>
    <p>${o.garantiaMeses ? `<b>${o.garantiaMeses} meses</b>${o.garantiaAte ? `, até ${dataBr(o.garantiaAte)}` : ''}.` : 'Conforme o contrato.'}</p>${paragrafos(d.empresa.textoGarantia)}
    <h2>Recomendações</h2>
    <p>Não deixe a bomba trabalhar sem água (a seco); mantenha a tampa do poço fechada e o quadro protegido da chuva; em caso de queda de vazão,
      água turva ou bomba desarmando, chame a assistência. Recomendamos uma revisão preventiva a cada 12 meses.</p>
    <div class="assinaturas"><div>Responsável técnico · ${escapar(d.empresa.empresaNome || '')}</div><div>Recebido por: ${escapar(d.cliente?.nome || '')}</div></div>`);
};

/** Adesivo do quadro (10 × 6 cm): empresa, telefone e WhatsApp, nº da obra e do poço. Sai 4 por folha para recortar. */
export const htmlAdesivo = (d: DocumentoObra, logo: string | null) => {
  const e = d.empresa;
  const um = `<div class="adesivo">
    ${logo ? `<img src="${escapar(logo)}" alt="">` : ''}
    <div class="nome">${escapar(e.empresaNome || '')}</div>
    <div class="tel">${escapar(fone(e.empresaWhatsapp || e.empresaTelefone) || '')}</div>
    <div class="info">Assistência e manutenção do poço${e.empresaWhatsapp ? ' · WhatsApp' : ''}</div>
    <div class="obra">Obra nº ${d.obra.idObra}${d.poco ? ` · Poço ${escapar(d.poco.identificacao)}` : ''}${d.obra.dataTermino ? ` · ${dataBr(d.obra.dataTermino)}` : ''}</div>
  </div>`;
  return pagina(`Adesivo ${d.obra.idObra}`, `<style>
      .folha { display: flex; flex-wrap: wrap; gap: 6mm; }
      .adesivo { width: 100mm; height: 60mm; border: 1px dashed #999; border-radius: 4mm; box-sizing: border-box; padding: 4mm; text-align: center; display: flex; flex-direction: column; justify-content: center; }
      .adesivo img { max-height: 16mm; max-width: 60mm; margin: 0 auto 2mm; }
      .nome { font-weight: bold; font-size: 15px; } .tel { font-size: 24px; font-weight: bold; color: #1677ff; margin: 1mm 0; }
      .info { font-size: 11px; } .obra { font-size: 10px; color: #555; margin-top: 2mm; }
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
const qualificacaoEmpresa = (d: DocumentoObra) => [(d.empresa.empresaNome || '__________').toUpperCase(),
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
const modeloEmHtml = (modelo: string, campos: Record<string, string>, html: Record<string, string>) => {
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
  const c = d.cliente;
  const contratada = `CONTRATADA · ${escapar(d.empresa.empresaNome || '')}${d.empresa.empresaRepresentante ? `<br>${escapar(d.empresa.empresaRepresentante)}` : ''}${d.empresa.responsavelTecnico ? `<br>${escapar(d.empresa.responsavelTecnico)}${d.empresa.registroTecnico ? ` · ${escapar(d.empresa.registroTecnico)}` : ''}` : ''}`;
  const contratante = `CONTRATANTE · ${escapar(c?.nome || '')}${c?.tipoPessoa === 'PJ' && c.representante ? `<br>p.p. ${escapar(c.representante)}` : ''}`;
  return `<div class="assinaturas quatro"><div>${contratada}</div><div>${contratante}</div>
    <div>Testemunha 1 · nome e CPF</div><div>Testemunha 2 · nome e CPF</div></div>`;
};

/** Contrato completo com cláusulas: o modelo da configuração (ou o padrão) preenchido com os dados da obra e do cliente. */
export const htmlContrato = (d: DocumentoObra, logo: string | null, hoje: string) => {
  const o = d.obra;
  const corpo = modeloEmHtml(d.empresa.modeloContrato || MODELO_CONTRATO_PADRAO, camposBase(d, hoje), { tabela_itens: o.itens?.length ? tabelaItens(o.itens, []) : '' });
  return pagina(`Contrato ${o.idObra}`, `${cabecalho(d, logo)}<div class="contrato">${corpo}</div>${assinaturasContrato(d)}`);
};

/** Termo aditivo: os adicionais que entraram nele, o valor e o novo total do contrato (contrato + aditivos até este). */
export const htmlAditivo = (d: DocumentoObra, aditivo: Aditivo, todos: Aditivo[], logo: string | null, hoje: string) => {
  const o = d.obra;
  const ate = todos.filter(a => a.numero <= aditivo.numero).reduce((s, a) => s + Math.round(a.valor * 100), 0) / 100;
  const novoTotal = Math.round(((o.valorContratado || 0) + ate) * 100) / 100;
  const tabela = `<table class="itens"><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr>
    ${aditivo.adicionais.map(a => `<tr><td>${escapar(a.descricao)}</td><td class="n">${num(a.quantidade, '')}</td><td class="n">${brl(a.valorUnitario)}</td><td class="n">${brl(a.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">Total do aditivo</td><td class="n">${brl(aditivo.valor)}</td></tr></table>`;
  const campos = {
    ...camposBase(d, hoje), numero_aditivo: String(aditivo.numero), valor_aditivo: brl(aditivo.valor), valor_aditivo_extenso: valorPorExtenso(aditivo.valor),
    novo_total: brl(novoTotal), novo_total_extenso: valorPorExtenso(novoTotal), observacao: aditivo.observacao || '',
  };
  const corpo = modeloEmHtml(d.empresa.modeloAditivo || MODELO_ADITIVO_PADRAO, campos, { tabela_adicionais: tabela });
  return pagina(`Aditivo ${aditivo.numero} · obra ${o.idObra}`, `${cabecalho(d, logo)}<div class="contrato">${corpo}</div>${assinaturasContrato(d)}`);
};
