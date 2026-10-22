import assert from 'assert';
import { analisarRaio, caixaDoRaio, distanciaM, lerGeojson, lerRaio, regiaoDoArquivo } from './mapa';
import { validarCliente } from './obras';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };

teste('mapa de poços: lê os poços de referência do maperf', () => {
  const r = lerGeojson({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { id_ponto: 3500000041, municipio: 'Itupeva', profundida: 150, vazao: 6.3 }, geometry: { type: 'Point', coordinates: [-47.046666, -23.054444] } },
    { type: 'Feature', properties: { id_ponto: 2, profundida: null }, geometry: { type: 'Point', coordinates: [999, -23] } },   // fora do mapa: ignora
  ] }, 'get_pocos_with_center/Jundiai.geojson');
  assert.strictEqual(r.tipo, 'POCOS');
  assert.strictEqual(r.regiao, 'jundiai');
  assert.deepStrictEqual(r.itens, [{ idExterno: '3500000041', municipio: 'Itupeva', latitude: -23.054444, longitude: -47.046666, profundidadeM: 150, vazaoM3h: 6.3 }]);
});

teste('mapa de poços: lê a grade de potencial (dentro de { geojson })', () => {
  const r = lerGeojson({ geojson: { type: 'FeatureCollection', features: [
    { id: '0', type: 'Feature', properties: { data: 76.96106366856657, id: 0 },
      geometry: { type: 'Polygon', coordinates: [[[-46.75, -23.3052], [-46.7382, -23.3052], [-46.7382, -23.3177], [-46.75, -23.3177], [-46.75, -23.3052]]] } },
  ] } }, 'atibaia.geojson');
  assert.strictEqual(r.tipo, 'POTENCIAL');
  assert.deepStrictEqual(r.itens, [{ idExterno: '0', latMin: -23.3177, latMax: -23.3052, lonMin: -46.75, lonMax: -46.7382, valor: 76.9611 }]);
  assert.throws(() => lerGeojson({ features: [] }, 'x.geojson'), /sem pontos/);
  assert.throws(() => lerGeojson({ features: [{ geometry: { type: 'LineString' } }] }, 'x.geojson'), /não reconhecido/);
  assert.strictEqual(regiaoDoArquivo('C:\\dados\\Sul Minas.json'), 'sul minas');
});

teste('mapa de poços: distância, caixa e raio', () => {
  const a = { latitude: -23.1171, longitude: -46.5565 };
  const d = distanciaM(a, { latitude: -23.1171 + 0.018, longitude: -46.5565 });
  assert.ok(Math.abs(d - 2001) < 5, String(d));                         // 0,018° de latitude ≈ 2 km
  const c = caixaDoRaio(a.latitude, a.longitude, 2000);
  assert.ok(c.latMin < a.latitude && c.lonMax > a.longitude && c.lonMax - c.lonMin > c.latMax - c.latMin);   // longitude "encolhe" fora do equador
  assert.deepStrictEqual([lerRaio(undefined), lerRaio(50), lerRaio('3000'), lerRaio(99999)], [2000, 200, 3000, 20000]);
});

teste('mapa de poços: resumo da região e metros sugeridos', () => {
  const c = { latitude: -23, longitude: -46.5 };
  const p = (dLat: number, prof: number | null, vazao: number | null, nosso = false) => ({ latitude: -23 + dLat, longitude: -46.5, profundidadeM: prof, vazaoM3h: vazao, nosso });
  const r = analisarRaio(c, 2000, [p(0.001, 120, 4), p(0.002, 150, 6, true), p(0.003, 400, null), p(0.004, null, 2), p(0.05, 90, 9)]);   // o último fica a ~5,5 km
  assert.deepStrictEqual(r, {
    raioM: 2000, quantidade: 4, nossos: 1, profundidadeMedia: 223.3, profundidadeMediana: 150, profundidadeMin: 120, profundidadeMax: 400,
    vazaoMediaM3h: 4, metrosSugeridos: 150,
  });
  assert.strictEqual(analisarRaio(c, 2000, [p(0.001, 133, null), p(0.002, 141, null)]).metrosSugeridos, 140);   // mediana 137 → 140
  assert.strictEqual(analisarRaio(c, 2000, []).metrosSugeridos, null);
});

teste('clientes de poço: só o nome é obrigatório', () => {
  const c = validarCliente({ nome: '  José  da Silva ', telefone: '(11) 99876-5432', documento: '123.456.789-01', email: 'Jose@Sitio.com', uf: 'sp' });
  assert.deepStrictEqual([c.nome, c.telefone, c.documento, c.email, c.uf], ['José da Silva', '11998765432', '12345678901', 'jose@sitio.com', 'SP']);
  assert.strictEqual(validarCliente({ nome: 'Ana' }).telefone, null);
  assert.throws(() => validarCliente({ telefone: '11999999999' }), /nome/);
  assert.throws(() => validarCliente({ nome: 'Ana', documento: '123' }), /CPF/);
  assert.throws(() => validarCliente({ nome: 'Ana', telefone: '123' }), /incompleto/);
});
