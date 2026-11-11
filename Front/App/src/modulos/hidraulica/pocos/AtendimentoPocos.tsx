// Obras de poços › atendimento e pós-venda: os leads (todo contato, com origem e o prazo de resposta em horário
// comercial), as pendências do processo de todas as obras, os indicadores, a galeria de fotos liberadas para
// propaganda e a configuração (dados da empresa, logo, mensagens e prazos).
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Empty, Flex, Image, Input, InputNumber, Modal, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, Upload,
  message,
} from 'antd';
import { CheckOutlined, FileSearchOutlined, PlusOutlined, ReloadOutlined, SettingOutlined, WhatsAppOutlined } from '@ant-design/icons';
import {
  ConfigProcesso, dataBr, ESTADOS_ETAPA, ESTADOS_PRAZO, foneBr, IndicadoresProcesso, Lead, LeadForm, ORIGENS_LEAD, OrigemLead, PendenciaObra, processoApi, Servico,
  SERVICOS, SITUACOES_LEAD, SITUACOES_OBRA, urlArquivo,
} from './obrasApi';
import { abrirObra, navPocos } from './navPocos';
import { recursosPocos } from './recursosPocos';
import { reduzirImagem } from './ProcessoObra';
import { OrcamentoRapido } from './OrcamentoContrato';
import { CAMPOS_MODELO, MODELO_ADITIVO_PADRAO, MODELO_CONTRATO_PADRAO } from './documentosPocos';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const quando = (s: string | null) => (s ? `${dataBr(s)} ${s.slice(11, 16)}` : '—');
const agoraInput = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// ------------------------------------------------------------------ leads
const vazio = (): LeadForm => ({ nome: '', telefone: null, origem: 'WHATSAPP', indicadoPor: null, cidade: null, necessidade: null, recebidoEm: null, observacao: null });

const LeadModal: React.FC<{ aberto: Lead | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ aberto, onFechar, onSalvo }) => {
  const [f, setF] = useState<LeadForm>(vazio());
  useEffect(() => {
    if (!aberto) return;
    setF(aberto === 'novo' ? { ...vazio(), recebidoEm: agoraInput() } : { ...aberto, recebidoEm: aberto.recebidoEm.slice(0, 16).replace(' ', 'T') });
  }, [aberto]);
  const salvar = async () => {
    try {
      const corpo = { ...f, recebidoEm: f.recebidoEm ? f.recebidoEm.replace('T', ' ') : null };
      if (aberto === 'novo') await processoApi.criarLead(corpo); else if (aberto) await processoApi.salvarLead(aberto.idLead, corpo);
      message.success('Lead salvo.'); onSalvo();
    } catch (e) { erro(e); }
  };
  return (
    <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo contato (lead)' : 'Lead'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={onFechar} width={640} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={8}>
          <Col span={12}><Text>Nome</Text><Input maxLength={120} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></Col>
          <Col span={12}><Text>Telefone / WhatsApp</Text><Input value={foneBr(f.telefone) || f.telefone || ''} onChange={e => setF({ ...f, telefone: e.target.value || null })} /></Col>
        </Row>
        <Row gutter={8}>
          <Col span={8}><Text>Origem</Text>
            <Select style={{ width: '100%' }} value={f.origem} onChange={origem => setF({ ...f, origem })} options={(Object.keys(ORIGENS_LEAD) as OrigemLead[]).map(o => ({ value: o, label: ORIGENS_LEAD[o] }))} />
          </Col>
          {f.origem === 'INDICACAO' && <Col span={8}><Text>Indicado por</Text><Input maxLength={120} value={f.indicadoPor || ''} onChange={e => setF({ ...f, indicadoPor: e.target.value || null })} /></Col>}
          <Col span={8}><Text>Cidade</Text><Input maxLength={60} value={f.cidade || ''} onChange={e => setF({ ...f, cidade: e.target.value || null })} /></Col>
        </Row>
        <div><Text>O que precisa</Text><Input maxLength={255} value={f.necessidade || ''} onChange={e => setF({ ...f, necessidade: e.target.value || null })} placeholder="Ex.: poço novo no sítio, bomba parou, limpeza" /></div>
        <Row gutter={8}>
          <Col span={10}><Text>Quando chegou</Text><Input type="datetime-local" value={f.recebidoEm || ''} onChange={e => setF({ ...f, recebidoEm: e.target.value || null })} /></Col>
          <Col span={14}><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => setF({ ...f, observacao: e.target.value || null })} /></Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>O prazo de resposta conta do "quando chegou", só em horário comercial (configurável).</Text>
      </Space>
    </Modal>
  );
};

