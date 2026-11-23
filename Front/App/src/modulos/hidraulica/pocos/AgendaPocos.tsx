// Obras de poços › agenda, equipe e sonda (etapa 5): o calendário do mês, a lista dos próximos dias e os cadastros
// de equipe e equipamentos do módulo (separados dos funcionários e da frota da loja). Ao salvar um compromisso, os
// avisos de conflito (pessoa ou equipamento em dois lugares, equipamento parado) aparecem sem bloquear.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Calendar, Card, Col, Empty, Input, List, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { CalendarOutlined, PlusOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  agendaApi, Compromisso, CompromissoForm, dataBr, diasDoCompromisso, Equipamento, EquipamentoForm, foneBr, FUNCOES_EQUIPE, FuncaoEquipe, Membro, MembroForm,
  Obra, obrasApi, SERVICOS, SITUACOES_AGENDA, SITUACOES_EQUIPAMENTO, SituacaoAgenda, SituacaoEquipamento, TIPOS_AGENDA, TIPOS_EQUIPAMENTO, TipoAgenda, TipoEquipamento,
} from './obrasApi';
import { abrirObra, navPocos, useNavPocos, useNivelPocos } from './navPocos';
import { CampoTelefone } from '../../../shared/formularios/Campos';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const iso = (d: Dayjs) => d.format('YYYY-MM-DD');
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const vazio = (dia: string): CompromissoForm => ({
  idObra: null, tipo: 'OBRA', titulo: '', local: null, dataInicio: dia, dataFim: dia, horaInicio: null, situacao: 'AGENDADO', observacao: null, equipe: [], equipamentos: [],
});

const mostrarAvisos = (c: Compromisso) => {
  if (!c.avisos.length) return;
  Modal.warning({
    title: 'Agendado, mas atenção',
    content: <List size="small" dataSource={c.avisos} renderItem={a => <List.Item style={{ padding: '4px 0' }}>• {a.texto}</List.Item>} />,
  });
};

