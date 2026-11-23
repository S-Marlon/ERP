// Mais ferramentas › Plano mensal › "Custos da obra": custo por metro e rendimento da sonda por formação, e os
// parâmetros da obra (horas fixas, jornada, despesa por dia). Base do "Custo e margem" do orçamento.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Row, Space, Table, Typography, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CustosObraDados, custosObraApi } from './obrasApi';
import { CAMADAS_GEOLOGICAS } from './estruturaPoco';

const { Text } = Typography;

export const CustosObraConfig: React.FC = () => {
  const [d, setD] = useState<CustosObraDados | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mudou, setMudou] = useState(false);
  useEffect(() => { custosObraApi.carregar().then(setD).catch(e => message.error(e instanceof Error ? e.message : 'Erro.')); }, []);
  if (!d) return <Card size="small" loading />;

  const mudarFormacao = (formacao: string, x: Partial<CustosObraDados['formacoes'][number]>) => {
    setD({ ...d, formacoes: d.formacoes.map(f => (f.formacao === formacao ? { ...f, ...x } : f)) }); setMudou(true);
  };
  const par = (k: keyof CustosObraDados['parametros'], rotulo: string, sufixo: string, dica?: string) => (
    <Col xs={12} md={8} xl={4}>
      <Text>{rotulo}</Text>
      <CampoNumero min={0} style={{ width: '100%' }} suffix={sufixo} value={d.parametros[k]} title={dica}
        onChange={v => { setD({ ...d, parametros: { ...d.parametros, [k]: Number(v) || 0 } }); setMudou(true); }} />
    </Col>
  );
  const salvar = async () => {
    setSalvando(true);
    try { setD(await custosObraApi.salvar(d)); setMudou(false); message.success('Custos da obra salvos.'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao salvar.'); } finally { setSalvando(false); }
  };
  const cor = (f: string) => CAMADAS_GEOLOGICAS.find(c => c.valor === f)?.cor || '#d9d9d9';

  return (
    <Card size="small" title="Custos da obra (perfuração e instalação)"
      extra={<Button type="primary" size="small" icon={<SaveOutlined />} disabled={!mudou} loading={salvando} onClick={salvar}>Salvar</Button>}>
      {!d.configurado && <Alert type="info" showIcon style={{ marginBottom: 8 }} message="Preencha o custo por metro e o rendimento de cada formação: é o que calcula o custo e o preço mínimo no orçamento da obra." />}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Table size="small" rowKey="formacao" pagination={false} dataSource={d.formacoes}
            columns={[
              { title: 'Formação', render: (_, f) => <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: cor(f.formacao) }} />{f.formacao}</Space> },
              { title: 'Custo por metro', width: 150, render: (_, f) => <CampoDinheiro min={0} size="small" style={{ width: '100%' }} value={f.custoMetro} onChange={v => mudarFormacao(f.formacao, { custoMetro: Number(v) || 0 })} /> },
              { title: 'Rendimento', width: 130, render: (_, f) => <CampoNumero min={0} size="small" style={{ width: '100%' }} suffix="m/h" value={f.rendimentoMH} onChange={v => mudarFormacao(f.formacao, { rendimentoMH: Number(v) || 0 })} /> },
            ]} />
          <Text type="secondary" style={{ fontSize: 12 }}>Custo por metro: diesel, desgaste de broca/martelo e compressor. Rendimento: quantos metros a sonda faz por hora.</Text>
        </Col>
        <Col xs={24} lg={12}>
          <Row gutter={[10, 10]}>
            {par('horasMobilizacao', 'Montar a sonda', 'h', 'Montar e desmontar no local')}
            {par('horasRevestimento100m', 'Revestir 100 m', 'h')}
            {par('horasLimpeza', 'Limpeza do poço', 'h')}
            {par('horasInstalacaoBomba', 'Instalar a bomba', 'h')}
            {par('horasPorDia', 'Jornada', 'h/dia')}
            <Col xs={12} md={8} xl={4}>
              <Text>Despesa por dia</Text>
              <CampoDinheiro min={0} style={{ width: '100%' }} value={d.parametros.custoDia}
                onChange={v => { setD({ ...d, parametros: { ...d.parametros, custoDia: Number(v) || 0 } }); setMudou(true); }} />
            </Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            A hora da equipe, o custo por km, a base da empresa, os impostos e as margens vêm de "Custos e variáveis da empresa", acima.
            Despesa por dia: alimentação, estadia, pedágio.
          </Text>
        </Col>
      </Row>
    </Card>
  );
};
