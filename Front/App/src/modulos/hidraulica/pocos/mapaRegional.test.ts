import assert from 'assert';
import { CAMADAS_PADRAO, CENTRO_PADRAO, corDoPoco, corPotencial, enquadramento, lerCamadas, lerGpsTexto, textoRaio } from './mapaRegional';
import { foneBr } from './obrasApi';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('mapa de poços: cores do potencial e dos poços', () => {
  assert.deepStrictEqual([corPotencial(120), corPotencial(76.9), corPotencial(30), corPotencial(5)], ['#0B0033', '#3B4CCA', '#D6E4F0', '#FFFFFF']);
  assert.strictEqual(corDoPoco({ situacao: 'ATIVO', ultimaObra: null }), '#52c41a');
  assert.strictEqual(corDoPoco({ situacao: 'ATIVO', ultimaObra: { idObra: 1, situacao: 'AGUARDANDO_SINAL', servicos: [] } }), '#faad14');
  assert.strictEqual(corDoPoco({ situacao: 'ATIVO', ultimaObra: { idObra: 1, situacao: 'CANCELADA', servicos: [] } }), '#52c41a');
  assert.strictEqual(corDoPoco({ situacao: 'SECO', ultimaObra: { idObra: 1, situacao: 'EM_EXECUCAO', servicos: [] } }), '#595959');
});

teste('mapa de poços: camadas lembradas e enquadramento', () => {
  assert.deepStrictEqual(lerCamadas(null), CAMADAS_PADRAO);
  assert.deepStrictEqual(lerCamadas('{"potencial":true,"nossos":"x"}'), { ...CAMADAS_PADRAO, potencial: true });
  assert.deepStrictEqual(lerCamadas('quebrado'), CAMADAS_PADRAO);
  assert.deepStrictEqual(enquadramento([]), { centro: CENTRO_PADRAO, zoom: 10 });
  assert.deepStrictEqual(enquadramento([{ latitude: -23, longitude: -46 }, { latitude: -23.2, longitude: -46.4 }]), { centro: [-23.1, -46.2], zoom: 11 });
  assert.deepStrictEqual(enquadramento([], { latitude: -22, longitude: -47 }), { centro: [-22, -47], zoom: 15 });
  assert.deepStrictEqual([textoRaio(2000), textoRaio(1500), textoRaio(800)], ['2 km', '1,5 km', '800 m']);
  assert.deepStrictEqual([lerGpsTexto('-23.0544, -47.0466'), lerGpsTexto('-23,05; -47,04'), lerGpsTexto('rua')], [{ latitude: -23.0544, longitude: -47.0466 }, { latitude: -23.05, longitude: -47.04 }, null]);
  assert.deepStrictEqual([foneBr('11998765432'), foneBr('1144556677'), foneBr(null)], ['(11) 99876-5432', '(11) 4455-6677', '']);
});
