import { linkWhatsapp, mensagemDaNota, NotaDaFila } from './fiscalApi';

const assert = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

assert(linkWhatsapp('(11) 99999-0000', 'oi').startsWith('https://wa.me/5511999990000?text=oi'), 'DDI 55');
assert(linkWhatsapp('+55 11 99999-0000', 'oi').startsWith('https://wa.me/5511999990000'), 'já com DDI');

const nota = {
  idVenda: 7, cliente: 'Maria Souza', total: 27,
  documento: { chave: '3526', urlDanfe: null },
} as unknown as NotaDaFila;
let texto = mensagemDaNota(nota, 'Loja X', 'https://consulta');
assert(texto.startsWith('Olá Maria! Segue a nota fiscal da sua compra na Loja X (venda Nº 7,'), texto);
assert(texto.includes('Chave de acesso: 3526') && texto.includes('Consulte em: https://consulta'), texto);
texto = mensagemDaNota({ ...nota, cliente: 'CONSUMIDOR', documento: { ...nota.documento!, urlDanfe: 'https://danfe' } }, '', null);
assert(texto.startsWith('Olá! Segue a nota fiscal da sua compra (venda') && texto.includes('Acesse: https://danfe'), texto);

console.log('fiscalApi: ok');
