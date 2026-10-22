// Obras de poços › histórico e manutenção do poço (etapa 6): a linha do tempo, as medições (com gráfico do nível) e o
// plano de manutenção de cada poço (dentro da ficha do poço), e a lista de manutenções vencidas/a vencer e garantias
// vencendo, com o cliente para oferecer o serviço e o atalho para criar a obra (e agendar).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Table, Tag, Timeline, Tooltip, Typography, message,
} from 'antd';
import { CalendarOutlined, EnvironmentOutlined, PlusOutlined, ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import GraficoBarras from '../../../shared/components/graficos/GraficoBarras';
import {
  dataBr, foneBr, GarantiaVencendo, HistoricoPoco, ManutencaoAOferecer, manutencaoApi, obrasApi, PlanoForm, PlanoManutencao, RegistroForm, RegistroPoco, SERVICOS,
  ServicoPlano, SITUACOES_OBRA, SITUACOES_PLANO, TipoRegistro, TIPOS_REGISTRO,
} from './obrasApi';
import { abrirObra, abrirPoco, agendarObra } from './navPocos';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const SERVICOS_PLANO: ServicoPlano[] = ['LIMPEZA', 'MANUTENCAO', 'TROCA_BOMBA', 'TESTE_VAZAO', 'OUTRO'];
const num = (v: number | null) => (v === null ? '—' : String(v).replace('.', ','));

const RegistroModal: React.FC<{ idPoco: number; aberto: RegistroPoco | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ idPoco, aberto, onFechar, onSalvo }) => {
  const [f, setF] = useState<RegistroForm>({ tipo: 'MEDICAO', data: hoje(), descricao: null, nivelEstaticoM: null, nivelDinamicoM: null, vazaoLh: null });
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? { tipo: 'MEDICAO', data: hoje(), descricao: null, nivelEstaticoM: null, nivelDinamicoM: null, vazaoLh: null } : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try {
      if (aberto === 'novo') await manutencaoApi.criarRegistro(idPoco, f); else if (aberto) await manutencaoApi.salvarRegistro(aberto.idRegistro, f);
      onSalvo();
    } catch (e) { erro(e); }
  };
  const medida = (k: 'nivelEstaticoM' | 'nivelDinamicoM' | 'vazaoLh', rotulo: string, suf: string) => (
    <Col span={8}><Text>{rotulo}</Text><InputNumber min={0} decimalSeparator="," suffix={suf} style={{ width: '100%' }} value={f[k] ?? undefined} onChange={v => setF({ ...f, [k]: v === null ? null : Number(v) })} /></Col>
  );
  return (
    <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo registro do poço' : 'Registro do poço'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={onFechar} destroyOnHidden
      footer={(botoes) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          {aberto && aberto !== 'novo'
            ? <Popconfirm title="Apagar o registro?" okText="Apagar" cancelText="Voltar" onConfirm={async () => { try { await manutencaoApi.removerRegistro(aberto.idRegistro); onSalvo(); } catch (e) { erro(e); } }}>
                <Button type="text" danger>Apagar</Button>
              </Popconfirm>
            : <span />}
          <Space>{botoes}</Space>
        </Space>
      )}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={8}>
          <Col span={12}><Text>Tipo</Text>
            <Select style={{ width: '100%' }} value={f.tipo} onChange={tipo => setF({ ...f, tipo })}
              options={(Object.keys(TIPOS_REGISTRO) as TipoRegistro[]).map(t => ({ value: t, label: TIPOS_REGISTRO[t].texto }))} />
          </Col>
          <Col span={12}><Text>Data</Text><Input type="date" max={hoje()} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Col>
        </Row>
        {f.tipo === 'MEDICAO' && (
          <Row gutter={8}>{medida('nivelEstaticoM', 'Nível estático', 'm')}{medida('nivelDinamicoM', 'Nível dinâmico', 'm')}{medida('vazaoLh', 'Vazão', 'L/h')}</Row>
        )}
        <div><Text>{f.tipo === 'MEDICAO' ? 'Observação' : 'Descrição'}</Text>
          <Input.TextArea maxLength={255} rows={2} value={f.descricao || ''} onChange={e => setF({ ...f, descricao: e.target.value || null })}
            placeholder={f.tipo === 'PROBLEMA' ? 'Ex.: cliente relata água turva depois da chuva' : undefined} />
        </div>
      </Space>
    </Modal>
  );
};

