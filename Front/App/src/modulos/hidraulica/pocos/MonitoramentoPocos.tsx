// Obras de poços › monitoramento remoto (etapa 7): o painel dos aparelhos (situação, última leitura, consumo do dia), o
// detalhe com gráficos e o simulador, os alertas, o cadastro dos aparelhos (com a chave para o firmware) e o guia de
// como ligar o hardware. Tudo do próprio módulo.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Badge, Button, Card, Col, Descriptions, Drawer, Empty, Input, InputNumber, Modal, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { ApiOutlined, BellOutlined, ExperimentOutlined, EyeOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import GraficoBarras from '../../../shared/components/graficos/GraficoBarras';
import {
  AlertaIot, CONEXOES_IOT, ConexaoIot, Dispositivo, DispositivoForm, DispositivoNoPainel, foneBr, haQuanto, iotApi, LeituraEnvio, LeituraIot, obrasApi, Poco,
  ResumoDiaIot, STATUS_IOT, TIPOS_ALERTA_IOT, URL_LEITURAS,
} from './obrasApi';
import { abrirPoco } from './navPocos';

const { Text, Paragraph } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const num = (v: number | null | undefined, un = '') => (v === null || v === undefined ? '—' : `${v.toLocaleString('pt-BR')}${un ? ` ${un}` : ''}`);
const hora = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;

// ------------------------------------------------------------------ detalhe do aparelho (gráficos + simulador)
const Simulador: React.FC<{ d: Dispositivo; onEnviado: () => void }> = ({ d, onEnviado }) => {
  const [l, setL] = useState<LeituraEnvio>({ nivel_m: null, corrente_a: null, vazao_lh: null, tensao_v: 220, bomba: true });
  const enviar = async () => {
    try {
      const r = await iotApi.simular(d.idDispositivo, l);
      message.success(`Leitura gravada${r.alertasAbertos ? ` · ${r.alertasAbertos} alerta(s) aberto(s)` : ''}${r.alertasFechados ? ` · ${r.alertasFechados} normalizado(s)` : ''}.`);
      onEnviado();
    } catch (e) { erro(e); }
  };
  const campo = (k: keyof LeituraEnvio, rotulo: string, suf: string) => (
    <Col span={6}><Text style={{ fontSize: 12 }}>{rotulo}</Text>
      <InputNumber size="small" decimalSeparator="," suffix={suf} style={{ width: '100%' }} value={(l[k] as number | null) ?? undefined}
        onChange={v => setL({ ...l, [k]: v === null ? null : Number(v) })} />
    </Col>
  );
  return (
    <Card size="small" title={<Space><ExperimentOutlined />Simular uma leitura (como se fosse o aparelho)</Space>}>
      <Row gutter={8} align="bottom">
        {campo('nivel_m', 'Nível da água', 'm')}{campo('corrente_a', 'Corrente', 'A')}{campo('vazao_lh', 'Vazão', 'L/h')}{campo('tensao_v', 'Tensão', 'V')}
      </Row>
      <Space style={{ marginTop: 8 }}>
        <Switch checked={!!l.bomba} onChange={bomba => setL({ ...l, bomba })} /><Text>Bomba {l.bomba ? 'ligada' : 'desligada'}</Text>
        <Button type="primary" size="small" onClick={enviar}>Enviar agora</Button>
      </Space>
      <div><Text type="secondary" style={{ fontSize: 12 }}>Serve para testar os limites e os alertas antes de ter o hardware (as leituras simuladas ficam gravadas como as reais).</Text></div>
    </Card>
  );
};

