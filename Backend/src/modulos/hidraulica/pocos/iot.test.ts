import assert from 'assert';
import { chaveConfere, chaveDoDispositivo, condicoesDaLeitura, Leitura, lerLote, reconciliar, resumoPorDia, statusDoDispositivo, validarDispositivo } from './iot';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const MESTRA = 'chave-mestra-de-teste-bem-longa';

teste('iot de poços: chave do aparelho', () => {
  const k = chaveDoDispositivo(MESTRA, 'esp32-a1b2');
  assert.strictEqual(k.length, 32);
  assert.strictEqual(k, chaveDoDispositivo(MESTRA, ' ESP32-A1B2 '));            // não depende de maiúscula/espaço
  assert.notStrictEqual(k, chaveDoDispositivo(MESTRA, 'ESP32-A1B3'));
  assert.notStrictEqual(k, chaveDoDispositivo(`${MESTRA}x`, 'ESP32-A1B2'));       // trocar a mestra invalida
  assert.ok(chaveConfere(MESTRA, 'ESP32-A1B2', k.toUpperCase()));
  assert.ok(!chaveConfere(MESTRA, 'ESP32-A1B2', 'errada'));
  assert.throws(() => chaveDoDispositivo('', 'X'), /IOT_CHAVE_MESTRA/);
});

teste('iot de poços: cadastro do aparelho', () => {
  const d = validarDispositivo({ nome: 'Sensor 1', identificador: 'aa:bb:cc:dd:ee:ff', conexao: 'gsm_4g', intervaloMin: '10', correnteMinA: 3, correnteMaxA: 9 });
  assert.deepStrictEqual([d.identificador, d.conexao, d.intervaloMin, d.situacao], ['AA:BB:CC:DD:EE:FF', 'GSM_4G', 10, 'ATIVO']);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'x' }), /Identificador/);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'ABCD', correnteMinA: 9, correnteMaxA: 3 }), /menor que a máxima/);
  assert.throws(() => validarDispositivo({ nome: 'S', identificador: 'ABCD', intervaloMin: 0 }), /Intervalo/);
});

teste('iot de poços: lote de leituras', () => {
  const agora = new Date('2026-10-22T15:00:00-03:00');
  const l = lerLote({ leituras: [
    { em: '2026-10-22T14:30:00-03:00', coluna_m: 21.6, corrente_a: 6.8, bomba: 1, vazao_lh: 3200 },
    { em: '2026-10-22T14:00:00-03:00', nivel_m: 18, bomba: false },
  ] }, agora, 60);
  assert.deepStrictEqual(l.map(x => [x.em.slice(11, 16), x.nivelM, x.bombaLigada]), [['14:00', 18, false], ['14:30', 38.4, true]]);   // em ordem; 60 − 21,6 = 38,4
  assert.strictEqual(lerLote({ nivel_m: 10 }, agora, null)[0].nivelM, 10);    // leitura solta vale a hora de agora
  assert.throws(() => lerLote({ leituras: [{ em: '2026-10-22T16:00:00-03:00' }] }, agora, null), /futuro/);
  assert.throws(() => lerLote({ leituras: [{ em: '2026-07-01T10:00:00-03:00' }] }, agora, null), /60 dias/);
  assert.throws(() => lerLote({ leituras: [{ corrente_a: -1 }] }, agora, null), /Corrente fora da faixa/);
  assert.throws(() => lerLote({ leituras: [] }, agora, null), /Nenhuma/);
});

const L = (x: Partial<Leitura>): Leitura => ({
  em: '2026-10-22 10:00:00', nivelM: null, vazaoLh: null, correnteA: null, tensaoV: null, bombaLigada: null, horimetroH: null, temperaturaC: null, sinalDbm: null, bateriaV: null, ...x,
});
const lim = { nivelAlertaM: 45, correnteMinA: 3, correnteMaxA: 9, vazaoMinLh: 1000, tensaoMinV: 200, tensaoMaxV: 240 };

teste('iot de poços: condições de alerta', () => {
  assert.deepStrictEqual(condicoesDaLeitura(lim, L({ nivelM: 46, correnteA: 1.2, bombaLigada: true, vazaoLh: 200, tensaoV: 190 })).map(c => c.tipo),
    ['NIVEL_BAIXO', 'A_SECO', 'VAZAO_BAIXA', 'TENSAO']);
  assert.deepStrictEqual(condicoesDaLeitura(lim, L({ correnteA: 12 })).map(c => c.tipo), ['SOBRECORRENTE']);           // 12 A > 0,5: ligada
  assert.deepStrictEqual(condicoesDaLeitura(lim, L({ correnteA: 0.1, vazaoLh: 0 })), []);                               // desligada: não é "a seco"
  assert.deepStrictEqual(condicoesDaLeitura({ ...lim, nivelAlertaM: null }, L({ nivelM: 99 })), []);                    // sem limite, sem alerta
});

teste('iot de poços: abrir e fechar alertas', () => {
  const r = reconciliar(['SEM_SINAL', 'TENSAO'], [
    L({ em: '2026-10-22 10:00:00', correnteA: 1, bombaLigada: true }),              // abre a seco; fecha sem sinal; tensão sem dado: continua
    L({ em: '2026-10-22 10:15:00', correnteA: 6, bombaLigada: true, tensaoV: 220 }), // fecha a seco (aberto neste lote) e tensão
  ], lim);
  assert.deepStrictEqual(r.abrir.map(a => [a.tipo, a.inicio, a.fim]), [['A_SECO', '2026-10-22 10:00:00', '2026-10-22 10:15:00']]);   // registrado com início e fim
  assert.deepStrictEqual(r.fechar, [{ tipo: 'SEM_SINAL', fim: '2026-10-22 10:00:00' }, { tipo: 'TENSAO', fim: '2026-10-22 10:15:00' }]);
  const r2 = reconciliar([], [L({ nivelM: 50 }), L({ em: '2026-10-22 10:15:00', nivelM: 51 })], lim);
  assert.deepStrictEqual(r2.abrir.map(a => [a.tipo, a.inicio]), [['NIVEL_BAIXO', '2026-10-22 10:00:00']]);           // não repete
});

teste('iot de poços: situação do aparelho e resumo do dia', () => {
  const agora = new Date('2026-10-22T10:40:00');
  assert.deepStrictEqual([statusDoDispositivo('2026-10-22 10:30:00', 15, agora), statusDoDispositivo('2026-10-22 10:05:00', 15, agora),
    statusDoDispositivo('2026-10-22 09:00:00', 15, agora), statusDoDispositivo(null, 15, agora)], ['ONLINE', 'ATRASADO', 'SEM_SINAL', 'NUNCA']);
  const dia = resumoPorDia([
    L({ em: '2026-10-22 08:00:00', nivelM: 18, bombaLigada: false }),
    L({ em: '2026-10-22 08:15:00', nivelM: 38, bombaLigada: true, vazaoLh: 3000 }),
    L({ em: '2026-10-22 08:30:00', nivelM: 40, bombaLigada: true, vazaoLh: 2800 }),
    L({ em: '2026-10-22 12:30:00', nivelM: 19, bombaLigada: false }),             // 4 h sem leitura: conta só 30 min (2 × 15)
  ], 15);
  assert.deepStrictEqual(dia, [{ dia: '2026-10-22', leituras: 4, nivelEstaticoM: 18.5, nivelDinamicoM: 39, vazaoMediaLh: 2900, horasBomba: 0.75, volumeM3: 2.15 }]);
});
