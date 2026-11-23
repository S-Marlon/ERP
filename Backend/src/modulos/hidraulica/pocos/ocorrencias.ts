// Checklist de ocorrências do poço (perfuração, água, poço, bomba e elétrica, local): o catálogo é o mesmo do front
// (Front/App/src/modulos/hidraulica/pocos/ocorrencias.ts) e aqui junta o que foi marcado nos relatórios das obras e
// nos registros do poço, para a ficha mostrar o histórico de problemas. Puro, com teste.

export type GrupoOcorrencia = 'PERFURACAO' | 'AGUA' | 'POCO' | 'BOMBA' | 'LOCAL';

export const GRUPOS_OCORRENCIA: Record<GrupoOcorrencia, { titulo: string; cor: string }> = {
  PERFURACAO: { titulo: 'Na perfuração', cor: 'volcano' },
  AGUA: { titulo: 'Qualidade da água', cor: 'blue' },
  POCO: { titulo: 'Poço e estrutura', cor: 'gold' },
  BOMBA: { titulo: 'Bomba e elétrica', cor: 'purple' },
  LOCAL: { titulo: 'Local e acesso', cor: 'default' },
};

export const OCORRENCIAS: Array<{ codigo: string; rotulo: string; grupo: GrupoOcorrencia }> = [
  { codigo: 'chkCaimento', rotulo: 'Caimento / desmoronamento', grupo: 'PERFURACAO' },
  { codigo: 'chkColapsoParede', rotulo: 'Parede instável (desbarrancando)', grupo: 'PERFURACAO' },
  { codigo: 'chkPerdaRetorno', rotulo: 'Perda de retorno do ar/fluido (fratura, galeria)', grupo: 'PERFURACAO' },
  { codigo: 'chkFerramentaPresa', rotulo: 'Ferramenta presa ou avariada', grupo: 'PERFURACAO' },
  { codigo: 'chkEstruturas', rotulo: 'Interferência com estruturas subterrâneas', grupo: 'PERFURACAO' },
  { codigo: 'chkBaixaVazaoInesperada', rotulo: 'Vazão abaixo do esperado', grupo: 'PERFURACAO' },
  { codigo: 'chkPocoSeco', rotulo: 'Poço seco (sem água)', grupo: 'PERFURACAO' },

  { codigo: 'chkAguaNaoLimpou', rotulo: 'Água turva / areia', grupo: 'AGUA' },
  { codigo: 'chkPresencaFerro', rotulo: 'Água vermelha / ferro', grupo: 'AGUA' },
  { codigo: 'chkCheiro', rotulo: 'Cheiro forte (enxofre, ovo podre)', grupo: 'AGUA' },
  { codigo: 'chkSalobra', rotulo: 'Água salobra / gosto ruim', grupo: 'AGUA' },
  { codigo: 'chkContaminacao', rotulo: 'Suspeita de contaminação (esgoto, óleo, espuma)', grupo: 'AGUA' },
  { codigo: 'chkCalcario', rotulo: 'Água dura / incrustação (calcário)', grupo: 'AGUA' },

  { codigo: 'chkReducaoVazao', rotulo: 'Queda de vazão', grupo: 'POCO' },
  { codigo: 'chkNivelBaixando', rotulo: 'Nível da água baixando', grupo: 'POCO' },
  { codigo: 'chkLajeInfiltracao', rotulo: 'Risco de infiltração na laje', grupo: 'POCO' },
  { codigo: 'chkSemTampa', rotulo: 'Poço sem tampa ou lacre', grupo: 'POCO' },
  { codigo: 'chkRevestimentoDanificado', rotulo: 'Revestimento danificado ou torto', grupo: 'POCO' },
  { codigo: 'chkAreiaReservatorio', rotulo: "Areia na caixa d'água / tubulação", grupo: 'POCO' },

  { codigo: 'chkEnergiaRuim', rotulo: 'Oscilação de energia', grupo: 'BOMBA' },
  { codigo: 'chkAquecimentoBomba', rotulo: 'Superaquecimento do motor', grupo: 'BOMBA' },
  { codigo: 'chkDisjuntorDesarma', rotulo: 'Disjuntor / térmico desarmando', grupo: 'BOMBA' },
  { codigo: 'chkLigaDesliga', rotulo: 'Bomba liga e desliga sem parar', grupo: 'BOMBA' },
  { codigo: 'chkCorrenteAlta', rotulo: 'Corrente acima da placa do motor', grupo: 'BOMBA' },
  { codigo: 'chkRuido', rotulo: 'Ruído ou vibração', grupo: 'BOMBA' },
  { codigo: 'chkFiacao', rotulo: 'Cabo ou emenda danificada', grupo: 'BOMBA' },
  { codigo: 'chkSemProtecao', rotulo: 'Sem proteção (falta de fase, a seco)', grupo: 'BOMBA' },

  { codigo: 'chkAcessoDificil', rotulo: 'Acesso difícil para a máquina', grupo: 'LOCAL' },
  { codigo: 'chkClimaAdverso', rotulo: 'Chuva / clima parou o serviço', grupo: 'LOCAL' },
  { codigo: 'chkSemEnergiaLocal', rotulo: 'Sem energia adequada no local', grupo: 'LOCAL' },
  { codigo: 'chkTerceiros', rotulo: 'Interferência de terceiros (vizinho, outro poço perto)', grupo: 'LOCAL' },
];

const PORCODIGO = new Map(OCORRENCIAS.map(o => [o.codigo, o]));
export const rotuloOcorrencia = (codigo: string) => PORCODIGO.get(codigo)?.rotulo || codigo;

/** Códigos marcados num relatório (campos booleanos chk...). */
export const marcadas = (dados: Record<string, unknown> | null | undefined) =>
  OCORRENCIAS.filter(o => dados?.[o.codigo] === true).map(o => o.codigo);

/** Só os códigos que existem no catálogo, sem repetir (para gravar o que veio da tela). */
export const codigosValidos = (lista: unknown) => [...new Set((Array.isArray(lista) ? lista : String(lista ?? '').split(','))
  .map(c => String(c).trim()).filter(c => PORCODIGO.has(c)))];

export interface FonteOcorrencias { codigos: string[]; data: string | null; origem: string }

/**
 * Histórico de ocorrências do poço: cada código com quantas vezes apareceu, a última data e onde (obra/registro).
 * Mais recente primeiro; o que se repete (2+ vezes) é o problema crônico do poço.
 */
export const ocorrenciasDoPoco = (fontes: FonteOcorrencias[]) => {
  const m = new Map<string, { codigo: string; rotulo: string; grupo: GrupoOcorrencia; vezes: number; ultimaVez: string | null; origem: string }>();
  for (const f of fontes) {
    for (const c of new Set(f.codigos)) {
      const o = PORCODIGO.get(c);
      if (!o) continue;
      const atual = m.get(c);
      if (!atual) { m.set(c, { codigo: c, rotulo: o.rotulo, grupo: o.grupo, vezes: 1, ultimaVez: f.data, origem: f.origem }); continue; }
      atual.vezes += 1;
      if ((f.data || '') > (atual.ultimaVez || '')) { atual.ultimaVez = f.data; atual.origem = f.origem; }
    }
  }
  return [...m.values()].sort((a, b) => (b.ultimaVez || '').localeCompare(a.ultimaVez || '') || b.vezes - a.vezes);
};
