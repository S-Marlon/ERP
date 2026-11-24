import assert from 'assert';
import { DadosRelatorioCliente, htmlRelatorioCliente, SECOES_CLIENTE, verificarRelatorio } from './relatorioCliente';

const teste = (nome: string, fn: () => void) => { fn(); console.log(`${nome}: ok`); };
const todas = Object.fromEntries(SECOES_CLIENTE.map(s => [s.id, true])) as any;

const d: DadosRelatorioCliente = {
  empresa: { nome: 'Poços Exemplo', telefone: '11999990000', textoGarantia: 'Garantia da perfuração.', responsavelTecnico: 'Eng. Fulano', registroTecnico: 'CREA 123' },
  poco: { identificacao: 'Poço de <Carlos>', cidade: 'Itu', uf: 'SP', profundidadeM: 120, diametro: '5"', nivelEstaticoM: 18, nivelDinamicoM: 30 },
  cliente: { nome: 'Carlos' },
  servicos: [{ titulo: 'Perfuração', servicos: 'Perfuração, instalação', conclusao: '2026-11-20', garantiaAte: '2027-11-20' }],
  estrutura: { perfuracoes: [{ perfDe: 0, perfAte: 120, perfDiam: 6 }], revestimentos: [{ revDe: 0, revAte: 48, revDiam: 5 }] },
  conjunto: { bombaMarca: 'Ebara', profundidadeBombaM: 64, tuboBarras: 16, tuboMetros: 64, tuboLuva: 'Luva galvanizada', instaladoEm: '2026-11-20' },
  ocorrencias: [{ rotulo: 'Água turva / areia', vezes: 2, ultimaVez: '2026-11-20' }],
  fotos: [{ url: 'http://x/foto.jpg', legenda: 'Bomba' }],
  hoje: '2026-11-23',
};

teste('relatório para o cliente: seções e conteúdo', () => {
  const h = htmlRelatorioCliente(d, todas);
  assert.ok(h.startsWith('<!doctype html>'));
  assert.ok(h.includes('Poço de &lt;Carlos&gt;'));                         // escapa
  assert.ok(h.includes('Garantia válida até <b>20/11/2027</b>') && h.includes('até 20/11/2027'));
  // papel timbrado dos documentos, seções numeradas e sem imprimir sozinho (a tela imprime pela prévia)
  assert.ok(h.includes('class="topo"') && h.includes('<span class="n">1</span>Serviços realizados') && !h.includes('window.print'));
  assert.ok(h.includes('<svg') && h.includes('16 barras de 4 m = 64 m'));
  assert.ok(h.includes('Água turva / areia (2 vezes)'));
  assert.ok(h.includes('Sem corda') === false);                            // geomecânico/galvanizado: corda opcional
  assert.ok(h.includes('<img src="http://x/foto.jpg"') && h.includes('CREA 123'));
});

teste('relatório para o cliente: seções desligadas e sem dados', () => {
  const h = htmlRelatorioCliente(d, { ...todas, fotos: false, estrutura: false });
  assert.ok(!h.includes('<img src="http://x') && !h.includes('Estrutura do poço</h2>'));
  const vazio = htmlRelatorioCliente({ ...d, servicos: [], estrutura: null, conjunto: null, ocorrencias: [], fotos: [] }, todas);
  assert.ok(!vazio.includes('Serviços realizados</h2>') && !vazio.includes('Fotos</h2>') && vazio.includes('<h2>Cliente e poço</h2>')
    && vazio.includes('<span class="n">1</span>Observações e cuidados'));
});

teste('relatório para o cliente: verificação antes de mandar', () => {
  const ok = verificarRelatorio({ ...d, poco: { ...d.poco, latitude: -23.2, longitude: -47.3 }, cliente: { nome: 'Carlos', telefone: '11988887777' },
    conjunto: { ...d.conjunto!, fioMetros: 74 }, estrutura: { ...d.estrutura }, empresa: { ...d.empresa } }, { fotosDaBomba: 1 });
  assert.deepStrictEqual(ok.filter(x => x.nivel === 'CRITICO'), [], JSON.stringify(ok));
  const sem = verificarRelatorio({ ...d, conjunto: null, cliente: null, servicos: [], fotos: [] });
  const criticos = sem.filter(x => x.nivel === 'CRITICO').map(x => x.texto);
  assert.ok(criticos.includes('Motobomba não registrada (bomba, tubo, fio).') && criticos.includes('Poço sem proprietário (cliente).') && criticos.includes('Nenhuma obra concluída neste poço.'));
  assert.strictEqual(sem[0].nivel, 'CRITICO');                               // críticos primeiro
  const fio = verificarRelatorio({ ...d, conjunto: { ...d.conjunto!, fioMetros: 50 } });
  assert.ok(fio.some(x => x.nivel === 'CRITICO' && x.texto.includes('não chega')));
  assert.ok(verificarRelatorio(d, { fotosDaBomba: 0 }).some(x => x.texto === 'Sem foto da bomba.'));
});
