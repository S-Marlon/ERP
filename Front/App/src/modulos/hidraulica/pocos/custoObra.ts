// Custo e margem da obra (orçamento): perfuração por formação (custo por metro e rendimento da sonda), materiais da
// estrutura prevista, bomba, horas da equipe (perfuração + montar a sonda, revestir, limpar, instalar a bomba), dias de
// obra, deslocamento (km × viagens) e despesas por dia. Com impostos, taxa de cobrança e inadimplência sobre o preço,
// dá o preço mínimo (margem mínima), o sugerido (margem desejada) e a margem do valor contratado. Puro, com teste.

export interface CustoFormacao { formacao: string; custoMetro: number; rendimentoMH: number }
export interface ParametrosObra {
  horasMobilizacao: number; horasRevestimento100m: number; horasLimpeza: number; horasInstalacaoBomba: number; horasPorDia: number; custoDia: number;
}
/** O que vem do Plano mensal (hora da equipe, km, deduções e margens). */
export interface CustosDaEmpresa {
  custoHoraEquipe: number; custoKm: number; impostosPct: number; taxaCobrancaPct: number; inadimplenciaPct: number;
  margemPct: number; margemMinimaPct: number; arredondarPara: number;
}

export interface EntradaCusto {
  trechos: Array<{ formacao: string; metros: number }>;
  /** O que a obra tem (vem dos serviços: perfuração revestida e limpa, instalação da bomba...). */
  incluir: { perfuracao: boolean; revestimento: boolean; limpeza: boolean; bomba: boolean };
  /** Materiais da estrutura prevista (a custo do cadastro) e outros, em R$. */
  materiais: number; outrosMateriais: number;
  bombaCusto: number;
  /** Km de ida e volta da base até o poço (uma viagem por dia de obra). */
  km: number;
  /** Preço combinado (valor contratado); 0 = ainda sem preço. */
  preco: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
/** Arredonda o preço para cima no múltiplo (5, 10, 50...). */
const paraCima = (v: number, multiplo: number) => (multiplo > 0 ? Math.ceil(v / multiplo - 1e-9) * multiplo : r2(v));

export const estimarCusto = (e: EntradaCusto, formacoes: CustoFormacao[], p: ParametrosObra, emp: CustosDaEmpresa) => {
  const porFormacao = new Map(formacoes.map(f => [f.formacao, f]));
  const alertas: string[] = [];
  const metros = e.trechos.reduce((s, t) => s + n(t.metros), 0);

  // perfuração: custo por metro e horas pelo rendimento de cada formação
  const perfuracao = e.incluir.perfuracao ? e.trechos.filter(t => n(t.metros) > 0).map(t => {
    const f = porFormacao.get(t.formacao);
    if (!f || !(f.custoMetro > 0)) alertas.push(`Sem custo por metro de "${t.formacao || 'formação não escolhida'}" (Custos da obra).`);
    if (f && !(f.rendimentoMH > 0)) alertas.push(`Sem rendimento (m/h) de "${t.formacao}" (Custos da obra).`);
    return { formacao: t.formacao, metros: n(t.metros), custo: r2(n(t.metros) * (f?.custoMetro || 0)), horas: f?.rendimentoMH ? r2(n(t.metros) / f.rendimentoMH) : 0 };
  }) : [];
  const custoPerfuracao = r2(perfuracao.reduce((s, x) => s + x.custo, 0));

  // horas: perfuração + fixas (montar a sonda quando perfura ou limpa, revestir por 100 m, limpar, instalar a bomba)
  const horas = {
    perfuracao: r2(perfuracao.reduce((s, x) => s + x.horas, 0)),
    mobilizacao: e.incluir.perfuracao || e.incluir.limpeza ? n(p.horasMobilizacao) : 0,
    revestimento: e.incluir.revestimento ? r2((metros / 100) * n(p.horasRevestimento100m)) : 0,
    limpeza: e.incluir.limpeza ? n(p.horasLimpeza) : 0,
    bomba: e.incluir.bomba ? n(p.horasInstalacaoBomba) : 0,
  };
  const horasTotal = r2(Object.values(horas).reduce((s, h) => s + h, 0));
  const dias = horasTotal > 0 ? Math.max(1, Math.ceil(horasTotal / (n(p.horasPorDia) || 8) - 1e-9)) : 0;
  const equipe = r2(horasTotal * n(emp.custoHoraEquipe));
  const deslocamento = r2(n(e.km) * dias * n(emp.custoKm));
  const despesasDia = r2(dias * n(p.custoDia));
  const materiais = r2(n(e.materiais) + n(e.outrosMateriais));
  const bomba = e.incluir.bomba ? r2(n(e.bombaCusto)) : 0;
  if (e.incluir.bomba && !bomba) alertas.push('Bomba sem custo: informe o valor ou a potência.');
  const custo = r2(custoPerfuracao + materiais + bomba + equipe + deslocamento + despesasDia);

  // deduções sobre o preço (impostos, taxa de cobrança, inadimplência) e as margens
  const deducoes = n(emp.impostosPct) + n(emp.taxaCobrancaPct) + n(emp.inadimplenciaPct);
  const divMin = 1 - deducoes - n(emp.margemMinimaPct), divAlvo = 1 - deducoes - n(emp.margemPct);
  const precoMinimo = custo > 0 && divMin > 0 ? paraCima(custo / divMin, n(emp.arredondarPara)) : null;
  const precoSugerido = custo > 0 && divAlvo > 0 ? paraCima(custo / divAlvo, n(emp.arredondarPara)) : null;
  const preco = n(e.preco);
  const lucro = preco > 0 ? r2(preco * (1 - deducoes) - custo) : null;
  const margem = preco > 0 && lucro !== null ? Math.round((lucro / preco) * 1000) / 1000 : null;
  const situacao: 'SEM_PRECO' | 'PREJUIZO' | 'ABAIXO_MINIMA' | 'OK' =
    preco <= 0 ? 'SEM_PRECO' : lucro! < 0 ? 'PREJUIZO' : margem! < n(emp.margemMinimaPct) ? 'ABAIXO_MINIMA' : 'OK';

  return {
    metros, perfuracao, custoPerfuracao, horas, horasTotal, dias, equipe, deslocamento, despesasDia, materiais, bomba, custo,
    deducoesPct: Math.round(deducoes * 10000) / 10000, impostosSobrePreco: preco > 0 ? r2(preco * deducoes) : null,
    precoMinimo, precoSugerido, lucro, margem, situacao, alertas,
  };
};
export type EstimativaCusto = ReturnType<typeof estimarCusto>;

/** O que a obra inclui pelos serviços: perfuração (revestida e limpa), limpeza, instalação ou troca da bomba. */
export const incluirPelosServicos = (servicos: string[]) => ({
  perfuracao: servicos.includes('PERFURACAO'),
  revestimento: servicos.includes('PERFURACAO'),
  limpeza: servicos.includes('PERFURACAO') || servicos.includes('LIMPEZA'),
  bomba: servicos.includes('INSTALACAO') || servicos.includes('TROCA_BOMBA'),
});

/** Trechos de partida: o perfil geológico do relatório (se houver) ou os metros previstos numa formação só. */
export const trechosIniciais = (relatorio: Record<string, any> | null | undefined, metrosPrevistos: number | null, formacaoPadrao: string) => {
  const camadas = (relatorio?.perfilGeologico || []).filter((c: any) => Number(c?.geoAte) > Number(c?.geoDe || 0) && c?.geoTipo && c.geoTipo !== 'Fratura com água');
  if (camadas.length) return camadas.map((c: any) => ({ formacao: String(c.geoTipo), metros: r2(Number(c.geoAte) - Number(c.geoDe || 0)) }));
  return [{ formacao: formacaoPadrao, metros: n(metrosPrevistos) || n(relatorio?.profundidade) }];
};

/** Km de ida e volta da base até o poço: linha reta (GPS) × fator da estrada × 2 (igual ao Plano mensal). */
export const kmAteOPoco = (base: { baseLatitude: number | null; baseLongitude: number | null; fatorEstrada: number }, latitude?: number | null, longitude?: number | null) => {
  if (base.baseLatitude === null || base.baseLongitude === null || latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(latitude - base.baseLatitude), dLon = rad(longitude - base.baseLongitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(base.baseLatitude)) * Math.cos(rad(latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * (base.fatorEstrada || 1) * 2);
};
