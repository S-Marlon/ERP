import { codigoOpcao, diferencaOpcoes, templateUsaAtributo, trocarTokenTemplate } from './atributosRegras';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

export const runAtributosRegrasTests = (): void => {
  const atuais = [
    { id: 1, valor: 'NBR', emUso: true },
    { id: 2, valor: 'Viton', emUso: false },
    { id: 3, valor: 'Silicone', emUso: true },
  ];

  const d1 = diferencaOpcoes(atuais, ['nbr', 'Silicone', 'EPDM']);
  assert(d1.manter.map(m => m.id).join() === '1,3', 'Opções existentes são mantidas pelo id (casando sem maiúsculas).');
  assert(d1.inserir.length === 1 && d1.inserir[0].valor === 'EPDM' && d1.inserir[0].ordem === 3, 'Opção nova entra na posição informada.');
  assert(d1.desativar.join() === '2' && d1.bloqueadas.length === 0, 'Opção sem uso que saiu é desativada.');

  const d2 = diferencaOpcoes(atuais, ['Viton']);
  assert(d2.bloqueadas.sort().join() === 'NBR,Silicone', 'Opções em uso não podem ser removidas.');

  const d3 = diferencaOpcoes(atuais, ['NBR', 'NBR ', 'Viton', 'Silicone']);
  assert(d3.inserir.length === 0 && d3.manter.length === 3, 'Valores repetidos na lista são ignorados.');

  assert(codigoOpcao('Aço Inox 304', 1) === 'ACO_INOX_304', 'Código da opção sem acento e em maiúsculas.');
  assert(codigoOpcao('***', 4) === 'OPC_4', 'Valor sem letras gera código sequencial.');

  assert(templateUsaAtributo('{SIGLA}-{Diametro Interno}x{ALT}', [13, 'Diâmetro interno', 'diametro_int']), 'Template usa o atributo pelo nome.');
  assert(!templateUsaAtributo('{SIGLA}-{Largura}', [13, 'Diâmetro interno', 'diametro_int']), 'Template sem o atributo.');

  const novo = trocarTokenTemplate('{SIGLA}-{Diametro Interno}x[diametro_int]', [13, 'Diâmetro interno', 'diametro_int'], 'DIAM_INT');
  assert(novo === '{SIGLA}-{DIAM_INT}x[DIAM_INT]', 'Mesclagem troca os tokens da origem pelo código do destino.');
};
