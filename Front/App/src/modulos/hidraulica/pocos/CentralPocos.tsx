// Obras de poços › Central (tela inicial do módulo): o dia (agenda, contatos, sensores, cobrança), os contratos a
// finalizar por fase com o que falta em cada um, as informações a completar nas fichas e a prévia do plano mensal
// (quem tem mais chance de assinar e quanto ficaria). Cada pendência leva direto ao lugar de resolver.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, Col, Empty, Flex, Popover, Progress, Row, Segmented, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ApiOutlined, CalculatorOutlined, CalendarOutlined, CustomerServiceOutlined, DollarOutlined, FileTextOutlined, ReloadOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import {
  AcaoPendencia, Central, centralApi, ClientePlano, ContratoCentral, FaseContrato, FASES_CONTRATO, foneBr, GRAVIDADES, SERVICOS,
} from './obrasApi';
import { abrirFichaCliente, abrirFichaPoco, abrirObra, navPocos } from './navPocos';
import { OrcamentoRapido } from './OrcamentoContrato';
import { PrimeirosPassos } from './InicioPocos';

const { Text } = Typography;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const FASES: FaseContrato[] = ['NEGOCIACAO', 'SINAL', 'EXECUCAO', 'FECHAMENTO'];
const PESO = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

/** Vai para o lugar onde a pendência se resolve. */
const resolver = (c: ContratoCentral, acao: AcaoPendencia) => {
  if (acao === 'POCO' && c.idPoco) return abrirFichaPoco(c.idPoco);
  if (acao === 'CLIENTE') return abrirFichaCliente(c.idCliente);
  abrirObra(c.idObra, acao === 'PROCESSO' ? 'PROCESSO' : acao === 'COBRANCA' ? 'COBRANCA' : acao === 'MATERIAIS' ? 'MATERIAIS' : 'RELATORIO');
};

const CartaoContrato: React.FC<{ c: ContratoCentral }> = ({ c }) => {
  const visiveis = c.pendencias.slice(0, 4);
  return (
    <Card size="small" hoverable style={{ marginBottom: 8, borderLeft: `3px solid ${c.gravidade === 'ALTA' ? '#ff4d4f' : c.gravidade === 'MEDIA' ? '#fa8c16' : '#d9d9d9'}` }}
      styles={{ body: { padding: '8px 10px' } }} onClick={() => abrirObra(c.idObra, c.fase === 'NEGOCIACAO' ? 'ORCAMENTO' : 'COBRANCA')}>
      <Flex justify="space-between" gap={6}>
        <Text strong style={{ fontSize: 13 }} ellipsis>Nº {c.idObra} · {c.titulo}</Text>
        {c.total > 0 && <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{brl0(c.total)}</Text>}
      </Flex>
      <Text type="secondary" style={{ fontSize: 11 }}>{c.cliente}{c.servicos.length ? ` · ${c.servicos.map(s => SERVICOS[s]).join(' + ')}` : ''}</Text>
      {c.fase === 'FECHAMENTO' && c.aReceber > 0 && <div><Text style={{ fontSize: 11 }}>falta receber {brl(c.aReceber)}</Text></div>}
      <div style={{ marginTop: 4 }} onClick={e => e.stopPropagation()}>
        {visiveis.map((p, i) => (
          <Tag key={i} color={GRAVIDADES[p.gravidade]} style={{ marginBottom: 3, cursor: 'pointer', whiteSpace: 'normal' }} onClick={() => resolver(c, p.acao)}>{p.texto}</Tag>
        ))}
        {c.pendencias.length > visiveis.length && (
          <Popover title="O que mais falta" content={<Space direction="vertical" size={2}>{c.pendencias.slice(4).map((p, i) => (
            <a key={i} onClick={() => resolver(c, p.acao)}><Tag color={GRAVIDADES[p.gravidade]}>{p.texto}</Tag></a>
          ))}</Space>}>
            <Tag style={{ cursor: 'pointer' }}>+{c.pendencias.length - visiveis.length}</Tag>
          </Popover>
        )}
      </div>
    </Card>
  );
};

