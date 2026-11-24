// Plano mensal › Simular caso a caso › "Desconto de adesão": o serviço feito agora com desconto em troca da fidelidade.
// Para cada plano (com o preço combinado, se houver): em quantos meses o desconto volta pelo lucro, quanto sobra no fim
// da fidelidade, o preço do plano que paga o desconto no prazo e a multa proporcional de quem sai antes. Regras em adesaoPlano.ts.
import React, { useState } from 'react';
import { Alert, Card, Col, Empty, Row, Table, Tag, Tooltip, Typography } from 'antd';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustosPlano, PlanoSimulado } from './obrasApi';
import { analisarAdesao, multaProporcional } from './adesaoPlano';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const meses = (m: number | null) => (m === null ? 'não se paga' : m === 0 ? '—' : `${m} ${m === 1 ? 'mês' : 'meses'}`);

export const DescontoAdesao: React.FC<{ planos: PlanoSimulado[]; custos: CustosPlano }> = ({ planos, custos }) => {
  const [valorCheio, setValorCheio] = useState<number | null>(null);
  const [cobrado, setCobrado] = useState<number | null>(null);
  const [fidelidade, setFidelidade] = useState<number>(24);
  const [custoServico, setCustoServico] = useState<number | null>(null);
  const deducoesPct = custos.impostosPct + custos.taxaCobrancaPct + custos.inadimplenciaPct;
  const entrada = { valorCheio: valorCheio || 0, cobrado: cobrado ?? valorCheio ?? 0, meses: fidelidade || 1, custoServico };
  const linhas = planos.map(p => ({
    p, a: analisarAdesao(entrada, {
      preco: p.risco.preco, custoMensal: p.risco.esperado.custoMensal, deducoesPct,
      lucroEsperado: p.risco.esperado.lucroMensal, lucroPessimista: p.risco.pessimista.lucroMensal, arredondarPara: custos.arredondarPara,
    }),
  }));
  const desconto = linhas[0]?.a.desconto ?? Math.max(0, (valorCheio || 0) - (cobrado ?? 0));

  return (
    <Card size="small" title="Desconto de adesão (serviço agora, o resto no plano)">
      <Row gutter={[10, 8]}>
        <Col xs={12} md={6}><Text style={{ fontSize: 12 }}>Serviço (valor cheio)</Text>
          <CampoDinheiro size="small" min={0} style={{ width: '100%' }} value={valorCheio} onChange={v => setValorCheio(v === null || v === undefined ? null : Number(v))} /></Col>
        <Col xs={12} md={6}><Text style={{ fontSize: 12 }}>Cobro agora</Text>
          <CampoDinheiro size="small" min={0} style={{ width: '100%' }} value={cobrado} onChange={v => setCobrado(v === null || v === undefined ? null : Number(v))} /></Col>
        <Col xs={12} md={6}><Text style={{ fontSize: 12 }}>Fidelidade</Text>
          <CampoNumero size="small" min={1} max={120} step={6} suffix="meses" style={{ width: '100%' }} value={fidelidade} onChange={v => setFidelidade(Number(v) || 1)} /></Col>
        <Col xs={12} md={6}>
          <Tooltip title="O que o serviço custa para a empresa (opcional): se o cobrado ficar abaixo, mostra o prejuízo de caixa">
            <Text style={{ fontSize: 12 }}>Custo do serviço (opcional)</Text>
          </Tooltip>
          <CampoDinheiro size="small" min={0} style={{ width: '100%' }} value={custoServico} onChange={v => setCustoServico(v === null || v === undefined ? null : Number(v))} /></Col>
      </Row>

      {!desconto ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Informe o valor cheio do serviço e quanto vai cobrar agora (ex.: serviço de R$ 6.000, cobro R$ 2.000)." />
      ) : (
        <>
          <Text style={{ display: 'block', margin: '8px 0' }}>
            Desconto de <b>{brl0(desconto)}</b>: o plano precisa deixar <b>{brl(desconto / Math.max(1, fidelidade))}</b> de lucro por mês para pagá-lo em {fidelidade} meses.
            {linhas[0]?.a.prejuizoCaixa ? <Text type="danger"> Abaixo do custo: {brl0(linhas[0].a.prejuizoCaixa)} de prejuízo de caixa no serviço.</Text> : null}
          </Text>
          <Table size="small" pagination={false} rowKey={l => l.p.nome} dataSource={linhas}
            columns={[
              { title: 'Plano', render: (_, l) => <Text strong>{l.p.nome}</Text> },
              { title: 'Preço/mês', align: 'right', render: (_, l) => brl(l.p.risco.preco) },
              { title: 'Lucro/mês', align: 'right', render: (_, l) => (
                <Tooltip title={`pessimista ${brl(l.p.risco.pessimista.lucroMensal)}`}>{brl(l.p.risco.esperado.lucroMensal)}</Tooltip>
              ) },
              { title: 'Desconto se paga em', render: (_, l) => (
                <div>
                  <Text strong style={{ color: l.a.pagaEsperado ? '#389e0d' : '#cf1322' }}>{meses(l.a.mesesEsperado)}</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>pessimista: {meses(l.a.mesesPessimista)}</Text></div>
                </div>
              ) },
              { title: `Sobra em ${fidelidade} meses`, align: 'right', render: (_, l) => (
                <Tooltip title={`pessimista ${brl(l.a.sobraPessimista)}`}>
                  <Text style={{ color: l.a.sobraEsperada >= 0 ? '#389e0d' : '#cf1322' }}>{brl(l.a.sobraEsperada)}</Text>
                </Tooltip>
              ) },
              { title: <Tooltip title="Preço mensal que paga o desconto dentro da fidelidade (no esperado)">Preço para pagar</Tooltip>, align: 'right',
                render: (_, l) => (l.a.precoParaPagar !== null ? <Text type={l.p.risco.preco >= l.a.precoParaPagar ? 'secondary' : 'warning'}>{brl(l.a.precoParaPagar)}</Text> : '—') },
              { title: '', width: 110, render: (_, l) => (l.a.pagaPessimista ? <Tag color="green">vale a pena</Tag>
                : l.a.pagaEsperado ? <Tooltip title="Paga no esperado, mas não se o cliente usar todos os chamados"><Tag color="gold">vale, com risco</Tag></Tooltip>
                : <Tag color="red">não se paga</Tag>) },
            ]} />
          <Alert type="info" showIcon style={{ marginTop: 8 }}
            message={`Multa proporcional (devolve o desconto dos meses que faltam): sai no mês ${[Math.round(fidelidade / 4), Math.round(fidelidade / 2), Math.round((fidelidade * 3) / 4)]
              .filter((m, i, x) => m > 0 && x.indexOf(m) === i).map(m => `${m} → ${brl0(multaProporcional(desconto, fidelidade, m))}`).join(' · ')} · no fim, nada.`}
            description="Coloque no contrato: valor cheio, desconto, meses de fidelidade e a devolução proporcional. Cobrança automática (cartão ou débito) evita quem para de pagar cedo." />
        </>
      )}
    </Card>
  );
};
