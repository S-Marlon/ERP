// DANFE (Documento Auxiliar da NF-e) em HTML A4, montado a partir do XML lido (não da conferência).
// Conferência visual da nota recebida; não substitui o DANFE oficial emitido pelo fornecedor.
import type { NfeDataFromXML } from '../xml/utils/nfeParser';
import { situacaoDoProtocolo } from '../xml/utils/10-protocoloParser';
import { codificarCode128C, svgCodigoBarras } from '../../../../core/impressao/codigoBarras';

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (v: unknown) => Number(String(v ?? '').replace(',', '.')) || 0;
const moeda = (v: unknown) => num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v: unknown) => num(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const unit = (v: unknown) => num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export const formatarDocumento = (v?: string) => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v || '';
};
export const formatarChave = (chave?: string) => String(chave || '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
const formatarCep = (v?: string) => String(v || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
const data = (v?: string) => (v ? new Date(v).toLocaleDateString('pt-BR') : '');
const dataHora = (v?: string) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

const MOD_FRETE: Record<string, string> = {
  '0': '0 - Por conta do Remetente (CIF)', '1': '1 - Por conta do Destinatário (FOB)', '2': '2 - Por conta de Terceiros',
  '3': '3 - Próprio por conta do Remetente', '4': '4 - Próprio por conta do Destinatário', '9': '9 - Sem Ocorrência de Transporte',
};

// Campo com rótulo pequeno em cima e valor embaixo (padrão visual do DANFE)
const campo = (rotulo: string, valor: unknown, opcoes: { flex?: number; alinhar?: 'left' | 'right' | 'center'; negrito?: boolean } = {}) =>
  `<div class="c" style="flex:${opcoes.flex ?? 1};text-align:${opcoes.alinhar || 'left'}">` +
  `<div class="r">${esc(rotulo)}</div><div class="v${opcoes.negrito ? ' b' : ''}">${esc(valor) || '&nbsp;'}</div></div>`;

const CSS = `
@page { size: A4 portrait; margin: 7mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; margin: 0; }
.pagina { width: 196mm; margin: 0 auto; position: relative; }
.sec { font-weight: bold; font-size: 7pt; margin: 3px 0 1px; text-transform: uppercase; }
.linha { display: flex; border: 1px solid #000; border-top: none; }
.linha:first-of-type, .sec + .linha { border-top: 1px solid #000; }
.c { border-right: 1px solid #000; padding: 1px 3px; min-height: 8.5mm; overflow: hidden; }
.c:last-child { border-right: none; }
.r { font-size: 5.5pt; text-transform: uppercase; color: #222; }
.v { font-size: 8pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.b { font-weight: bold; }
.topo { display: flex; border: 1px solid #000; }
.topo > div { border-right: 1px solid #000; padding: 3px; }
.topo > div:last-child { border-right: none; }
.emit { flex: 3.2; }
.emit .nome { font-size: 11pt; font-weight: bold; margin-bottom: 2px; }
.danfe { flex: 1.3; text-align: center; }
.danfe .t { font-size: 13pt; font-weight: bold; }
.danfe .num { font-size: 9pt; font-weight: bold; margin-top: 3px; }
.tipo { display: inline-block; border: 1px solid #000; padding: 1px 6px; font-size: 12pt; font-weight: bold; margin: 2px 0; }
.chave { flex: 3.5; }
.chave .cod { text-align: center; }
.chave .num { font-size: 7.6pt; font-weight: bold; text-align: center; white-space: nowrap; margin-top: 2px; }
.chave .cons { font-size: 7pt; text-align: center; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #000; padding: 1px 2px; font-size: 6.8pt; vertical-align: top; }
th { font-size: 5.8pt; text-transform: uppercase; background: #f0f0f0; }
td.n { text-align: right; white-space: nowrap; }
td.cod { white-space: nowrap; }
.dups { display: flex; flex-wrap: wrap; border: 1px solid #000; }
.dup { border-right: 1px solid #000; padding: 1px 4px; font-size: 7pt; min-width: 32mm; }
.adic { display: flex; border: 1px solid #000; min-height: 26mm; }
.adic > div { padding: 2px 4px; white-space: pre-wrap; font-size: 7pt; }
.adic > div:first-child { flex: 2; border-right: 1px solid #000; }
.adic > div:last-child { flex: 1; }
.marca { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 34pt; font-weight: bold; color: rgba(200,0,0,.18); transform: rotate(-25deg); pointer-events: none; }
.rodape { font-size: 6.5pt; color: #444; margin-top: 3px; text-align: right; }
@media screen { body { background: #e5e5e5; padding: 10px 0; } .pagina { background: #fff; padding: 6mm; box-shadow: 0 0 6px rgba(0,0,0,.25); } }
`;

export const gerarHtmlDanfe = (nfe: NfeDataFromXML): string => {
  const ide = nfe.ide;
  const emit = nfe.emitente;
  const dest = nfe.destinatario;
  const t = nfe.totais?.icmsTot;
  const transp = nfe.transp;
  const vol = transp?.vol?.[0];
  const prot = nfe.protocolo;
  const chave = String(nfe.chaveAcesso || '').replace(/\D/g, '');
  const situacao = situacaoDoProtocolo(prot);
  const homologacao = (prot?.tpAmb || ide?.tpAmb) === '2';

  const codigoChave = chave.length === 44
    ? svgCodigoBarras({ tipo: 'CODE128', valor: chave, modulos: codificarCode128C(chave) }, 80, 11)
    : '';

  const enderecoEmit = [emit.logradouro, emit.numeroEnd, emit.complemento].filter(Boolean).join(', ');
  const enderecoDest = dest ? [dest.enderDest?.xLgr, dest.enderDest?.nro, dest.enderDest?.xCpl].filter(Boolean).join(', ') : '';

  const marca = homologacao
    ? '<div class="marca">SEM VALOR FISCAL<br>HOMOLOGAÇÃO</div>'
    : situacao !== 'AUTORIZADA' ? '<div class="marca">NF-E NÃO AUTORIZADA</div>' : '';

  const itens = (nfe.produtos || []).map(p => {
    const icms = p.imposto?.icms;
    const ipi = p.imposto?.ipi;
    return `<tr>
      <td class="cod">${esc(p.prod.cProd)}</td>
      <td>${esc(p.prod.xProd)}${p.prod.infAdProd ? `<br><i>${esc(p.prod.infAdProd)}</i>` : ''}</td>
      <td class="cod">${esc(p.prod.NCM)}</td>
      <td class="cod">${esc(icms?.csosn || (icms ? `${icms.orig || ''}${icms.cst || ''}` : ''))}</td>
      <td class="cod">${esc(p.prod.CFOP)}</td>
      <td class="cod">${esc(p.prod.uCom)}</td>
      <td class="n">${qtd(p.prod.qCom)}</td>
      <td class="n">${unit(p.prod.vUnCom)}</td>
      <td class="n">${moeda(p.prod.vProd)}</td>
      <td class="n">${num(p.prod.vDesc) ? moeda(p.prod.vDesc) : ''}</td>
      <td class="n">${icms?.vBC ? moeda(icms.vBC) : ''}</td>
      <td class="n">${icms?.vICMS ? moeda(icms.vICMS) : ''}</td>
      <td class="n">${ipi?.vIPI ? moeda(ipi.vIPI) : ''}</td>
      <td class="n">${icms?.pICMS ? qtd(icms.pICMS) : ''}</td>
      <td class="n">${ipi?.pIPI ? qtd(ipi.pIPI) : ''}</td>
    </tr>`;
  }).join('');

  const duplicatas = nfe.cobranca?.dup || [];
  const fatura = nfe.cobranca?.fat;

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>DANFE NF-e ${esc(nfe.numero)} - ${esc(emit.nome)}</title><style>${CSS}</style></head><body>
<div class="pagina">${marca}

<div class="topo">
  <div class="emit">
    <div class="nome">${esc(emit.nome)}</div>
    <div>${esc(enderecoEmit)}</div>
    <div>${esc(emit.bairro)} - ${esc(formatarCep(emit.cep))}</div>
    <div>${esc(emit.municipio)} - ${esc(emit.uf)}${emit.fone ? ` · Fone: ${esc(emit.fone)}` : ''}</div>
  </div>
  <div class="danfe">
    <div class="t">DANFE</div>
    <div style="font-size:6.5pt">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
    <div style="font-size:7pt;margin-top:2px">0 - Entrada<br>1 - Saída</div>
    <div class="tipo">${esc(ide?.tpNF || nfe.tipoOperacao)}</div>
    <div class="num">Nº ${esc(nfe.numero)}<br>Série ${esc(nfe.serie)}</div>
  </div>
  <div class="chave">
    <div class="cod">${codigoChave}</div>
    <div class="r" style="text-align:center;margin-top:2px">Chave de acesso</div>
    <div class="num">${esc(formatarChave(chave))}</div>
    <div class="cons">Consulta de autenticidade no portal nacional da NF-e<br>www.nfe.fazenda.gov.br/portal ou no site da SEFAZ autorizadora</div>
  </div>
</div>
<div class="linha">
  ${campo('Natureza da operação', nfe.naturezaOperacao, { flex: 3 })}
  ${campo('Protocolo de autorização de uso', prot ? `${prot.nProt} - ${dataHora(prot.dhRecbto)}` : 'XML sem protocolo de autorização', { flex: 2, negrito: true })}
</div>
<div class="linha">
  ${campo('Inscrição estadual', emit.ie)}
  ${campo('Insc. estadual do subst. trib.', emit.iest)}
  ${campo('CNPJ / CPF', formatarDocumento(emit.cnpj))}
</div>

<div class="sec">Destinatário / Remetente</div>
<div class="linha">
  ${campo('Nome / Razão social', dest?.xNome, { flex: 3.2 })}
  ${campo('CNPJ / CPF', formatarDocumento(dest?.cnpjOrCpfOrEstrangeiro), { flex: 1.4 })}
  ${campo('Data da emissão', data(nfe.dataEmissao), { flex: 1 })}
</div>
<div class="linha">
  ${campo('Endereço', enderecoDest, { flex: 2.6 })}
  ${campo('Bairro / Distrito', dest?.enderDest?.xBairro, { flex: 1.4 })}
  ${campo('CEP', formatarCep(dest?.enderDest?.cep), { flex: 0.8 })}
  ${campo('Data da saída/entrada', '', { flex: 1 })}
</div>
<div class="linha">
  ${campo('Município', dest?.enderDest?.xMun, { flex: 2.2 })}
  ${campo('UF', dest?.enderDest?.uf, { flex: 0.4 })}
  ${campo('Fone / Fax', dest?.enderDest?.fone, { flex: 1.2 })}
  ${campo('Inscrição estadual', dest?.ie, { flex: 1.2 })}
  ${campo('Hora da saída/entrada', '', { flex: 1 })}
</div>

${fatura || duplicatas.length ? `<div class="sec">Fatura / Duplicatas</div>
<div class="dups">
  ${fatura ? `<div class="dup"><b>Fatura ${esc(fatura.nFat)}</b><br>Original ${moeda(fatura.vOrig)} · Líquido ${moeda(fatura.vLiq)}</div>` : ''}
  ${duplicatas.map(d => `<div class="dup">Nº ${esc(d.nDup)}<br>Venc. ${esc(data(d.dVenc))}<br><b>R$ ${moeda(d.vDup)}</b></div>`).join('')}
</div>` : ''}

<div class="sec">Cálculo do imposto</div>
<div class="linha">
  ${campo('Base de cálc. do ICMS', moeda(t?.vBC), { alinhar: 'right' })}
  ${campo('Valor do ICMS', moeda(t?.vICMS), { alinhar: 'right' })}
  ${campo('Base de cálc. ICMS ST', moeda(t?.vBCST), { alinhar: 'right' })}
  ${campo('Valor do ICMS subst.', moeda(t?.vST || t?.vICMSST), { alinhar: 'right' })}
  ${campo('Valor total dos produtos', moeda(t?.vProd), { alinhar: 'right', negrito: true })}
</div>
<div class="linha">
  ${campo('Valor do frete', moeda(t?.vFrete), { alinhar: 'right' })}
  ${campo('Valor do seguro', moeda(t?.vSeg), { alinhar: 'right' })}
  ${campo('Desconto', moeda(t?.vDesc), { alinhar: 'right' })}
  ${campo('Outras despesas', moeda(t?.vOutro), { alinhar: 'right' })}
  ${campo('Valor do IPI', moeda(t?.vIPI), { alinhar: 'right' })}
  ${campo('Valor total da nota', moeda(t?.vNF), { alinhar: 'right', negrito: true })}
</div>

<div class="sec">Transportador / Volumes transportados</div>
<div class="linha">
  ${campo('Nome / Razão social', transp?.transporta?.xNome, { flex: 3 })}
  ${campo('Frete por conta', MOD_FRETE[String(transp?.modFrete ?? '')] || transp?.modFrete, { flex: 2.2 })}
  ${campo('Placa do veículo', transp?.veicTransp?.placa, { flex: 1 })}
  ${campo('UF', transp?.veicTransp?.uf, { flex: 0.4 })}
  ${campo('CNPJ / CPF', formatarDocumento(transp?.transporta?.cnpjOrCpf), { flex: 1.6 })}
</div>
<div class="linha">
  ${campo('Endereço', transp?.transporta?.xEnder, { flex: 3 })}
  ${campo('Município', transp?.transporta?.xMun, { flex: 2 })}
  ${campo('UF', transp?.transporta?.uf, { flex: 0.4 })}
  ${campo('Inscrição estadual', transp?.transporta?.ie, { flex: 1.6 })}
</div>
<div class="linha">
  ${campo('Quantidade', vol?.qVol, { alinhar: 'right' })}
  ${campo('Espécie', vol?.esp)}
  ${campo('Marca', vol?.marca)}
  ${campo('Numeração', vol?.nVol)}
  ${campo('Peso bruto', vol?.pesoB ? qtd(vol.pesoB) : '', { alinhar: 'right' })}
  ${campo('Peso líquido', vol?.pesoL ? qtd(vol.pesoL) : '', { alinhar: 'right' })}
</div>

<div class="sec">Dados dos produtos / serviços</div>
<table>
  <thead><tr>
    <th>Código</th><th style="width:34%">Descrição do produto / serviço</th><th>NCM/SH</th><th>CST</th><th>CFOP</th><th>Un</th>
    <th>Quant.</th><th>Valor unit.</th><th>Valor total</th><th>Desc.</th><th>BC ICMS</th><th>Valor ICMS</th><th>Valor IPI</th><th>Alíq. ICMS</th><th>Alíq. IPI</th>
  </tr></thead>
  <tbody>${itens}</tbody>
</table>

<div class="sec">Dados adicionais</div>
<div class="adic">
  <div><div class="r">Informações complementares</div>${esc(nfe.informacoesAdicionais?.infCpl || '')}</div>
  <div><div class="r">Reservado ao fisco</div>${esc(nfe.informacoesAdicionais?.infAdFisco || '')}</div>
</div>
<div class="rodape">Impresso pelo ERP a partir do XML recebido em ${esc(new Date().toLocaleString('pt-BR'))} · conferência interna, não substitui o DANFE do emitente</div>
</div></body></html>`;
};