const CompromissoModal: React.FC<{
  aberto: Compromisso | CompromissoForm | null; equipe: Membro[]; equipamentos: Equipamento[]; obras: Obra[]; onFechar: () => void; onSalvo: () => void;
}> = ({ aberto, equipe, equipamentos, obras, onFechar, onSalvo }) => {
  const [f, setF] = useState<CompromissoForm>(vazio(iso(dayjs())));
  const existente = aberto && 'idAgenda' in aberto ? aberto : null;
  useEffect(() => {
    if (!aberto) return;
    setF('idAgenda' in aberto ? { ...aberto, equipe: aberto.equipe.map(x => x.id), equipamentos: aberto.equipamentos.map(x => x.id) } : { ...aberto });
  }, [aberto]);
  const mudar = (x: Partial<CompromissoForm>) => setF(a => ({ ...a, ...x }));
  const escolherObra = (idObra: number | undefined) => {
    const o = obras.find(x => x.idObra === idObra);
    if (!o) { mudar({ idObra: null }); return; }
    mudar({ idObra: o.idObra, titulo: f.titulo || o.titulo || `${o.servicos.map(s => SERVICOS[s]).join(' + ')} - ${o.cliente}`, local: f.local || o.cidade || null,
      tipo: o.servicos.length === 1 && (o.servicos[0] === 'MANUTENCAO' || o.servicos[0] === 'LIMPEZA') ? 'MANUTENCAO' : f.tipo });
  };
  const salvar = async () => {
    try {
      const c = existente ? await agendaApi.salvar(existente.idAgenda, f) : await agendaApi.criar(f);
      message.success(existente ? 'Compromisso salvo.' : 'Agendado.');
      mostrarAvisos(c);
      onSalvo();
    } catch (e) { erro(e); }
  };
  const mudarSituacao = async (s: SituacaoAgenda) => {
    if (!existente) return;
    try { await agendaApi.mudar(existente.idAgenda, s); message.success(`Compromisso ${SITUACOES_AGENDA[s].texto.toLowerCase()}.`); onSalvo(); } catch (e) { erro(e); }
  };
  return (
    <Modal open={!!aberto} title={existente ? 'Compromisso' : 'Novo compromisso'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={onFechar} width={680} destroyOnHidden
      footer={(botoes) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {existente && existente.situacao === 'AGENDADO' && <Button onClick={() => mudarSituacao('REALIZADO')}>Marcar realizado</Button>}
            {existente && existente.situacao === 'AGENDADO' && <Button danger onClick={() => mudarSituacao('CANCELADO')}>Cancelar</Button>}
            {existente && existente.situacao !== 'AGENDADO' && <Button onClick={() => mudarSituacao('AGENDADO')}>Voltar para agendado</Button>}
            {existente && (
              <Popconfirm title="Apagar o compromisso?" description="Use para o que foi lançado por engano (o cancelado fica no histórico)." okText="Apagar" cancelText="Voltar"
                onConfirm={async () => { try { await agendaApi.remover(existente.idAgenda); onSalvo(); } catch (e) { erro(e); } }}>
                <Button type="text" danger>Apagar</Button>
              </Popconfirm>
            )}
          </Space>
          <Space>{botoes}</Space>
        </Space>
      )}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {existente?.avisos.length ? <Alert type="warning" showIcon message={existente.avisos.map(a => a.texto).join(' ')} /> : null}
        <Row gutter={8}>
          <Col span={14}><Text>Obra (opcional)</Text>
            <Select allowClear showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Sem obra (ex.: visita de orçamento)" value={f.idObra ?? undefined}
              onChange={escolherObra} options={obras.map(o => ({ value: o.idObra, label: `Nº ${o.idObra} · ${o.titulo || o.cliente}${o.cidade ? ` · ${o.cidade}` : ''}` }))} />
          </Col>
          <Col span={10}><Text>Tipo</Text>
            <Select style={{ width: '100%' }} value={f.tipo} onChange={tipo => mudar({ tipo })}
              options={(Object.keys(TIPOS_AGENDA) as TipoAgenda[]).map(t => ({ value: t, label: TIPOS_AGENDA[t].texto }))} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={14}><Text>Título</Text><Input maxLength={150} value={f.titulo} onChange={e => mudar({ titulo: e.target.value })} placeholder="Ex.: Perfuração - Sítio São José" /></Col>
          <Col span={10}><Text>Local</Text><Input maxLength={150} value={f.local || ''} onChange={e => mudar({ local: e.target.value || null })} placeholder="Cidade / endereço" /></Col>
        </Row>
        <Row gutter={8}>
          <Col span={8}><Text>Início</Text><Input type="date" value={f.dataInicio} onChange={e => mudar({ dataInicio: e.target.value, dataFim: f.dataFim < e.target.value ? e.target.value : f.dataFim })} /></Col>
          <Col span={8}><Text>Fim</Text><Input type="date" value={f.dataFim} min={f.dataInicio} onChange={e => mudar({ dataFim: e.target.value })} /></Col>
          <Col span={8}><Text>Hora (opcional)</Text><Input type="time" value={f.horaInicio || ''} onChange={e => mudar({ horaInicio: e.target.value || null })} /></Col>
        </Row>
        <div><Text>Quem vai</Text>
          <Select mode="multiple" style={{ width: '100%' }} placeholder="Equipe" value={f.equipe} onChange={v => mudar({ equipe: v })} optionFilterProp="label"
            options={equipe.map(m => ({ value: m.idMembro, label: `${m.nome} (${FUNCOES_EQUIPE[m.funcao].toLowerCase()})` }))} />
        </div>
        <div><Text>Equipamentos</Text>
          <Select mode="multiple" style={{ width: '100%' }} placeholder="Sonda, caminhão, compressor..." value={f.equipamentos} onChange={v => mudar({ equipamentos: v })} optionFilterProp="label"
            options={equipamentos.map(e => ({
              value: e.idEquipamento, label: `${e.nome}${e.identificacao ? ` · ${e.identificacao}` : ''}${e.situacao !== 'ATIVO' ? ` (${SITUACOES_EQUIPAMENTO[e.situacao].texto.toLowerCase()})` : ''}`,
            }))} />
        </div>
        <div><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => mudar({ observacao: e.target.value || null })} /></div>
        {existente?.idObra && (
          <Button size="small" type="link" style={{ padding: 0 }} onClick={() => { onFechar(); abrirObra(existente.idObra!); }}>
            Abrir a obra Nº {existente.idObra}{existente.cliente ? ` · ${existente.cliente}` : ''}{existente.clienteTelefone ? ` · ${foneBr(existente.clienteTelefone)}` : ''}
          </Button>
        )}
      </Space>
    </Modal>
  );
};

