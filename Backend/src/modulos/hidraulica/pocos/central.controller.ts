// Obras de poços › Central (painel principal do módulo): GET /central devolve
// - hoje: agenda do dia, contatos sem resposta, alertas dos sensores, cobrança vencida e a receber;
// - contratos: as obras em aberto por fase, com o que falta para fechar cada uma;
// - completar: clientes e poços com informação faltando (e a % da base completa);
// - plano: a prévia do plano mensal (chance de cada cliente assinar e a estimativa do valor).
// Tudo calculado do que o módulo já guarda (regras e pesos em central.ts).
import { Request, Response } from 'express';
import pool from '../../../infra/db';
import { garantiaAte, lerServicos } from './obras';
import { responderErro } from './obras.controller';
import { checklistDaObra } from './processo';
import { carregarConfig, eventosDe, fotosPorEtapa, paraProcesso, regras } from './processo.controller';
import {
  ClienteParaPlano, completudeCliente, completudePoco, estimativaPlano, faseDoContrato, pendenciasDoContrato, propensaoPlano,
} from './central';
import { idadeEmAnos } from './conjuntos';
import { carregarPlanoMensal } from './planoMensal.controller';
import { planoSugerido as planoSugerido_, precoDoPlano } from './planoMensal';

const tenantDe = (req: Request): number => Number(req.query.tenant_id || req.headers['x-tenant-id'] || req.body?.tenant_id || 1);
const n = (v: unknown) => Number(v) || 0;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const agoraLocal = () => {
  const d = new Date(); const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const meses = (de: string, ate: string) => {
  const a = new Date(`${de.slice(0, 10)}T12:00:00`), b = new Date(`${ate.slice(0, 10)}T12:00:00`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
};
/** Serviços de manutenção (contam como recorrência) e os que valem como "visita" para estimar o plano. */
const MANUTENCAO = ['LIMPEZA', 'MANUTENCAO', 'TROCA_BOMBA', 'TESTE_VAZAO'];
const VISITA = ['LIMPEZA', 'MANUTENCAO'];

/** Monta todos os números da Central (usado também pela ficha completa do cliente, para a prévia do plano). */
export const calcularCentral = async (tenant: number) => {
  {
    const agora = agoraLocal();
    const hoje = agora.slice(0, 10);
    const cfg = await carregarConfig(tenant);

    // ------------------------------------------------------------ obras (contratos)
    const [obras]: any = await pool.execute(
      `SELECT o.id_obra, o.id_cliente, o.id_poco, o.titulo, o.servicos, o.situacao, o.valor_contratado, o.garantia_meses,
              DATE_FORMAT(o.created_at, '%Y-%m-%d %H:%i:%s') AS criada_txt, DATE_FORMAT(o.data_previsao, '%Y-%m-%d') AS previsao_txt,
              DATE_FORMAT(o.data_inicio, '%Y-%m-%d') AS inicio_txt, DATE_FORMAT(o.data_termino, '%Y-%m-%d') AS termino_txt,
              c.nome AS cliente, c.telefone, po.identificacao AS poco, po.latitude, po.profundidade_m, po.vazao_lh,
              (SELECT COALESCE(SUM(a.valor), 0) FROM modulo_hidraulica_pocos_adicionais a WHERE a.id_obra = o.id_obra AND a.situacao = 'APROVADO') AS adicionais,
              (SELECT COALESCE(SUM(p.valor), 0) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status <> 'CANCELADO') AS parcelado,
              (SELECT COALESCE(SUM(p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status <> 'CANCELADO') AS recebido,
              (SELECT COALESCE(SUM(p.valor - p.valor_pago), 0) FROM modulo_hidraulica_pocos_parcelas p
                WHERE p.id_obra = o.id_obra AND p.status = 'ABERTO' AND p.vencimento < CURDATE()) AS vencido,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_parcelas p WHERE p.id_obra = o.id_obra AND p.status = 'ABERTO' AND p.vencimento < CURDATE()) AS parcelas_vencidas,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras_materiais l WHERE l.id_obra = o.id_obra) AS mat_linhas,
              (SELECT COUNT(*) FROM modulo_hidraulica_pocos_obras_materiais l WHERE l.id_obra = o.id_obra AND l.qtd_usada IS NULL) AS mat_sem
       FROM modulo_hidraulica_pocos_obras o
       LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = o.id_cliente
       LEFT JOIN modulo_hidraulica_pocos_pocos po ON po.id_poco = o.id_poco
       WHERE o.tenant_id = ? AND o.situacao <> 'CANCELADA' ORDER BY o.id_obra DESC LIMIT 3000`, [tenant]);
    const ids = obras.map((o: any) => Number(o.id_obra));
    const [ev, ft] = await Promise.all([eventosDe(ids), fotosPorEtapa(ids)]);
    const rg = regras(cfg);
    const contratos: any[] = [];
    for (const o of obras) {
      const fase = faseDoContrato(o.situacao);
      if (!fase) continue;
      const total = Math.round((n(o.valor_contratado) + n(o.adicionais)) * 100) / 100;
      const etapas = checklistDaObra(paraProcesso(o), ev.get(Number(o.id_obra)) || [], ft.get(Number(o.id_obra)) || {}, rg, agora)
        // pós-venda fica em Atendimento; as etapas do orçamento só contam enquanto a obra não começou
        .filter(i => i.grupo !== 'POS_VENDA' && (i.grupo !== 'ORCAMENTO' || fase === 'NEGOCIACAO' || fase === 'SINAL'))
        .filter(i => i.estado === 'PENDENTE' || i.estado === 'ATRASADO')
        .map(i => ({ titulo: i.titulo, estado: i.estado as 'PENDENTE' | 'ATRASADO' }));
      const servicos = lerServicos(o.servicos);
      const pendencias = pendenciasDoContrato({
        situacao: o.situacao, servicos, criadaEm: o.criada_txt, dataPrevisao: o.previsao_txt || null, dataInicio: o.inicio_txt || null, dataTermino: o.termino_txt || null,
        valorContratado: nulo(o.valor_contratado), garantiaMeses: nulo(o.garantia_meses), total, parcelado: n(o.parcelado), recebido: n(o.recebido), vencido: n(o.vencido),
        temPoco: !!o.id_poco, pocoComGps: o.latitude !== null, pocoComProfundidade: !!n(o.profundidade_m), pocoComVazao: !!n(o.vazao_lh),
        clienteComTelefone: !!o.telefone, materiaisLinhas: n(o.mat_linhas), materiaisSemConferir: n(o.mat_sem), etapasProcesso: etapas,
      }, hoje);
      if (fase === 'FECHAMENTO' && !pendencias.length) continue;
      contratos.push({
        idObra: Number(o.id_obra), titulo: o.titulo || `Obra ${o.id_obra}`, cliente: o.cliente || null, telefone: o.telefone || null, idCliente: Number(o.id_cliente),
        idPoco: nulo(o.id_poco), poco: o.poco || null, servicos, situacao: o.situacao, fase, total, recebido: n(o.recebido),
        aReceber: Math.round((total - n(o.recebido)) * 100) / 100, desde: o.termino_txt || o.inicio_txt || o.criada_txt.slice(0, 10), pendencias,
        gravidade: pendencias.some(p => p.gravidade === 'ALTA') ? 'ALTA' : pendencias.some(p => p.gravidade === 'MEDIA') ? 'MEDIA' : 'BAIXA',
      });
    }

    // ------------------------------------------------------------ clientes e poços (completar e plano)
    const [clientes]: any = await pool.execute(`SELECT * FROM modulo_hidraulica_pocos_clientes WHERE tenant_id = ? AND ativo = 1`, [tenant]);
    const [pocos]: any = await pool.execute(
      `SELECT p.*, DATE_FORMAT(p.data_perfuracao, '%Y-%m-%d') AS perfuracao_txt, c.nome AS proprietario
       FROM modulo_hidraulica_pocos_pocos p LEFT JOIN modulo_hidraulica_pocos_clientes c ON c.id_cliente = p.id_proprietario
       WHERE p.tenant_id = ? AND p.situacao <> 'DESATIVADO'`, [tenant]);
    const [iot]: any = await pool.execute(`SELECT DISTINCT id_poco FROM modulo_hidraulica_pocos_dispositivos WHERE tenant_id = ? AND situacao = 'ATIVO'`, [tenant]);
    const [planos]: any = await pool.execute(`SELECT DISTINCT id_poco FROM modulo_hidraulica_pocos_planos_manutencao WHERE tenant_id = ? AND ativo = 1`, [tenant]);
    const [conjuntos]: any = await pool.execute(
      `SELECT id_poco, situacao, potencia_cv, DATE_FORMAT(instalado_em, '%Y-%m-%d') AS instalado FROM modulo_hidraulica_pocos_conjuntos WHERE tenant_id = ?`, [tenant]);
    const comIot = new Set(iot.map((x: any) => Number(x.id_poco)));
    const comConjunto = new Set(conjuntos.filter((k: any) => k.situacao === 'INSTALADO').map((k: any) => Number(k.id_poco)));
    const comPlano = new Set(planos.map((x: any) => Number(x.id_poco)));

    const completar = {
      clientes: clientes.map((c: any) => ({ idCliente: Number(c.id_cliente), nome: c.nome, ...completudeCliente({ telefone: c.telefone, documento: c.documento, endereco: c.endereco, cidade: c.cidade }) }))
        .filter((c: any) => c.pct < 100).sort((a: any, b: any) => a.pct - b.pct),
      pocos: pocos.map((p: any) => ({
        idPoco: Number(p.id_poco), identificacao: p.identificacao, proprietario: p.proprietario || null,
        ...completudePoco({ latitude: nulo(p.latitude), profundidadeM: nulo(p.profundidade_m), vazaoLh: nulo(p.vazao_lh), nivelEstaticoM: nulo(p.nivel_estatico_m),
          diametro: p.diametro || null, dataPerfuracao: p.perfuracao_txt || null, idProprietario: nulo(p.id_proprietario), perfuradoPor: p.perfurado_por, temConjunto: p.situacao === 'ATIVO' ? comConjunto.has(Number(p.id_poco)) : undefined }),
      })).filter((p: any) => p.pct < 100).sort((a: any, b: any) => a.pct - b.pct),
      totalClientes: clientes.length, totalPocos: pocos.length, pct: 0,
    };
    const somaPct = clientes.reduce((s: number, c: any) => s + completudeCliente(c).pct, 0)
      + pocos.reduce((s: number, p: any) => s + completudePoco({ latitude: nulo(p.latitude), profundidadeM: nulo(p.profundidade_m), vazaoLh: nulo(p.vazao_lh),
        nivelEstaticoM: nulo(p.nivel_estatico_m), diametro: p.diametro || null, dataPerfuracao: p.perfuracao_txt || null, idProprietario: nulo(p.id_proprietario),
        perfuradoPor: p.perfurado_por, temConjunto: p.situacao === 'ATIVO' ? comConjunto.has(Number(p.id_poco)) : undefined }).pct, 0);
    completar.pct = clientes.length + pocos.length ? Math.round(somaPct / (clientes.length + pocos.length)) : 100;

    const avaliacoes = new Set<number>();
    for (const [idObra, lista] of ev) if (lista.some(e => e.etapa === 'AVALIACAO_RECEBIDA' && e.situacao === 'FEITO')) avaliacoes.add(idObra);
    const ehManutencao = (s: string[]) => s.some(x => MANUTENCAO.includes(x));
    const ehVisita = (s: string[]) => s.length > 0 && s.every(x => VISITA.includes(x));
    const concluidasManut = obras.filter((o: any) => o.situacao === 'CONCLUIDA' && ehVisita(lerServicos(o.servicos)) && n(o.valor_contratado) > 0);
    const visitaEmpresa = concluidasManut.length ? concluidasManut.reduce((s: number, o: any) => s + n(o.valor_contratado), 0) / concluidasManut.length : null;
    // planos oferecidos (tela Plano mensal): com eles, a estimativa é o preço do plano sugerido para o poço do cliente
    const pm = await carregarPlanoMensal(pool, tenant);
    const plano = clientes.map((c: any) => {
      const id = Number(c.id_cliente);
      const dele = pocos.filter((p: any) => Number(p.id_proprietario) === id);
      const obrasDele = obras.filter((o: any) => Number(o.id_cliente) === id);
      const concluidas = obrasDele.filter((o: any) => o.situacao === 'CONCLUIDA');
      const manut = concluidas.filter((o: any) => ehManutencao(lerServicos(o.servicos)));
      const perfurouAqui = new Set(concluidas.filter((o: any) => lerServicos(o.servicos).some(s => s === 'PERFURACAO' || s === 'INSTALACAO')).map((o: any) => Number(o.id_poco)));
      const nossos = dele.filter((p: any) => p.perfurado_por === 'NOS' || perfurouAqui.has(Number(p.id_poco))).length;
      const idades = dele.map((p: any) => p.perfuracao_txt).filter(Boolean).map((d: string) => Math.floor(meses(d, hoje) / 12));
      const profundidades = dele.map((p: any) => n(p.profundidade_m)).filter((x: number) => x > 0);
      const garantias = concluidas.map((o: any) => garantiaAte(o.termino_txt || null, nulo(o.garantia_meses))).filter(Boolean) as string[];
      const ultimaGarantia = garantias.sort().pop() || null;
      const ultimaObra = concluidas.map((o: any) => o.termino_txt).filter(Boolean).sort().pop() || null;
      const ultimaManut = manut.map((o: any) => o.termino_txt).filter(Boolean).sort().pop() || null;
      const idsPocos = new Set(dele.map((p: any) => Number(p.id_poco)));
      const conjDele = conjuntos.filter((k: any) => idsPocos.has(Number(k.id_poco)));
      const idadesBomba = conjDele.filter((k: any) => k.situacao === 'INSTALADO' && k.instalado).map((k: any) => idadeEmAnos(k.instalado, hoje) as number);
      const dados: ClienteParaPlano = {
        pocos: dele.length, pocosNossos: nossos, idadeMaisVelhoAnos: idades.length ? Math.max(...idades) : null,
        profundidadeMaxM: profundidades.length ? Math.max(...profundidades) : null, obrasConcluidas: concluidas.length, obrasManutencao: manut.length,
        valorGasto: concluidas.reduce((s: number, o: any) => s + n(o.valor_contratado) + n(o.adicionais), 0),
        mesesDesdeUltimaObra: ultimaObra ? meses(ultimaObra, hoje) : null, mesesDesdeUltimaManutencao: ultimaManut ? meses(ultimaManut, hoje) : null,
        garantiaVencida: !!ultimaGarantia && ultimaGarantia < hoje, garantiaVencendoMeses: ultimaGarantia && ultimaGarantia >= hoje ? meses(hoje, ultimaGarantia) : null,
        avaliou: obrasDele.some((o: any) => avaliacoes.has(Number(o.id_obra))), temIot: dele.some((p: any) => comIot.has(Number(p.id_poco))),
        temPlanoManutencao: dele.some((p: any) => comPlano.has(Number(p.id_poco))), parcelasVencidas: obrasDele.reduce((s: number, o: any) => s + n(o.parcelas_vencidas), 0),
        bombaMaisVelhaAnos: idadesBomba.length ? Math.max(...idadesBomba) : null, trocasBomba: conjDele.filter((k: any) => k.situacao === 'RETIRADO').length,
        temTelefone: !!c.telefone, obraAberta: obrasDele.some((o: any) => ['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO'].includes(o.situacao)),
      };
      const visitaCliente = manut.filter((o: any) => ehVisita(lerServicos(o.servicos)) && n(o.valor_contratado) > 0);
      const prop = propensaoPlano(dados);
      let estimativa = estimativaPlano(dados, visitaCliente.length ? visitaCliente.reduce((s: number, o: any) => s + n(o.valor_contratado), 0) / visitaCliente.length : null, visitaEmpresa);
      let planoSugerido: string | null = null;
      if (pm.niveis.length) {
        const ativos = dele.filter((p: any) => p.situacao === 'ATIVO');
        const cvs = conjDele.filter((k: any) => k.situacao === 'INSTALADO' && n(k.potencia_cv) > 0).map((k: any) => n(k.potencia_cv));
        const poco = { profundidadeM: dados.profundidadeMaxM, potenciaCv: cvs.length ? Math.max(...cvs) : null, pocos: Math.max(1, ativos.length) };
        const precos = pm.niveis.map(nv => ({ nome: nv.nome, preco: precoDoPlano(pm.custos, nv, poco, pm.mediaVisitaEmpresa) }));
        const sug = planoSugerido_(precos);
        const viaveis = precos.filter(x => x.preco.viavel).map(x => x.preco.precoMensal);
        if (sug) {
          planoSugerido = sug.nome;
          estimativa = {
            valorMensal: sug.preco.precoMensal, minimo: Math.min(...viaveis), maximo: Math.max(...viaveis),
            base: `Plano ${sug.nome}: custo ${brl(sug.preco.custoMensal)}/mês, lucro ${brl(sug.preco.lucroMensal)}/mês`
              + `${sug.preco.economiaAnual > 0 ? `, o cliente economiza ${brl(sug.preco.economiaAnual)}/ano` : ''}`,
          };
        } else estimativa = { ...estimativa, base: `Nenhum plano viável para este poço (ver Plano mensal). ${estimativa.base}` };
      }
      return {
        idCliente: id, nome: c.nome, telefone: c.telefone || null, cidade: c.cidade || null, ...dados, ...prop, estimativa, planoSugerido,
      };
    }).filter((c: any) => c.pocos > 0 || c.obrasConcluidas > 0).sort((a: any, b: any) => b.pontos - a.pontos || b.valorGasto - a.valorGasto);
    const potencial = (faixa: string) => plano.filter((c: any) => c.faixa === faixa).reduce((s: number, c: any) => s + c.estimativa.valorMensal, 0);

    // ------------------------------------------------------------ hoje
    const [[ag]]: any = await pool.execute(
      `SELECT COUNT(*) AS n, GROUP_CONCAT(titulo ORDER BY hora_inicio SEPARATOR ' | ') AS titulos FROM modulo_hidraulica_pocos_agenda
       WHERE tenant_id = ? AND situacao = 'AGENDADO' AND data_inicio <= CURDATE() AND data_fim >= CURDATE()`, [tenant]);
    const [[ld]]: any = await pool.execute(
      `SELECT COUNT(*) AS n FROM modulo_hidraulica_pocos_leads WHERE tenant_id = ? AND respondido_em IS NULL AND situacao <> 'PERDIDO'`, [tenant]);
    const [[al]]: any = await pool.execute(`SELECT COUNT(*) AS n FROM modulo_hidraulica_pocos_alertas WHERE tenant_id = ? AND fim IS NULL`, [tenant]);
    const [[rc]]: any = await pool.execute(
      `SELECT COALESCE(SUM(valor - valor_pago), 0) AS total, COALESCE(SUM(CASE WHEN vencimento < CURDATE() THEN valor - valor_pago ELSE 0 END), 0) AS vencido
       FROM modulo_hidraulica_pocos_parcelas WHERE tenant_id = ? AND status = 'ABERTO'`, [tenant]);

    return {
      hoje: {
        agenda: n(ag.n), agendaTitulos: ag.titulos ? String(ag.titulos).split(' | ').slice(0, 5) : [], contatosSemResposta: n(ld.n), alertasIot: n(al.n),
        aReceber: n(rc.total), vencido: n(rc.vencido),
      },
      contratos, completar,
      plano: {
        clientes: plano, potencialAlta: potencial('ALTA'), potencialMedia: potencial('MEDIA'), visitaEmpresa: visitaEmpresa === null ? null : Math.round(visitaEmpresa * 100) / 100,
        alta: plano.filter((c: any) => c.faixa === 'ALTA').length, media: plano.filter((c: any) => c.faixa === 'MEDIA').length,
      },
    };
  }
};

// GET /central
export const central = async (req: Request, res: Response) => {
  try { return res.json(await calcularCentral(tenantDe(req))); }
  catch (e) { return responderErro(res, e, 'Erro ao montar a central.'); }
};
