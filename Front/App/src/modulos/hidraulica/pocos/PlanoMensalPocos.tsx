// Obras de poços › Mais ferramentas › Plano mensal, em abas: análise por cliente (distância, preço, faixa de lucro e
// risco de cada um, e o total da carteira), simulador caso a caso (com o preço combinado e o raio da distância), planos
// oferecidos, custos (da empresa e da obra) e a carteira (chance de assinar). Viável quando a empresa lucra a margem
// mínima e o cliente paga menos do que avulso. A conta fica no backend (planoMensal.ts); a tela usa o que está sendo
// editado, antes de salvar.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Divider, Empty, Flex, Input, Popconfirm, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, UndoOutlined, WarningOutlined } from '@ant-design/icons';
import { Central, centralApi, ClienteAnalisado, CustosPlano, NivelPlano, planoMensalApi, PlanoMensalDados, PlanoSimulado, PocoSimulado, PrecoPlano } from './obrasApi';
import { PlanoMensal as Carteira } from './CentralPocos';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { AnalisePlanoCarteira, FaixaLucro, TagRisco } from './AnalisePlanoCarteira';
import { DescontoAdesao } from './DescontoAdesao';
import { VisorCustosPlanos } from './VisorCustosPlanos';
import { CustosObraConfig } from './CustosObraConfig';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pctTxt = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