const Leads: React.FC = () => {
  const [lista, setLista] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState(false);
  const [aberto, setAberto] = useState<Lead | 'novo' | null>(null);
  const [obraDe, setObraDe] = useState<{ lead: Lead; servicos: Servico[]; titulo: string } | null>(null);
  const [perder, setPerder] = useState<{ lead: Lead; motivo: string } | null>(null);
  const [orcamentoDe, setOrcamentoDe] = useState<Lead | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await processoApi.leads({ busca, todos })); } catch (e) { erro(e); } finally { setCarregando(false); }
  }, [busca, todos]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);
  useEffect(() => { const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);   // o relógio do prazo anda
  const acao = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) message.success(ok); carregar(); } catch (e) { erro(e); } };
  const criarObra = async () => {
    if (!obraDe) return;
    try {
      const r = await processoApi.obraDoLead(obraDe.lead.idLead, { servicos: obraDe.servicos, titulo: obraDe.titulo || null });
      message.success(`Obra ${r.idObra} criada (orçamento). Complete os valores e o escopo na obra.`);
      setObraDe(null); abrirObra(r.idObra, 'PROCESSO');
    } catch (e) { erro(e); }
  };
  const semResposta = lista.filter(l => !l.respondidoEm && l.situacao !== 'PERDIDO');
  return (
    <Card size="small"
      title={<Space wrap><Input allowClear placeholder="Nome, telefone, cidade ou o que precisa" style={{ width: 280 }} value={busca} onChange={e => setBusca(e.target.value)} />
        <Checkbox checked={todos} onChange={e => setTodos(e.target.checked)}>mostrar antigos</Checkbox></Space>}
      extra={<Space>
        <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo contato</Button>
      </Space>}>
      {semResposta.some(l => l.estadoResposta === 'ATRASADO') && (
        <Alert type="error" showIcon style={{ marginBottom: 8 }} message={`${semResposta.filter(l => l.estadoResposta === 'ATRASADO').length} contato(s) passaram do prazo de resposta.`} />
      )}
      <Table<Lead> size="small" rowKey="idLead" loading={carregando} dataSource={lista} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum contato. Todo contato (Google, indicação, placa, Instagram) entra aqui." /> }}
        onRow={l => ({ onClick: () => setAberto(l), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Contato', render: (_, l) => (
              <div style={{ lineHeight: 1.35 }}>
                <Text strong>{l.nome}</Text> <Tag>{ORIGENS_LEAD[l.origem]}{l.indicadoPor ? `: ${l.indicadoPor}` : ''}</Tag>
                <div><Text type="secondary" style={{ fontSize: 12 }}>{[foneBr(l.telefone), l.cidade, l.necessidade].filter(Boolean).join(' · ')}</Text></div>
              </div>
            ),
          },
          {
            title: 'Resposta', width: 190, render: (_, l) => (
              <div style={{ lineHeight: 1.35 }}>
                <Tag color={ESTADOS_PRAZO[l.estadoResposta].cor}>{ESTADOS_PRAZO[l.estadoResposta].texto}</Tag>
                <div><Text type="secondary" style={{ fontSize: 11 }}>chegou {quando(l.recebidoEm)}{l.respondidoEm ? ` · respondido ${quando(l.respondidoEm)}` : ` · prazo ${quando(l.prazoResposta)}`}</Text></div>
              </div>
            ),
          },
          {
            title: 'Situação', width: 190, render: (_, l) => (
              <div style={{ lineHeight: 1.35 }}>
                <Tag color={SITUACOES_LEAD[l.situacao].cor}>{SITUACOES_LEAD[l.situacao].texto}</Tag>
                {l.idObra && <div><a onClick={e => { e.stopPropagation(); abrirObra(l.idObra!, 'PROCESSO'); }} style={{ fontSize: 12 }}>obra {l.idObra}{l.obraSituacao ? ` · ${SITUACOES_OBRA[l.obraSituacao].texto.toLowerCase()}` : ''}</a></div>}
                {l.motivoPerda && <div><Text type="secondary" style={{ fontSize: 11 }}>{l.motivoPerda}</Text></div>}
              </div>
            ),
          },
          {
            title: '', width: 330, align: 'right', render: (_, l) => (
              <Space size={4} wrap style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                {l.whatsapp && <Tooltip title="Abrir o WhatsApp com a mensagem pronta"><Button size="small" icon={<WhatsAppOutlined />} onClick={() => window.open(l.whatsapp!, '_blank')} /></Tooltip>}
                {!l.respondidoEm && l.situacao !== 'PERDIDO' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => acao(() => processoApi.respondido(l.idLead), 'Resposta registrada.')}>Respondi</Button>}
                {!l.idObra && l.situacao !== 'PERDIDO' && (
                  <Button size="small" type="primary" ghost onClick={() => setOrcamentoDe(l)}>Orçamento</Button>
                )}
                {!l.idObra && l.situacao !== 'PERDIDO' && (
                  <Button size="small" onClick={() => setObraDe({ lead: l, servicos: /limp/i.test(l.necessidade || '') ? ['LIMPEZA'] : /bomba/i.test(l.necessidade || '') ? ['TROCA_BOMBA'] : ['PERFURACAO'], titulo: '' })}>Criar obra</Button>
                )}
                {l.situacao !== 'PERDIDO' && l.situacao !== 'CONVERTIDO' && (
                  <Select size="small" style={{ width: 120 }} placeholder="mudar" value={undefined}
                    onChange={(v: string) => (v === 'PERDIDO' ? setPerder({ lead: l, motivo: '' }) : acao(() => processoApi.mudarLead(l.idLead, v as 'EM_CONTATO')))}
                    options={[{ value: 'EM_CONTATO', label: 'Em contato' }, { value: 'VISITA_AGENDADA', label: 'Visita agendada' }, { value: 'PERDIDO', label: 'Perdido' }]} />
                )}
                {l.situacao === 'PERDIDO' && <Button size="small" type="link" onClick={() => acao(() => processoApi.mudarLead(l.idLead, 'EM_CONTATO'))}>reabrir</Button>}
              </Space>
            ),
          },
        ]} />
      <LeadModal aberto={aberto} onFechar={() => setAberto(null)} onSalvo={() => { setAberto(null); carregar(); }} />
      <OrcamentoRapido aberto={!!orcamentoDe} lead={orcamentoDe} onFechar={() => { setOrcamentoDe(null); carregar(); }} />
      <Modal open={!!obraDe} title={`Criar obra para ${obraDe?.lead.nome || ''}`} okText="Criar obra (orçamento)" cancelText="Voltar" onOk={criarObra} onCancel={() => setObraDe(null)} destroyOnHidden>
        {obraDe && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Usa o cliente de poço com o mesmo telefone ou cadastra um novo com o nome, telefone e cidade do contato.</Text>
            <div><Text>Serviços</Text>
              <Checkbox.Group value={obraDe.servicos} onChange={v => setObraDe({ ...obraDe, servicos: v as Servico[] })}
                options={(Object.keys(SERVICOS) as Servico[]).map(s => ({ value: s, label: SERVICOS[s] }))} />
            </div>
            <div><Text>Título (opcional)</Text><Input maxLength={150} value={obraDe.titulo} onChange={e => setObraDe({ ...obraDe, titulo: e.target.value })} placeholder={`${obraDe.lead.necessidade || 'Orçamento'} - ${obraDe.lead.nome}`} /></div>
          </Space>
        )}
      </Modal>
      <Modal open={!!perder} title="Contato perdido" okText="Marcar perdido" okButtonProps={{ danger: true }} cancelText="Voltar" onCancel={() => setPerder(null)} destroyOnHidden
        onOk={() => perder && acao(() => processoApi.mudarLead(perder.lead.idLead, 'PERDIDO', perder.motivo), 'Marcado como perdido.').then(() => setPerder(null))}>
        <Select style={{ width: '100%', marginBottom: 8 }} placeholder="Motivo comum" onChange={(v: string) => perder && setPerder({ ...perder, motivo: v })}
          options={['Preço', 'Fechou com outra empresa', 'Desistiu / adiou', 'Não respondeu mais', 'Fora da área de atendimento', 'Sem viabilidade técnica'].map(m => ({ value: m, label: m }))} />
        <Input maxLength={150} placeholder="Ou escreva o motivo" value={perder?.motivo || ''} onChange={e => perder && setPerder({ ...perder, motivo: e.target.value })} />
      </Modal>
    </Card>
  );
};

