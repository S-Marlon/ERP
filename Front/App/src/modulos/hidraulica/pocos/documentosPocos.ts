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

/** Tabela dos itens: descrição, quantidade, unidade, valor unitário e total; os opcionais ("se necessário") ficam fora do total. */
export const tabelaItens = (itens: ItemOrcamentoForm[], adicionais: { descricao: string; valor: number }[] = []) => {
  const linha = (i: ItemOrcamentoForm) => `<tr${i.opcional ? ' class="opcional"' : ''}><td>${escapar(i.descricao)}${i.opcional ? ' <small>(se necessário, não incluso no total)</small>' : ''}</td>
    <td class="n">${num(i.quantidade, i.unidade)}</td><td class="n">${brl(i.valorUnitario)}</td><td class="n">${i.opcional ? `${brl(i.valorUnitario)}/${escapar(i.unidade)}` : brl(i.valorTotal)}</td></tr>`;
  const base = itens.filter(i => !i.opcional), opc = itens.filter(i => i.opcional);
  const total = (base.reduce((s, i) => s + Math.round(i.valorTotal * 100), 0) + adicionais.reduce((s, a) => s + Math.round(a.valor * 100), 0)) / 100;
  return `<table class="itens"><tr><th>Descrição</th><th>Qtd.</th><th>Valor unit.</th><th>Total</th></tr>
    ${base.map(linha).join('')}
    ${adicionais.map(a => `<tr><td>${escapar(a.descricao)} <small>(adicional aprovado)</small></td><td class="n"></td><td class="n"></td><td class="n">${brl(a.valor)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">Total</td><td class="n">${brl(total)}</td></tr>
    ${opc.map(linha).join('')}
  </table>`;
};

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
    ${o.valorSinal ? `<p>Sinal de ${brl(o.valorSinal)} ${o.sinalQuando === 'NO_ATO' ? 'no dia do início da obra' : 'para agendar o início da obra'}.</p>` : ''}
    ${o.formaPagamento ? paragrafos(o.formaPagamento) : '<p>A combinar.</p>'}
    <h2>Prazo</h2><p>${o.prazoExecucaoDias ? `Execução em até ${o.prazoExecucaoDias} dia(s) a partir do início, salvo chuva ou condições do terreno.` : 'A combinar na aprovação.'}</p>
    <h2>Garantia</h2>${o.garantiaMeses ? `<p><b>${o.garantiaMeses} meses</b> a partir da conclusão.</p>` : ''}${paragrafos(d.empresa.textoGarantia)}
    <div class="assinaturas"><div>${escapar(d.empresa.empresaNome || 'Empresa')}</div><div>De acordo: ${escapar(d.cliente?.nome || 'Cliente')}</div></div>
    <p class="rodape">A profundidade final depende do terreno e do aquífero; metros além do previsto são cobrados pelo valor do metro excedente.</p>`);
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
  d.empresa.empresaDocumento && `inscrita no CNPJ/CPF sob o nº ${doc(d.empresa.empresaDocumento)}`, d.empresa.empresaEndereco && `com endereço em ${d.empresa.empresaEndereco}`]
  .filter(Boolean).join(', ');

/** Os {campos} que os modelos de contrato e aditivo podem usar (para a tela de configuração mostrar). */
export const CAMPOS_MODELO: Record<string, string> = {
  numero: 'nº do orçamento/contrato', empresa: 'nome da empresa', empresa_qualificacao: 'empresa com CNPJ e endereço', cliente: 'nome do cliente',
  cliente_qualificacao: 'cliente com documento, estado civil, endereço…', local_obra: 'endereço/GPS do poço', servicos: 'serviços contratados',
  escopo: 'escopo do orçamento', tabela_itens: 'tabela dos itens (linha sozinha)', metros: 'profundidade prevista', valor_total: 'valor total',
  valor_total_extenso: 'valor total por extenso', valor_metro_excedente: 'valor do metro excedente', sinal: 'frase do sinal', forma_pagamento: 'forma de pagamento',
  prazo_dias: 'prazo de execução em dias', garantia_meses: 'meses de garantia', texto_garantia: 'texto de garantia da configuração', foro: 'cidade do foro',
  responsavel_tecnico: 'responsável técnico', registro_tecnico: 'CREA/registro', cidade_data: 'cidade e data por extenso',
  numero_aditivo: 'nº do aditivo', data_contrato: 'data do contrato', tabela_adicionais: 'tabela do aditivo (linha sozinha)', valor_aditivo: 'valor do aditivo',
  valor_aditivo_extenso: 'valor do aditivo por extenso', novo_total: 'novo valor do contrato', novo_total_extenso: 'novo valor por extenso', observacao: 'observação do aditivo',
};