/** Etiqueta do compromisso no calendário e na lista. */
const Etiqueta: React.FC<{ c: Compromisso; onClick: () => void }> = ({ c, onClick }) => (
  <div onClick={e => { e.stopPropagation(); onClick(); }}
    style={{
      background: c.situacao === 'CANCELADO' ? '#f5f5f5' : `${TIPOS_AGENDA[c.tipo].cor}1a`, borderLeft: `3px solid ${TIPOS_AGENDA[c.tipo].cor}`,
      padding: '1px 4px', marginBottom: 2, borderRadius: 3, fontSize: 11, lineHeight: 1.35, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      textDecoration: c.situacao === 'CANCELADO' ? 'line-through' : undefined, opacity: c.situacao === 'REALIZADO' ? 0.6 : 1,
    }}>
    {c.avisos.length ? <WarningOutlined style={{ color: '#d48806', marginRight: 3 }} /> : null}
    {c.horaInicio ? `${c.horaInicio} ` : ''}{c.titulo}
  </div>
);

const Calendario: React.FC = () => {
  const nav = useNavPocos();
  const [mes, setMes] = useState<Dayjs>(dayjs());
  const [lista, setLista] = useState<Compromisso[]>([]);
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [aberto, setAberto] = useState<Compromisso | CompromissoForm | null>(null);
  const [vista, setVista] = useState<'MES' | 'PROXIMOS'>('MES');
  const carregar = useCallback(async () => {
    try { setLista(await agendaApi.periodo(iso(mes.startOf('month').subtract(7, 'day')), iso(mes.endOf('month').add(42, 'day')))); } catch (e) { erro(e); }
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    agendaApi.equipe().then(setEquipe).catch(() => setEquipe([]));
    agendaApi.equipamentos().then(setEquipamentos).catch(() => setEquipamentos([]));
    obrasApi.obras().then(l => setObras(l.filter(o => o.situacao !== 'CANCELADA'))).catch(() => setObras([]));
  }, []);
  // "Agendar" vindo da obra: abre o compromisso novo já preenchido
  useEffect(() => {
    if (nav.aba !== 'agenda' || !nav.agendarObra) return;
    obrasApi.obra(nav.agendarObra).then(o => {
      const dia = o.dataPrevisao && o.dataPrevisao >= iso(dayjs()) ? o.dataPrevisao : iso(dayjs());
      setMes(dayjs(dia));
      setAberto({ ...vazio(dia), idObra: o.idObra, titulo: o.titulo || `${o.servicos.map(s => SERVICOS[s]).join(' + ')} - ${o.cliente}`, local: o.cidade || null,
        tipo: o.servicos.length === 1 && (o.servicos[0] === 'MANUTENCAO' || o.servicos[0] === 'LIMPEZA') ? 'MANUTENCAO' : 'OBRA' });
      navPocos.trocarAba('agenda');
    }).catch(erro);
  }, [nav.pedido]);   // eslint-disable-line react-hooks/exhaustive-deps
  const porDia = useMemo(() => {
    const m = new Map<string, Compromisso[]>();
    for (const c of lista) for (const d of diasDoCompromisso(c)) m.set(d, [...(m.get(d) || []), c]);
    return m;
  }, [lista]);
  const hoje = iso(dayjs());
  const proximos = lista.filter(c => c.dataFim >= hoje && c.situacao !== 'CANCELADO').slice(0, 60);
  const comAviso = lista.filter(c => c.avisos.length && c.dataFim >= hoje);
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Segmented value={vista} onChange={v => setVista(v as 'MES' | 'PROXIMOS')} options={[{ value: 'MES', label: 'Mês' }, { value: 'PROXIMOS', label: 'Próximos' }]} />
            {(Object.keys(TIPOS_AGENDA) as TipoAgenda[]).map(t => <Tag key={t} color={TIPOS_AGENDA[t].cor}>{TIPOS_AGENDA[t].texto}</Tag>)}
          </Space>
          <Space>
            <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} onClick={carregar} /></Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto(vazio(iso(dayjs())))}>Agendar</Button>
          </Space>
        </Space>
      </Card>
      {!!comAviso.length && (
        <Alert type="warning" showIcon message={`${comAviso.length} compromisso(s) com aviso`}
          description={comAviso.slice(0, 5).map(c => <div key={c.idAgenda}><a onClick={() => setAberto(c)}>{dataBr(c.dataInicio)} · {c.titulo}</a>: {c.avisos.map(a => a.texto).join(' ')}</div>)} />
      )}
      {(!equipe.length || !equipamentos.length) && (
        <Alert type="info" showIcon closable message="Cadastre a equipe e os equipamentos (sonda, caminhão, compressor) nas abas ao lado para escalar nos compromissos." />
      )}
      {vista === 'MES'
        ? (
          <Card size="small">
            <Calendar value={mes} onPanelChange={d => setMes(d)} onSelect={(d, info) => { if (info.source === 'date') setAberto(vazio(iso(d))); }}
              cellRender={(d, info) => {
                if (info.type !== 'date') return info.originNode;
                const itens = porDia.get(iso(d)) || [];
                return <div>{itens.slice(0, 4).map(c => <Etiqueta key={c.idAgenda} c={c} onClick={() => setAberto(c)} />)}
                  {itens.length > 4 && <Text type="secondary" style={{ fontSize: 11 }}>+{itens.length - 4}</Text>}</div>;
              }} />
          </Card>
        )
        : (
          <Card size="small" title="Próximos compromissos">
            <List dataSource={proximos} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada agendado" /> }}
              renderItem={c => (
                <List.Item style={{ cursor: 'pointer' }} onClick={() => setAberto(c)}
                  extra={<Space direction="vertical" size={2} style={{ alignItems: 'flex-end' }}>
                    <Tag color={SITUACOES_AGENDA[c.situacao].cor}>{SITUACOES_AGENDA[c.situacao].texto}</Tag>
                    {c.avisos.length ? <Tooltip title={c.avisos.map(a => a.texto).join(' ')}><Tag color="warning" icon={<WarningOutlined />}>{c.avisos.length} aviso(s)</Tag></Tooltip> : null}
                  </Space>}>
                  <List.Item.Meta
                    avatar={<div style={{ width: 64, textAlign: 'center', borderLeft: `3px solid ${TIPOS_AGENDA[c.tipo].cor}`, paddingLeft: 6 }}>
                      <div style={{ fontWeight: 600 }}>{dataBr(c.dataInicio).slice(0, 5)}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{SEMANA[new Date(`${c.dataInicio}T12:00:00`).getDay()]}{c.dataFim !== c.dataInicio ? ` → ${dataBr(c.dataFim).slice(0, 5)}` : ''}</Text>
                    </div>}
                    title={<>{c.horaInicio ? `${c.horaInicio} · ` : ''}{c.titulo}</>}
                    description={<>
                      {[TIPOS_AGENDA[c.tipo].texto, c.local, c.cliente].filter(Boolean).join(' · ')}
                      <div>{c.equipe.map(m => <Tag key={`m${m.id}`}>{m.nome}</Tag>)}{c.equipamentos.map(e => <Tag key={`e${e.id}`} color="geekblue">{e.nome}</Tag>)}</div>
                    </>} />
                </List.Item>
              )} />
          </Card>
        )}
      <CompromissoModal aberto={aberto} equipe={equipe} equipamentos={equipamentos} obras={obras} onFechar={() => setAberto(null)}
        onSalvo={() => { setAberto(null); carregar(); }} />
    </Space>
  );
};