// ------------------------------------------------------------------ pendências
const Pendencias: React.FC = () => {
  const [dados, setDados] = useState<{ leads: Lead[]; itens: PendenciaObra[] } | null>(null);
  const carregar = useCallback(() => processoApi.pendencias().then(setDados).catch(erro), []);
  useEffect(() => { carregar(); }, [carregar]);
  if (!dados) return <Card loading />;
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small" title={`Contatos sem resposta (${dados.leads.length})`} extra={<Button icon={<ReloadOutlined />} onClick={carregar} />}>
        <Table<Lead> size="small" rowKey="idLead" pagination={false} dataSource={dados.leads} locale={{ emptyText: 'Todos respondidos' }}
          columns={[
            { title: 'Contato', render: (_, l) => <><Text strong>{l.nome}</Text> <Tag>{ORIGENS_LEAD[l.origem]}</Tag> <Text type="secondary" style={{ fontSize: 12 }}>{foneBr(l.telefone)}</Text></> },
            { title: 'Prazo', width: 230, render: (_, l) => <><Tag color={ESTADOS_PRAZO[l.estadoResposta].cor}>{ESTADOS_PRAZO[l.estadoResposta].texto}</Tag><Text style={{ fontSize: 12 }}>{quando(l.prazoResposta)}</Text></> },
            { title: '', width: 200, align: 'right', render: (_, l) => <Space>
              {l.whatsapp && <Button size="small" icon={<WhatsAppOutlined />} onClick={() => window.open(l.whatsapp!, '_blank')}>WhatsApp</Button>}
              <Button size="small" type="primary" onClick={async () => { try { await processoApi.respondido(l.idLead); carregar(); } catch (e) { erro(e); } }}>Respondi</Button>
            </Space> },
          ]} />
      </Card>
      <Card size="small" title={`Obras com etapa pendente ou atrasada (${dados.itens.length})`}>
        <Table<PendenciaObra> size="small" rowKey={i => `${i.idObra}-${i.etapa}`} pagination={{ pageSize: 50, hideOnSinglePage: true }} dataSource={dados.itens}
          locale={{ emptyText: 'Processo em dia em todas as obras' }}
          columns={[
            { title: 'Obra', render: (_, i) => <><a onClick={() => abrirObra(i.idObra, 'PROCESSO')}>Nº {i.idObra} · {i.obra}</a><div><Text type="secondary" style={{ fontSize: 12 }}>{i.cliente}{i.telefone ? ` · ${foneBr(i.telefone)}` : ''} · {SITUACOES_OBRA[i.situacaoObra].texto.toLowerCase()}</Text></div></> },
            { title: 'Etapa', render: (_, i) => i.titulo },
            { title: 'Situação', width: 200, render: (_, i) => <><Tag color={ESTADOS_ETAPA[i.estado].cor}>{ESTADOS_ETAPA[i.estado].texto}</Tag>{i.prazo && <Text style={{ fontSize: 12 }}>prazo {dataBr(i.prazo)}</Text>}</> },
            {
              title: '', width: 210, align: 'right', render: (_, i) => <Space>
                {i.whatsapp && (i.etapa === 'AVALIACAO_PEDIDA' || i.etapa === 'REVISAO_LEMBRADA') && (
                  <Button size="small" icon={<WhatsAppOutlined />} onClick={() => {
                    window.open(i.whatsapp!, '_blank');
                    Modal.confirm({ title: 'Mensagem enviada?', content: 'Registrar a etapa como feita agora?', okText: 'Sim', cancelText: 'Ainda não',
                      onOk: async () => { try { await processoApi.marcar(i.idObra, i.etapa); carregar(); } catch (e) { erro(e); } } });
                  }}>{i.etapa === 'AVALIACAO_PEDIDA' ? 'Pedir avaliação' : 'Lembrar revisão'}</Button>
                )}
                <Button size="small" icon={<FileSearchOutlined />} onClick={() => abrirObra(i.idObra, 'PROCESSO')}>Abrir</Button>
              </Space>,
            },
          ]} />
      </Card>
    </Space>
  );
};

