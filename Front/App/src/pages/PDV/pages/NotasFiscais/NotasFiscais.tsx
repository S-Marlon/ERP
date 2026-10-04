// Vendas › Notas fiscais: fila do dia (revisar, aprovar e emitir, dispensar), envio ao cliente, cancelamento e configuração.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Drawer, Empty, Input, Modal, Radio, Select, Space, Table, Tabs, Tag, Timeline, Tooltip, Typography, message,
} from 'antd';
import { CopyOutlined, FileTextOutlined, HistoryOutlined, MailOutlined, ReloadOutlined, StopOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { ConfiguracaoFiscal } from './ConfiguracaoFiscal';
import { DadosConfiguracao, EventoNota, FilaDoDia, fiscalApi, linkEmail, linkWhatsapp, mensagemDaNota, Modelo, NotaDaFila, SituacaoNota } from './fiscalApi';

const { Text, Title } = Typography;

const money = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatarDoc = (d: string | null) => {
  if (!d) return '';
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
};

const SITUACAO: Record<SituacaoNota, { rotulo: string; cor: string }> = {
  AGUARDANDO: { rotulo: 'Aguardando', cor: 'gold' },
  SEM_NOTA: { rotulo: 'Só serviço', cor: 'default' },
  DISPENSADA: { rotulo: 'Dispensada', cor: 'default' },
  PROCESSANDO: { rotulo: 'Emitindo', cor: 'processing' },
  AUTORIZADA: { rotulo: 'Autorizada', cor: 'green' },
  REJEITADA: { rotulo: 'Rejeitada', cor: 'red' },
  DENEGADA: { rotulo: 'Denegada', cor: 'red' },
  CANCELADA: { rotulo: 'Cancelada', cor: 'volcano' },
};
const NOME_MODELO: Record<Modelo, string> = { '65': 'NFC-e', '55': 'NF-e' };

/** Pode ir para a emissão: na fila, rejeitada ou com a nota cancelada (venda ainda válida), sem pendência. */
const emitivel = (n: NotaDaFila) => n.statusVenda === 'CONCLUIDA' && ['AGUARDANDO', 'REJEITADA', 'CANCELADA'].includes(n.situacao) && n.pendencias.length === 0;

const FilaNotas: React.FC<{ loja: string }> = ({ loja }) => {
  const [data, setData] = useState(hoje());
  const [fila, setFila] = useState<FilaDoDia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [modelos, setModelos] = useState<Record<number, Modelo>>({});
  const [processando, setProcessando] = useState(false);
  const [dispensando, setDispensando] = useState<number[] | null>(null);
  const [motivoDispensa, setMotivoDispensa] = useState('');
  const [cancelando, setCancelando] = useState<NotaDaFila | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [enviando, setEnviando] = useState<NotaDaFila | null>(null);
  const [canal, setCanal] = useState<'WHATSAPP' | 'EMAIL'>('WHATSAPP');
  const [destino, setDestino] = useState('');
  const [historico, setHistorico] = useState<{ nota: NotaDaFila; eventos: EventoNota[] } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setFila(await fiscalApi.fila(data));
      setSelecionadas([]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  }, [data]);
  useEffect(() => { carregar(); }, [carregar]);

  const notas = useMemo(() => fila?.notas || [], [fila]);
  const modeloDe = (n: NotaDaFila) => modelos[n.idVenda] || n.modelo;

  const emitir = async (ids: number[]) => {
    if (!ids.length) return;
    // Uma requisição por modelo escolhido (a numeração de NFC-e e NF-e é separada)
    const grupos = new Map<Modelo, number[]>();
    for (const id of ids) {
      const n = notas.find(x => x.idVenda === id)!;
      grupos.set(modeloDe(n), [...(grupos.get(modeloDe(n)) || []), id]);
    }
    setProcessando(true);
    try {
      const resultados = (await Promise.all([...grupos].map(([modelo, lista]) => fiscalApi.emitir(lista, modelo)))).flatMap(r => r.resultados);
      const ok = resultados.filter(r => r.ok).length;
      const falhas = resultados.filter(r => !r.ok);
      if (!falhas.length) message.success(`${ok} nota(s) autorizada(s).`);
      else {
        Modal.warning({
          title: `${ok} autorizada(s), ${falhas.length} com problema`,
          content: <ul style={{ paddingLeft: 18 }}>{falhas.map(f => <li key={f.idVenda}>Venda {f.idVenda}: {f.mensagem}</li>)}</ul>,
        });
      }
      await carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao emitir.');
    } finally {
      setProcessando(false);
    }
  };

  const confirmarEmissao = (ids: number[]) => {
    const total = ids.reduce((a, id) => a + (notas.find(n => n.idVenda === id)?.total || 0), 0);
    Modal.confirm({
      title: `Aprovar e emitir ${ids.length} nota(s)?`,
      content: `Total ${money(total)} · ambiente ${fila?.ambiente === 'PRODUCAO' ? 'PRODUÇÃO (com valor fiscal)' : 'homologação (teste)'}.`,
      okText: 'Emitir', cancelText: 'Voltar', onOk: () => emitir(ids),
    });
  };

  const dispensar = async () => {
    if (!dispensando || !motivoDispensa.trim()) { message.warning('Informe o motivo.'); return; }
    try {
      const r = await fiscalApi.dispensar(dispensando, motivoDispensa.trim());
      const falhas = r.resultados.filter(x => !x.ok);
      if (falhas.length) message.warning(falhas.map(f => `Venda ${f.idVenda}: ${f.mensagem}`).join(' · '));
      else message.success('Dispensada(s).');
      setDispensando(null); setMotivoDispensa('');
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao dispensar.');
    }
  };

  const reabrir = async (n: NotaDaFila) => {
    try {
      const r = await fiscalApi.reabrir([n.idVenda]);
      if (!r.resultados[0]?.ok) message.warning(r.resultados[0]?.mensagem);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao reabrir.');
    }
  };

  const cancelarNota = async () => {
    if (!cancelando?.documento) return;
    try {
      await fiscalApi.cancelar(cancelando.documento.idDocumento, motivoCancelamento.trim());
      message.success('Nota cancelada.');
      setCancelando(null); setMotivoCancelamento('');
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao cancelar.');
    }
  };

  const abrirEnvio = (n: NotaDaFila, c: 'WHATSAPP' | 'EMAIL') => {
    setEnviando(n); setCanal(c); setDestino((c === 'WHATSAPP' ? n.celular : n.email) || '');
  };
  const enviar = async () => {
    if (!enviando?.documento) return;
    try {
      const r = await fiscalApi.registrarEnvio(enviando.documento.idDocumento, canal, destino.trim());
      const texto = mensagemDaNota(enviando, loja, fila?.consultaUrl || null);
      if (canal === 'WHATSAPP') window.open(linkWhatsapp(destino, texto), '_blank');
      else if (!r.enviadoPeloEmissor) window.location.href = linkEmail(destino.trim(), `Nota fiscal - venda ${enviando.idVenda}`, texto);
      else message.success(r.mensagem);
      setEnviando(null);
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao enviar.');
    }
  };

  const verHistorico = async (n: NotaDaFila) => {
    if (!n.documento) return;
    try {
      const r = await fiscalApi.eventos(n.documento.idDocumento);
      setHistorico({ nota: n, eventos: r.eventos });
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar o histórico.');
    }
  };

  const aguardando = notas.filter(n => n.situacao === 'AGUARDANDO');
  const prontas = aguardando.filter(emitivel).map(n => n.idVenda);
  const resumo = fila?.resumo || {};

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input type="date" value={data} max={hoje()} onChange={e => setData(e.target.value || hoje())} style={{ width: 160 }} />
          <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
          {fila && <Tag color={fila.ambiente === 'PRODUCAO' ? 'green' : 'orange'}>{fila.ambiente === 'PRODUCAO' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO (teste)'}</Tag>}
          {fila && <Tag>emissor: {fila.emissor || '—'}</Tag>}
          {fila && <Tag>{fila.modoEmissao === 'AUTOMATICA' ? 'automático' : 'fila de aprovação'}</Tag>}
        </Space>
        <Space wrap>
          {(Object.keys(SITUACAO) as SituacaoNota[]).filter(s => resumo[s]).map(s => <Tag key={s} color={SITUACAO[s].cor}>{SITUACAO[s].rotulo}: {resumo[s]}</Tag>)}
        </Space>
      </div>

      {fila && !fila.configurado && <Alert type="warning" showIcon message="Configure a empresa e a emissão na aba Configuração antes de emitir." />}
      <Alert type="info" showIcon closable
        message="MEI: a venda para pessoa física dispensa nota; a venda para CNPJ exige NF-e (modelo 55), emitida antes de a mercadoria sair. Confirme as regras com seu contador." />

      <Card size="small" styles={{ body: { padding: 0 } }}
        title={<Space wrap>
          <Button type="primary" disabled={!selecionadas.length} loading={processando} onClick={() => confirmarEmissao(selecionadas)}>
            Aprovar e emitir selecionadas ({selecionadas.length})
          </Button>
          <Button disabled={!selecionadas.length} onClick={() => setDispensando(selecionadas)}>Dispensar selecionadas</Button>
          {prontas.length > 0 && <Button type="link" onClick={() => setSelecionadas(prontas)}>Selecionar as {prontas.length} prontas</Button>}
        </Space>}>
        <Table<NotaDaFila>
          size="small" rowKey="idVenda" loading={carregando} dataSource={notas} pagination={false}
          locale={{ emptyText: <Empty description="Nenhuma venda neste dia" /> }}
          rowSelection={{
            selectedRowKeys: selecionadas, onChange: k => setSelecionadas(k as number[]),
            getCheckboxProps: n => ({ disabled: !emitivel(n) && !(n.situacao === 'AGUARDANDO') }),
          }}
          columns={[
            { title: 'Nº', dataIndex: 'idVenda', width: 60 },
            { title: 'Hora', dataIndex: 'criadoEm', width: 60, render: (v: string) => hora(v) },
            {
              title: 'Cliente', key: 'cliente',
              render: (_, n) => (
                <div>
                  <div>{n.cliente}</div>
                  {n.documentoCliente && <Text type="secondary" style={{ fontSize: 11 }}>{formatarDoc(n.documentoCliente)}</Text>}
                  {n.modeloSugerido === '55' && <Tag color="purple" style={{ fontSize: 10, marginLeft: 4 }}>CNPJ · NF-e obrigatória</Tag>}
                </div>
              ),
            },
            {
              title: 'Total', key: 'total', width: 110, align: 'right' as const,
              render: (_, n) => (
                <div>
                  <b style={n.statusVenda === 'CANCELADA' ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}>{money(n.total)}</b>
                  {n.totalDevolvido > 0 && <div><Tag color="orange" style={{ margin: 0, fontSize: 10 }}>devolvido {money(n.totalDevolvido)}</Tag></div>}
                </div>
              ),
            },
            {
              title: 'Modelo', key: 'modelo', width: 100,
              render: (_, n) => (emitivel(n) || n.situacao === 'AGUARDANDO'
                ? <Select size="small" value={modeloDe(n)} style={{ width: 90 }} onChange={v => setModelos(m => ({ ...m, [n.idVenda]: v }))}
                    options={[{ value: '65', label: 'NFC-e' }, { value: '55', label: 'NF-e' }]} />
                : n.situacao === 'SEM_NOTA' ? '—' : NOME_MODELO[n.modelo]),
            },
            {
              title: 'Situação', key: 'situacao', width: 230,
              render: (_, n) => (
                <div>
                  <Tag color={SITUACAO[n.situacao].cor}>{SITUACAO[n.situacao].rotulo}</Tag>
                  {n.statusVenda === 'CANCELADA' && <Tag color="red">venda cancelada</Tag>}
                  {n.documento?.numero && n.situacao !== 'DISPENSADA' && (
                    <Text style={{ fontSize: 12 }}>nº {n.documento.numero}
                      {n.documento.chave && <Tooltip title={`Copiar chave ${n.documento.chave}`}>
                        <CopyOutlined style={{ marginLeft: 4, color: '#8c8c8c' }} onClick={() => { navigator.clipboard.writeText(n.documento!.chave!); message.success('Chave copiada.'); }} />
                      </Tooltip>}
                    </Text>
                  )}
                  {n.pendencias.length > 0 && <div>{n.pendencias.map(p => <div key={p}><Text type="danger" style={{ fontSize: 11 }}>{p}</Text></div>)}</div>}
                  {n.documento?.motivo && ['REJEITADA', 'DISPENSADA', 'DENEGADA'].includes(n.situacao) && (
                    <div><Text type={n.situacao === 'DISPENSADA' ? 'secondary' : 'danger'} style={{ fontSize: 11 }}>{n.documento.motivo}</Text></div>
                  )}
                </div>
              ),
            },
            {
              title: '', key: 'acoes', width: 210, align: 'right' as const,
              render: (_, n) => (
                <Space size={2} wrap>
                  {emitivel(n) && <Button size="small" type="primary" ghost loading={processando} onClick={() => confirmarEmissao([n.idVenda])}>Emitir</Button>}
                  {n.statusVenda === 'CONCLUIDA' && ['AGUARDANDO', 'REJEITADA'].includes(n.situacao) && <Button size="small" onClick={() => setDispensando([n.idVenda])}>Dispensar</Button>}
                  {n.situacao === 'DISPENSADA' && n.statusVenda === 'CONCLUIDA' && <Button size="small" onClick={() => reabrir(n)}>Voltar à fila</Button>}
                  {n.situacao === 'AUTORIZADA' && (<>
                    <Tooltip title="Enviar por WhatsApp"><Button size="small" icon={<WhatsAppOutlined style={{ color: '#25d366' }} />} onClick={() => abrirEnvio(n, 'WHATSAPP')} /></Tooltip>
                    <Tooltip title="Enviar por e-mail"><Button size="small" icon={<MailOutlined />} onClick={() => abrirEnvio(n, 'EMAIL')} /></Tooltip>
                    {n.documento?.urlDanfe && <Tooltip title="DANFE"><Button size="small" icon={<FileTextOutlined />} href={n.documento.urlDanfe} target="_blank" /></Tooltip>}
                    <Tooltip title="Cancelar nota"><Button size="small" danger icon={<StopOutlined />} onClick={() => setCancelando(n)} /></Tooltip>
                  </>)}
                  {n.documento && <Tooltip title="Histórico"><Button size="small" type="text" icon={<HistoryOutlined />} onClick={() => verHistorico(n)} /></Tooltip>}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={dispensando !== null} title={`Dispensar ${dispensando?.length || 0} nota(s)`} okText="Dispensar" cancelText="Voltar"
        onOk={dispensar} onCancel={() => setDispensando(null)} destroyOnHidden>
        <Text type="secondary">A venda continua válida; só não terá nota. Pode voltar à fila depois.</Text>
        <Input style={{ marginTop: 8 }} autoFocus placeholder="Motivo: consumidor pessoa física, venda de teste, ..." value={motivoDispensa}
          onChange={e => setMotivoDispensa(e.target.value)} maxLength={255} onPressEnter={dispensar} />
      </Modal>

      <Modal open={cancelando !== null} title={`Cancelar a nota da venda ${cancelando?.idVenda ?? ''}`} okText="Cancelar nota" okButtonProps={{ danger: true, disabled: motivoCancelamento.trim().length < 15 }}
        cancelText="Voltar" onOk={cancelarNota} onCancel={() => setCancelando(null)} destroyOnHidden>
        <Text type="secondary">A SEFAZ aceita o cancelamento da NFC-e só logo após a emissão (em geral até 30 minutos). Depois, cancele a venda pela devolução.</Text>
        <Input.TextArea style={{ marginTop: 8 }} rows={2} placeholder="Justificativa (mínimo 15 caracteres)" value={motivoCancelamento}
          onChange={e => setMotivoCancelamento(e.target.value)} maxLength={255} showCount />
      </Modal>

      <Modal open={enviando !== null} title={`Enviar a nota da venda ${enviando?.idVenda ?? ''}`} okText="Enviar" cancelText="Voltar"
        onOk={enviar} onCancel={() => setEnviando(null)} destroyOnHidden>
        <Radio.Group value={canal} onChange={e => { setCanal(e.target.value); setDestino((e.target.value === 'WHATSAPP' ? enviando?.celular : enviando?.email) || ''); }}
          optionType="button" options={[{ value: 'WHATSAPP', label: 'WhatsApp' }, { value: 'EMAIL', label: 'E-mail' }]} />
        <Input style={{ marginTop: 8 }} autoFocus value={destino} onChange={e => setDestino(e.target.value)}
          placeholder={canal === 'WHATSAPP' ? 'Celular com DDD' : 'email@cliente.com'} />
        {enviando && <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap', background: '#fafafa', padding: 8, borderRadius: 6 }}>{mensagemDaNota(enviando, loja, fila?.consultaUrl || null)}</pre>}
        <Text type="secondary" style={{ fontSize: 12 }}>O contato fica gravado na nota. {canal === 'WHATSAPP' ? 'Abre o WhatsApp com a mensagem pronta.' : 'Abre o seu programa de e-mail (ou envia pelo provedor, quando ele oferece).'}</Text>
      </Modal>

      <Drawer open={historico !== null} onClose={() => setHistorico(null)} title={`Histórico da nota · venda ${historico?.nota.idVenda ?? ''}`} width={460}>
        <Timeline items={(historico?.eventos || []).map(e => ({
          color: e.sucesso ? 'green' : 'red',
          children: (
            <div>
              <b>{e.tipo.replace('_', ' ').toLowerCase()}</b> <Text type="secondary" style={{ fontSize: 12 }}>{new Date(e.criadoEm).toLocaleString('pt-BR')} · {e.operador}</Text>
              {e.mensagem && <div style={{ fontSize: 12 }}>{e.mensagem}</div>}
            </div>
          ),
        }))} />
      </Drawer>
    </Space>
  );
};

const NotasFiscais: React.FC = () => {
  const [loja, setLoja] = useState('');
  const [aba, setAba] = useState('fila');
  const aplicar = (d: DadosConfiguracao) => setLoja(d.emitente?.nomeFantasia || d.emitente?.razaoSocial || '');
  useEffect(() => { fiscalApi.configuracao().then(aplicar).catch(() => undefined); }, []);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ margin: 0 }}>Notas fiscais</Title>
      <Text type="secondary">Revise as vendas do dia, aprove e emita as notas e envie ao cliente.</Text>
      <Tabs activeKey={aba} onChange={setAba} destroyOnHidden items={[
        { key: 'fila', label: 'Notas do dia', children: <FilaNotas loja={loja} /> },
        { key: 'config', label: 'Configuração', children: <ConfiguracaoFiscal onSalvo={aplicar} /> },
      ]} />
    </div>
  );
};

export default NotasFiscais;
