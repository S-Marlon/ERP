// Plano mensal › "Análise por cliente": cada cliente com poço, a distância da base (GPS ou km médio), o plano (o
// sugerido dele ou um escolhido para todos), o preço, a faixa de lucro por mês (pessimista · esperado · otimista), até
// onde a distância compensa e o risco com os motivos. No topo, o que a carteira daria por mês se todos assinassem.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Popover, Row, Segmented, Select, Space, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { EnvironmentOutlined, ExperimentOutlined } from '@ant-design/icons';
import { ClienteAnalisado, CustosPlano, NivelPlano, planoMensalApi, RiscoPlano } from './obrasApi';
import { analisarCarteira, EscolhaPlano, LinhaAnalise } from './planoMensalAnalise';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
const cor = (v: number) => (v < 0 ? '#cf1322' : '#389e0d');

export const RISCO: Record<RiscoPlano['nivel'], { texto: string; cor: string }> = {
  BAIXO: { texto: 'risco baixo', cor: 'green' }, MEDIO: { texto: 'risco médio', cor: 'gold' }, ALTO: { texto: 'risco alto', cor: 'red' },
};
export const PRECISAO: Record<RiscoPlano['precisao'], string> = { BOA: 'dados bons', MEDIA: 'dados em parte estimados', BAIXA: 'dados estimados' };

/** Faixa do lucro por mês: o esperado em destaque e, embaixo, do pessimista ao otimista (com a barrinha). */
export const FaixaLucro: React.FC<{ r: RiscoPlano }> = ({ r }) => {
  const min = Math.min(r.pessimista.lucroMensal, 0), max = Math.max(r.otimista.lucroMensal, 1);
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  return (
    <Tooltip title={`Pessimista ${brl(r.pessimista.lucroMensal)} · esperado ${brl(r.esperado.lucroMensal)} · otimista ${brl(r.otimista.lucroMensal)} por mês`}>
      <div style={{ minWidth: 130 }}>
        <Text strong style={{ color: cor(r.esperado.lucroMensal) }}>{brl(r.esperado.lucroMensal)}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}> {pct(r.esperado.margem)}</Text>
        <div style={{ position: 'relative', height: 6, background: '#f0f0f0', borderRadius: 3, margin: '3px 0 1px' }}>
          <div style={{ position: 'absolute', left: pos(r.pessimista.lucroMensal), right: `calc(100% - ${pos(r.otimista.lucroMensal)})`, top: 0, bottom: 0,
            background: r.pessimista.lucroMensal < 0 ? 'linear-gradient(90deg, #ff7875, #95de64)' : '#95de64', borderRadius: 3 }} />
          {min < 0 && <div style={{ position: 'absolute', left: pos(0), top: -2, bottom: -2, width: 1, background: '#595959' }} />}
          <div style={{ position: 'absolute', left: pos(r.esperado.lucroMensal), top: -2, width: 3, height: 10, marginLeft: -1, background: '#262626', borderRadius: 1 }} />
        </div>
        <Text type="secondary" style={{ fontSize: 11 }}>{brl0(r.pessimista.lucroMensal)} a {brl0(r.otimista.lucroMensal)}</Text>
      </div>
    </Tooltip>
  );
};

/** Tag do risco com os motivos ao passar o mouse. */
export const TagRisco: React.FC<{ r: RiscoPlano }> = ({ r }) => (
  <Popover title={`${RISCO[r.nivel].texto[0].toUpperCase()}${RISCO[r.nivel].texto.slice(1)} · ${PRECISAO[r.precisao]}`}
    content={<ul style={{ margin: 0, paddingLeft: 16, maxWidth: 360 }}>{(r.fatores.length ? r.fatores : ['Lucro positivo mesmo no pior cenário.']).map(f => <li key={f}>{f}</li>)}</ul>}>
    <Space size={2} direction="vertical">
      <Tag color={RISCO[r.nivel].cor} style={{ margin: 0 }}>{RISCO[r.nivel].texto}</Tag>
      {r.precisao !== 'BOA' && <Text type="secondary" style={{ fontSize: 10 }}>{PRECISAO[r.precisao]}</Text>}
    </Space>
  </Popover>
);

