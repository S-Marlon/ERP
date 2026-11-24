// Relatório do poço para o cliente (ficha do poço › "Relatório para o cliente"): o que foi feito e como o poço ficou,
// para mandar depois da obra — dados do poço, serviços, a estrutura e o conjunto instalado (com os desenhos),
// observações técnicas, recomendações, garantia e as fotos. HTML para imprimir ou salvar em PDF. Puro, com teste.
import { resumoEstrutura, svgPerfil, temEstrutura } from './estruturaPoco';
import { conferirConjunto, ConjuntoDesenho, svgConjunto, textoTubo } from './desenhoConjunto';
import { blocoAssinaturas, cabecalho, celula, listaCondicoes, pagina } from './documentosPocos';

export type SecaoCliente = 'servicos' | 'estrutura' | 'conjunto' | 'observacoes' | 'fotos';
export const SECOES_CLIENTE: Array<{ id: SecaoCliente; titulo: string }> = [
  { id: 'servicos', titulo: 'Serviços realizados e garantia' },
  { id: 'estrutura', titulo: 'Estrutura do poço (desenho)' },
  { id: 'conjunto', titulo: 'Bomba e instalação (desenho)' },
  { id: 'observacoes', titulo: 'Observações e recomendações' },
  { id: 'fotos', titulo: 'Fotos' },
];

export interface DadosRelatorioCliente {
  empresa: { nome?: string | null; documento?: string | null; telefone?: string | null; whatsapp?: string | null; email?: string | null; endereco?: string | null; logo?: string | null;
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
/** Telefone só com números → (11) 98888-7777. */
const fone = (t: string | null | undefined) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t || '';
};
const junta = (...v: unknown[]) => v.filter(x => x !== null && x !== undefined && String(x).trim() !== '').join(' · ');

/** Cuidados de sempre com o poço (os mesmos do laudo de entrega). */
const CUIDADOS = [
  'Bomba: não deixe trabalhar sem água (a seco); se desarmar com frequência, desligue e chame a assistência.',
  'Poço: mantenha a tampa fechada e a área em volta limpa, sem fossa ou lixo por perto.',
  'Quadro de comando: proteja da chuva e do sol direto; não altere as proteções.',
  'Sinais de atenção: queda de vazão, água turva ou com cheiro, barulho diferente na bomba.',
  'Revisão: recomendamos uma revisão preventiva a cada 12 meses.',
];

/**
 * O relatório no papel timbrado dos documentos da obra (o mesmo da proposta, do laudo e da ficha de campo): cabeçalho
 * com o quadro do documento, resumo do poço em destaque, fichas em grade, seções numeradas, desenhos ao lado dos dados,
 * cuidados, fotos e a assinatura do responsável técnico. Sem a impressão automática (a tela imprime pela prévia).
 */
export const htmlRelatorioCliente = (d: DadosRelatorioCliente, secoes: Record<SecaoCliente, boolean>) => {
  const e = d.empresa;
  const p = d.poco;
  const local = junta(p.endereco, p.bairro, p.cidade && `${p.cidade}${p.uf ? `/${p.uf}` : ''}`);
  const temGps = p.latitude !== null && p.latitude !== undefined && p.longitude !== null && p.longitude !== undefined;
  const garantia = d.servicos.map(s => s.garantiaAte).filter(Boolean).sort().pop() || null;
  const c = d.conjunto;
  const conferencia = c ? conferirConjunto(c, { profundidadeM: p.profundidadeM, nivelDinamicoM: p.nivelDinamicoM }) : [];
  // para o cliente, só o que é dele cuidar (bomba perto do fundo ou acima do nível, luva de metal antiga); conferência
  // de cadastro (fio, corda, tubos) fica só na verificação interna
  const recomendacoes = conferencia.filter(x => !x.ok && /fundo|nível dinâmico|oxidação/.test(x.texto)).map(x => `Atenção: ${x.texto}`);
  const v = (x: unknown, un = '') => (x === null || x === undefined || x === '' || (typeof x === 'number' && !x) ? '—' : `${esc(typeof x === 'number' ? num(x) : x)}${un}`);

  let n = 0;
  const titulo = (t: string) => `<h2><span class="n">${++n}</span>${esc(t)}</h2>`;
  const blocos: string[] = [];
  if (secoes.servicos && (d.servicos.length || garantia)) {
    blocos.push(`${titulo('Serviços realizados')}
      <table class="itens"><tr><th>Serviço</th><th>O que foi feito</th><th class="n">Conclusão</th><th class="n">Garantia até</th></tr>
      ${d.servicos.map(s => `<tr><td>${esc(s.titulo)}</td><td>${esc(s.servicos)}</td><td class="n">${dataBr(s.conclusao) || '—'}</td><td class="n">${dataBr(s.garantiaAte) || '—'}</td></tr>`).join('')}
      </table>
      ${garantia ? `<p class="garantia">Garantia válida até <b>${dataBr(garantia)}</b>.</p>` : ''}
      ${e.textoGarantia ? `<p class="nota">${esc(e.textoGarantia)}</p>` : ''}`);
  }
  if (secoes.estrutura && d.estrutura && temEstrutura(d.estrutura)) {
    blocos.push(`<div class="bloco">${titulo('Estrutura do poço')}<div class="lado">
      <div class="desenho">${svgPerfil(d.estrutura, { altura: 400, largura: 400 })}</div>
      <div class="texto"><div class="r">Como o poço foi construído</div>
        <ul>${resumoEstrutura(d.estrutura).map(l => `<li>${esc(l)}</li>`).join('')}</ul></div></div></div>`);
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
    ].filter(([, x]) => x && String(x).trim());
    blocos.push(`<div class="bloco">${titulo('Bomba e instalação')}<div class="lado">
      <div class="desenho">${svgConjunto(c, { profundidadeM: p.profundidadeM, nivelEstaticoM: p.nivelEstaticoM, nivelDinamicoM: p.nivelDinamicoM }, { altura: 400, largura: 400 })}</div>
      <div class="texto"><div class="ficha um">${linhas.map(([r, x]) => celula(String(r), esc(x))).join('')}</div></div></div></div>`);
  }
  if (secoes.observacoes) {
    const ocorrencias = d.ocorrencias || [];
    blocos.push(`${titulo('Observações e cuidados')}
      ${ocorrencias.length ? `<p><b>Registrado nas visitas e obras:</b> ${ocorrencias.map(o => `${esc(o.rotulo)}${o.vezes > 1 ? ` (${o.vezes} vezes)` : ''}`).join(' · ')}.</p>` : ''}
      ${listaCondicoes([...recomendacoes, ...CUIDADOS])}`);
  }
  if (secoes.fotos && d.fotos.length) {
    blocos.push(`${titulo('Fotos')}<div class="fotos">${d.fotos.map(f => `<figure><img src="${esc(f.url)}" alt=""><figcaption>${esc(f.legenda)}</figcaption></figure>`).join('')}</div>`);
  }

