// Relatório do poço para o cliente (ficha do poço › "Relatório para o cliente"): o que foi feito e como o poço ficou,
// para mandar depois da obra — dados do poço, serviços, a estrutura e o conjunto instalado (com os desenhos),
// observações técnicas, recomendações, garantia e as fotos. HTML para imprimir ou salvar em PDF. Puro, com teste.
import { resumoEstrutura, svgPerfil, temEstrutura } from './estruturaPoco';
import { conferirConjunto, ConjuntoDesenho, svgConjunto, textoTubo } from './desenhoConjunto';

export type SecaoCliente = 'servicos' | 'estrutura' | 'conjunto' | 'observacoes' | 'fotos';
export const SECOES_CLIENTE: Array<{ id: SecaoCliente; titulo: string }> = [
  { id: 'servicos', titulo: 'Serviços realizados e garantia' },
  { id: 'estrutura', titulo: 'Estrutura do poço (desenho)' },
  { id: 'conjunto', titulo: 'Bomba e instalação (desenho)' },
  { id: 'observacoes', titulo: 'Observações e recomendações' },
  { id: 'fotos', titulo: 'Fotos' },
];

export interface DadosRelatorioCliente {
  empresa: { nome?: string | null; documento?: string | null; telefone?: string | null; email?: string | null; endereco?: string | null; logo?: string | null;
    textoGarantia?: string | null; responsavelTecnico?: string | null; registroTecnico?: string | null };
  poco: { identificacao: string; endereco?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null; latitude?: number | null; longitude?: number | null;
    profundidadeM?: number | null; diametro?: string | null; vazaoLh?: number | null; nivelEstaticoM?: number | null; nivelDinamicoM?: number | null; dataPerfuracao?: string | null };
  cliente?: { nome: string; telefone?: string | null; documento?: string | null } | null;
  servicos: Array<{ titulo: string; servicos: string; conclusao: string | null; garantiaAte: string | null }>;
  estrutura?: Record<string, any> | null;
  conjunto?: (ConjuntoDesenho & { instaladoEm?: string | null }) | null;
  ocorrencias?: Array<{ rotulo: string; vezes: number; ultimaVez: string | null }>;
  fotos: Array<{ url: string; legenda: string }>;
  hoje: string;
}

const esc = (t: unknown) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const num = (v: unknown) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const dataBr = (s: string | null | undefined) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');
const campo = (rotulo: string, valor: unknown) => (valor === null || valor === undefined || String(valor).trim() === '' ? ''
  : `<div class="campo"><label>${esc(rotulo)}</label><div>${esc(valor)}</div></div>`);
const junta = (...v: unknown[]) => v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').join(' · ');