// ------------------------------------------------------------------ indicadores
const Indicadores: React.FC = () => {
  const [dias, setDias] = useState(90);
  const [d, setD] = useState<IndicadoresProcesso | null>(null);
  useEffect(() => {
    const ate = new Date(); const de = new Date(); de.setDate(de.getDate() - dias);
    const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    processoApi.indicadores(f(de), f(ate)).then(setD).catch(erro);
  }, [dias]);
  const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR')}%`);
  const cor = (v: number | null, bom = 90) => (v === null ? undefined : { color: v >= bom ? '#389e0d' : v >= 60 ? '#d48806' : '#cf1322' });
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Segmented value={dias} onChange={v => setDias(Number(v))} options={[{ value: 30, label: '30 dias' }, { value: 90, label: '90 dias' }, { value: 365, label: '12 meses' }]} />
      {!d ? <Card loading /> : <>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Contatos (leads)" value={d.leads} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Respondidos no prazo" value={pct(d.respostaNoPrazo)} valueStyle={cor(d.respostaNoPrazo)} /><Text type="secondary" style={{ fontSize: 12 }}>de {d.respostaMedidos} já vencidos ou respondidos</Text></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Orçamentos no prazo" value={pct(d.orcamentoNoPrazo)} valueStyle={cor(d.orcamentoNoPrazo)} /><Text type="secondary" style={{ fontSize: 12 }}>{d.orcamentos} enviado(s)</Text></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Obras com as 3 fotos" value={pct(d.fotosCompletas)} valueStyle={cor(d.fotosCompletas)} /><Text type="secondary" style={{ fontSize: 12 }}>{d.concluidas} concluída(s) · avaliações {d.avaliacoesRecebidas}/{d.avaliacoesPedidas}</Text></Card></Col>
        </Row>
        <Card size="small" title="De onde vêm os clientes">
          <Table size="small" rowKey="origem" pagination={false} dataSource={d.porOrigem} locale={{ emptyText: 'Sem contatos no período' }}
            columns={[
              { title: 'Origem', render: (_, o: IndicadoresProcesso['porOrigem'][number]) => ORIGENS_LEAD[o.origem] || o.origem },
              { title: 'Contatos', dataIndex: 'leads', align: 'right' },
              { title: 'Viraram obra', dataIndex: 'convertidos', align: 'right' },
              { title: 'Perdidos', dataIndex: 'perdidos', align: 'right' },
              { title: 'Conversão', align: 'right', render: (_, o: IndicadoresProcesso['porOrigem'][number]) => pct(o.conversao) },
              { title: 'Valor fechado', align: 'right', render: (_, o: IndicadoresProcesso['porOrigem'][number]) => brl(o.valorFechado) },
            ]} />
        </Card>
      </>}
    </Space>
  );
};

