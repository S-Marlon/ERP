import assert from 'assert';
import { normalizarPlaca, novoKm, placaParaMostrar, validarKm, validarVeiculo } from './veiculos';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('frota: placa nos dois formatos', () => {
  assert.strictEqual(normalizarPlaca(' abc-1234 '), 'ABC1234');
  assert.strictEqual(normalizarPlaca('abc1d23'), 'ABC1D23');
  assert.strictEqual(normalizarPlaca('AB1234'), null);
  assert.strictEqual(normalizarPlaca('ABC12345'), null);
  assert.strictEqual(placaParaMostrar('ABC1234'), 'ABC-1234');
  assert.strictEqual(placaParaMostrar('ABC1D23'), 'ABC1D23');
});

teste('frota: cadastro do veículo', () => {
  const v = validarVeiculo({ placa: 'rtx-2c45', apelido: ' Strada  branca ', tipo: 'utilitario', anoFabricacao: 2021, anoModelo: 2022, renavam: '0123.456.789-0', chassi: '9bd 17201 2a3456789', tanqueLitros: '55,5' }, 2026);
  assert.deepStrictEqual([v.placa, v.apelido, v.tipo, v.combustivel, v.situacao, v.renavam, v.chassi, v.tanqueLitros],
    ['RTX2C45', 'Strada branca', 'UTILITARIO', 'FLEX', 'EM_USO', '01234567890', '9BD172012A3456789', 55.5]);
  assert.throws(() => validarVeiculo({ placa: 'X' }, 2026), /Placa/);
  assert.throws(() => validarVeiculo({ placa: 'ABC1234', anoFabricacao: 2021, anoModelo: 2023 }, 2026), /ano do modelo/);
  assert.throws(() => validarVeiculo({ placa: 'ABC1234', anoFabricacao: 2030 }, 2026), /entre 1950/);
  assert.throws(() => validarVeiculo({ placa: 'ABC1234', chassi: '9BD172012A345678O' }, 2026), /Chassi/);   // com O
  assert.throws(() => validarVeiculo({ placa: 'ABC1234', renavam: '123' }, 2026), /RENAVAM/);
  assert.throws(() => validarVeiculo({ placa: 'ABC1234', tipo: 'NAVIO' }, 2026), /Tipo/);
});

teste('frota: km só sobe (a não ser corrigindo)', () => {
  assert.strictEqual(validarKm('85.430'), 85430);
  assert.strictEqual(novoKm(1000, 1500, false), 1500);
  assert.throws(() => novoKm(1000, 900, false), /menor que o atual/);
  assert.strictEqual(novoKm(1000, 900, true), 900);
  assert.throws(() => validarKm(-1), /inválida/);
});