export const htmlRelatorioCliente = (d: DadosRelatorioCliente, secoes: Record<SecaoCliente, boolean>) => {
  const e = d.empresa;
  const p = d.poco;
  const local = junta(p.endereco, p.bairro, p.cidade && `${p.cidade}${p.uf ? `/${p.uf}` : ''}`);
  const gps = p.latitude !== null && p.latitude !== undefined && p.longitude !== null && p.longitude !== undefined ? `${p.latitude}, ${p.longitude}` : '';
  const garantia = d.servicos.map(s => s.garantiaAte).filter(Boolean).sort().pop() || null;
  const c = d.conjunto;
  const conferencia = c ? conferirConjunto(c, { profundidadeM: p.profundidadeM, nivelDinamicoM: p.nivelDinamicoM }) : [];
  // para o cliente, só o que é dele cuidar (bomba perto do fundo ou acima do nível, luva de metal antiga); conferência
  // de cadastro (fio, corda, tubos) fica só na verificação interna
  const recomendacoes = conferencia.filter(x => !x.ok && /fundo|nível dinâmico|oxidação/.test(x.texto)).map(x => x.texto);

  const blocos: string[] = [];
  if (secoes.servicos && (d.servicos.length || garantia)) {
    blocos.push(`<section><h2>Serviços realizados</h2><table><thead><tr><th>Serviço</th><th>O que foi feito</th><th>Conclusão</th><th>Garantia até</th></tr></thead><tbody>
      ${d.servicos.map(s => `<tr><td>${esc(s.titulo)}</td><td>${esc(s.servicos)}</td><td>${dataBr(s.conclusao) || '—'}</td><td>${dataBr(s.garantiaAte) || '—'}</td></tr>`).join('')}
    </tbody></table>${garantia ? `<p class="destaque">Garantia válida até <b>${dataBr(garantia)}</b>.</p>` : ''}</section>`);
  }
  if (secoes.estrutura && d.estrutura && temEstrutura(d.estrutura)) {
    blocos.push(`<section class="quebra-evitar"><h2>Estrutura do poço</h2><div class="lado">
      <div class="desenho">${svgPerfil(d.estrutura, { altura: 420, largura: 420 })}</div>
      <ul>${resumoEstrutura(d.estrutura).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div></section>`);
  }
  if (secoes.conjunto && c) {
    const linhas = [
      ['Bomba', junta([c.bombaMarca, c.bombaModelo].filter(Boolean).join(' '), c.potenciaCv ? `${num(c.potenciaCv)} CV` : '', c.tensao, c.estagios ? `${c.estagios} estágios` : '')],
      ['Motor / bombeador', junta([c.motorMarca, c.motorModelo].filter(Boolean).join(' '), [c.bombeadorMarca, c.bombeadorModelo].filter(Boolean).join(' '))],
      ['Profundidade da bomba', c.profundidadeBombaM ? `${num(c.profundidadeBombaM)} m` : ''],
      ['Tubo edutor', junta(c.tuboMaterial, c.tuboDiametro, textoTubo(c), c.tuboLuva)],
      ['Fio', junta(c.fioTipo, c.fioBitola, c.fioMetros ? `${num(c.fioMetros)} m` : '')],
      ['Corda', junta(c.cordaMaterial, c.cordaMetros ? `${num(c.cordaMetros)} m` : '')],
      ['Quadro de comando', c.quadroComando], ['Cabeça do poço', c.cabecaPoco], ['Instalado em', dataBr(c.instaladoEm)],
    ].filter(([, v]) => v && String(v).trim());
    blocos.push(`<section class="quebra-evitar"><h2>Bomba e instalação</h2><div class="lado">
      <div class="desenho">${svgConjunto(c, { profundidadeM: p.profundidadeM, nivelEstaticoM: p.nivelEstaticoM, nivelDinamicoM: p.nivelDinamicoM }, { altura: 420, largura: 420 })}</div>
      <div class="dados">${linhas.map(([r, v]) => campo(String(r), v)).join('')}</div></div></section>`);
  }
  if (secoes.observacoes && ((d.ocorrencias || []).length || recomendacoes.length)) {
    blocos.push(`<section><h2>Observações e recomendações</h2>
      ${(d.ocorrencias || []).length ? `<p><b>Registrado nas visitas e obras:</b> ${(d.ocorrencias || []).map(o => `${esc(o.rotulo)}${o.vezes > 1 ? ` (${o.vezes} vezes)` : ''}`).join(' · ')}.</p>` : ''}
      ${recomendacoes.length ? `<ul>${recomendacoes.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</section>`);
  }
  if (secoes.fotos && d.fotos.length) {
    blocos.push(`<section><h2>Fotos</h2><div class="fotos">${d.fotos.map(f => `<figure><img src="${esc(f.url)}" alt=""><figcaption>${esc(f.legenda)}</figcaption></figure>`).join('')}</div></section>`);
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>Relatório do poço · ${esc(p.identificacao)}</title><style>
    @page { size: A4; margin: 12mm; } * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table, td, th { font-size: inherit; } body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1f2933; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-bottom: 3px solid #006d77; padding-bottom: 8px; margin-bottom: 10px; }
    header img { max-height: 54px; max-width: 160px; } header .emp { font-size: 10px; color: #52606d; }
    header h1 { margin: 0; font-size: 18px; color: #006d77; } header .num { text-align: right; font-size: 10px; color: #52606d; }
    section { margin-bottom: 12px; } h2 { font-size: 12.5px; color: #006d77; text-transform: uppercase; letter-spacing: .4px; border-bottom: 1px solid #d9e2ec; padding-bottom: 3px; margin: 0 0 6px; }
    .grade { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; }
    .campo label { display: block; font-size: 8.5px; text-transform: uppercase; color: #7b8794; letter-spacing: .4px; } .campo div { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; } th { background: #f0f4f8; text-align: left; font-size: 9.5px; text-transform: uppercase; color: #52606d; }
    th, td { padding: 4px 6px; border-bottom: 1px solid #e4e7eb; }
    .destaque { background: #e6fffb; border: 1px solid #87e8de; padding: 5px 8px; border-radius: 4px; margin: 6px 0 0; }
    .lado { display: flex; gap: 14px; align-items: flex-start; } .lado .desenho { flex: 0 0 auto; } .lado ul, .lado .dados { flex: 1; }
    .lado .dados { display: grid; grid-template-columns: 1fr; gap: 6px; } ul { margin: 0; padding-left: 16px; } li { margin-bottom: 3px; }
    .quebra-evitar { page-break-inside: avoid; }
    .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } figure { margin: 0; page-break-inside: avoid; }
    figure img { width: 100%; height: 150px; object-fit: cover; border-radius: 4px; border: 1px solid #e4e7eb; } figcaption { font-size: 9.5px; color: #52606d; margin-top: 2px; }
    footer { margin-top: 14px; border-top: 1px solid #d9e2ec; padding-top: 8px; font-size: 9.5px; color: #52606d; }
    .assinatura { margin-top: 26px; width: 260px; border-top: 1px solid #52606d; padding-top: 3px; text-align: center; color: #1f2933; }
  </style></head><body>
    <header>
      <div style="display:flex;gap:10px;align-items:center">${e.logo ? `<img src="${esc(e.logo)}" alt="">` : ''}
        <div><h1>Relatório do poço</h1><div class="emp">${esc(junta(e.nome, e.documento, e.telefone, e.email))}</div></div></div>
      <div class="num"><b style="font-size:12px;color:#1f2933">${esc(p.identificacao)}</b><br>emitido em ${dataBr(d.hoje)}</div>
    </header>
    <section><h2>Cliente e poço</h2><div class="grade">
      ${campo('Cliente', d.cliente?.nome)}${campo('Telefone', d.cliente?.telefone)}${campo('Local', local)}${campo('GPS', gps)}
      ${campo('Profundidade', p.profundidadeM ? `${num(p.profundidadeM)} m` : '')}${campo('Diâmetro', p.diametro)}
      ${campo('Vazão', p.vazaoLh ? `${num(p.vazaoLh)} L/h` : '')}${campo('Nível estático / dinâmico', p.nivelEstaticoM || p.nivelDinamicoM ? `${num(p.nivelEstaticoM) || '—'} / ${num(p.nivelDinamicoM) || '—'} m` : '')}
      ${campo('Perfurado em', dataBr(p.dataPerfuracao))}
    </div></section>
    ${blocos.join('')}
    <footer>
      ${e.textoGarantia ? `<p>${esc(e.textoGarantia)}</p>` : ''}
      ${e.responsavelTecnico ? `<div class="assinatura">${esc(e.responsavelTecnico)}${e.registroTecnico ? `<br><span style="color:#7b8794">${esc(e.registroTecnico)}</span>` : ''}</div>` : ''}
      <p>${esc(junta(e.nome, e.endereco, e.telefone, e.email))}</p>
    </footer>
  </body></html>`;
};

// ---------------------------------------------------------------- verificação antes de mandar
export interface Pendencia { nivel: 'CRITICO' | 'AVISO'; texto: string; onde: string }

/**
 * O que falta antes de mandar o relatório ao cliente. Crítico: sem cliente, sem serviço concluído, sem motobomba
 * registrada (ou sem a profundidade dela), profundidade do poço, tubos que não batem com a bomba, fio que não chega.
 * Aviso: estrutura, fotos (e foto da bomba), garantia, GPS, telefone do cliente e os dados da empresa no cabeçalho.
 */
export const verificarRelatorio = (d: DadosRelatorioCliente, extras: { fotosDaBomba?: number } = {}): Pendencia[] => {
  const r: Pendencia[] = [];
  const add = (nivel: Pendencia['nivel'], texto: string, onde: string) => r.push({ nivel, texto, onde });
  const c = d.conjunto;
  const p = d.poco;
  if (!d.cliente?.nome) add('CRITICO', 'Poço sem proprietário (cliente).', 'Editar dados do poço');
  if (!d.servicos.some(s => s.conclusao)) add('CRITICO', 'Nenhuma obra concluída neste poço.', 'Contratos e obras');
  if (!c) add('CRITICO', 'Motobomba não registrada (bomba, tubo, fio).', 'Bomba e instalação › Registrar conjunto');
  else {
    if (!c.bombaMarca && !c.bombaModelo && !c.motorMarca && !c.bombeadorModelo) add('CRITICO', 'Motobomba sem marca/modelo.', 'Bomba e instalação › Corrigir');
    if (!Number(c.profundidadeBombaM)) add('CRITICO', 'Sem a profundidade da bomba.', 'Bomba e instalação › Corrigir');
    if (!Number(c.tuboBarras) && !Number(c.tuboMetros)) add('AVISO', 'Tubo edutor sem barras/metros.', 'Bomba e instalação › Corrigir');
    if (!Number(c.fioMetros)) add('AVISO', 'Fio da bomba sem metragem.', 'Bomba e instalação › Corrigir');
    for (const x of conferirConjunto(c, { profundidadeM: p.profundidadeM, nivelDinamicoM: p.nivelDinamicoM }).filter(x => !x.ok)) {
      add(/não chega|abaixo do fundo|acima do nível/.test(x.texto) || x.texto.startsWith('Tubos somam') ? 'CRITICO' : 'AVISO', x.texto, 'Bomba e instalação');
    }
  }
  if (!Number(p.profundidadeM)) add('CRITICO', 'Poço sem profundidade.', 'Editar dados do poço');
  if (!d.estrutura || !temEstrutura(d.estrutura)) add('AVISO', 'Sem a estrutura do poço (perfuração e revestimento).', 'Estrutura');
  else if (d.estrutura.revestimentoDesconhecido) add('AVISO', 'Revestimento não informado (o desenho sai só com a perfuração).', 'Estrutura › Informar a estrutura');
  if (!d.fotos.length) add('AVISO', 'Sem fotos (bomba, cabeça do poço, quadro).', 'Bomba e instalação › Fotos');
  else if (extras.fotosDaBomba === 0) add('AVISO', 'Sem foto da bomba.', 'Bomba e instalação › Fotos');
  if (d.servicos.some(s => s.conclusao) && !d.servicos.some(s => s.garantiaAte)) add('AVISO', 'Obra concluída sem garantia informada.', 'Obra › orçamento e contrato');
  if (p.latitude === null || p.latitude === undefined) add('AVISO', 'Poço sem GPS.', 'Editar dados do poço');
  if (!d.cliente?.telefone) add('AVISO', 'Cliente sem telefone.', 'Ficha do cliente');
  if (!d.empresa.nome || !d.empresa.telefone) add('AVISO', 'Dados da empresa incompletos no cabeçalho (nome/telefone).', 'Atendimento › Configuração');
  if (!d.empresa.textoGarantia) add('AVISO', 'Sem o texto da garantia no rodapé.', 'Atendimento › Configuração');
  return r.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'CRITICO' ? -1 : 1));
};
