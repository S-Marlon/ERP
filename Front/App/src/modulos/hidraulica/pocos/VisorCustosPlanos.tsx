// Plano mensal › Custos › visor: enquanto os custos são editados (antes de salvar), mostra para um poço de referência o
// custo de uma preventiva e de um chamado e, em cada plano, para onde vai o preço mensal — preventivas, chamados, limpeza,
// monitoramento, bomba, material, impostos/taxas e o lucro (com a faixa). Regras em planoMensalAnalise.ts.
import React from 'react';
import { Alert, Button, Card, Col, Empty, Flex, Row, Space, Statistic, Tag, Tooltip, Typography } from 'antd';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustosPlano, PlanoSimulado, PocoSimulado } from './obrasApi';
import { composicaoDoPreco, FATIAS } from './planoMensalAnalise';
import { TagRisco } from './AnalisePlanoCarteira';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Poços de referência para ver o comportamento dos custos. */
const REFERENCIAS: Array<{ rotulo: string; poco: PocoSimulado }> = [
  { rotulo: 'Raso e perto', poco: { profundidadeM: 50, potenciaCv: 1, pocos: 1, kmIdaVolta: 20, profundidadeBombaM: 35 } },
  { rotulo: 'Comum', poco: { profundidadeM: 80, potenciaCv: 1.5, pocos: 1, kmIdaVolta: 60, profundidadeBombaM: 55 } },
  { rotulo: 'Fundo e longe', poco: { profundidadeM: 150, potenciaCv: 3, pocos: 1, kmIdaVolta: 140, profundidadeBombaM: 100 } },
];

export const VisorCustosPlanos: React.FC<{
  planos: PlanoSimulado[]; custos: CustosPlano; poco: PocoSimulado; onPoco: (p: PocoSimulado) => void; carregando: boolean; erro?: string | null;
}> = ({ planos, custos, poco, onPoco, carregando, erro }) => {
  const ded = custos.impostosPct + custos.taxaCobrancaPct + custos.inadimplenciaPct;
  const um = planos[0]?.preco;
  const usados = new Set(planos.flatMap(p => p.preco.custos.map(c => c.tipo)));

  return (
    <Card size="small" title="Visor: como os custos ficam nos planos" style={{ position: 'sticky', top: 8 }}
      extra={<Text type="secondary" style={{ fontSize: 11 }}>{carregando ? 'recalculando…' : 'muda enquanto você edita'}</Text>}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {erro && <Alert type="error" showIcon message={`Não deu para calcular: ${erro}`} description="Os números abaixo são do último cálculo que deu certo." />}
        <div>
          <Text strong style={{ fontSize: 12 }}>Poço de referência</Text>
          <Flex gap={4} wrap style={{ margin: '4px 0' }}>
            {REFERENCIAS.map(r => (
              <Button key={r.rotulo} size="small" type={poco.profundidadeM === r.poco.profundidadeM && poco.kmIdaVolta === r.poco.kmIdaVolta ? 'primary' : 'default'}
                onClick={() => onPoco({ ...r.poco })}>{r.rotulo}</Button>
            ))}
          </Flex>
          <Row gutter={6}>
            <Col span={6}><CampoNumero size="small" min={0} suffix="m" style={{ width: '100%' }} value={poco.profundidadeM} title="Profundidade do poço"
              onChange={v => onPoco({ ...poco, profundidadeM: v ?? null })} /></Col>
            <Col span={6}><CampoNumero size="small" min={0} suffix="m" style={{ width: '100%' }} value={poco.profundidadeBombaM ?? null} placeholder="bomba" title="Profundidade da bomba"
              onChange={v => onPoco({ ...poco, profundidadeBombaM: v ?? null })} /></Col>
            <Col span={6}><CampoNumero size="small" min={0} step={0.5} suffix="CV" style={{ width: '100%' }} value={poco.potenciaCv} title="Potência da bomba"
              onChange={v => onPoco({ ...poco, potenciaCv: v ?? null })} /></Col>
            <Col span={6}><CampoNumero size="small" min={0} suffix="km" style={{ width: '100%' }} value={poco.kmIdaVolta ?? null} placeholder={String(custos.kmMedio)} title="Km ida e volta"
              onChange={v => onPoco({ ...poco, kmIdaVolta: v ?? null })} /></Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 11 }}>poço · bomba a · potência · km ida e volta</Text>
        </div>

        {um && (
          <Row gutter={8}>
            <Col span={8}><Tooltip title={`${custos.horasVisita} h × ${custos.pessoasPreventiva} pessoa(s) + material + km`}>
              <Statistic title="1 preventiva" value={brl0(um.custoUmaPreventiva)} valueStyle={{ fontSize: 15 }} /></Tooltip></Col>
            <Col span={8}><Tooltip title={`(${custos.horasTroca} h + ${custos.horasPor100m} h/100 m) × ${custos.pessoasTroca} pessoas + material + km (2ª viagem se passar de 8 h)`}>
              <Statistic title="1 chamado" value={brl0(um.custoUmChamado)} valueStyle={{ fontSize: 15 }} /></Tooltip></Col>
            <Col span={8}><Tooltip title={`Com ${Math.round(custos.adicionalDomingoPct * 100)}% de hora extra (só planos com prioridade)`}>
              <Statistic title="no domingo" value={brl0(um.custoChamadoDomingo)} valueStyle={{ fontSize: 15 }} /></Tooltip></Col>
          </Row>
        )}

        {!planos.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum plano oferecido (aba Planos oferecidos)." /> : planos.map(p => {
          const c = composicaoDoPreco(p.risco.preco, p.preco.custos, ded);
          return (
            <div key={p.nome}>
              <Flex justify="space-between" align="baseline" gap={6} wrap>
                <Text strong>{p.nome}</Text>
                <Space size={6}>
                  <Text strong>{brl(p.risco.preco)}<Text type="secondary" style={{ fontSize: 11 }}>/mês</Text></Text>
                  <TagRisco r={p.risco} />
                </Space>
              </Flex>
              <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', margin: '4px 0 2px', background: '#f5f5f5',
                outline: c.excesso ? '2px solid #ff4d4f' : undefined }}>
                {c.fatias.map(f => (
                  <Tooltip key={f.tipo} title={`${f.rotulo}: ${brl(f.valor)}/mês (${String(f.pct).replace('.', ',')}%)`}>
                    <div style={{ width: `${f.pct}%`, background: f.cor }} />
                  </Tooltip>
                ))}
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                custo {brl(c.custoMes)} · impostos/taxas {brl(c.deducoes)} ·{' '}
                {c.excesso ? <Text type="danger" style={{ fontSize: 11 }}>faltam {brl(c.excesso)}/mês para cobrir</Text>
                  : <>lucro <Text style={{ fontSize: 11, color: '#389e0d' }}>{brl(c.lucro)}</Text> ({brl0(p.risco.pessimista.lucroMensal)} a {brl0(p.risco.otimista.lucroMensal)})</>}
              </Text>
            </div>
          );
        })}

        <Flex gap={8} wrap>
          {Object.entries(FATIAS).filter(([t]) => usados.has(t as never) || t === 'DEDUCOES' || t === 'LUCRO').map(([t, f]) => (
            <Space key={t} size={4}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: f.cor }} /><Text style={{ fontSize: 11 }}>{f.rotulo}</Text></Space>
          ))}
        </Flex>
        <Tag style={{ whiteSpace: 'normal', margin: 0 }}>O preço de cada plano é calculado com a margem desejada e arredondado; os custos são os do poço de referência.</Tag>
      </Space>
    </Card>
  );
};