/** Campos dos custos: rótulo, sufixo, passo e se é percentual (a tela mostra 6, o banco guarda 0,06). */
type Campo = { k: keyof CustosPlano; rotulo: string; sufixo?: string; prefixo?: string; passo?: number; pct?: boolean; ajuda?: string; opcional?: boolean };
const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Equipe: preventiva e chamado', campos: [
    { k: 'custoHoraEquipe', rotulo: 'Custo por hora (por pessoa)', prefixo: 'R$', ajuda: 'Salário + encargos e benefícios de uma pessoa ÷ horas produtivas do mês (120 a 150 h)' },
    { k: 'pessoasPreventiva', rotulo: 'Pessoas na preventiva', passo: 1, ajuda: 'Normalmente 1: a preventiva não tira a bomba' },
    { k: 'horasVisita', rotulo: 'Horas da preventiva', sufixo: 'h', passo: 0.5, ajuda: 'No local, com o teste de vazão (sem a viagem)' },
    { k: 'pessoasTroca', rotulo: 'Pessoas no chamado/troca', passo: 1, ajuda: 'A equipe que tira e desce a bomba (2 ou 3)' },
    { k: 'horasTroca', rotulo: 'Horas do chamado (poço raso)', sufixo: 'h', passo: 0.5, ajuda: 'Meio período; passou de 8 h, volta no dia seguinte (2ª viagem)' },
    { k: 'horasPor100m', rotulo: 'Horas a mais por 100 m', sufixo: 'h', passo: 0.5, ajuda: 'Tirar e descer o tubo no chamado/troca (≈ 17 barras de 6 m)' },
  ] },
  { titulo: 'Chamados e urgência', campos: [
    { k: 'chamadosPocoAno', rotulo: 'Chamados esperados por poço/ano', passo: 0.5, ajuda: 'Quantas vezes um poço "para" por ano; o pessimista usa o limite do plano' },
    { k: 'domingoFeriadoPct', rotulo: 'Chamados em domingo/feriado', sufixo: '%', pct: true, passo: 1, ajuda: 'Só pesa nos planos com prioridade (os outros esperam o dia útil)' },
    { k: 'adicionalDomingoPct', rotulo: 'Hora extra no domingo/feriado', sufixo: '%', pct: true, passo: 10, ajuda: 'CLT: 100%' },
    { k: 'taxaUrgencia', rotulo: 'Taxa de urgência', prefixo: 'R$', passo: 10, ajuda: 'Cobrada no domingo/feriado de quem não tem prioridade (fora do plano)' },
    { k: 'custoPipa', rotulo: 'Caminhão-pipa', prefixo: 'R$', passo: 50, ajuda: 'Só nos planos com água emergencial' },
    { k: 'pipaPct', rotulo: 'Chance de precisar do pipa', sufixo: '%', pct: true, passo: 5, ajuda: 'Em quantos chamados leva o pipa' },
  ] },
  { titulo: 'Deslocamento e material', campos: [
    { k: 'kmMedio', rotulo: 'Km médio de ida e volta', sufixo: 'km', passo: 10, ajuda: 'Usado quando o poço não tem GPS ou a base não foi informada' },
    { k: 'custoKm', rotulo: 'Custo por km', prefixo: 'R$', passo: 0.1, ajuda: 'Combustível e desgaste do veículo' },
    { k: 'materialVisita', rotulo: 'Material por visita', prefixo: 'R$', passo: 10 },
    { k: 'fatorEstrada', rotulo: 'Fator da estrada', sufixo: '×', passo: 0.05, ajuda: 'Distância em linha reta × fator = km de estrada (1,3 é o comum)' },
  ] },
  { titulo: 'Limpeza e monitoramento', campos: [
    { k: 'custoLimpeza', rotulo: 'Custo de uma limpeza programada', prefixo: 'R$', passo: 50, ajuda: 'Só entra no plano que incluir limpeza programada' },
    { k: 'custoMonitoramentoMes', rotulo: 'Monitoramento por mês', prefixo: 'R$', passo: 5, ajuda: 'Chip, dados e plataforma por poço' },
    { k: 'aparelhoValor', rotulo: 'Valor do aparelho', prefixo: 'R$', passo: 50 },
    { k: 'aparelhoMeses', rotulo: 'Pagar o aparelho em', sufixo: 'meses', passo: 6 },
  ] },
  { titulo: 'Bomba e material', campos: [
    { k: 'bombaPrecoPorCv', rotulo: 'Preço da bomba por CV', prefixo: 'R$', passo: 100 },
    { k: 'bombaVidaAnos', rotulo: 'Vida útil da bomba', sufixo: 'anos', passo: 0.5 },
    { k: 'materialMetro', rotulo: 'Material por metro de poço', prefixo: 'R$', passo: 5,
      ajuda: 'Tubo edutor + fio + corda por metro, a preço de venda (vai até a bomba; sem ela, 70% da profundidade)' },
    { k: 'materialVidaAnos', rotulo: 'Vida útil do material', sufixo: 'anos', passo: 1, ajuda: 'De quantos em quantos anos se troca a tubulação e o fio' },
    { k: 'materialAnoPoco', rotulo: 'Conexões e peças por ano', prefixo: 'R$', passo: 50, ajuda: 'Peças pequenas por poço por ano (fora o tubo e o fio), a preço de venda' },
  ] },
  { titulo: 'Planejamento', campos: [
    { k: 'metaAssinantes', rotulo: 'Meta de assinantes', passo: 1 },
    { k: 'metaReceita', rotulo: 'Meta de receita por mês', prefixo: 'R$', passo: 500 },
    { k: 'capacidadeSemana', rotulo: 'Serviços da equipe por semana', passo: 1, ajuda: 'Preventivas e chamados que cabem sem atrasar o "amanhã"' },
    { k: 'custoEquipeDedicada', rotulo: 'Equipe só para os planos (mês)', prefixo: 'R$', passo: 500, ajuda: 'Salários + encargos + veículo: para ver a partir de quantos assinantes vale' },
  ] },
  { titulo: 'Preço', campos: [
    { k: 'impostosPct', rotulo: 'Impostos', sufixo: '%', pct: true, passo: 0.5 },
    { k: 'taxaCobrancaPct', rotulo: 'Taxa de cobrança', sufixo: '%', pct: true, passo: 0.5, ajuda: 'Boleto, cartão ou PIX recorrente' },
    { k: 'inadimplenciaPct', rotulo: 'Inadimplência esperada', sufixo: '%', pct: true, passo: 0.5 },
    { k: 'margemPct', rotulo: 'Margem desejada', sufixo: '%', pct: true, passo: 1 },
    { k: 'margemMinimaPct', rotulo: 'Margem mínima', sufixo: '%', pct: true, passo: 1, ajuda: 'Abaixo disso o plano não é viável' },
    { k: 'arredondarPara', rotulo: 'Arredondar de', prefixo: 'R$', passo: 5, ajuda: 'O preço mensal vai de 5 em 5 reais' },
    { k: 'precoVisitaAvulsa', rotulo: 'Visita avulsa (o que cobramos)', prefixo: 'R$', passo: 50, opcional: true,
      ajuda: 'Para comparar com o plano. Vazio = média das manutenções concluídas' },
  ] },
];

const NIVEL_NOVO: NivelPlano = {
  nome: 'Novo plano', descricao: null, visitasAno: 1, limpezaACadaMeses: null, chamadosAno: 2, descontoPecasPct: 0, descontoLimpezaPct: 0, prioridade: false, aguaEmergencial: false, monitoramento: false,
  reservaBombaPct: 0, fidelidadeMeses: 12, ordem: 99, ativo: true,
};

