// Veículos da frota (etapa 1): regras puras de cadastro. Placa guardada sem traço e em maiúscula (antiga ABC1234 ou
// Mercosul ABC1D23); km só sobe, a não ser numa correção.

export class ErroFrota extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const TIPOS_VEICULO = ['CARRO', 'UTILITARIO', 'CAMINHAO', 'MOTO', 'OUTRO'] as const;
export const COMBUSTIVEIS = ['GASOLINA', 'ETANOL', 'FLEX', 'DIESEL', 'GNV', 'ELETRICO'] as const;
export const SITUACOES_VEICULO = ['EM_USO', 'MANUTENCAO', 'PARADO', 'VENDIDO'] as const;

const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

/** "abc-1d23 " → "ABC1D23"; null quando não é placa válida. */
export const normalizarPlaca = (v: unknown) => {
  const p = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return PLACA_ANTIGA.test(p) || PLACA_MERCOSUL.test(p) ? p : null;
};

/** Para mostrar: antiga com traço (ABC-1234), Mercosul junta (ABC1D23). */
export const placaParaMostrar = (p: string) => (PLACA_ANTIGA.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p);

const texto = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
const opcao = <T extends readonly string[]>(lista: T, v: unknown, padrao: T[number], nome: string): T[number] => {
  if (v === undefined || v === null || v === '') return padrao;
  const s = String(v).toUpperCase();
  if (!(lista as readonly string[]).includes(s)) throw new ErroFrota(`${nome} inválido.`);
  return s as T[number];
};
const positivoOuNulo = (v: unknown, nome: string) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) throw new ErroFrota(`${nome}: informe um número maior que zero.`);
  return Math.round(n * 100) / 100;
};

export const validarKm = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 9_999_999) throw new ErroFrota('Quilometragem inválida.');
  return Math.round(n);
};

/** Dados do cadastro do veículo (o km inicial só vale na criação; depois muda pelo ajuste de km). */
export const validarVeiculo = (b: any, anoAtual: number) => {
  const placa = normalizarPlaca(b?.placa);
  if (!placa) throw new ErroFrota('Placa inválida: use o formato ABC-1234 ou ABC1D23.');
  const ano = (v: unknown, nome: string) => {
    if (v === undefined || v === null || v === '') return null;
    const n = Math.floor(Number(v));
    if (!(n >= 1950 && n <= anoAtual + 1)) throw new ErroFrota(`${nome}: entre 1950 e ${anoAtual + 1}.`);
    return n;
  };
  const anoFabricacao = ano(b?.anoFabricacao, 'Ano de fabricação');
  const anoModelo = ano(b?.anoModelo, 'Ano do modelo');
  if (anoFabricacao && anoModelo && (anoModelo < anoFabricacao || anoModelo > anoFabricacao + 1)) {
    throw new ErroFrota('O ano do modelo é o de fabricação ou o seguinte.');
  }
  const renavam = String(b?.renavam ?? '').replace(/\D/g, '') || null;
  if (renavam && (renavam.length < 9 || renavam.length > 11)) throw new ErroFrota('RENAVAM: de 9 a 11 números.');
  const chassi = String(b?.chassi ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
  if (chassi && !/^[A-HJ-NPR-Z0-9]{17}$/.test(chassi)) throw new ErroFrota('Chassi: 17 letras e números (sem I, O e Q).');
  return {
    placa, apelido: texto(b?.apelido, 60),
    tipo: opcao(TIPOS_VEICULO, b?.tipo, 'CARRO', 'Tipo'),
    marca: texto(b?.marca, 40), modelo: texto(b?.modelo, 60), anoFabricacao, anoModelo, cor: texto(b?.cor, 30), renavam, chassi,
    combustivel: opcao(COMBUSTIVEIS, b?.combustivel, 'FLEX', 'Combustível'),
    tanqueLitros: positivoOuNulo(b?.tanqueLitros, 'Tanque'), cargaKg: positivoOuNulo(b?.cargaKg, 'Carga'),
    situacao: opcao(SITUACOES_VEICULO, b?.situacao, 'EM_USO', 'Situação'),
    observacao: texto(b?.observacao, 255),
  };
};

/** Novo km: só sobe; abaixo do atual só como correção (digitação errada). */
export const novoKm = (atual: number, informado: unknown, corrigir: boolean) => {
  const km = validarKm(informado);
  if (km < atual && !corrigir) throw new ErroFrota(`O km informado (${km.toLocaleString('pt-BR')}) é menor que o atual (${atual.toLocaleString('pt-BR')}): marque "corrigir" se o atual estava errado.`);
  return km;
};