const DetalheDispositivo: React.FC<{ id: number | null; onFechar: () => void; onMudou: () => void }> = ({ id, onFechar, onMudou }) => {
  const [horas, setHoras] = useState(24);
  const [dados, setDados] = useState<{ dispositivo: Dispositivo; total: number; leituras: LeituraIot[]; dias: ResumoDiaIot[] } | null>(null);
  const carregar = useCallback(() => { if (id) iotApi.leituras(id, horas).then(setDados).catch(erro); }, [id, horas]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);
  const d = dados?.dispositivo;
  const porLeitura = horas <= 48;
  return (
    <Drawer open={!!id} onClose={onFechar} width={900} title={d ? `${d.nome} · ${d.poco || ''}` : 'Aparelho'} destroyOnHidden
      extra={<Segmented value={horas} onChange={v => setHoras(Number(v))} options={[{ value: 24, label: '24 h' }, { value: 168, label: '7 dias' }, { value: 720, label: '30 dias' }]} />}>
      {!dados || !d ? <Card loading /> : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions size="small" column={{ xs: 1, md: 3 }} items={[
            { key: 'p', label: 'Poço', children: <a onClick={() => { onFechar(); abrirPoco(d.idPoco); }}>{d.poco}</a> },
            { key: 'c', label: 'Cliente', children: <>{d.cliente || '—'}{d.telefone ? ` · ${foneBr(d.telefone)}` : ''}</> },
            { key: 'u', label: 'Última leitura', children: d.ultimaLeituraEm ? `${hora(d.ultimaLeituraEm)} (${haQuanto(d.ultimaLeituraEm, new Date())})` : 'nunca' },
            { key: 'l', label: 'Limites', children: [d.nivelAlertaM !== null && `nível > ${num(d.nivelAlertaM, 'm')}`, d.correnteMinA !== null && `a seco < ${num(d.correnteMinA, 'A')}`,
              d.correnteMaxA !== null && `sobrecorrente > ${num(d.correnteMaxA, 'A')}`, d.vazaoMinLh !== null && `vazão < ${num(d.vazaoMinLh, 'L/h')}`].filter(Boolean).join(' · ') || 'nenhum (sem alertas)' },
            { key: 'i', label: 'Envio', children: `${CONEXOES_IOT[d.conexao]} · a cada ${d.intervaloMin} min` },
            { key: 't', label: 'Leituras no período', children: dados.total },
          ]} />
          {!dados.total ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma leitura no período" /> : porLeitura ? (
            <>
              <Card size="small" title="Nível da água (m, a partir da boca do poço; maior = mais fundo)">
                <GraficoBarras altura={180} semLegenda formatar={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`}
                  pontos={dados.leituras.map(l => ({ chave: l.em, rotulo: l.em.slice(11, 16), valores: { nivel: l.nivelM ?? 0 } }))}
                  series={[{ chave: 'nivel', nome: 'Nível', cor: '#1677ff' }]} />
              </Card>
              <Card size="small" title="Corrente da bomba (A)">
                <GraficoBarras altura={160} semLegenda formatar={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} A`}
                  pontos={dados.leituras.map(l => ({ chave: l.em, rotulo: l.em.slice(11, 16), valores: { corrente: l.correnteA ?? 0 } }))}
                  series={[{ chave: 'corrente', nome: 'Corrente', cor: '#fa8c16' }]} />
              </Card>
            </>
          ) : (
            <>
              <Card size="small" title="Por dia: horas de bomba (barras) e volume estimado em m³ (linha)">
                <GraficoBarras altura={180} formatar={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  pontos={dados.dias.map(x => ({ chave: x.dia, rotulo: `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}`, valores: { horas: x.horasBomba }, linha: x.volumeM3 }))}
                  series={[{ chave: 'horas', nome: 'Horas de bomba', cor: '#fa8c16' }]} linha={{ nome: 'Volume (m³)', cor: '#1677ff' }} />
              </Card>
              <Card size="small" title="Por dia: nível dinâmico (barras) e estático (linha), em m">
                <GraficoBarras altura={160} formatar={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`}
                  pontos={dados.dias.map(x => ({ chave: x.dia, rotulo: `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}`, valores: { nd: x.nivelDinamicoM ?? 0 }, linha: x.nivelEstaticoM ?? undefined }))}
                  series={[{ chave: 'nd', nome: 'Nível dinâmico', cor: '#91caff' }]} linha={{ nome: 'Nível estático', cor: '#1677ff' }} />
              </Card>
            </>
          )}
          {!!dados.dias.length && (
            <Table size="small" rowKey="dia" pagination={false} dataSource={[...dados.dias].reverse()}
              columns={[
                { title: 'Dia', render: (_, x: ResumoDiaIot) => `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}` },
                { title: 'NE', align: 'right', render: (_, x: ResumoDiaIot) => num(x.nivelEstaticoM, 'm') },
                { title: 'ND', align: 'right', render: (_, x: ResumoDiaIot) => num(x.nivelDinamicoM, 'm') },
                { title: 'Vazão média', align: 'right', render: (_, x: ResumoDiaIot) => num(x.vazaoMediaLh, 'L/h') },
                { title: 'Bomba', align: 'right', render: (_, x: ResumoDiaIot) => `${x.horasBomba.toLocaleString('pt-BR')} h` },
                { title: 'Volume', align: 'right', render: (_, x: ResumoDiaIot) => `${x.volumeM3.toLocaleString('pt-BR')} m³` },
                { title: 'Leituras', align: 'right', dataIndex: 'leituras' },
              ]} />
          )}
          <Simulador d={d} onEnviado={() => { carregar(); onMudou(); }} />
        </Space>
      )}
    </Drawer>
  );
};

// ------------------------------------------------------------------ painel
const PainelAparelhos: React.FC<{ onCadastrar: () => void }> = ({ onCadastrar }) => {
  const [dados, setDados] = useState<{ dispositivos: DispositivoNoPainel[]; alertas: AlertaIot[]; chaveConfigurada: boolean } | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const carregar = useCallback(() => iotApi.painel().then(setDados).catch(erro), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);   // atualiza a cada minuto
  if (!dados) return <Card loading />;
  const agora = new Date();
  const ativos = dados.dispositivos.filter(d => d.status !== 'INATIVO');
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {!dados.chaveConfigurada && (
        <Alert type="warning" showIcon message="IOT_CHAVE_MESTRA não está no .env do backend"
          description="Sem ela os aparelhos não conseguem enviar (o simulador funciona). Ponha uma frase longa e aleatória no Backend/.env e reinicie o backend." />
      )}
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Aparelhos ativos" value={ativos.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Online" value={ativos.filter(d => d.status === 'ONLINE').length} valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Sem sinal / atrasados" value={ativos.filter(d => d.status === 'SEM_SINAL' || d.status === 'ATRASADO').length}
          valueStyle={ativos.some(d => d.status === 'SEM_SINAL') ? { color: '#cf1322' } : undefined} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Alertas abertos" value={dados.alertas.length} valueStyle={dados.alertas.length ? { color: '#d48806' } : undefined} /></Card></Col>
      </Row>
      {!dados.dispositivos.length ? (
        <Card><Empty description="Nenhum aparelho cadastrado. Cadastre o primeiro e use o simulador para testar antes de ter o hardware.">
          <Button type="primary" icon={<PlusOutlined />} onClick={onCadastrar}>Cadastrar aparelho</Button>
        </Empty></Card>
      ) : (
        <Row gutter={[12, 12]}>
          {dados.dispositivos.map(d => (
            <Col xs={24} md={12} xl={8} key={d.idDispositivo}>
              <Badge.Ribbon text={STATUS_IOT[d.status].texto} color={STATUS_IOT[d.status].cor === 'default' ? 'gray' : STATUS_IOT[d.status].cor}>
                <Card size="small" hoverable onClick={() => setAberto(d.idDispositivo)} style={{ height: '100%', opacity: d.status === 'INATIVO' ? 0.6 : 1 }}
                  title={<Space direction="vertical" size={0}><Text strong>{d.poco}</Text><Text type="secondary" style={{ fontSize: 12 }}>{d.cliente || d.nome}</Text></Space>}>
                  <Row gutter={8}>
                    <Col span={12}><Statistic title="Nível da água" value={d.ultima?.nivelM ?? '—'} suffix={d.ultima?.nivelM !== null && d.ultima ? 'm' : ''} precision={d.ultima?.nivelM != null ? 1 : undefined} decimalSeparator="," /></Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Bomba</Text>
                      <div style={{ fontSize: 18 }}>{d.ultima?.bombaLigada === null || !d.ultima ? '—' : d.ultima.bombaLigada
                        ? <Tag color="green" icon={<ThunderboltOutlined />}>ligada</Tag> : <Tag>desligada</Tag>}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{num(d.ultima?.correnteA, 'A')} · {num(d.ultima?.vazaoLh, 'L/h')}</Text>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {haQuanto(d.ultimaLeituraEm, agora)}{d.ultima?.sinalDbm != null ? ` · sinal ${d.ultima.sinalDbm} dBm` : ''}{d.ultima?.bateriaV != null ? ` · bateria ${num(d.ultima.bateriaV, 'V')}` : ''}
                    </Text>
                    {d.hoje && <div><Text type="secondary" style={{ fontSize: 12 }}>Hoje: bomba {d.hoje.horasBomba.toLocaleString('pt-BR')} h · {d.hoje.volumeM3.toLocaleString('pt-BR')} m³</Text></div>}
                    {d.alertasAbertos > 0 && <Tag color="red" icon={<BellOutlined />} style={{ marginTop: 4 }}>{d.alertasAbertos} alerta(s)</Tag>}
                  </div>
                </Card>
              </Badge.Ribbon>
            </Col>
          ))}
        </Row>
      )}
      {!!dados.alertas.length && <ListaAlertas lista={dados.alertas} onMudou={carregar} titulo="Alertas abertos" />}
      <DetalheDispositivo id={aberto} onFechar={() => setAberto(null)} onMudou={carregar} />
    </Space>
  );
};

const ListaAlertas: React.FC<{ lista: AlertaIot[]; onMudou: () => void; titulo: string }> = ({ lista, onMudou, titulo }) => (
  <Card size="small" title={<Space><BellOutlined />{titulo}</Space>}>
    <Table<AlertaIot> size="small" rowKey="idAlerta" dataSource={lista} pagination={{ pageSize: 30, hideOnSinglePage: true }} locale={{ emptyText: 'Nenhum alerta' }}
      columns={[
        { title: 'Alerta', width: 140, render: (_, a) => <Tag color={TIPOS_ALERTA_IOT[a.tipo].cor}>{TIPOS_ALERTA_IOT[a.tipo].texto}</Tag> },
        { title: 'Poço', render: (_, a) => <>{a.idPoco ? <a onClick={() => abrirPoco(a.idPoco!)}>{a.poco}</a> : a.poco}<div><Text type="secondary" style={{ fontSize: 12 }}>{a.cliente}{a.telefone ? ` · ${foneBr(a.telefone)}` : ''}</Text></div></> },
        { title: 'O que aconteceu', dataIndex: 'mensagem' },
        { title: 'Quando', width: 170, render: (_, a) => <>{hora(a.inicio)}{a.fim ? <div><Text type="secondary" style={{ fontSize: 12 }}>normalizou {hora(a.fim)}</Text></div> : <div><Tag color="red">aberto</Tag></div>}</> },
        {
          title: '', width: 110, render: (_, a) => (a.vistoEm
            ? <Tooltip title={`Visto por ${a.vistoPor} em ${hora(a.vistoEm)}`}><Tag icon={<EyeOutlined />}>visto</Tag></Tooltip>
            : <Button size="small" onClick={async () => { try { await iotApi.visto(a.idAlerta); onMudou(); } catch (e) { erro(e); } }}>Marcar visto</Button>),
        },
      ]} />
  </Card>
);

const TodosAlertas: React.FC = () => {
  const [dias, setDias] = useState(30);
  const [lista, setLista] = useState<AlertaIot[]>([]);
  const carregar = useCallback(() => iotApi.alertas(dias).then(setLista).catch(erro), [dias]);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Segmented value={dias} onChange={v => setDias(Number(v))} options={[{ value: 7, label: '7 dias' }, { value: 30, label: '30 dias' }, { value: 90, label: '90 dias' }, { value: 365, label: '1 ano' }]} />
      <ListaAlertas lista={lista} onMudou={carregar} titulo="Alertas (abertos e dos últimos dias)" />
    </Space>
  );
};

// ------------------------------------------------------------------ aparelhos
const vazio = (): DispositivoForm => ({
  idPoco: null, nome: '', identificador: '', conexao: 'WIFI', intervaloMin: 15, profundidadeSensorM: null, nivelAlertaM: null, correnteMinA: null, correnteMaxA: null,
  vazaoMinLh: null, tensaoMinV: 190, tensaoMaxV: 245, situacao: 'ATIVO', observacao: null,
});

const Aparelhos: React.FC<{ novo: boolean; onNovoFeito: () => void }> = ({ novo, onNovoFeito }) => {
  const [lista, setLista] = useState<Dispositivo[]>([]);
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [aberto, setAberto] = useState<Dispositivo | 'novo' | null>(null);
  const [f, setF] = useState<DispositivoForm>(vazio());
  const [chave, setChave] = useState<{ identificador: string; chave: string } | null>(null);
  const carregar = useCallback(() => iotApi.dispositivos().then(setLista).catch(erro), []);
  useEffect(() => { carregar(); obrasApi.pocos().then(setPocos).catch(() => setPocos([])); }, [carregar]);
  useEffect(() => { if (novo) { setAberto('novo'); onNovoFeito(); } }, [novo, onNovoFeito]);
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? vazio() : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try { if (aberto === 'novo') await iotApi.criar(f); else if (aberto) await iotApi.salvar(aberto.idDispositivo, f); setAberto(null); carregar(); message.success('Aparelho salvo.'); }
    catch (e) { erro(e); }
  };
  const verChave = async (d: Dispositivo) => { try { setChave(await iotApi.chave(d.idDispositivo)); } catch (e) { erro(e); } };
  const n = (k: keyof DispositivoForm, rotulo: string, suf: string, dica?: string) => (
    <Col span={8}><Tooltip title={dica}><Text>{rotulo}</Text></Tooltip>
      <InputNumber min={0} decimalSeparator="," suffix={suf} style={{ width: '100%' }} value={(f[k] as number | null) ?? undefined}
        onChange={v => setF({ ...f, [k]: v === null ? null : Number(v) })} />
    </Col>
  );
  return (
    <Card size="small" title="Aparelhos" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo aparelho</Button>}>
      <Table<Dispositivo> size="small" rowKey="idDispositivo" dataSource={lista} pagination={false} locale={{ emptyText: 'Nenhum aparelho' }}
        onRow={d => ({ onClick: () => setAberto(d), style: { cursor: 'pointer', opacity: d.situacao === 'ATIVO' ? 1 : 0.55 } })}
        columns={[
          { title: 'Aparelho', render: (_, d) => <>{d.nome}<div><Text code style={{ fontSize: 11 }}>{d.identificador}</Text></div></> },
          { title: 'Poço', render: (_, d) => <>{d.poco}{d.cliente ? <div><Text type="secondary" style={{ fontSize: 12 }}>{d.cliente}</Text></div> : null}</> },
          { title: 'Envio', width: 150, render: (_, d) => `${CONEXOES_IOT[d.conexao]} · ${d.intervaloMin} min` },
          { title: 'Última leitura', width: 130, render: (_, d) => haQuanto(d.ultimaLeituraEm, new Date()) },
          { title: '', width: 120, render: (_, d) => <Button size="small" icon={<KeyOutlined />} onClick={e => { e.stopPropagation(); verChave(d); }}>Chave</Button> },
        ]} />
      <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo aparelho' : 'Aparelho'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={() => setAberto(null)} width={720} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Row gutter={8}>
            <Col span={12}><Text>Poço</Text>
              <Select showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Escolha o poço" value={f.idPoco ?? undefined} onChange={idPoco => setF({ ...f, idPoco })}
                options={pocos.map(p => ({ value: p.idPoco, label: `${p.identificacao}${p.proprietario ? ` · ${p.proprietario}` : ''}` }))} />
            </Col>
            <Col span={12}><Text>Nome</Text><Input maxLength={100} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Sensor do poço 1" /></Col>
          </Row>
          <Row gutter={8}>
            <Col span={10}><Text>Identificador (nº de série / MAC)</Text><Input maxLength={40} value={f.identificador} onChange={e => setF({ ...f, identificador: e.target.value.toUpperCase() })} placeholder="ESP32-0001" /></Col>
            <Col span={7}><Text>Conexão</Text>
              <Select style={{ width: '100%' }} value={f.conexao} onChange={conexao => setF({ ...f, conexao })} options={(Object.keys(CONEXOES_IOT) as ConexaoIot[]).map(c => ({ value: c, label: CONEXOES_IOT[c] }))} />
            </Col>
            <Col span={7}><Text>Envia a cada</Text><InputNumber min={1} max={1440} suffix="min" style={{ width: '100%' }} value={f.intervaloMin} onChange={v => setF({ ...f, intervaloMin: Number(v) || 15 })} /></Col>
          </Row>
          <Text strong>Sensor e limites (vazio = sem alerta daquele tipo)</Text>
          <Row gutter={8}>
            {n('profundidadeSensorM', 'Profundidade do sensor', 'm', 'Onde o sensor de pressão está pendurado. Com ela o aparelho pode mandar só a coluna d\'água (coluna_m).')}
            {n('nivelAlertaM', 'Alerta se a água passar de', 'm', 'Nível (a partir da boca) mais fundo que isso = água acabando. Use alguns metros acima da bomba.')}
            {n('vazaoMinLh', 'Vazão mínima (bomba ligada)', 'L/h')}
          </Row>
          <Row gutter={8}>
            {n('correnteMinA', 'Corrente mínima (a seco)', 'A', 'Bomba girando sem água puxa menos corrente: uns 60–70% da corrente normal.')}
            {n('correnteMaxA', 'Corrente máxima', 'A', 'Acima da corrente nominal da placa do motor (ex.: +15%).')}
            <Col span={8}><Text>Tensão (mín. / máx.)</Text>
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber min={0} style={{ width: '50%' }} value={f.tensaoMinV ?? undefined} onChange={v => setF({ ...f, tensaoMinV: v === null ? null : Number(v) })} />
                <InputNumber min={0} style={{ width: '50%' }} value={f.tensaoMaxV ?? undefined} onChange={v => setF({ ...f, tensaoMaxV: v === null ? null : Number(v) })} />
              </Space.Compact>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={16}><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => setF({ ...f, observacao: e.target.value || null })} /></Col>
            <Col span={8}><Text>Situação</Text><div><Switch checked={f.situacao === 'ATIVO'} onChange={v => setF({ ...f, situacao: v ? 'ATIVO' : 'INATIVO' })} /> {f.situacao === 'ATIVO' ? 'Ativo' : 'Inativo'}</div></Col>
          </Row>
        </Space>
      </Modal>
      <Modal open={!!chave} title="Chave do aparelho (para o firmware)" footer={null} onCancel={() => setChave(null)} width={680}>
        {chave && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="A chave não fica guardada: é calculada da IOT_CHAVE_MESTRA do .env. Se a mestra mudar, grave a nova chave nos aparelhos." />
            <Descriptions size="small" column={1} bordered items={[
              { key: 'u', label: 'Endereço', children: <Text copyable code>{URL_LEITURAS}</Text> },
              { key: 'i', label: 'X-Dispositivo', children: <Text copyable code>{chave.identificador}</Text> },
              { key: 'c', label: 'X-Chave', children: <Text copyable code>{chave.chave}</Text> },
            ]} />
            <Text type="secondary" style={{ fontSize: 12 }}>Teste pelo terminal (troque o endereço pelo do servidor que o aparelho alcança):</Text>
            <Paragraph copyable code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {`curl -X POST "${URL_LEITURAS}" -H "Content-Type: application/json" -H "X-Dispositivo: ${chave.identificador}" -H "X-Chave: ${chave.chave}" -d "{\\"leituras\\":[{\\"nivel_m\\":38.4,\\"corrente_a\\":6.8,\\"bomba\\":true}]}"`}
            </Paragraph>
          </Space>
        )}
      </Modal>
    </Card>
  );
};

// ------------------------------------------------------------------ guia
const FIRMWARE = `// ESP32 + sensor de nível 4–20 mA (via ADS1115) + PZEM-004T v3 (corrente/tensão)
// Bibliotecas: Adafruit ADS1X15, PZEM004Tv30 (instale pelo gerenciador do Arduino)
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_ADS1X15.h>
#include <PZEM004Tv30.h>
#include "time.h"

const char* WIFI_REDE  = "sua-rede";
const char* WIFI_SENHA = "sua-senha";
const char* URL   = "https://SEU-SERVIDOR/api/modulos/hidraulica/pocos/iot/leituras";
const char* ID    = "ESP32-0001";                    // o identificador do cadastro
const char* CHAVE = "cole-aqui-a-chave-da-tela";
const float FAIXA_SENSOR_MCA = 20.0;                 // sensor de 0–20 m de coluna d'água
const float SHUNT_OHMS = 150.0;                      // resistor do 4–20 mA

Adafruit_ADS1115 ads;
PZEM004Tv30 pzem(Serial2, 16, 17);                   // RX, TX

float colunaDagua() {                                // 4 mA = 0 m · 20 mA = faixa do sensor
  float volts = ads.computeVolts(ads.readADC_SingleEnded(0));
  float mA = volts / SHUNT_OHMS * 1000.0;
  return max(0.0f, (mA - 4.0f) / 16.0f * FAIXA_SENSOR_MCA);
}

void setup() {
  WiFi.begin(WIFI_REDE, WIFI_SENHA);
  configTime(-3 * 3600, 0, "pool.ntp.org");          // hora certa (o servidor recusa hora no futuro)
  ads.begin(); ads.setGain(GAIN_ONE);
}

void loop() {
  struct tm t; getLocalTime(&t);
  char em[32]; strftime(em, sizeof em, "%Y-%m-%dT%H:%M:%S-03:00", &t);
  float i = pzem.current(), v = pzem.voltage();
  if (isnan(i)) i = 0; if (isnan(v)) v = 0;
  String json = String("{\\"leituras\\":[{\\"em\\":\\"") + em + "\\",\\"coluna_m\\":" + String(colunaDagua(), 2) +
    ",\\"corrente_a\\":" + String(i, 2) + ",\\"tensao_v\\":" + String(v, 1) + ",\\"bomba\\":" + (i > 0.5 ? "true" : "false") +
    ",\\"sinal_dbm\\":" + WiFi.RSSI() + "}]}";

  WiFiClientSecure cliente; cliente.setInsecure();   // em produção, use o certificado do servidor
  HTTPClient http; http.begin(cliente, URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Dispositivo", ID);
  http.addHeader("X-Chave", CHAVE);
  int status = http.POST(json);
  http.end();
  // status 201 = gravou · 401 = chave errada · sem rede ou 5xx: guarde em LittleFS e mande junto no próximo envio
  delay(15UL * 60UL * 1000UL);                       // a cada 15 min (igual ao "envia a cada" do cadastro)
}`;

const ComoLigar: React.FC = () => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Card size="small" title="1. O que o aparelho envia">
      <Paragraph>
        <Text code>POST {URL_LEITURAS}</Text> com os cabeçalhos <Text code>X-Dispositivo</Text> (o identificador) e <Text code>X-Chave</Text> (botão "Chave" em Aparelhos).
        Pode mandar várias leituras de uma vez (até 500): guarde o que mediu sem sinal e envie junto depois; a mesma hora não duplica.
      </Paragraph>
      <Paragraph code copyable style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
        {`{ "leituras": [ { "em": "2026-10-22T14:05:00-03:00", "nivel_m": 38.4, "vazao_lh": 3200, "corrente_a": 6.8,
                "tensao_v": 221, "bomba": true, "horimetro_h": 1532.4, "temp_c": 31.5, "sinal_dbm": -71, "bateria_v": 12.6 } ] }`}
      </Paragraph>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Todos os campos são opcionais. Em vez de <Text code>nivel_m</Text>, mande <Text code>coluna_m</Text> (coluna d'água sobre o sensor) e cadastre a profundidade do sensor:
        o servidor calcula nível = profundidade − coluna. Sem <Text code>em</Text>, vale a hora em que chegou.
      </Text>
    </Card>
    <Card size="small" title="2. Peças sugeridas">
      <Row gutter={[16, 8]}>
        {[
          ['Cérebro', 'ESP32 DevKit (Wi-Fi). Sem Wi-Fi: LilyGO T-A7670 ou T-SIM7600 (ESP32 + 4G) com chip M2M. Evite SIM800L (2G sendo desligado). Vários poços perto: LoRa (Heltec V3) + gateway.'],
          ['Nível', 'Transmissor de nível hidrostático submersível 4–20 mA, inox, IP68, cabo ventilado (com respiro). Faixa pela coluna d\'água (ex.: 0–20 mca). Lido por ADS1115 + resistor de 150 Ω, ou conversor 4–20 mA → 0–3,3 V. Ultrassônico não serve dentro do poço.'],
          ['Bomba', 'Monofásica: PZEM-004T v3 (tensão, corrente, potência, energia). Trifásica: medidor Modbus RS485 (ex.: Eastron SDM630) + módulo MAX485, ou 3 × SCT-013. Ligada/desligada: pela corrente ou detector de tensão AC (PC817) no contator.'],
          ['Vazão', 'Hidrômetro com saída de pulsos (reed switch, ex.: 1 pulso a cada 10 L) na saída do poço. Sensores de turbina (YF-DN25/DN32) entopem com areia.'],
          ['Energia', 'Com rede: fonte HLK-PM01 (220 V → 5 V) ou 12 V + DPS contra surto (raio é o que mais queima). Sem rede: painel solar 10–20 W + controlador + bateria 12 V 7 Ah. Caixa IP65 com prensa-cabos.'],
          ['Firmware', 'Arduino IDE ou PlatformIO; hora pela internet (NTP); watchdog; medir a cada 1–5 min e enviar a cada 15; guardar em LittleFS quando sem sinal. Depois: MQTT e ligar/desligar a bomba por relé (com intertravamento).'],
        ].map(([t, d]) => (
          <Col xs={24} md={12} key={t}><Text strong>{t}: </Text><Text>{d}</Text></Col>
        ))}
      </Row>
    </Card>
    <Card size="small" title="3. Exemplo de firmware (ESP32, para começar)">
      <Paragraph copyable={{ text: FIRMWARE }} style={{ marginBottom: 0 }}>
        <pre style={{ fontSize: 11, maxHeight: 420, overflow: 'auto', background: '#fafafa', padding: 10, borderRadius: 6 }}>{FIRMWARE}</pre>
      </Paragraph>
    </Card>
    <Card size="small" title="4. Dicas de instalação">
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Sensor de nível abaixo do nível dinâmico e acima da bomba, preso ao edutor; anote a profundidade no cadastro.</li>
        <li>Primeiro dia: deixe sem limites, olhe a corrente normal da bomba e o nível em operação, e depois ponha os limites (a seco ≈ 60–70% da corrente normal).</li>
        <li>O servidor precisa de um endereço que o aparelho alcance pela internet (domínio com HTTPS); "localhost" só funciona no computador.</li>
        <li>Use o simulador (no detalhe do aparelho) para conferir os alertas antes de ir a campo.</li>
      </ul>
    </Card>
  </Space>
);

const MonitoramentoPocos: React.FC = () => {
  const [vista, setVista] = useState<'PAINEL' | 'ALERTAS' | 'APARELHOS' | 'GUIA'>('PAINEL');
  const [novo, setNovo] = useState(false);
  const [versao, setVersao] = useState(0);
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Segmented value={vista} onChange={v => setVista(v as typeof vista)} options={[
          { value: 'PAINEL', label: <span><ApiOutlined /> Painel</span> }, { value: 'ALERTAS', label: 'Alertas' },
          { value: 'APARELHOS', label: 'Aparelhos' }, { value: 'GUIA', label: 'Como ligar' },
        ]} />
        {vista === 'PAINEL' && <Tooltip title="Recarregar (o painel também atualiza sozinho a cada minuto)"><Button icon={<ReloadOutlined />} onClick={() => setVersao(v => v + 1)} /></Tooltip>}
      </Space>
      {vista === 'PAINEL' && <PainelAparelhos key={versao} onCadastrar={() => { setVista('APARELHOS'); setNovo(true); }} />}
      {vista === 'ALERTAS' && <TodosAlertas />}
      {vista === 'APARELHOS' && <Aparelhos novo={novo} onNovoFeito={() => setNovo(false)} />}
      {vista === 'GUIA' && <ComoLigar />}
    </Space>
  );
};

export default MonitoramentoPocos;