/** Preço do plano para o poço simulado: preço, custo, lucro, economia do cliente e o que reprova. */
const Resultado: React.FC<{ p: PrecoPlano; sugerido: boolean }> = ({ p, sugerido }) => (
  <Space direction="vertical" size={2} style={{ width: '100%' }}>
    <Flex justify="space-between" align="baseline">
      <Text strong style={{ fontSize: 20 }}>{brl(p.precoMensal)}<Text type="secondary">/mês</Text></Text>
      {p.viavel ? <Tag color="green" icon={<CheckCircleOutlined />}>{sugerido ? 'sugerido' : 'viável'}</Tag>
        : <Tooltip title={p.avisos.join('. ')}><Tag color="red" icon={<WarningOutlined />}>inviável</Tag></Tooltip>}
    </Flex>
    <Text type="secondary" style={{ fontSize: 12 }}>
      custo {brl(p.custoMensal)} · lucro <Text style={{ fontSize: 12, color: p.lucroMensal >= 0 ? '#389e0d' : '#cf1322' }}>{brl(p.lucroMensal)}</Text> ({pctTxt(p.margemReal)})
    </Text>
    <Tooltip title={p.comparacaoEstimada ? 'Sem o preço da visita avulsa nem manutenções concluídas: comparação estimada pelo custo com a margem.' : undefined}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        avulso sairia {brl(p.avulsoAnual)}/ano · cliente {p.economiaAnual >= 0 ? 'economiza' : 'paga a mais'}{' '}
        <Text style={{ fontSize: 12, color: p.economiaAnual >= 0 ? '#389e0d' : '#cf1322' }}>{brl(Math.abs(p.economiaAnual))}</Text>{p.comparacaoEstimada ? ' (estimado)' : ''}
      </Text>
    </Tooltip>
    {!p.viavel && p.avisos.map((a, i) => <Text key={i} type="danger" style={{ fontSize: 12 }}>{a}</Text>)}
  </Space>
);

const CartaoNivel: React.FC<{
  n: NivelPlano; original: NivelPlano | null; preco?: PrecoPlano; sugerido: boolean; taxaUrgencia: number;
  onMudar: (n: NivelPlano) => void; onSalvar: () => void; onApagar: () => void; onDesfazer: () => void;
}> = ({ n, original, preco, sugerido, taxaUrgencia, onMudar, onSalvar, onApagar, onDesfazer }) => {
  const mudou = !original || JSON.stringify(original) !== JSON.stringify(n);
  const set = (x: Partial<NivelPlano>) => onMudar({ ...n, ...x });
  const linha = (rotulo: string, campo: React.ReactNode) => (
    <Flex justify="space-between" align="center" gap={8}><Text style={{ fontSize: 13 }}>{rotulo}</Text>{campo}</Flex>
  );
  return (
    <Card size="small" style={{ height: '100%', opacity: n.ativo ? 1 : 0.6, borderColor: sugerido ? '#52c41a' : undefined }}
      title={<Input variant="borderless" value={n.nome} maxLength={60} onChange={e => set({ nome: e.target.value })} style={{ fontWeight: 600, padding: 0 }} />}
      extra={<Tooltip title={n.ativo ? 'Oferecido (desligue para tirar da oferta sem apagar)' : 'Fora da oferta'}>
        <Switch size="small" checked={n.ativo} onChange={v => set({ ativo: v })} />
      </Tooltip>}>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {preco ? <Resultado p={preco} sugerido={sugerido} /> : <Text type="secondary">{n.ativo ? 'calculando…' : 'fora da oferta'}</Text>}
        <Divider style={{ margin: '4px 0' }} />
        {linha('Visitas preventivas por ano', <CampoNumero size="small" min={0} max={24} value={n.visitasAno} onChange={v => set({ visitasAno: v ?? 0 })} style={{ width: 80 }} />)}
        {linha('Limpeza programada a cada', <CampoNumero size="small" min={0} max={120} value={n.limpezaACadaMeses ?? 0} onChange={v => set({ limpezaACadaMeses: v ? v : null })}
          suffix="meses" style={{ width: 110 }} placeholder="não" />)}
        {linha('Chamados inclusos por ano (limite)', <CampoNumero size="small" min={0} max={24} value={n.chamadosAno} onChange={v => set({ chamadosAno: v ?? 0 })} style={{ width: 80 }} />)}
        {linha('Prioridade: domingo e feriado', <Switch size="small" checked={n.prioridade} onChange={v => set({ prioridade: v })} />)}
        {!n.prioridade && <Text type="secondary" style={{ fontSize: 11, marginTop: -4 }}>
          Chamado entra na fila do próximo dia útil{taxaUrgencia ? `; domingo/feriado com taxa de ${brl(taxaUrgencia)}` : ''}.
        </Text>}
        {linha('Água emergencial (caminhão-pipa)', <Switch size="small" checked={n.aguaEmergencial} onChange={v => set({ aguaEmergencial: v })} />)}
        {linha('Monitoramento (IoT)', <Switch size="small" checked={n.monitoramento} onChange={v => set({ monitoramento: v })} />)}
        {linha('Cobre da troca da bomba', <CampoNumero size="small" min={0} max={100} step={10} value={Math.round(n.reservaBombaPct * 100)}
          onChange={v => set({ reservaBombaPct: (v ?? 0) / 100 })} suffix="%" style={{ width: 90 }} />)}
        {linha('Desconto em material (tubo, fio, conexões)', <CampoNumero size="small" min={0} max={100} value={Math.round(n.descontoPecasPct * 100)}
          onChange={v => set({ descontoPecasPct: (v ?? 0) / 100 })} suffix="%" style={{ width: 90 }} />)}
        {linha('Desconto na limpeza', <CampoNumero size="small" min={0} max={90} value={Math.round(n.descontoLimpezaPct * 100)}
          onChange={v => set({ descontoLimpezaPct: (v ?? 0) / 100 })} suffix="%" style={{ width: 90 }} />)}
        {linha('Fidelidade', <CampoNumero size="small" min={0} max={120} step={6} value={n.fidelidadeMeses} onChange={v => set({ fidelidadeMeses: v ?? 0 })} suffix="meses" style={{ width: 110 }} />)}
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={255} placeholder="Texto para o cliente (o que o plano oferece)"
          value={n.descricao || ''} onChange={e => set({ descricao: e.target.value || null })} />
        <Flex justify="space-between">
          <Popconfirm title={`Apagar o plano ${n.nome}?`} description="Para só tirar da oferta, desligue a chave." okText="Apagar" cancelText="Não" onConfirm={onApagar}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
          <Space size={4}>
            {mudou && original && <Button size="small" icon={<UndoOutlined />} onClick={onDesfazer}>Desfazer</Button>}
            <Button size="small" type={mudou ? 'primary' : 'default'} disabled={!mudou} icon={<SaveOutlined />} onClick={onSalvar}>Salvar</Button>
          </Space>
        </Flex>
      </Space>
    </Card>
  );
};

