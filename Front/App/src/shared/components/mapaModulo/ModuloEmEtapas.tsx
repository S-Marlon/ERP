// Tela de um módulo que abre por etapas: a visão geral (o mapa e em que etapa estamos) e uma aba por funcionalidade. A
// funcionalidade pronta mostra a tela dela (`telas`); as outras mostram o que vão fazer e com que parte do ERP se ligam.
import React, { useState } from 'react';
import { Alert, Card, Col, Empty, List, Row, Space, Steps, Tabs, Tag, Typography } from 'antd';
import { AlertOutlined, DashboardOutlined } from '@ant-design/icons';
import { etapaAtual, etapasDoPlano, Funcionalidade, SituacaoFuncionalidade } from './mapaModulo';

const { Text, Title, Paragraph } = Typography;

const SITUACAO: Record<SituacaoFuncionalidade, { cor: string; texto: string }> = {
  PLANEJADA: { cor: 'default', texto: 'planejada' },
  EM_CONSTRUCAO: { cor: 'processing', texto: 'em construção' },
  PRONTA: { cor: 'success', texto: 'pronta' },
};

interface Props {
  titulo: React.ReactNode;
  descricao: string;
  funcionalidades: Funcionalidade[];
  icones: Record<string, React.ReactNode>;
  /** Telas das funcionalidades que já abriram (chave → tela). */
  telas: Record<string, React.ReactNode>;
  textoAlertas: string;
  abaInicial?: string;
}

/** Aba de uma funcionalidade que ainda não abriu: o que ela vai fazer, o que guarda e com o que se liga. */
const EmBreve: React.FC<{ f: Funcionalidade; icone: React.ReactNode }> = ({ f, icone }) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Alert type="info" showIcon icon={icone}
      message={<span>{f.titulo} <Tag color={SITUACAO[f.situacao].cor}>{SITUACAO[f.situacao].texto}</Tag><Tag>etapa {f.etapa}</Tag></span>}
      description={f.resumo} />
    <Row gutter={[12, 12]}>
      <Col xs={24} lg={10}>
        <Card size="small" title="O que vai fazer" style={{ height: '100%' }}>
          <List size="small" dataSource={f.oQueFaz} renderItem={x => <List.Item style={{ padding: '4px 0' }}>• {x}</List.Item>} />
        </Card>
      </Col>
      <Col xs={24} lg={7}>
        <Card size="small" title="O que guarda" style={{ height: '100%' }}>
          <Space size={[4, 6]} wrap>{f.dados.map(d => <Tag key={d}>{d}</Tag>)}</Space>
        </Card>
      </Col>
      <Col xs={24} lg={7}>
        <Card size="small" title="Liga com o ERP" style={{ height: '100%' }}>
          <List size="small" dataSource={f.ligaCom} renderItem={x => <List.Item style={{ padding: '4px 0' }}><Text type="secondary">{x}</Text></List.Item>} />
        </Card>
      </Col>
    </Row>
  </Space>
);

const VisaoGeral: React.FC<Pick<Props, 'funcionalidades' | 'icones' | 'textoAlertas'> & { onAbrir: (chave: string) => void }> = ({ funcionalidades, icones, textoAlertas, onAbrir }) => {
  const etapas = etapasDoPlano(funcionalidades);
  const atual = etapaAtual(funcionalidades);
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Etapas do módulo">
        <Steps size="small" direction="vertical" current={etapas.findIndex(e => e.etapa === atual)}
          items={etapas.map(e => ({
            title: <span>Etapa {e.etapa}: {e.titulos.join(', ')}</span>,
            description: <Tag color={SITUACAO[e.situacao].cor}>{SITUACAO[e.situacao].texto}</Tag>,
            status: e.situacao === 'PRONTA' ? 'finish' : e.etapa === atual ? 'process' : 'wait',
          }))} />
      </Card>
      <Row gutter={[12, 12]}>
        {funcionalidades.map(f => (
          <Col xs={24} md={12} xl={8} key={f.chave}>
            <Card size="small" hoverable onClick={() => onAbrir(f.chave)} style={{ height: '100%' }}
              title={<Space>{icones[f.chave]}{f.titulo}</Space>} extra={<Tag color={SITUACAO[f.situacao].cor}>{SITUACAO[f.situacao].texto}</Tag>}>
              <Paragraph type="secondary" style={{ marginBottom: 6 }}>{f.resumo}</Paragraph>
              <Text type="secondary" style={{ fontSize: 12 }}>Etapa {f.etapa}{f.ligaCom.length ? ` · liga com ${f.ligaCom.join(', ')}` : ''}</Text>
            </Card>
          </Col>
        ))}
      </Row>
      <Card size="small" title={<Space><AlertOutlined /> Alertas</Space>}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={textoAlertas} />
      </Card>
    </Space>
  );
};

const ModuloEmEtapas: React.FC<Props> = ({ titulo, descricao, funcionalidades, icones, telas, textoAlertas, abaInicial = 'visao' }) => {
  const [aba, setAba] = useState(abaInicial);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={3} style={{ margin: 0 }}>{titulo}</Title>
        <Text type="secondary">{descricao}</Text>
      </div>
      <Tabs activeKey={aba} onChange={setAba} destroyOnHidden items={[
        { key: 'visao', label: <span><DashboardOutlined /> Visão geral</span>, children: <VisaoGeral funcionalidades={funcionalidades} icones={icones} textoAlertas={textoAlertas} onAbrir={setAba} /> },
        ...funcionalidades.map(f => ({
          key: f.chave,
          label: <span style={{ opacity: f.situacao === 'PLANEJADA' ? 0.65 : 1 }}>{icones[f.chave]} {f.titulo}</span>,
          children: telas[f.chave] ?? <EmBreve f={f} icone={icones[f.chave]} />,
        })),
      ]} />
    </div>
  );
};

export default ModuloEmEtapas;
