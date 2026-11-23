// Obras de poços › custos da obra (config): custo por metro e rendimento da sonda por formação, e os parâmetros que não
// dependem da formação (horas fixas, jornada, despesa por dia). O cálculo da estimativa fica no front
// (Front/App/src/modulos/hidraulica/pocos/custoObra.ts); aqui só a validação do que se grava. Puro, com teste.
import { ErroObra } from './obras';

export const FORMACOES = ['Solo / aterro', 'Argila', 'Areia', 'Silte (caxeta)', 'Rocha alterada', 'Rocha sã'] as const;

export interface CustoFormacao { formacao: string; custoMetro: number; rendimentoMH: number }
export interface ParametrosObra {
  horasMobilizacao: number; horasRevestimento100m: number; horasLimpeza: number; horasInstalacaoBomba: number; horasPorDia: number; custoDia: number;
}
export const PARAMETROS_PADRAO: ParametrosObra = { horasMobilizacao: 4, horasRevestimento100m: 3, horasLimpeza: 4, horasInstalacaoBomba: 4, horasPorDia: 8, custoDia: 0 };

const numero = (v: unknown, nome: string, max: number) => {
  if (v === undefined || v === null || v === '') return 0;
  const x = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(x) || x < 0 || x > max) throw new ErroObra(`${nome}: valor inválido (0 a ${max}).`);
  return Math.round(x * 10000) / 10000;
};

/** Formações conhecidas (as do perfil geológico), sem repetir; custo/m até 100 mil e rendimento até 100 m/h. */
export const validarFormacoes = (lista: unknown): CustoFormacao[] => {
  const vistos = new Set<string>();
  return (Array.isArray(lista) ? lista : [])
    .filter((f: any) => (FORMACOES as readonly string[]).includes(f?.formacao) && !vistos.has(f.formacao) && !!vistos.add(f.formacao))
    .map((f: any) => ({ formacao: f.formacao, custoMetro: numero(f.custoMetro, `Custo por metro (${f.formacao})`, 100000), rendimentoMH: numero(f.rendimentoMH, `Rendimento (${f.formacao})`, 100) }));
};

export const validarParametros = (b: any): ParametrosObra => {
  const horasPorDia = numero(b?.horasPorDia, 'Jornada', 24) || 8;
  return {
    horasMobilizacao: numero(b?.horasMobilizacao, 'Horas para montar a sonda', 200), horasRevestimento100m: numero(b?.horasRevestimento100m, 'Horas de revestimento por 100 m', 200),
    horasLimpeza: numero(b?.horasLimpeza, 'Horas de limpeza', 200), horasInstalacaoBomba: numero(b?.horasInstalacaoBomba, 'Horas de instalação da bomba', 200),
    horasPorDia, custoDia: numero(b?.custoDia, 'Despesa por dia', 100000),
  };
};