// ------------------------------------------------------------------ galeria
const Galeria: React.FC = () => {
  const [fotos, setFotos] = useState<Awaited<ReturnType<typeof processoApi.galeria>>>([]);
  useEffect(() => { processoApi.galeria().then(setFotos).catch(erro); }, []);
  return (
    <Card size="small" title={`Fotos liberadas para divulgar (${fotos.length})`} extra={<Text type="secondary" style={{ fontSize: 12 }}>Clique para ampliar; botão direito para salvar</Text>}>
      {!fotos.length ? <Empty description='Nenhuma foto com "pode divulgar". Marque na obra (parte Processo) quando o cliente autorizar.' /> : (
        <Image.PreviewGroup>
          <Row gutter={[10, 10]}>
            {fotos.map(f => (
              <Col xs={12} md={6} xl={4} key={f.idFoto}>
                <Image src={urlArquivo(f.url) || ''} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
                <div style={{ lineHeight: 1.3, marginTop: 4 }}>
                  <Text style={{ fontSize: 12 }}>{f.legenda || f.obra}</Text>
                  <div><Text type="secondary" style={{ fontSize: 11 }}>{f.etapa.toLowerCase()} · {f.cidade || ''} · <a onClick={() => abrirObra(f.idObra, 'PROCESSO')}>obra {f.idObra}</a></Text></div>
                </div>
              </Col>
            ))}
          </Row>
        </Image.PreviewGroup>
      )}
    </Card>
  );
};