const ListaEquipe: React.FC = () => {
  const [lista, setLista] = useState<Membro[]>([]);
  const [aberto, setAberto] = useState<Membro | 'novo' | null>(null);
  const [f, setF] = useState<MembroForm>({ nome: '', funcao: 'AJUDANTE', telefone: null, observacao: null, ativo: true });
  const carregar = useCallback(() => agendaApi.equipe(true).then(setLista).catch(erro), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? { nome: '', funcao: 'AJUDANTE', telefone: null, observacao: null, ativo: true } : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try { if (aberto === 'novo') await agendaApi.criarMembro(f); else if (aberto) await agendaApi.salvarMembro(aberto.idMembro, f); setAberto(null); carregar(); }
    catch (e) { erro(e); }
  };
  return (
    <Card size="small" title="Equipe de campo" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Nova pessoa</Button>}>
      <Table<Membro> size="small" rowKey="idMembro" dataSource={lista} pagination={false} locale={{ emptyText: 'Ninguém cadastrado' }}
        onRow={m => ({ onClick: () => setAberto(m), style: { cursor: 'pointer', opacity: m.ativo ? 1 : 0.55 } })}
        columns={[
          { title: 'Nome', dataIndex: 'nome' },
          { title: 'Função', width: 140, render: (_, m) => FUNCOES_EQUIPE[m.funcao] },
          { title: 'Telefone', width: 150, render: (_, m) => foneBr(m.telefone) || '—' },
          { title: '', width: 90, render: (_, m) => (m.ativo ? null : <Tag>inativo</Tag>) },
        ]} />
      <Modal open={!!aberto} title={aberto === 'novo' ? 'Nova pessoa da equipe' : 'Pessoa da equipe'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={() => setAberto(null)} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div><Text>Nome</Text><Input maxLength={100} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
          <Row gutter={8}>
            <Col span={12}><Text>Função</Text>
              <Select style={{ width: '100%' }} value={f.funcao} onChange={funcao => setF({ ...f, funcao })}
                options={(Object.keys(FUNCOES_EQUIPE) as FuncaoEquipe[]).map(x => ({ value: x, label: FUNCOES_EQUIPE[x] }))} />
            </Col>
            <Col span={12}><Text>Telefone</Text><CampoTelefone value={f.telefone} onChange={t => setF({ ...f, telefone: t || null })} /></Col>
          </Row>
          <div><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => setF({ ...f, observacao: e.target.value || null })} /></div>
          <Space><Switch checked={f.ativo} onChange={ativo => setF({ ...f, ativo })} /><Text>{f.ativo ? 'Ativo' : 'Inativo (some da escala)'}</Text></Space>
        </Space>
      </Modal>
    </Card>
  );
};