const Contratos: React.FC<{ lista: ContratoCentral[] }> = ({ lista }) => {
  const [soGraves, setSoGraves] = useState(false);
  const visiveis = lista.filter(c => !soGraves || c.gravidade === 'ALTA');
  return (
    <Card size="small" title={`Contratos a finalizar (${lista.length})`}
      extra={<Space size={6}><Switch size="small" checked={soGraves} onChange={setSoGraves} /><Text style={{ fontSize: 12 }}>só o urgente</Text></Space>}>
      {!lista.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum contrato pendente: tudo fechado" /> : (
        <Row gutter={10}>
          {FASES.map(f => {
            const da = visiveis.filter(c => c.fase === f).sort((a, b) => PESO[a.gravidade] - PESO[b.gravidade] || b.total - a.total);
            const valor = da.reduce((s, c) => s + (f === 'FECHAMENTO' ? c.aReceber : c.total), 0);
            return (
              <Col xs={24} md={12} xl={6} key={f}>
                <div style={{ background: '#fafafa', borderRadius: 8, padding: 8, height: '100%' }}>
                  <Flex justify="space-between" style={{ marginBottom: 6 }}>
                    <Tooltip title={FASES_CONTRATO[f].dica}><Text strong>{FASES_CONTRATO[f].texto} <Badge count={da.length} color="#8c8c8c" /></Text></Tooltip>
                    {valor > 0 && <Text type="secondary" style={{ fontSize: 12 }}>{f === 'FECHAMENTO' ? 'a receber ' : ''}{brl0(valor)}</Text>}
                  </Flex>
                  <div style={{ maxHeight: 460, overflow: 'auto' }}>
                    {da.length ? da.map(c => <CartaoContrato key={c.idObra} c={c} />) : <Text type="secondary" style={{ fontSize: 12 }}>nada aqui</Text>}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}
    </Card>
  );
};

const Completar: React.FC<{ d: Central['completar'] }> = ({ d }) => (
  <Card size="small" title="Informações a completar"
    extra={<Tooltip title="Média de quanto as fichas de clientes e poços estão preenchidas"><Space size={6}><Text style={{ fontSize: 12 }}>base completa</Text>
      <Progress type="circle" size={34} percent={d.pct} /></Space></Tooltip>}>
    <Alert type="info" showIcon style={{ marginBottom: 8 }}
      message="Ficha completa é o que permite oferecer o plano mensal certo: telefone para o contato, GPS para o mapa e a visita, profundidade/vazão/nível para o preço e o acompanhamento." />
    <Row gutter={12}>
      <Col xs={24} lg={12}>
        <Table size="small" rowKey="idCliente" dataSource={d.clientes} pagination={{ pageSize: 8, hideOnSinglePage: true, size: 'small' }}
          locale={{ emptyText: 'Todos os clientes completos' }} title={() => <Text strong>Clientes ({d.clientes.length} de {d.totalClientes})</Text>}
          onRow={c => ({ onClick: () => abrirFichaCliente(c.idCliente), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Cliente', dataIndex: 'nome' },
            { title: '', width: 70, render: (_, c) => <Progress percent={c.pct} size="small" showInfo={false} strokeColor={c.pct < 50 ? '#ff4d4f' : undefined} /> },
            { title: 'Falta', render: (_, c) => c.faltando.map(f => <Tag key={f} style={{ marginBottom: 2 }}>{f}</Tag>) },
          ]} />
      </Col>
      <Col xs={24} lg={12}>
        <Table size="small" rowKey="idPoco" dataSource={d.pocos} pagination={{ pageSize: 8, hideOnSinglePage: true, size: 'small' }}
          locale={{ emptyText: 'Todos os poços completos' }} title={() => <Text strong>Poços ({d.pocos.length} de {d.totalPocos})</Text>}
          onRow={p => ({ onClick: () => abrirFichaPoco(p.idPoco), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Poço', render: (_, p) => <>{p.identificacao}<div><Text type="secondary" style={{ fontSize: 11 }}>{p.proprietario || 'sem dono'}</Text></div></> },
            { title: '', width: 70, render: (_, p) => <Progress percent={p.pct} size="small" showInfo={false} strokeColor={p.pct < 50 ? '#ff4d4f' : undefined} /> },
            { title: 'Falta', render: (_, p) => p.faltando.map(f => <Tag key={f} style={{ marginBottom: 2 }}>{f}</Tag>) },
          ]} />
      </Col>
    </Row>
  </Card>
);

export const PlanoMensal: React.FC<{ d: Central['plano']; naTelaDoPlano?: boolean }> = ({ d, naTelaDoPlano }) => {
  const [faixa, setFaixa] = useState<'TODAS' | 'ALTA' | 'MEDIA' | 'BAIXA'>('TODAS');
  const lista = d.clientes.filter(c => faixa === 'TODAS' || c.faixa === faixa);
  const texto = { ALTA: 'alta', MEDIA: 'média', BAIXA: 'baixa' };
  return (
    <Card size="small" title={naTelaDoPlano ? 'Carteira: quem assinaria e quanto entraria por mês' : 'Prévia do plano mensal (manutenção e monitoramento)'}
      extra={<Segmented size="small" value={faixa} onChange={v => setFaixa(v as typeof faixa)}
        options={[{ value: 'TODAS', label: 'Todos' }, { value: 'ALTA', label: `Alta (${d.alta})` }, { value: 'MEDIA', label: `Média (${d.media})` }, { value: 'BAIXA', label: 'Baixa' }]} />}>
      <Row gutter={[10, 10]} style={{ marginBottom: 8 }}>
        <Col xs={12} md={6}><Statistic title="Chance alta" value={d.alta} suffix="cliente(s)" valueStyle={{ color: '#389e0d' }} /></Col>
        <Col xs={12} md={6}><Statistic title="Potencial (chance alta)" value={brl0(d.potencialAlta)} suffix="/mês" /></Col>
        <Col xs={12} md={6}><Statistic title="Potencial (chance média)" value={brl0(d.potencialMedia)} suffix="/mês" /></Col>
        <Col xs={12} md={6}><Statistic title="Visita de manutenção (média)" value={d.visitaEmpresa ? brl0(d.visitaEmpresa) : '—'} /></Col>
      </Row>
      {!naTelaDoPlano && (
        <Alert type="info" showIcon style={{ marginBottom: 8 }}
          message="O valor é o do plano que mais vale para cada cliente, pelos custos e planos de Mais ferramentas › Plano mensal. A chance de assinar é estimada."
          action={<Button size="small" onClick={() => navPocos.ir({ aba: 'plano' })}>Ajustar o plano</Button>} />
      )}
      <Table<ClientePlano> size="small" rowKey="idCliente" dataSource={lista} pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: 'Nenhum cliente com poço ou obra ainda' }}
        onRow={c => ({ onClick: () => abrirFichaCliente(c.idCliente), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Cliente', render: (_, c) => (
              <div style={{ lineHeight: 1.35 }}>
                <Text strong>{c.nome}</Text>
                <div><Text type="secondary" style={{ fontSize: 11 }}>
                  {[c.cidade, `${c.pocos} poço(s)`, c.profundidadeMaxM ? `até ${c.profundidadeMaxM} m` : null, c.obrasConcluidas ? `${c.obrasConcluidas} obra(s)` : null,
                    c.mesesDesdeUltimaManutencao !== null ? `última manutenção há ${c.mesesDesdeUltimaManutencao} meses` : null].filter(Boolean).join(' · ')}
                </Text></div>
              </div>
            ),
          },
          {
            title: 'Chance', width: 200, render: (_, c) => (
              <Popover title={`${c.pontos} pontos`} content={<Space direction="vertical" size={2}>{c.motivos.map((m, i) => (
                <Text key={i} style={{ fontSize: 12 }}><Text strong style={{ color: m.pontos < 0 ? '#cf1322' : '#389e0d' }}>{m.pontos > 0 ? '+' : ''}{m.pontos}</Text> {m.texto}</Text>
              ))}</Space>}>
                <div>
                  <Progress percent={c.pontos} size="small" strokeColor={c.faixa === 'ALTA' ? '#52c41a' : c.faixa === 'MEDIA' ? '#faad14' : '#d9d9d9'} format={p => `${p}`} />
                  <Text type="secondary" style={{ fontSize: 11 }}>{texto[c.faixa]} · {c.motivos.filter(m => m.pontos > 0).slice(0, 2).map(m => m.texto.toLowerCase()).join(', ')}</Text>
                </div>
              </Popover>
            ),
          },
          {
            title: 'Plano estimado', width: 170, align: 'right', render: (_, c) => (
              <Tooltip title={c.estimativa.base}>
                {c.planoSugerido && <div><Tag color="blue" style={{ margin: 0 }}>{c.planoSugerido}</Tag></div>}
                <Text strong>{brl0(c.estimativa.valorMensal)}/mês</Text>
                <div><Text type="secondary" style={{ fontSize: 11 }}>{brl0(c.estimativa.minimo)} a {brl0(c.estimativa.maximo)}</Text></div>
              </Tooltip>
            ),
          },
          { title: 'Já gastou', width: 120, align: 'right', render: (_, c) => (c.valorGasto ? brl0(c.valorGasto) : '—') },
          {
            title: '', width: 60, render: (_, c) => c.telefone && (
              <Tooltip title={`WhatsApp ${foneBr(c.telefone)}`}>
                <Button size="small" type="text" icon={<WhatsAppOutlined style={{ color: '#25d366' }} />}
                  onClick={e => { e.stopPropagation(); window.open(`https://wa.me/55${c.telefone!.replace(/\D/g, '')}`, '_blank'); }} />
              </Tooltip>
            ),
          },
        ]} />
    </Card>
  );
};

const CentralPocos: React.FC = () => {
  const [d, setD] = useState<Central | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [orcamento, setOrcamento] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setD(await centralApi.carregar()); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  if (!d) return <Card loading />;
  const abertos = d.contratos.filter(c => c.fase !== 'FECHAMENTO');
  const atalho = (titulo: string, valor: React.ReactNode, icone: React.ReactNode, aba: string, cor?: string, extra?: React.ReactNode, vista?: 'RECEBER') => (
    <Col xs={12} md={6}>
      <Card size="small" hoverable onClick={() => navPocos.ir(vista ? { aba, vista } : { aba })} style={{ height: '100%' }}>
        <Statistic title={<Space size={4}>{icone}{titulo}</Space>} value={valor as string} valueStyle={cor ? { color: cor } : undefined} />
        {extra && <Text type="secondary" style={{ fontSize: 11 }}>{extra}</Text>}
      </Card>
    </Col>
  );
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Flex justify="space-between" align="center">
        <Text type="secondary">Comece por aqui: o que precisa da sua atenção hoje e o que falta para fechar cada contrato.</Text>
        <Space>
          <Button icon={<FileTextOutlined />} onClick={() => navPocos.ir({ aba: 'documentos', subvista: 'KIT' })}>Kit de visita</Button>
          <Button type="primary" icon={<CalculatorOutlined />} onClick={() => setOrcamento(true)}>Orçamento rápido</Button>
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>
      </Flex>
      <OrcamentoRapido aberto={orcamento} onFechar={() => setOrcamento(false)} />
      <PrimeirosPassos onOrcamento={() => setOrcamento(true)} />
      <Row gutter={[12, 12]}>
        {atalho('Agenda de hoje', d.hoje.agenda, <CalendarOutlined />, 'agenda', undefined, d.hoje.agendaTitulos.join(' · ') || 'nada agendado')}
        {atalho('Contatos sem resposta', d.hoje.contatosSemResposta, <CustomerServiceOutlined />, 'atendimento', d.hoje.contatosSemResposta ? '#cf1322' : undefined)}
        {atalho('Alertas dos sensores', d.hoje.alertasIot, <ApiOutlined />, 'iot', d.hoje.alertasIot ? '#d48806' : undefined)}
        {atalho('A receber', brl0(d.hoje.aReceber), <DollarOutlined />, 'obras', d.hoje.vencido ? '#cf1322' : undefined, d.hoje.vencido ? `${brl(d.hoje.vencido)} vencido` : 'nada vencido', 'RECEBER')}
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Contratos em aberto" value={abertos.length} /><Text type="secondary" style={{ fontSize: 11 }}>{brl0(abertos.reduce((s, c) => s + c.total, 0))} em negociação e execução</Text></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Concluídos com pendência" value={d.contratos.length - abertos.length} valueStyle={d.contratos.length - abertos.length ? { color: '#d48806' } : undefined} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Base completa" value={d.completar.pct} suffix="%" /><Text type="secondary" style={{ fontSize: 11 }}>{d.completar.clientes.length + d.completar.pocos.length} ficha(s) a completar</Text></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Plano mensal: chance alta" value={d.plano.alta} suffix={`· ${brl0(d.plano.potencialAlta)}/mês`} valueStyle={{ color: '#389e0d' }} /></Card></Col>
      </Row>
      <Contratos lista={d.contratos} />
      <Completar d={d.completar} />
      <PlanoMensal d={d.plano} />
    </Space>
  );
};

export default CentralPocos;