// ------------------------------------------------------------------ configuração
const Configuracao: React.FC = () => {
  const [c, setC] = useState<ConfigProcesso | null>(null);
  const [logoNovo, setLogoNovo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { processoApi.config().then(setC).catch(erro); }, []);
  if (!c) return <Card loading />;
  const campo = (k: keyof ConfigProcesso, rotulo: string, span: number, props: object = {}) => (
    <Col span={span}><Text>{rotulo}</Text><Input value={(c[k] as string) || ''} onChange={e => setC({ ...c, [k]: e.target.value || null })} {...props} /></Col>
  );
  const n = (k: keyof ConfigProcesso, rotulo: string, suf: string, min: number, max: number) => (
    <Col span={6}><Text>{rotulo}</Text><InputNumber min={min} max={max} suffix={suf} style={{ width: '100%' }} value={c[k] as number} onChange={v => setC({ ...c, [k]: Number(v) || min })} /></Col>
  );
  const salvar = async (tirarLogo = false) => {
    setSalvando(true);
    try {
      const r = await processoApi.salvarConfig({ ...c, logoNovo: logoNovo || undefined, tirarLogo });
      setC(r); setLogoNovo(null); recursosPocos.definir(r); message.success('Configuração salva.');
    }
    catch (e) { erro(e); } finally { setSalvando(false); }
  };
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small" title="Dados da empresa (orçamento, laudo e adesivo)">
        <Row gutter={[8, 8]}>
          <Col span={6}>
            <Text>Logo</Text>
            <div style={{ border: '1px dashed #d9d9d9', borderRadius: 6, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
              {logoNovo || c.logo ? <img src={logoNovo || urlArquivo(c.logo) || ''} alt="logo" style={{ maxHeight: 80, maxWidth: '100%' }} /> : <Text type="secondary">sem logo</Text>}
            </div>
            <Space style={{ marginTop: 4 }}>
              <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={async f => { try { setLogoNovo(await reduzirImagem(f, 600, 0.9)); } catch (e) { erro(e); } return false; }}>
                <Button size="small">Escolher</Button>
              </Upload>
              {c.logo && !logoNovo && <Button size="small" type="link" danger onClick={() => salvar(true)}>tirar</Button>}
            </Space>
          </Col>
          <Col span={18}>
            <Row gutter={[8, 8]}>
              {campo('empresaNome', 'Nome', 12)}{campo('empresaDocumento', 'CNPJ / CPF', 12)}
              {campo('empresaTelefone', 'Telefone', 8)}{campo('empresaWhatsapp', 'WhatsApp', 8)}{campo('empresaEmail', 'E-mail', 8)}
              {campo('empresaEndereco', 'Endereço', 24)}
              {campo('empresaRepresentante', 'Representante legal (no contrato)', 16, { placeholder: 'Ex.: José Maurício dos Santos' })}
              {campo('empresaRepresentanteCpf', 'CPF do representante', 8)}
            </Row>
          </Col>
          <Col span={24}><Text>Texto de garantia (orçamento e laudo)</Text>
            <Input.TextArea rows={3} maxLength={2000} value={c.textoGarantia || ''} onChange={e => setC({ ...c, textoGarantia: e.target.value || null })}
              placeholder="Ex.: A garantia cobre a execução da perfuração e do revestimento contra defeitos de construção. Não cobre: redução natural da vazão do aquífero..." />
          </Col>
          {campo('formaPagamentoPadrao', 'Forma de pagamento padrão', 18, { placeholder: 'Ex.: 30% de sinal, saldo na entrega ou em até 3 vezes' })}
          {n('validadeOrcamentoDias', 'Validade do orçamento', 'dias', 1, 365)}
        </Row>
      </Card>
      <Card size="small" title="Contrato e termo aditivo">
        <Row gutter={[8, 8]}>
          {campo('foroCidade', 'Foro (cidade da comarca)', 8, { maxLength: 60 })}
          {campo('responsavelTecnico', 'Responsável técnico', 10, { maxLength: 120 })}
          {campo('registroTecnico', 'CREA / registro', 6, { maxLength: 30 })}
          {([['modeloContrato', 'Modelo do contrato', MODELO_CONTRATO_PADRAO, 14], ['modeloAditivo', 'Modelo do termo aditivo', MODELO_ADITIVO_PADRAO, 10]] as const).map(([k, rotulo, padrao, linhas]) => (
            <Col span={24} key={k}>
              <Flex justify="space-between" align="center">
                <Text>{rotulo}{!c[k] && <Text type="secondary" style={{ fontSize: 12 }}> (usando o modelo padrão)</Text>}</Text>
                {c[k] && <Button size="small" type="link" onClick={() => setC({ ...c, [k]: null })}>restaurar o padrão</Button>}
              </Flex>
              <Input.TextArea rows={linhas} maxLength={k === 'modeloContrato' ? 60000 : 20000} value={c[k] || padrao}
                onChange={e => setC({ ...c, [k]: e.target.value.trim() && e.target.value !== padrao ? e.target.value : null })} />
            </Col>
          ))}
          <Col span={24}>
            <Alert type="warning" showIcon message="O modelo padrão é uma referência: peça para um advogado revisar as cláusulas antes de usar com clientes." />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Linhas que começam com "CLÁUSULA" viram título; {'{tabela_itens}'} e {'{tabela_adicionais}'} vão numa linha sozinha. Campos:{' '}
              {Object.entries(CAMPOS_MODELO).map(([k, t]) => <Tooltip key={k} title={t}><Tag style={{ marginBottom: 2 }}>{`{${k}}`}</Tag></Tooltip>)}
            </Text>
          </Col>
        </Row>
      </Card>
      <Card size="small" title="Pós-venda (mensagens de WhatsApp)">
        <Row gutter={[8, 8]}>
          {campo('linkAvaliacao', 'Link para avaliar no Google', 24, { placeholder: 'https://g.page/r/.../review (no Perfil da Empresa no Google: "Pedir avaliações")' })}
          <Col span={12}><Text>Mensagem pedindo avaliação</Text>
            <Input.TextArea rows={4} maxLength={1000} value={c.msgAvaliacao} onChange={e => setC({ ...c, msgAvaliacao: e.target.value })} />
          </Col>
          <Col span={12}><Text>Mensagem do lembrete de revisão</Text>
            <Input.TextArea rows={4} maxLength={1000} value={c.msgRevisao} onChange={e => setC({ ...c, msgRevisao: e.target.value })} />
          </Col>
          <Col span={24}><Text type="secondary" style={{ fontSize: 12 }}>Use {'{cliente}'}, {'{empresa}'}, {'{link}'}, {'{poco}'} e {'{obra}'}: são trocados pelos dados de cada obra.</Text></Col>
        </Row>
      </Card>
      <Card size="small" title="Prazos e horário comercial">
        <Row gutter={[8, 8]}>
          {n('respostaLeadMin', 'Responder contato em', 'min', 5, 1440)}{n('orcamentoHoras', 'Enviar orçamento em', 'h', 1, 240)}
          {n('avaliacaoDias', 'Pedir avaliação após', 'dias', 1, 90)}{n('revisaoMeses', 'Lembrar revisão após', 'meses', 1, 60)}
          {campo('horaAbre', 'Abre', 6, { type: 'time' })}{campo('horaFecha', 'Fecha', 6, { type: 'time' })}
          {campo('sabadoFecha', 'Sábado fecha (vazio = não abre)', 8, { type: 'time' })}
        </Row>
      </Card>
      <Card size="small" title="Telas do módulo">
        <Space direction="vertical" size={6}>
          <Space><Switch checked={c.usaMonitoramento} onChange={v => setC({ ...c, usaMonitoramento: v })} />
            <span><b>Monitoramento (IoT)</b> <Text type="secondary">· ligue quando houver aparelho medindo algum poço</Text></span></Space>
          <Space><Switch checked={c.usaMapa} onChange={v => setC({ ...c, usaMapa: v })} />
            <span><b>Mapa</b> <Text type="secondary">· poços dos clientes e a base regional (profundidade e vazão da região)</Text></span></Space>
          <Text type="secondary" style={{ fontSize: 12 }}>Desligada, a tela sai de "Mais ferramentas". Nada é apagado: ligar de novo traz tudo de volta.</Text>
        </Space>
      </Card>
      <Space><Button type="primary" icon={<SettingOutlined />} loading={salvando} onClick={() => salvar()}>Salvar configuração</Button></Space>
    </Space>
  );
};

type VistaAtendimento = 'LEADS' | 'PENDENCIAS' | 'INDICADORES' | 'GALERIA' | 'CONFIG';
const VISTAS_ATENDIMENTO: VistaAtendimento[] = ['LEADS', 'PENDENCIAS', 'INDICADORES', 'GALERIA', 'CONFIG'];

const AtendimentoPocos: React.FC = () => {
  const pedida = navPocos.get().subvista as VistaAtendimento | undefined;
  const [vista, setVista] = useState<VistaAtendimento>(pedida && VISTAS_ATENDIMENTO.includes(pedida) ? pedida : 'LEADS');
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Segmented value={vista} onChange={v => setVista(v as typeof vista)} options={[
        { value: 'LEADS', label: 'Contatos (leads)' }, { value: 'PENDENCIAS', label: 'Pendências' }, { value: 'INDICADORES', label: 'Indicadores' },
        { value: 'GALERIA', label: 'Galeria' }, { value: 'CONFIG', label: 'Configuração' },
      ]} />
      {vista === 'LEADS' && <Leads />}
      {vista === 'PENDENCIAS' && <Pendencias />}
      {vista === 'INDICADORES' && <Indicadores />}
      {vista === 'GALERIA' && <Galeria />}
      {vista === 'CONFIG' && <Configuracao />}
    </Space>
  );
};

export default AtendimentoPocos;