const ListaEquipamentos: React.FC = () => {
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [aberto, setAberto] = useState<Equipamento | 'novo' | null>(null);
  const [f, setF] = useState<EquipamentoForm>({ nome: '', tipo: 'SONDA', identificacao: null, situacao: 'ATIVO', observacao: null });
  const carregar = useCallback(() => agendaApi.equipamentos(true).then(setLista).catch(erro), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? { nome: '', tipo: 'SONDA', identificacao: null, situacao: 'ATIVO', observacao: null } : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try { if (aberto === 'novo') await agendaApi.criarEquipamento(f); else if (aberto) await agendaApi.salvarEquipamento(aberto.idEquipamento, f); setAberto(null); carregar(); }
    catch (e) { erro(e); }
  };
  return (
    <Card size="small" title="Equipamentos" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo equipamento</Button>}>
      <Table<Equipamento> size="small" rowKey="idEquipamento" dataSource={lista} pagination={false} locale={{ emptyText: 'Nenhum equipamento cadastrado' }}
        onRow={e => ({ onClick: () => setAberto(e), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Equipamento', render: (_, e) => <>{e.nome}{e.identificacao ? <Text type="secondary"> · {e.identificacao}</Text> : null}</> },
          { title: 'Tipo', width: 140, render: (_, e) => TIPOS_EQUIPAMENTO[e.tipo] },
          { title: 'Situação', width: 140, render: (_, e) => <Tag color={SITUACOES_EQUIPAMENTO[e.situacao].cor}>{SITUACOES_EQUIPAMENTO[e.situacao].texto}</Tag> },
          { title: 'Observação', render: (_, e) => <Text type="secondary">{e.observacao || ''}</Text> },
        ]} />
      <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo equipamento' : 'Equipamento'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={() => setAberto(null)} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div><Text>Nome</Text><Input maxLength={100} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Sonda roto-pneumática 1" /></div>
          <Row gutter={8}>
            <Col span={12}><Text>Tipo</Text>
              <Select style={{ width: '100%' }} value={f.tipo} onChange={tipo => setF({ ...f, tipo })}
                options={(Object.keys(TIPOS_EQUIPAMENTO) as TipoEquipamento[]).map(x => ({ value: x, label: TIPOS_EQUIPAMENTO[x] }))} />
            </Col>
            <Col span={12}><Text>Placa / nº de série</Text><Input maxLength={30} value={f.identificacao || ''} onChange={e => setF({ ...f, identificacao: e.target.value || null })} /></Col>
          </Row>
          <div><Text>Situação</Text>
            <Select style={{ width: '100%' }} value={f.situacao} onChange={situacao => setF({ ...f, situacao })}
              options={(Object.keys(SITUACOES_EQUIPAMENTO) as SituacaoEquipamento[]).map(x => ({ value: x, label: SITUACOES_EQUIPAMENTO[x].texto }))} />
          </div>
          <div><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => setF({ ...f, observacao: e.target.value || null })} placeholder="Ex.: na oficina até dia 30" /></div>
        </Space>
      </Modal>
    </Card>
  );
};

const AgendaPocos: React.FC = () => {
  const pedida = navPocos.get().subvista;
  const [vista, setVista] = useState<'AGENDA' | 'EQUIPE' | 'EQUIPAMENTOS'>(pedida === 'EQUIPE' || pedida === 'EQUIPAMENTOS' ? pedida : 'AGENDA');
  // equipe e equipamentos são cadastros da agenda: aparecem na trilha do topo e "subir" volta para a agenda
  useNivelPocos(vista === 'EQUIPE' ? 'Equipe' : vista === 'EQUIPAMENTOS' ? 'Equipamentos' : null, () => setVista('AGENDA'));
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Segmented value={vista} onChange={v => setVista(v as typeof vista)}
        options={[{ value: 'AGENDA', label: <span><CalendarOutlined /> Agenda</span> }, { value: 'EQUIPE', label: 'Equipe' }, { value: 'EQUIPAMENTOS', label: 'Equipamentos' }]} />
      {vista === 'AGENDA' && <Calendario />}
      {vista === 'EQUIPE' && <ListaEquipe />}
      {vista === 'EQUIPAMENTOS' && <ListaEquipamentos />}
    </Space>
  );
};

export default AgendaPocos;