export const MODELO_CONTRATO_PADRAO = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PERFURAÇÃO E INSTALAÇÃO DE POÇO TUBULAR Nº {numero}

CONTRATADA: {empresa_qualificacao}.
CONTRATANTE: {cliente_qualificacao}.

As partes acima identificadas têm entre si justo e contratado o seguinte:

CLÁUSULA 1ª – DO OBJETO
A CONTRATADA executará para o CONTRATANTE os serviços de {servicos}, no local: {local_obra}, conforme o orçamento nº {numero} e os itens abaixo:
{tabela_itens}
{escopo}

CLÁUSULA 2ª – DA PROFUNDIDADE E DO METRO EXCEDENTE
A profundidade prevista é de {metros}. A profundidade final depende das condições geológicas e do aquífero encontrados. Se for necessário perfurar além do previsto, cada metro excedente custará {valor_metro_excedente}, mediante autorização do CONTRATANTE, registrada por mensagem escrita ou termo aditivo.

CLÁUSULA 3ª – DO PREÇO E DO PAGAMENTO
Pelos serviços o CONTRATANTE pagará o valor total de {valor_total} ({valor_total_extenso}). {sinal}
Forma de pagamento: {forma_pagamento}
O atraso no pagamento sujeita o valor devido a multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês.

CLÁUSULA 4ª – DO PRAZO
Os serviços terão início em data combinada entre as partes e serão executados em até {prazo_dias} dias, prorrogáveis por chuva, condições do terreno, falta de acesso ou de energia no local, sem culpa da CONTRATADA.

CLÁUSULA 5ª – DAS OBRIGAÇÕES DO CONTRATANTE
a) garantir acesso livre e seguro ao local para a entrada da sonda, do caminhão e da equipe;
b) informar a existência de redes enterradas (água, esgoto, energia) e fossas próximas ao ponto de perfuração;
c) providenciar as autorizações exigidas pelo órgão gestor de recursos hídricos (outorga), salvo se contratadas à parte;
d) efetuar os pagamentos nas datas combinadas.

CLÁUSULA 6ª – DAS OBRIGAÇÕES DA CONTRATADA
a) executar os serviços com equipe e equipamentos próprios, seguindo as boas práticas e as normas técnicas aplicáveis;
b) entregar ao final o laudo do poço, com profundidade, diâmetro, vazão e níveis estático e dinâmico;
c) deixar o local limpo e organizado ao fim dos serviços.

CLÁUSULA 7ª – DO RISCO GEOLÓGICO
A quantidade e a qualidade da água dependem do aquífero e não podem ser garantidas pela CONTRATADA. Caso o poço resulte seco ou com vazão insuficiente, serão devidos os metros efetivamente perfurados e os serviços executados, salvo outro acordo escrito entre as partes.

CLÁUSULA 8ª – DA GARANTIA
Os serviços têm garantia de {garantia_meses} meses a partir da conclusão, cobrindo defeitos de execução. A garantia não cobre mau uso, bomba trabalhando a seco, descargas elétricas, falta ou oscilação de energia e alterações naturais do aquífero.
{texto_garantia}

CLÁUSULA 9ª – DA RESCISÃO
O contrato pode ser rescindido por descumprimento de qualquer cláusula. Se o CONTRATANTE desistir após a mobilização da equipe, o sinal ficará com a CONTRATADA para cobrir as despesas, sem prejuízo dos serviços já executados.

CLÁUSULA 10ª – DO FORO
Fica eleito o foro da comarca de {foro} para resolver qualquer questão deste contrato.

E, por estarem de acordo, as partes assinam este contrato em duas vias de igual teor, na presença de duas testemunhas.

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
  };
};

const assinaturasContrato = (d: DocumentoObra) => {
  const c = d.cliente;
  const contratada = `CONTRATADA · ${escapar(d.empresa.empresaNome || '')}${d.empresa.responsavelTecnico ? `<br>${escapar(d.empresa.responsavelTecnico)}${d.empresa.registroTecnico ? ` · ${escapar(d.empresa.registroTecnico)}` : ''}` : ''}`;
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