const PlanoMensalPocos: React.FC = () => {
  const [dados, setDados] = useState<PlanoMensalDados | null>(null);
  const [custos, setCustos] = useState<CustosPlano | null>(null);
  const [niveis, setNiveis] = useState<(NivelPlano & { chave: string })[]>([]);
  const [cliente, setCliente] = useState<number | null>(null);
  const [poco, setPoco] = useState<PocoSimulado>({ profundidadeM: 80, potenciaCv: 1.5, pocos: 1 });
  const [sim, setSim] = useState<{ planos: PlanoSimulado[] } | null>(null);
  const [aba, setAba] = useState<'ANALISE' | 'SIMULAR' | 'PLANOS' | 'CUSTOS' | 'CARTEIRA'>('ANALISE');
  /** Preço fechado com o cliente, por plano (para ver o risco com desconto). */
  const [combinados, setCombinados] = useState<Record<string, number>>({});
  const [simulando, setSimulando] = useState(false);
  const [erroSim, setErroSim] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [central, setCentral] = useState<Central | null>(null);

  const carregar = () => planoMensalApi.carregar().then(d => {
    setDados(d); setCustos(d.custos);
    setNiveis(d.niveis.map(n => ({ ...n, chave: String(n.idNivel) })));
  }).catch(erro);
  const recarregarCarteira = () => centralApi.carregar().then(setCentral).catch(() => setCentral(null));
  useEffect(() => { carregar(); recarregarCarteira(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // simula o que está na tela (custos e planos ainda não salvos), meio segundo depois da última mudança
  const vez = useRef(0);
  useEffect(() => {
    if (!custos) return;
    const minha = ++vez.current;
    setSimulando(true);
    const t = setTimeout(() => {
      planoMensalApi.simular(custos, niveis.filter(n => n.ativo && n.nome.trim()), poco, combinados)
        .then(r => { if (minha === vez.current) { setSim(r); setErroSim(null); setSimulando(false); } })
        .catch(e => { if (minha === vez.current) { setErroSim(e instanceof Error ? e.message : 'Erro ao simular.'); setSimulando(false); } });
    }, 500);
    return () => clearTimeout(t);
  }, [custos, niveis, poco, combinados]);

  const precoDe = (n: NivelPlano & { chave: string }) => {
    if (!sim || !n.ativo) return undefined;
    const i = niveis.filter(x => x.ativo && x.nome.trim()).indexOf(n);
    return i >= 0 ? sim.planos[i]?.preco : undefined;
  };
  const sugerido = useMemo(() => {
    const viaveis = (sim?.planos || []).filter(p => p.preco.viavel);
    return viaveis.sort((a, b) => b.preco.economiaAnual - a.preco.economiaAnual || a.preco.precoMensal - b.preco.precoMensal)[0]?.nome || null;
  }, [sim]);

  if (!dados || !custos) return <Card loading />;
  const custosMudaram = JSON.stringify(custos) !== JSON.stringify(dados.custos);
  const escolherCliente = (id: number | null) => {
    setCliente(id); setCombinados({});
    const c = dados.clientes.find(x => x.idCliente === id);
    setPoco(c ? { profundidadeM: c.profundidadeM, potenciaCv: c.potenciaCv, pocos: Math.max(1, c.pocos), latitude: c.latitude, longitude: c.longitude, kmIdaVolta: null,
        profundidadeBombaM: c.profundidadeBombaM ?? null }
      : { ...poco, latitude: null, longitude: null });
  };
  const salvarCustos = async () => {
    setSalvando(true);
    try { const c = await planoMensalApi.salvarCustos(custos); setDados({ ...dados, custos: c, salvo: true }); setCustos(c); message.success('Custos salvos.'); recarregarCarteira(); }
    catch (e) { erro(e); } finally { setSalvando(false); }
  };
  const salvarNivel = async (n: NivelPlano & { chave: string }) => {
    try {
      const { chave, ...sem } = n;
      const salvo = await planoMensalApi.salvarNivel(sem);
      setNiveis(l => l.map(x => (x.chave === chave ? { ...salvo, chave: String(salvo.idNivel) } : x)));
      setDados(d => d && ({ ...d, niveis: [...d.niveis.filter(x => x.idNivel !== salvo.idNivel), salvo] }));
      message.success(`Plano ${salvo.nome} salvo.`);
      recarregarCarteira();
    } catch (e) { erro(e); }
  };
  const apagarNivel = async (n: NivelPlano & { chave: string }) => {
    try {
      if (n.idNivel) await planoMensalApi.apagarNivel(n.idNivel);
      setNiveis(l => l.filter(x => x.chave !== n.chave));
      setDados(d => d && ({ ...d, niveis: d.niveis.filter(x => x.idNivel !== n.idNivel) }));
    } catch (e) { erro(e); }
  };
  const valorCampo = (c: Campo) => {
    const v = custos[c.k] as number | null;
    return v === null ? null : c.pct ? Math.round(v * 10000) / 100 : v;
  };
  const mudarCampo = (c: Campo, v: number | null) =>
    setCustos({ ...custos, [c.k]: v === null ? (c.opcional ? null : 0) : c.pct ? Math.round(v * 100) / 10000 : v });
  const simulado = sim?.planos.find(p => p.nome === sugerido);

  const simularCliente = (c: ClienteAnalisado) => { escolherCliente(c.idCliente); setAba('SIMULAR'); };
  const naoSalvos = custosMudaram || niveis.some(n => JSON.stringify(dados.niveis.find(x => x.idNivel === n.idNivel) || null) !== JSON.stringify((({ chave, ...x }) => x)(n)));
  const ativos = niveis.filter(n => n.ativo && n.nome.trim());

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {!dados.salvo && <Alert type="info" showIcon message="Os custos são valores padrão (palpites). Troque pelos seus custos reais (aba Custos) e salve: o preço de cada plano muda na hora." />}
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Segmented value={aba} onChange={v => setAba(v as typeof aba)}
          options={[{ value: 'ANALISE', label: 'Análise por cliente' }, { value: 'SIMULAR', label: 'Simular caso a caso' }, { value: 'PLANOS', label: 'Planos oferecidos' },
            { value: 'CUSTOS', label: 'Custos' }, { value: 'CARTEIRA', label: 'Carteira (chance de assinar)' }]} />
        {naoSalvos && <Tag color="gold" style={{ margin: 0 }}>há mudanças não salvas: as contas já usam o que está na tela</Tag>}
      </Flex>

      {aba === 'ANALISE' && <AnalisePlanoCarteira custos={custos} niveis={ativos} onSimular={simularCliente} onIrCustos={() => setAba('CUSTOS')} />}

      {aba === 'CUSTOS' && <>
      <Row gutter={[12, 12]} align="top">
        <Col xs={24} xl={15}>
          <Card size="small" title="Custos e variáveis da empresa"
            extra={<Space size={4}>
              {custosMudaram && <Button size="small" icon={<UndoOutlined />} onClick={() => setCustos(dados.custos)}>Desfazer</Button>}
              <Button size="small" type="primary" icon={<SaveOutlined />} disabled={!custosMudaram} loading={salvando} onClick={salvarCustos}>Salvar custos</Button>
            </Space>}>
            {GRUPOS.map(g => (
              <div key={g.titulo}>
                <Divider titlePlacement="start" plain style={{ margin: '4px 0 6px' }}><Text type="secondary" style={{ fontSize: 12 }}>{g.titulo}</Text></Divider>
                <Row gutter={[10, 6]}>
                  {g.titulo === 'Deslocamento e material' && (
                    <Col xs={24} lg={12}>
                      <Tooltip title="Cole a localização de onde a equipe sai (como no GPS do poço). Com ela, o transporte de cada cliente sai da distância até o poço." placement="topLeft">
                        <Text style={{ fontSize: 12 }}>Base da empresa (GPS)</Text>
                      </Tooltip>
                      <Input size="small" allowClear placeholder="-23.1171, -46.5565 (vazio = usa o km médio)"
                        value={custos.baseGps ?? (custos.baseLatitude !== null ? `${custos.baseLatitude}, ${custos.baseLongitude}` : '')}
                        onChange={e => setCustos({ ...custos, baseGps: e.target.value })} />
                    </Col>
                  )}
                  {g.campos.map(c => (
                    <Col key={c.k} xs={24} sm={12} lg={8}>
                      <Tooltip title={c.ajuda} placement="topLeft">
                        <Text style={{ fontSize: 12 }}>{c.rotulo}</Text>
                      </Tooltip>
                      <CampoNumero size="small" style={{ width: '100%' }} min={0} step={c.passo || 1} value={valorCampo(c)}
                        prefix={c.prefixo} suffix={c.sufixo} placeholder={c.k === 'precoVisitaAvulsa' && dados.mediaVisitaEmpresa ? `média ${brl(dados.mediaVisitaEmpresa)}` : undefined}
                        onChange={v => mudarCampo(c, v as number | null)} />
                    </Col>
                  ))}
                </Row>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <VisorCustosPlanos planos={sim?.planos || []} custos={custos} poco={poco} carregando={simulando} erro={erroSim}
            onPoco={p => { setCliente(null); setPoco(p); }} />
        </Col>
      </Row>
      <CustosObraConfig />
      </>}

      {aba === 'SIMULAR' && (
      <Row gutter={[12, 12]}>
        <Col xs={24}>
          <Card size="small" title="Simular para um cliente ou poço">
            <Row gutter={[10, 8]}>
              <Col xs={24} md={10}>
                <Text style={{ fontSize: 12 }}>Cliente (pega os poços dele)</Text>
                <Select size="small" style={{ width: '100%' }} allowClear showSearch optionFilterProp="label" placeholder="Poço digitado ao lado" value={cliente}
                  onChange={v => escolherCliente(v ?? null)}
                  options={dados.clientes.map(c => ({ value: c.idCliente, label: `${c.nome}${c.pocos > 1 ? ` (${c.pocos} poços)` : ''}` }))} />
              </Col>
              <Col xs={8} md={5}>
                <Text style={{ fontSize: 12 }}>Profundidade</Text>
                <CampoNumero size="small" min={0} max={1000} style={{ width: '100%' }} suffix="m" value={poco.profundidadeM} placeholder="80"
                  onChange={v => { setCliente(null); setPoco({ ...poco, profundidadeM: v ?? null }); }} />
              </Col>
              <Col xs={8} md={5}>
                <Text style={{ fontSize: 12 }}>Bomba</Text>
                <CampoNumero size="small" min={0} max={200} step={0.5} style={{ width: '100%' }} suffix="CV" value={poco.potenciaCv} placeholder="1,5"
                  onChange={v => { setCliente(null); setPoco({ ...poco, potenciaCv: v ?? null }); }} />
              </Col>
              <Col xs={8} md={4}>
                <Text style={{ fontSize: 12 }}>Poços</Text>
                <CampoNumero size="small" min={1} max={50} style={{ width: '100%' }} value={poco.pocos}
                  onChange={v => { setCliente(null); setPoco({ ...poco, pocos: v || 1 }); }} />
              </Col>
            </Row>
            <Flex align="center" gap={8} wrap style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 12 }}>Transporte (ida e volta)</Text>
              <CampoNumero size="small" min={0} max={5000} style={{ width: 120 }} suffix="km" value={poco.kmIdaVolta ?? null}
                placeholder={sim?.planos[0] ? String(sim.planos[0].preco.km) : String(custos.kmMedio)}
                onChange={v => setPoco({ ...poco, kmIdaVolta: v ?? null })} />
              {sim?.planos[0] && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {sim.planos[0].preco.kmOrigem === 'GPS' ? `${sim.planos[0].preco.km} km medidos da base até o poço`
                    : sim.planos[0].preco.kmOrigem === 'INFORMADO' ? 'informado à mão (apague para voltar ao calculado)'
                    : custos.baseLatitude === null && !custos.baseGps ? 'km médio (informe a base da empresa para medir pelo GPS)' : 'km médio (poço sem GPS)'}
                  {' · '}{brl(sim.planos[0].preco.km * custos.custoKm)} por visita
                </Text>
              )}
            </Flex>
            {cliente && (poco.profundidadeM === null || poco.potenciaCv === null) && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {poco.profundidadeM === null ? 'Poço sem profundidade: a conta usa 80 m. ' : ''}{poco.potenciaCv === null ? 'Bomba não registrada: a conta usa 1,5 CV.' : ''}
              </Text>
            )}
            {erroSim && <Alert type="error" showIcon style={{ marginTop: 8 }} message={erroSim} />}
            <Table size="small" style={{ marginTop: 10 }} rowKey="nome" pagination={false} dataSource={sim?.planos || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum plano oferecido: crie um abaixo." /> }}
              expandable={{
                expandedRowRender: p => (
                  <Row gutter={[16, 10]}>
                    <Col xs={24} lg={12}>
                      <Descriptions size="small" column={1} bordered items={[
                        ...p.preco.custos.map((c, i) => ({ key: String(i), label: c.item, children: `${brl(c.anual)}/ano · ${brl(c.anual / 12)}/mês` })),
                        { key: 't', label: <Text strong>Custo total</Text>, children: <Text strong>{brl(p.preco.custoMensal)}/mês</Text> },
                        { key: 'd', label: 'Impostos, cobrança e inadimplência', children: `${brl(p.risco.preco * (custos.impostosPct + custos.taxaCobrancaPct + custos.inadimplenciaPct))}/mês` },
                      ]} />
                    </Col>
                    <Col xs={24} lg={12}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Flex gap={8} align="center" wrap>
                          <Text strong>Fechar por</Text>
                          <CampoDinheiro size="small" min={0} style={{ width: 140 }} placeholder={brl(p.preco.precoMensal)} value={combinados[p.nome] ?? null}
                            onChange={v => setCombinados(c => { const x = { ...c }; if (v) x[p.nome] = Number(v); else delete x[p.nome]; return x; })} />
                          <Text type="secondary" style={{ fontSize: 12 }}>por mês {p.combinado ? `(${p.combinado < p.preco.precoMensal ? 'desconto de' : 'acima em'} ${brl(Math.abs(p.preco.precoMensal - p.combinado))})` : '— vazio = o preço calculado'}</Text>
                        </Flex>
                        <Table size="small" pagination={false} rowKey="k"
                          dataSource={[
                            { k: 'Pessimista', c: p.risco.pessimista, d: 'todos os chamados do limite, serviço +25%, inadimplência dobrada, km no maior erro' },
                            { k: 'Esperado', c: p.risco.esperado, d: 'os custos da empresa' },
                            { k: 'Otimista', c: p.risco.otimista, d: 'metade dos chamados esperados, sem inadimplência, km no menor erro' },
                          ]}
                          columns={[
                            { title: 'Cenário', dataIndex: 'k', width: 100 },
                            { title: 'Custo', align: 'right', render: (_, x) => brl(x.c.custoMensal) },
                            { title: 'Lucro/mês', align: 'right', render: (_, x) => <Text style={{ color: x.c.lucroMensal < 0 ? '#cf1322' : '#389e0d' }}>{brl(x.c.lucroMensal)}</Text> },
                            { title: 'Margem', align: 'right', render: (_, x) => pctTxt(x.c.margem) },
                            { title: '', render: (_, x) => <Text type="secondary" style={{ fontSize: 11 }}>{x.d}</Text> },
                          ]} />
                        <Text style={{ fontSize: 12 }}>
                          Distância: com {brl(p.risco.preco)}/mês, dá lucro até <b>{p.risco.kmEquilibrio ?? '—'} km</b> (ida e volta) e mantém a margem mínima
                          até <b>{p.risco.kmMargemMinima ?? '—'} km</b>. Este poço: {p.preco.km} km.
                        </Text>
                        {!!p.risco.fatores.length && <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>{p.risco.fatores.map(f => <li key={f}>{f}</li>)}</ul>}
                      </Space>
                    </Col>
                  </Row>
                ),
              }}
              columns={[
                { title: 'Plano', dataIndex: 'nome', render: (v: string, p) => <Space size={4}>{v}{p.nome === sugerido && <Tag color="green" style={{ margin: 0 }}>sugerido</Tag>}</Space> },
                { title: 'Preço', align: 'right', render: (_, p) => (
                  <div><Text strong>{brl(p.risco.preco)}/mês</Text>{p.combinado && <div><Text type="secondary" style={{ fontSize: 11 }}>combinado · calculado {brl(p.preco.precoMensal)}</Text></div>}</div>
                ) },
                { title: 'Custo', align: 'right', render: (_, p) => brl(p.preco.custoMensal) },
                { title: 'Lucro por mês (faixa)', width: 170, render: (_, p) => <FaixaLucro r={p.risco} /> },
                { title: 'Risco', width: 120, render: (_, p) => <TagRisco r={p.risco} /> },
                { title: 'Cliente economiza', align: 'right', render: (_, p) => (
                  <Text style={{ color: p.preco.economiaAnual >= 0 ? '#389e0d' : '#cf1322' }}>{brl(p.preco.economiaAnual)}/ano{p.preco.comparacaoEstimada ? '*' : ''}</Text>
                ) },
                { title: '', width: 90, render: (_, p) => (p.preco.viavel ? <Tag color="green">viável</Tag>
                  : <Tooltip title={p.preco.avisos.join('. ')}><Tag color="red">inviável</Tag></Tooltip>) },
              ]} />
            {sim?.planos.some(p => p.preco.comparacaoEstimada) && (
              <Text type="secondary" style={{ fontSize: 12 }}>* Sem o preço da visita avulsa: informe em "Visita avulsa" para a comparação valer.</Text>
            )}
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>Abra a linha do plano para ver os cenários, o raio da distância e testar um preço combinado.</Text>
            {simulado && (
              <Row gutter={10} style={{ marginTop: 10 }}>
                <Col span={8}><Statistic title={`${sugerido} · por ano`} value={brl(simulado.risco.preco * 12)} valueStyle={{ fontSize: 16 }} /></Col>
                <Col span={8}>
                  <Statistic title="Lucro por ano (esperado)" value={brl(simulado.risco.esperado.lucroMensal * 12)} valueStyle={{ fontSize: 16, color: '#389e0d' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>{brl(simulado.risco.pessimista.lucroMensal * 12)} a {brl(simulado.risco.otimista.lucroMensal * 12)}</Text>
                </Col>
                <Col span={8}><Statistic title="Cliente economiza por ano" value={brl(simulado.preco.economiaAnual)} valueStyle={{ fontSize: 16 }} /></Col>
              </Row>
            )}
          </Card>
        </Col>
      </Row>
      )}

      {aba === 'SIMULAR' && <DescontoAdesao planos={sim?.planos || []} custos={custos} />}

      {aba === 'PLANOS' && (
      <Card size="small" title="Planos oferecidos"
        extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setNiveis(l => [...l, { ...NIVEL_NOVO, ordem: l.length + 1, chave: `novo-${Date.now()}` }])}>Novo plano</Button>}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          O preço de cada cartão é para o poço do simulador. Mude o que o plano inclui e veja se continua viável antes de salvar.
        </Text>
        {niveis.some(n => n.descontoPecasPct > 0 && !n.reservaBombaPct) && (
          <Alert type="info" showIcon style={{ marginBottom: 8 }}
            message="O desconto agora vale só para o material (tubo, fio, conexões). Para o plano cobrir parte da bomba, use “Cobre da troca da bomba” (ex.: 20%, 50%, 100%)." />
        )}
        <Row gutter={[12, 12]}>
          {niveis.map(n => (
            <Col key={n.chave} xs={24} md={12} xl={8}>
              <CartaoNivel n={n} original={dados.niveis.find(x => x.idNivel === n.idNivel) || null} preco={precoDe(n)} sugerido={n.nome === sugerido} taxaUrgencia={custos.taxaUrgencia}
                onMudar={x => setNiveis(l => l.map(y => (y.chave === n.chave ? { ...x, chave: n.chave } : y)))}
                onDesfazer={() => { const o = dados.niveis.find(x => x.idNivel === n.idNivel); if (o) setNiveis(l => l.map(y => (y.chave === n.chave ? { ...o, chave: n.chave } : y))); }}
                onSalvar={() => salvarNivel(n)} onApagar={() => apagarNivel(n)} />
            </Col>
          ))}
        </Row>
      </Card>
      )}

      {aba === 'CARTEIRA' && (central ? <Carteira d={central.plano} naTelaDoPlano /> : <Card loading />)}
    </Space>
  );
};

export default PlanoMensalPocos;