const PlanoModal: React.FC<{ idPoco: number; aberto: PlanoManutencao | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ idPoco, aberto, onFechar, onSalvo }) => {
  const [f, setF] = useState<PlanoForm>({ servico: 'LIMPEZA', descricao: null, aCadaMeses: 24, ultimaInformada: null, ativo: true });
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? { servico: 'LIMPEZA', descricao: null, aCadaMeses: 24, ultimaInformada: null, ativo: true } : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try { if (aberto === 'novo') await manutencaoApi.criarPlano(idPoco, f); else if (aberto) await manutencaoApi.salvarPlano(aberto.idPlano, f); onSalvo(); }
    catch (e) { erro(e); }
  };
  return (
    <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo plano de manutenção' : 'Plano de manutenção'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={onFechar} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={8}>
          <Col span={12}><Text>Serviço</Text>
            <Select style={{ width: '100%' }} value={f.servico} onChange={servico => setF({ ...f, servico })} options={SERVICOS_PLANO.map(s => ({ value: s, label: SERVICOS[s] }))} />
          </Col>
          <Col span={12}><Text>A cada</Text><InputNumber min={1} max={120} suffix="meses" style={{ width: '100%' }} value={f.aCadaMeses} onChange={v => setF({ ...f, aCadaMeses: Number(v) || 1 })} /></Col>
        </Row>
        <div><Text>Descrição</Text><Input maxLength={150} value={f.descricao || ''} onChange={e => setF({ ...f, descricao: e.target.value || null })} placeholder="Ex.: limpeza química, revisão da bomba" /></div>
        <div><Text>Última vez feita fora do sistema (opcional)</Text>
          <Input type="date" max={hoje()} value={f.ultimaInformada || ''} onChange={e => setF({ ...f, ultimaInformada: e.target.value || null })} />
          <Text type="secondary" style={{ fontSize: 12 }}>A última obra concluída com este serviço no poço já conta sozinha; vale a data mais recente.</Text>
        </div>
        <Space><Switch checked={f.ativo} onChange={ativo => setF({ ...f, ativo })} /><Text>{f.ativo ? 'Ativo (entra no aviso)' : 'Desligado'}</Text></Space>
      </Space>
    </Modal>
  );
};

