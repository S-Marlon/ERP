// Obras de poços › documentos para imprimir (ou "Salvar como PDF" no navegador): o orçamento, o laudo de entrega e o
// adesivo do quadro, com o logo e os dados da empresa da configuração do processo. Funções puras: recebem os dados da
// obra e devolvem a página HTML completa.
import type { DocumentoObra } from './obrasApi';

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

/** Orçamento: escopo, valores (pacote, metro excedente, sinal, adicionais aprovados), prazo, garantia, pagamento e validade. */
export const htmlOrcamento = (d: DocumentoObra, logo: string | null, hoje: string) => {
  const o = d.obra;
  const servicos = o.servicos.map(s => SERVICOS_TXT[s] || s).join(' + ');
  const adic = o.adicionais.map(a => `<tr><td>${escapar(a.descricao)}</td><td class="valor">${brl(a.valor)}</td></tr>`).join('');
  const total = (o.valorContratado || 0) + o.adicionais.reduce((s, a) => s + a.valor, 0);
  const validade = new Date(`${hoje}T12:00:00`); validade.setDate(validade.getDate() + o.validadeOrcamentoDias);
  return pagina(`Orçamento ${o.idObra}`, `${cabecalho(d, logo)}
    <h1>Orçamento nº ${o.idObra}${o.titulo ? ` · ${escapar(o.titulo)}` : ''}</h1>
    <p>Data: ${dataBr(hoje)} · Válido até ${dataBr(validade.toISOString().slice(0, 10))} (${o.validadeOrcamentoDias} dias)</p>
    ${linhaCliente(d)}
    <h2>Serviço</h2><p><b>${escapar(servicos)}</b>${o.metrosPrevistos ? ` · profundidade prevista: ${num(o.metrosPrevistos, 'm')}` : ''}</p>
    ${o.escopo ? paragrafos(o.escopo) : ''}
    <h2>Valores</h2><table>
      <tr><td>${escapar(servicos)}${o.metrosPrevistos ? ` (até ${num(o.metrosPrevistos, 'm')})` : ''}</td><td class="valor">${brl(o.valorContratado)}</td></tr>
      ${o.valorMetroExcedente ? `<tr><td>Metro excedente (acima do previsto, se necessário)</td><td class="valor">${brl(o.valorMetroExcedente)} por metro</td></tr>` : ''}
      ${adic}
      <tr class="total"><td>Total</td><td class="valor">${brl(total)}</td></tr>
    </table>
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