export const AnalisePlanoCarteira: React.FC<{
  custos: CustosPlano; niveis: NivelPlano[]; onSimular: (c: ClienteAnalisado) => void; onIrCustos: () => void;
}> = ({ custos, niveis, onSimular, onIrCustos }) => {
  const [clientes, setClientes] = useState<ClienteAnalisado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<EscolhaPlano>('SUGERIDO');
  const [filtro, setFiltro] = useState<'TODOS' | RiscoPlano['nivel']>('TODOS');
  const vez = useRef(0);

  // refaz a análise com o que está na tela (custos e planos ainda não salvos), meio segundo depois da última mudança
  useEffect(() => {
    const minha = ++vez.current;
    const t = setTimeout(() => {
      planoMensalApi.analise(custos, niveis.filter(n => n.ativo && n.nome.trim()))
        .then(r => { if (minha === vez.current) { setClientes(r.clientes); setErro(null); } })
        .catch(e => { if (minha === vez.current) setErro(e instanceof Error ? e.message : 'Erro ao analisar.'); });
    }, 500);
    return () => clearTimeout(t);
  }, [custos, niveis]);

  if (erro) return <Alert type="error" showIcon message={erro} />;
  if (!clientes) return <Card loading />;
  const { linhas, totais } = analisarCarteira(clientes, escolha);
  const visiveis = linhas.filter(l => filtro === 'TODOS' || l.plano?.risco.nivel === filtro);
  const semBase = custos.baseLatitude === null && !custos.baseGps;
  const nomes = [...new Set(clientes.flatMap(c => c.planos.map(p => p.nome)))];

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {semBase && (
        <Alert type="warning" showIcon message="Sem a base da empresa (GPS), a distância de todos sai do km médio — a faixa de lucro fica larga."
          description="Cole a localização de onde a equipe sai: cada cliente passa a ter a distância medida até o poço dele."
          action={<Button size="small" icon={<EnvironmentOutlined />} onClick={onIrCustos}>Informar a base</Button>} />
      )}
      {!semBase && totais.semGps > 0 && (
        <Alert type="info" showIcon message={`${totais.semGps} cliente(s) com poço sem GPS: a distância deles é o km médio (faixa mais larga). Cole o GPS na ficha do poço.`} />
      )}
      <Row gutter={[12, 12]}>
        <Col xs={12} md={5}><Card size="small"><Statistic title="Clientes analisados" value={totais.clientes} /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="Receita se todos assinarem" value={brl0(totais.receita)} suffix="/mês" /></Card></Col>
        <Col xs={24} md={8}>
          <Card size="small">
            <Statistic title="Lucro esperado por mês" value={brl0(totais.lucro)} valueStyle={{ color: cor(totais.lucro) }} suffix={<Text type="secondary" style={{ fontSize: 13 }}>{pct(totais.margem)}</Text>} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              faixa de <Text style={{ fontSize: 12, color: cor(totais.pessimista) }}>{brl0(totais.pessimista)}</Text> a <Text style={{ fontSize: 12, color: cor(totais.otimista) }}>{brl0(totais.otimista)}</Text>
              {totais.alto ? ` · sem os de risco alto: ${brl0(totais.lucroSemAlto)}` : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: 14 }}>Risco</Text>
            <div style={{ marginTop: 6 }}>
              <Space wrap size={4}>
                <Tag color="green">{totais.baixo} baixo</Tag><Tag color="gold">{totais.medio} médio</Tag><Tag color="red">{totais.alto} alto</Tag>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Cliente a cliente"
        extra={<Space wrap>
          <Select size="small" style={{ width: 230 }} value={escolha} onChange={setEscolha}
            options={[{ value: 'SUGERIDO', label: 'Plano sugerido de cada cliente' }, ...nomes.map(n => ({ value: n, label: `Todos no plano ${n}` }))]} />
          <Segmented size="small" value={filtro} onChange={v => setFiltro(v as typeof filtro)}
            options={[{ value: 'TODOS', label: 'Todos' }, { value: 'ALTO', label: `Alto (${totais.alto})` }, { value: 'MEDIO', label: `Médio (${totais.medio})` }, { value: 'BAIXO', label: `Baixo (${totais.baixo})` }]} />
        </Space>}>
        <Table<LinhaAnalise> size="small" rowKey={l => l.cliente.idCliente} dataSource={visiveis} pagination={{ pageSize: 25, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={clientes.length ? 'Nenhum cliente neste filtro' : 'Nenhum cliente com poço ativo'} /> }}
          columns={[
            {
              title: 'Cliente', render: (_, l) => (
                <div style={{ lineHeight: 1.35 }}>
                  <Text strong>{l.cliente.nome}</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>
                    {[`${l.cliente.pocos} poço(s)`, l.cliente.profundidadeM ? `${l.cliente.profundidadeM} m` : 'sem profundidade',
                      l.cliente.potenciaCv ? `${String(l.cliente.potenciaCv).replace('.', ',')} CV` : 'sem bomba'].join(' · ')}
                  </Text></div>
                </div>
              ),
            },
            {
              title: 'Distância', width: 120, sorter: (a, b) => (a.cliente.km ?? 0) - (b.cliente.km ?? 0),
              render: (_, l) => (
                <div>
                  <Text>{l.cliente.km ?? '—'} km</Text>
                  <div>{l.cliente.kmOrigem === 'GPS' ? <Tag color="blue" style={{ margin: 0 }}>GPS</Tag> : <Tag style={{ margin: 0 }}>km médio</Tag>}</div>
                </div>
              ),
            },
            {
              title: 'Plano', width: 130, render: (_, l) => (l.plano ? (
                <div><Text>{l.plano.nome}</Text>{escolha === 'SUGERIDO' && l.cliente.sugerido !== l.plano.nome && <div><Text type="warning" style={{ fontSize: 11 }}>nenhum viável</Text></div>}</div>
              ) : <Text type="secondary">—</Text>),
            },
            { title: 'Preço', width: 110, align: 'right', sorter: (a, b) => (a.plano?.risco.preco ?? 0) - (b.plano?.risco.preco ?? 0),
              render: (_, l) => (l.plano ? <Text strong>{brl(l.plano.risco.preco)}</Text> : '—') },
            { title: 'Lucro por mês', width: 170, sorter: (a, b) => (a.plano?.risco.esperado.lucroMensal ?? 0) - (b.plano?.risco.esperado.lucroMensal ?? 0),
              render: (_, l) => (l.plano ? <FaixaLucro r={l.plano.risco} /> : '—') },
            {
              title: <Tooltip title="Até quantos km (ida e volta) este plano, com este preço, mantém a margem mínima">Raio</Tooltip>, width: 100,
              render: (_, l) => (l.plano?.risco.kmMargemMinima !== null && l.plano ? (
                <Text type={(l.cliente.km ?? 0) > l.plano.risco.kmMargemMinima ? 'danger' : 'secondary'}>até {l.plano.risco.kmMargemMinima} km</Text>
              ) : '—'),
            },
            { title: 'Risco', width: 130, render: (_, l) => (l.plano ? <TagRisco r={l.plano.risco} /> : '—') },
            {
              title: '', width: 44, render: (_, l) => (
                <Tooltip title="Simular este cliente (mudar plano, preço combinado, km)">
                  <Button size="small" type="text" icon={<ExperimentOutlined />} onClick={() => onSimular(l.cliente)} />
                </Tooltip>
              ),
            },
          ]} />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          Faixa: o pessimista conta todas as emergências usadas, visita 25% mais demorada, inadimplência dobrada, bomba durando 25% menos e o
          erro da distância (±15% pelo GPS, ±40% pelo km médio); profundidade ou bomba não informadas vão de 50 a 150 m e de 1 a 3 CV. O otimista, o contrário.
        </Text>
      </Card>
    </Space>
  );
};