/** Histórico do poço (fica na ficha do poço): linha do tempo, medições e plano de manutenção. */
export const HistoricoDoPoco: React.FC<{ idPoco: number; onAbrirObra?: () => void }> = ({ idPoco, onAbrirObra }) => {
  const [h, setH] = useState<HistoricoPoco | null>(null);
  const [vista, setVista] = useState<'LINHA' | 'MEDICOES' | 'PLANOS'>('LINHA');
  const [registro, setRegistro] = useState<RegistroPoco | 'novo' | null>(null);
  const [plano, setPlano] = useState<PlanoManutencao | 'novo' | null>(null);
  const carregar = useCallback(() => manutencaoApi.historico(idPoco).then(setH).catch(erro), [idPoco]);
  useEffect(() => { carregar(); }, [carregar]);
  const feito = () => { setRegistro(null); setPlano(null); carregar(); };
  if (!h) return <Card size="small" loading />;
  const medicoesGrafico = h.medicoes.filter(m => m.nivelEstaticoM !== null || m.nivelDinamicoM !== null);
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Segmented value={vista} onChange={v => setVista(v as typeof vista)}
          options={[{ value: 'LINHA', label: 'Linha do tempo' }, { value: 'MEDICOES', label: `Medições (${h.medicoes.length})` },
            { value: 'PLANOS', label: `Plano de manutenção${h.planos.some(p => p.ativo && (p.situacao === 'VENCIDA' || p.situacao === 'A_VENCER')) ? ' ⚠' : ''}` }]} />
        {vista === 'PLANOS'
          ? <Button size="small" icon={<PlusOutlined />} onClick={() => setPlano('novo')}>Novo plano</Button>
          : <Button size="small" icon={<PlusOutlined />} onClick={() => setRegistro('novo')}>Registrar (medição, visita...)</Button>}
      </Space>
      {vista === 'LINHA' && (h.linhaDoTempo.length
        ? <Timeline style={{ marginTop: 8 }} items={h.linhaDoTempo.map(e => ({
            color: e.tipo === 'OBRA' ? 'blue' : e.tipo === 'PROBLEMA' || e.tipo === 'ALERTA' ? 'red' : 'gray',
            children: (
              <div style={{ cursor: 'pointer' }} onClick={() => {
                if (e.idObra) { onAbrirObra?.(); abrirObra(e.idObra); }
                else if (e.idRegistro) setRegistro(h.registros.find(r => r.idRegistro === e.idRegistro) || null);
              }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{dataBr(e.data)}</Text>{' '}
                <Tag color={e.tipo === 'OBRA' ? 'blue' : e.tipo === 'ALERTA' ? 'volcano' : TIPOS_REGISTRO[e.tipo].cor}>
                  {e.tipo === 'OBRA' ? 'Obra' : e.tipo === 'ALERTA' ? 'Sensor' : TIPOS_REGISTRO[e.tipo].texto}
                </Tag>
                <Text strong>{e.titulo}</Text>
                {e.detalhe && <div><Text type="secondary">{e.detalhe}</Text></div>}
              </div>
            ),
          }))} />
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada no histórico ainda" />)}
      {vista === 'MEDICOES' && (
        <>
          {medicoesGrafico.length > 1 && (
            <GraficoBarras altura={180} formatar={v => `${num(Math.round(v * 10) / 10)} m`}
              pontos={medicoesGrafico.map((m, i) => ({ chave: `${m.data}-${i}`, rotulo: `${m.data.slice(5, 7)}/${m.data.slice(2, 4)}`,
                valores: { nd: m.nivelDinamicoM ?? 0 }, linha: m.nivelEstaticoM ?? undefined }))}
              series={[{ chave: 'nd', nome: 'Nível dinâmico (m)', cor: '#91caff' }]} linha={{ nome: 'Nível estático (m)', cor: '#1677ff' }} />
          )}
          <Table size="small" rowKey={(m, i) => `${m.data}-${i}`} dataSource={[...h.medicoes].reverse()} pagination={false} locale={{ emptyText: 'Nenhuma medição' }}
            columns={[
              { title: 'Data', width: 110, render: (_, m) => dataBr(m.data) },
              { title: 'Origem', width: 130, render: (_, m) => (m.origem === 'PERFURACAO' ? <Tag>ficha (perfuração)</Tag> : m.origem === 'SENSOR' ? <Tag color="purple">sensor (média do dia)</Tag> : <Tag color="blue">medição</Tag>) },
              { title: 'Nível estático', align: 'right', render: (_, m) => (m.nivelEstaticoM === null ? '—' : `${num(m.nivelEstaticoM)} m`) },
              { title: 'Nível dinâmico', align: 'right', render: (_, m) => (m.nivelDinamicoM === null ? '—' : `${num(m.nivelDinamicoM)} m`) },
              { title: 'Vazão', align: 'right', render: (_, m) => (m.vazaoLh === null ? '—' : `${m.vazaoLh.toLocaleString('pt-BR')} L/h`) },
            ]} />
          <Text type="secondary" style={{ fontSize: 12 }}>Nível estático subindo (mais fundo) ao longo dos anos é sinal de que o lençol está baixando ou o poço precisa de limpeza.</Text>
        </>
      )}
      {vista === 'PLANOS' && (
        <Table<PlanoManutencao> size="small" rowKey="idPlano" dataSource={h.planos} pagination={false}
          locale={{ emptyText: 'Nenhum plano: ex.: limpeza a cada 24 meses' }}
          onRow={p => ({ onClick: () => setPlano(p), style: { cursor: 'pointer', opacity: p.ativo ? 1 : 0.55 } })}
          columns={[
            { title: 'Serviço', render: (_, p) => <>{SERVICOS[p.servico]}{p.descricao ? <Text type="secondary"> · {p.descricao}</Text> : null}</> },
            { title: 'A cada', width: 90, render: (_, p) => `${p.aCadaMeses} meses` },
            { title: 'Última', width: 130, render: (_, p) => (p.ultima ? <>{dataBr(p.ultima)} <Text type="secondary" style={{ fontSize: 11 }}>{p.origemUltima === 'OBRA' ? '(obra)' : '(informada)'}</Text></> : '—') },
            { title: 'Próxima', width: 110, render: (_, p) => (p.proxima ? dataBr(p.proxima) : '—') },
            { title: 'Situação', width: 170, render: (_, p) => (p.ativo ? <Tag color={SITUACOES_PLANO[p.situacao].cor}>{SITUACOES_PLANO[p.situacao].texto}</Tag> : <Tag>desligado</Tag>) },
          ]} />
      )}
      <RegistroModal idPoco={idPoco} aberto={registro} onFechar={() => setRegistro(null)} onSalvo={feito} />
      <PlanoModal idPoco={idPoco} aberto={plano} onFechar={() => setPlano(null)} onSalvo={feito} />
    </Space>
  );
};

/** Cria a obra de manutenção já com o cliente, o poço e o serviço (e abre a obra ou a agenda). */
const criarObraDoPlano = async (p: ManutencaoAOferecer, depois: 'ABRIR' | 'AGENDAR') => {
  if (!p.idCliente) { message.warning('O poço não tem dono no cadastro: escolha o cliente na ficha do poço antes.'); return; }
  try {
    const o = await obrasApi.criarObra({
      idCliente: p.idCliente, idPoco: p.idPoco, servicos: [p.servico], titulo: `${SERVICOS[p.servico]}${p.descricao ? ` (${p.descricao})` : ''} - ${p.poco}`.slice(0, 150),
      dataPrevisao: null, garantiaMeses: null, metrosPrevistos: null, valorContratado: null, valorMetroExcedente: null, valorSinal: null, sinalQuando: 'ANTES',
      observacao: `Manutenção periódica (a cada ${p.aCadaMeses} meses)`,
    });
    message.success(`Obra ${o.idObra} criada como orçamento.`);
    if (depois === 'AGENDAR') agendarObra(o.idObra); else abrirObra(o.idObra);
  } catch (e) { erro(e); }
};

/** Manutenções a oferecer e garantias vencendo (aba do módulo). */
export const ManutencoesPocos: React.FC = () => {
  const [dados, setDados] = useState<{ planos: ManutencaoAOferecer[]; garantias: GarantiaVencendo[] } | null>(null);
  const [todas, setTodas] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setDados(await manutencaoApi.aOferecer(todas)); } catch (e) { erro(e); } finally { setCarregando(false); }
  }, [todas]);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="Os planos ficam na ficha de cada poço (aba Obras e poços › Poços › Histórico). A última vez vem sozinha da última obra concluída com o serviço." />
      <Card size="small" title={<Space><ToolOutlined />Manutenções para oferecer</Space>}
        extra={<Space>
          <Checkbox checked={todas} onChange={e => setTodas(e.target.checked)}>mostrar todos os planos</Checkbox>
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>}>
        <Table<ManutencaoAOferecer> size="small" rowKey="idPlano" loading={carregando} dataSource={dados?.planos || []} pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={todas ? 'Nenhum plano cadastrado' : 'Nenhuma manutenção vencida ou vencendo em 30 dias'} /> }}
          columns={[
            {
              title: 'Poço / cliente', render: (_, p) => (
                <div style={{ lineHeight: 1.35 }}>
                  <a onClick={() => abrirPoco(p.idPoco)}><EnvironmentOutlined /> {p.poco}</a>{p.cidade ? <Text type="secondary"> · {p.cidade}</Text> : null}
                  <div><Text>{p.cliente || <Text type="warning">sem dono no cadastro</Text>}</Text>{p.telefone ? <Text type="secondary"> · {foneBr(p.telefone)}</Text> : null}</div>
                </div>
              ),
            },
            { title: 'Serviço', render: (_, p) => <>{SERVICOS[p.servico]}<div><Text type="secondary" style={{ fontSize: 12 }}>a cada {p.aCadaMeses} meses{p.descricao ? ` · ${p.descricao}` : ''}</Text></div></> },
            { title: 'Última', width: 110, render: (_, p) => (p.ultima ? dataBr(p.ultima) : '—') },
            { title: 'Próxima', width: 170, render: (_, p) => <>{p.proxima ? dataBr(p.proxima) : '—'} <Tag color={SITUACOES_PLANO[p.situacao].cor}>{SITUACOES_PLANO[p.situacao].texto}</Tag></> },
            {
              title: '', width: 230, align: 'right', render: (_, p) => (p.obraAberta
                ? <Button size="small" type="link" onClick={() => abrirObra(p.obraAberta!.idObra)}>Obra {p.obraAberta.idObra} · {SITUACOES_OBRA[p.obraAberta.situacao].texto.toLowerCase()}</Button>
                : <Space size={4}>
                    <Button size="small" onClick={() => criarObraDoPlano(p, 'ABRIR')} disabled={!p.idCliente}>Criar obra</Button>
                    <Button size="small" type="primary" ghost icon={<CalendarOutlined />} onClick={() => criarObraDoPlano(p, 'AGENDAR')} disabled={!p.idCliente}>Criar e agendar</Button>
                  </Space>),
            },
          ]} />
      </Card>
      <Card size="small" title="Garantias vencendo nos próximos 30 dias" extra={<Text type="secondary" style={{ fontSize: 12 }}>Boa hora para oferecer uma revisão</Text>}>
        <Table<GarantiaVencendo> size="small" rowKey="idObra" loading={carregando} dataSource={dados?.garantias || []} pagination={false}
          locale={{ emptyText: 'Nenhuma garantia vencendo' }} onRow={g => ({ onClick: () => abrirObra(g.idObra), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Obra', render: (_, g) => <>Nº {g.idObra} · {g.titulo}<div><Text type="secondary" style={{ fontSize: 12 }}>{g.servicos.map(s => SERVICOS[s]).join(' + ')}{g.poco ? ` · ${g.poco}` : ''}</Text></div></> },
            { title: 'Cliente', render: (_, g) => <>{g.cliente}{g.telefone ? <Text type="secondary"> · {foneBr(g.telefone)}</Text> : null}</> },
            { title: 'Concluída', width: 110, render: (_, g) => dataBr(g.dataTermino) },
            { title: 'Garantia até', width: 120, render: (_, g) => <Text strong>{dataBr(g.garantiaAte)}</Text> },
          ]} />
      </Card>
    </Space>
  );
};
