import assert from 'assert';
import { ehMarcaVazia, marcaNoNome, marcasParaBusca } from './marcaNoNome';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const marcas = marcasParaBusca(['AMANCO', 'KRONA', 'GTOP-GBR', 'NTN', 'SAFETY', 'KALIPSO', 'Sem Marca', '2ª Linha', 'CORR PLASTIK', 'DeWALT']);

teste('marca no nome: acha a do produto', () => {
  assert.strictEqual(marcaNoNome('KORAX ABRAC. 9MM SIMPLEX GALV. - 10-12', marcas), 'KORAX');
  assert.strictEqual(marcaNoNome('VALV RET.VERT.METAL BRASFORT 3/4"966', marcas), 'BRASFORT');
  assert.strictEqual(marcaNoNome('MULTIMETRO DIGITAL BRASFO.PRO 8522', marcas), 'BRASFORT');
  assert.strictEqual(marcaNoNome('NIVEL BASE MAGNETICA STARF.TORPEDO', marcas), 'STARFER');
  assert.strictEqual(marcaNoNome('FITA ISOLANTE 3M ALTA TENSAO 19X02M', marcas), '3M');
  assert.strictEqual(marcaNoNome('ROLAMENTO PER.6802-2RSU PEER/SKF', marcas), 'SKF');
  assert.strictEqual(marcaNoNome('ROLAMENTO UC 206-18 GTOP-GBR', marcas), 'GTOP-GBR');
  assert.strictEqual(marcaNoNome('CAPACETE SEG.CLASSE AB AZUL SAFETY', marcas), 'SAFETY');
  assert.strictEqual(marcaNoNome('TUBO CORR PLASTIK 1/2', marcas), 'CORR PLASTIK');
  assert.strictEqual(marcaNoNome('Conexão Amanco joelho 25mm', marcas), 'AMANCO');
});

teste('marca no nome: não confunde', () => {
  // compatibilidade: a marca é da máquina
  assert.strictEqual(marcaNoNome('Escova de Carvao - Serra Marmore p/ DeWALT 861-B', marcas), null);
  assert.strictEqual(marcaNoNome('TERMINAL PARA KRONA 1/2', marcas), null);
  assert.strictEqual(marcaNoNome('ESCOVA DE CARVÃO TIPO DEWALT', marcas), null);
  // pedaço de palavra não conta (IMAR dentro de PRIMARIO, NTN dentro de outra palavra)
  assert.strictEqual(marcaNoNome('TINTA PRIMARIA CINZA', marcas), null);
  assert.strictEqual(marcaNoNome('ANTENA 1/2', marcas), null);
  // "sem marca" e "2ª linha" nunca são marca
  assert.strictEqual(marcaNoNome('PARAFUSO SEM MARCA 2ª LINHA', marcas), null);
  assert.ok(ehMarcaVazia('Sem Marca') && ehMarcaVazia('2ª Linha') && !ehMarcaVazia('KRONA'));
});