  const empresa = { empresaNome: e.nome, empresaDocumento: e.documento, empresaTelefone: e.telefone, empresaWhatsapp: e.whatsapp, empresaEmail: e.email, empresaEndereco: e.endereco } as any;
  const corpo = `${cabecalho({ empresa }, e.logo || null, { tipo: 'Relatório do poço', numero: p.identificacao, data: `Emitido em ${dataBr(d.hoje)}` })}
    <h1>Relatório técnico do poço</h1>
    <div class="sub">Dados do poço, serviços realizados${secoes.estrutura ? ', estrutura' : ''}${secoes.conjunto ? ' e instalação da bomba' : ''}</div>
    <div class="resumo">
      <div><div class="r">Profundidade</div><div class="v">${v(p.profundidadeM, ' m')}</div></div>
      <div><div class="r">Vazão</div><div class="v">${v(p.vazaoLh, ' L/h')}</div></div>
      <div><div class="r">Nível estático · dinâmico</div><div class="v">${v(p.nivelEstaticoM)} · ${v(p.nivelDinamicoM, ' m')}</div></div>
      <div class="destaque"><div class="r">Garantia</div><div class="v">${garantia ? `até ${dataBr(garantia)}` : '—'}</div></div>
    </div>
    <h2>Cliente e poço</h2>
    <div class="ficha tres">
      ${celula('Cliente', v(d.cliente?.nome))}${celula('Telefone', v(fone(d.cliente?.telefone)))}${celula('Perfurado em', v(dataBr(p.dataPerfuracao)))}
      ${celula('Diâmetro', v(p.diametro))}${celula('Identificação', esc(p.identificacao)).replace('<div>', '<div style="grid-column: span 2">')}
      ${celula('Local', `${v(local)}${temGps ? ` <small>· GPS ${p.latitude}, ${p.longitude}</small>` : ''}`, true)}
    </div>
    ${blocos.join('')}
    ${e.responsavelTecnico ? blocoAssinaturas([{ nome: esc(e.responsavelTecnico), papel: `Responsável técnico${e.registroTecnico ? ` · ${esc(e.registroTecnico)}` : ''}` }]) : ''}
    <div class="rodape">${esc(junta(e.nome, e.endereco, fone(e.telefone), e.email))}</div>`;
  return pagina(`Relatório do poço · ${p.identificacao}`, corpo, `
    .garantia { background: #e3f1e8; border: 1px solid #b7dcc4; color: #1e6b3a; padding: 1.6mm 3mm; border-radius: 1.5mm; margin: 2.5mm 0 1mm; }
    .bloco { break-inside: avoid; }
    .lado { display: flex; gap: 5mm; align-items: flex-start; }
    .lado .desenho { flex: 0 0 auto; border: 1px solid var(--b); border-radius: 1.5mm; padding: 2mm; background: #fbfcfd; }
    .lado .desenho svg { display: block; max-width: 92mm; height: auto; }
    .lado .texto { flex: 1; min-width: 0; } .lado ul { margin: 1mm 0 0; padding-left: 4.5mm; } .lado li { margin-bottom: 1.4mm; }
    .ficha.um { grid-template-columns: 1fr; }
    .assinaturas { justify-content: flex-end; } .assinaturas > div { flex: 0 0 75mm; }
    .fotos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
    figure { margin: 0; break-inside: avoid; }
    figure img { width: 100%; height: 45mm; object-fit: cover; border-radius: 1.5mm; border: 1px solid var(--b); display: block; }
    figcaption { font-size: 7.5pt; color: var(--m); margin-top: .8mm; }`).replace(/<script>window\.onload[\s\S]*?<\/script>/, '');
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
