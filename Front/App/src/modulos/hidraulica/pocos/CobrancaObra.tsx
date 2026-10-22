// Obras de poços › cobrança da obra (etapa 3): o resumo (contratado + adicionais aprovados, recebido, a receber), o
// sinal, os adicionais com a aprovação do cliente, as parcelas do saldo e os recebimentos. E a lista "a receber de
// obras". Tudo fica só no módulo: não passa pelo caixa nem pelo financeiro da loja.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { CheckOutlined, CloseOutlined, DollarOutlined, PlusOutlined, ReloadOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons';
import {
  Adicional, AdicionalForm, AReceberObra, cobrancaApi, CobrancaObra as Cobranca, dataBr, foneBr, FORMAS_RECEBIMENTO, FormaRecebimento, MEIOS_APROVACAO,
  MeioAprovacao, ParcelaObra, SITUACOES_ADICIONAL, SITUACOES_OBRA, SITUACOES_PARCELA, TipoAdicional, TIPOS_ADICIONAL, totaisAReceber,
} from './obrasApi';
import { abrirObra } from './navPocos';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');

const AdicionalModal: React.FC<{ aberto: Adicional | AdicionalForm | 'novo' | null; idObra: number; onFechar: () => void; onSalvo: () => void }> = ({ aberto, idObra, onFechar, onSalvo }) => {
  const [f, setF] = useState<AdicionalForm>({ tipo: 'SERVICO', descricao: '', quantidade: 1, valorUnitario: 0 });
  useEffect(() => {
    if (!aberto) return;
    setF(aberto === 'novo' ? { tipo: 'SERVICO', descricao: '', quantidade: 1, valorUnitario: 0 }
      : { tipo: aberto.tipo, descricao: aberto.descricao, quantidade: aberto.quantidade, valorUnitario: aberto.valorUnitario });
  }, [aberto]);
  const existente = aberto && aberto !== 'novo' && 'idAdicional' in aberto ? aberto : null;
  const salvar = async () => {
    try {
      if (existente) await cobrancaApi.salvarAdicional(existente.idAdicional, f); else await cobrancaApi.criarAdicional(idObra, f);
      message.success(existente ? 'Adicional salvo.' : 'Adicional lançado: aguardando a aprovação do cliente.');
      onSalvo();
    } catch (e) { erro(e); }
  };
  const total = Math.round((f.quantidade || 0) * Math.round((f.valorUnitario || 0) * 100)) / 100;
  return (
    <Modal open={!!aberto} title={existente ? 'Adicional' : 'Novo adicional'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={onFechar} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={8}>
          <Col span={9}><Text>Tipo</Text>
            <Select style={{ width: '100%' }} value={f.tipo} onChange={tipo => setF({ ...f, tipo })}
              options={(Object.keys(TIPOS_ADICIONAL) as TipoAdicional[]).map(t => ({ value: t, label: TIPOS_ADICIONAL[t] }))} />
          </Col>
          <Col span={15}><Text>Descrição</Text><Input maxLength={150} value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: 12 m excedentes, 2 conexões extras" /></Col>
        </Row>
        <Row gutter={8}>
          <Col span={8}><Text>Quantidade</Text><InputNumber min={0} style={{ width: '100%' }} decimalSeparator="," value={f.quantidade} onChange={v => setF({ ...f, quantidade: Number(v) || 0 })} /></Col>
          <Col span={8}><Text>Valor unitário</Text><InputNumber min={0} prefix="R$" precision={2} style={{ width: '100%' }} decimalSeparator="," value={f.valorUnitario} onChange={v => setF({ ...f, valorUnitario: Number(v) || 0 })} /></Col>
          <Col span={8}><Text>Total</Text><div style={{ padding: '5px 0' }}><Text strong>{brl(total)}</Text></div></Col>
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>O adicional só entra no saldo depois que o cliente aprovar (o meio da aprovação fica registrado).</Text>
      </Space>
    </Modal>
  );
};

const AprovarModal: React.FC<{ adicional: Adicional | null; onFechar: () => void; onFeito: () => void }> = ({ adicional, onFechar, onFeito }) => {
  const [meio, setMeio] = useState<MeioAprovacao | undefined>();
  const [obs, setObs] = useState('');
  useEffect(() => { setMeio(undefined); setObs(''); }, [adicional]);
  const aprovar = async () => {
    if (!adicional) return;
    if (!meio) { message.warning('Diga como o cliente aprovou.'); return; }
    try { await cobrancaApi.mudarAdicional(adicional.idAdicional, 'APROVADO', { meio, observacao: obs || null }); message.success('Aprovado: entrou no saldo da obra.'); onFeito(); }
    catch (e) { erro(e); }
  };
  return (
    <Modal open={!!adicional} title="Aprovação do cliente" okText="Registrar aprovação" cancelText="Voltar" onOk={aprovar} onCancel={onFechar} destroyOnHidden>
      {adicional && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Text>{adicional.descricao}: <Text strong>{brl(adicional.valor)}</Text></Text>
          <div><Text>Como o cliente aprovou</Text>
            <Select style={{ width: '100%' }} placeholder="Escolha" value={meio} onChange={setMeio}
              options={(Object.keys(MEIOS_APROVACAO) as MeioAprovacao[]).map(m => ({ value: m, label: MEIOS_APROVACAO[m] }))} />
          </div>
          <div><Text>Observação</Text><Input maxLength={255} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: aprovou por WhatsApp às 14h, print na pasta da obra" /></div>
        </Space>
      )}
    </Modal>
  );
};

const ReceberModal: React.FC<{ parcela: ParcelaObra | null; onFechar: () => void; onFeito: () => void }> = ({ parcela, onFechar, onFeito }) => {
  const [forma, setForma] = useState<FormaRecebimento>('PIX');
  const [valor, setValor] = useState<number>(0);
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (parcela) { setValor(parcela.saldo); setObs(''); } }, [parcela]);
  const receber = async () => {
    if (!parcela) return;
    setSalvando(true);
    try {
      const r = await cobrancaApi.receber(parcela.idParcela, { forma, valor, observacao: obs || null });
      message.success(r.status === 'PAGO' ? 'Recebido: parcela quitada.' : 'Recebido em parte.');
      onFeito();
    } catch (e) { erro(e); }
    finally { setSalvando(false); }
  };
  return (
    <Modal open={!!parcela} title={`Receber · ${parcela?.descricao || ''}`} okText="Receber" cancelText="Voltar" onOk={receber} confirmLoading={salvando}
      onCancel={onFechar} destroyOnHidden>
      {parcela && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Text>Saldo da parcela: <Text strong>{brl(parcela.saldo)}</Text></Text>
          <Row gutter={8}>
            <Col span={12}><Text>Forma</Text>
              <Select style={{ width: '100%' }} value={forma} onChange={setForma}
                options={(Object.keys(FORMAS_RECEBIMENTO) as FormaRecebimento[]).map(f => ({ value: f, label: FORMAS_RECEBIMENTO[f] }))} />
            </Col>
            <Col span={12}><Text>Valor</Text><InputNumber min={0.01} max={parcela.saldo} prefix="R$" precision={2} decimalSeparator="," style={{ width: '100%' }} value={valor} onChange={v => setValor(Number(v) || 0)} /></Col>
          </Row>
          <div><Text>Observação</Text><Input maxLength={255} value={obs} onChange={e => setObs(e.target.value)} /></div>
        </Space>
      )}
    </Modal>
  );
};

type ModoSaldo = 'VISTA' | 'PARCELADO' | 'SEM_PRAZO';
const SaldoModal: React.FC<{ aberto: boolean; idObra: number; semParcela: number; onFechar: () => void; onFeito: () => void }> = ({ aberto, idObra, semParcela, onFechar, onFeito }) => {
  const [modo, setModo] = useState<ModoSaldo>('VISTA');
  const [valor, setValor] = useState(0);
  const [qtd, setQtd] = useState(3);
  const [venc, setVenc] = useState('');
  useEffect(() => { if (aberto) { setValor(semParcela); setModo('VISTA'); setQtd(3); setVenc(''); } }, [aberto, semParcela]);
  const lancar = async () => {
    try {
      const r = await cobrancaApi.lancarParcelas(idObra, modo === 'SEM_PRAZO' ? { valor, semPrazo: true }
        : { valor, quantidade: modo === 'VISTA' ? 1 : qtd, primeiroVencimento: venc || null });
      message.success(`${r.parcelas} parcela(s) lançada(s).`);
      onFeito();
    } catch (e) { erro(e); }
  };
  return (
    <Modal open={aberto} title="Lançar o saldo da obra" okText="Lançar" cancelText="Voltar" onOk={lancar} onCancel={onFechar} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Segmented block value={modo} onChange={v => setModo(v as ModoSaldo)}
          options={[{ value: 'VISTA', label: 'À vista' }, { value: 'PARCELADO', label: 'Parcelado' }, { value: 'SEM_PRAZO', label: 'Sem prazo' }]} />
        <Row gutter={8}>
          <Col span={modo === 'PARCELADO' ? 8 : 12}><Text>Valor</Text>
            <InputNumber min={0.01} max={semParcela} prefix="R$" precision={2} decimalSeparator="," style={{ width: '100%' }} value={valor} onChange={v => setValor(Number(v) || 0)} />
          </Col>
          {modo === 'PARCELADO' && <Col span={6}><Text>Parcelas</Text><InputNumber min={2} max={36} style={{ width: '100%' }} value={qtd} onChange={v => setQtd(Number(v) || 2)} /></Col>}
          {modo !== 'SEM_PRAZO' && (
            <Col span={modo === 'PARCELADO' ? 10 : 12}><Text>{modo === 'VISTA' ? 'Vencimento' : '1º vencimento'}</Text>
              <Input type="date" value={venc} onChange={e => setVenc(e.target.value)} />
            </Col>
          )}
        </Row>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {modo === 'SEM_PRAZO' ? 'Uma parcela sem vencimento: o cliente paga quando puder e ela nunca fica vencida.'
            : modo === 'PARCELADO' ? `Parcelas iguais a cada 30 dias${venc ? '' : ' (o 1º vencimento fica para daqui a 30 dias se ficar vazio)'}.`
            : `${venc ? '' : 'Sem data, vence em 30 dias. '}Falta parcelar ${brl(semParcela)}.`}
        </Text>
      </Space>
    </Modal>
  );
};

/** A cobrança de uma obra (fica dentro da obra aberta). */
export const CobrancaDaObra: React.FC<{ idObra: number; cancelada: boolean; onMudou?: () => void }> = ({ idObra, cancelada, onMudou }) => {
  const [c, setC] = useState<Cobranca | null>(null);
  const [adicional, setAdicional] = useState<Adicional | AdicionalForm | 'novo' | null>(null);
  const [aprovando, setAprovando] = useState<Adicional | null>(null);
  const [recebendo, setRecebendo] = useState<ParcelaObra | null>(null);
  const [saldo, setSaldo] = useState(false);
  const [estorno, setEstorno] = useState<{ id: number; motivo: string } | null>(null);
  const carregar = useCallback(() => cobrancaApi.daObra(idObra).then(setC).catch(erro), [idObra]);
  useEffect(() => { carregar(); }, [carregar]);
  const feito = () => { setAdicional(null); setAprovando(null); setRecebendo(null); setSaldo(false); setEstorno(null); carregar(); onMudou?.(); };
  const mudar = async (a: Adicional, s: 'RECUSADO' | 'CANCELADO' | 'PENDENTE') => {
    try { await cobrancaApi.mudarAdicional(a.idAdicional, s); feito(); } catch (e) { erro(e); }
  };
  const estornar = async () => {
    if (!estorno) return;
    if (!estorno.motivo.trim()) { message.warning('Informe o motivo do estorno.'); return; }
    try { await cobrancaApi.estornar(estorno.id, estorno.motivo); message.success('Estornado: a parcela reabriu.'); feito(); } catch (e) { erro(e); }
  };
  if (!c) return <Card size="small" loading />;
  const r = c.resumo;
  const sinal = c.parcelas.find(p => p.tipo === 'SINAL' && p.status !== 'CANCELADO');
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Row gutter={[10, 10]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Total da obra" value={r.total} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." />
          <Text type="secondary" style={{ fontSize: 12 }}>{brl(r.contratado)} contrato{r.adicionaisAprovados ? ` + ${brl(r.adicionaisAprovados)} adicionais` : ''}</Text></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Recebido" value={r.recebido} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="A receber" value={r.aReceber} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." valueStyle={r.aReceber > 0 ? { color: '#d48806' } : undefined} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Falta parcelar" value={r.semParcela} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." />
          {r.adicionaisPendentes > 0 && <Text type="secondary" style={{ fontSize: 12 }}>+ {brl(r.adicionaisPendentes)} aguardando o cliente</Text>}</Card></Col>
      </Row>
      {r.sinal > 0 && (
        <Alert showIcon type={sinal?.status === 'PAGO' ? 'success' : c.sinalQuando === 'NO_ATO' ? 'info' : 'warning'}
          message={sinal?.status === 'PAGO' ? `Sinal de ${brl(r.sinal)} recebido.`
            : c.sinalQuando === 'NO_ATO' ? `Sinal de ${brl(r.sinal)} combinado para o dia da perfuração.`
            : `Sinal de ${brl(r.sinal)}: a obra só começa com ele recebido.`}
          action={sinal && sinal.status === 'ABERTO' ? <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => setRecebendo(sinal)}>Receber o sinal</Button> : undefined} />
      )}
      {c.sugestao && !cancelada && (
        <Alert showIcon type="info" message={`Metro excedente: ${c.sugestao.descricao} = ${brl(c.sugestao.valor)}`}
          description="O relatório mostra mais metros que os previstos. Lance o adicional e registre a aprovação do cliente."
          action={<Button size="small" onClick={() => setAdicional(c.sugestao)}>Lançar adicional</Button>} />
      )}
      <Card size="small" title="Adicionais" extra={!cancelada && <Button size="small" icon={<PlusOutlined />} onClick={() => setAdicional('novo')}>Novo adicional</Button>}>
        <Table<Adicional> size="small" rowKey="idAdicional" dataSource={c.adicionais} pagination={false}
          locale={{ emptyText: 'Nenhum adicional' }}
          columns={[
            { title: 'Adicional', render: (_, a) => <><Text>{a.descricao}</Text><div><Text type="secondary" style={{ fontSize: 12 }}>{TIPOS_ADICIONAL[a.tipo]} · {String(a.quantidade).replace('.', ',')} × {brl(a.valorUnitario)}</Text></div></> },
            { title: 'Valor', width: 120, align: 'right', render: (_, a) => <Text delete={a.situacao === 'CANCELADO' || a.situacao === 'RECUSADO'}>{brl(a.valor)}</Text> },
            {
              title: 'Aprovação', width: 230, render: (_, a) => (
                <>
                  <Tag color={SITUACOES_ADICIONAL[a.situacao].cor}>{SITUACOES_ADICIONAL[a.situacao].texto}</Tag>
                  {a.aprovacaoMeio && <div><Text type="secondary" style={{ fontSize: 12 }}>{MEIOS_APROVACAO[a.aprovacaoMeio]} · {a.aprovadoEm ? `${dataBr(a.aprovadoEm)} ${a.aprovadoEm.slice(11)}` : ''}{a.aprovacaoObs ? ` · ${a.aprovacaoObs}` : ''}</Text></div>}
                </>
              ),
            },
            {
              title: '', width: 150, align: 'right', render: (_, a) => (
                <Space size={2}>
                  {a.situacao === 'PENDENTE' && <>
                    <Tooltip title="Cliente aprovou"><Button size="small" type="text" icon={<CheckOutlined style={{ color: '#389e0d' }} />} onClick={() => setAprovando(a)} /></Tooltip>
                    <Tooltip title="Cliente recusou"><Button size="small" type="text" icon={<CloseOutlined />} onClick={() => mudar(a, 'RECUSADO')} /></Tooltip>
                    <Button size="small" type="link" onClick={() => setAdicional(a)}>editar</Button>
                  </>}
                  {a.situacao === 'APROVADO' && (
                    <Popconfirm title="Cancelar o adicional aprovado?" description="Ele sai do saldo; se o saldo já foi parcelado, ajuste as parcelas." okText="Cancelar adicional" cancelText="Voltar" onConfirm={() => mudar(a, 'CANCELADO')}>
                      <Tooltip title="Cancelar"><Button size="small" type="text" danger icon={<StopOutlined />} /></Tooltip>
                    </Popconfirm>
                  )}
                  {(a.situacao === 'RECUSADO' || a.situacao === 'CANCELADO') && <Tooltip title="Voltar para aguardando o cliente"><Button size="small" type="text" icon={<RollbackOutlined />} onClick={() => mudar(a, 'PENDENTE')} /></Tooltip>}
                </Space>
              ),
            },
          ]} />
      </Card>
      <Card size="small" title="Parcelas"
        extra={!cancelada && r.semParcela > 0 && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setSaldo(true)}>Lançar saldo ({brl(r.semParcela)})</Button>}>
        {r.semParcela < 0 && <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={`As parcelas passam do total da obra em ${brl(-r.semParcela)} (um adicional foi cancelado ou o contrato mudou): cancele ou ajuste uma parcela.`} />}
        <Table<ParcelaObra> size="small" rowKey="idParcela" dataSource={c.parcelas} pagination={false}
          locale={{ emptyText: 'Nenhuma parcela: lance o sinal nos dados da obra e o saldo aqui' }}
          columns={[
            { title: 'Parcela', render: (_, p) => <Text delete={p.status === 'CANCELADO'}>{p.descricao}</Text> },
            { title: 'Vencimento', width: 110, render: (_, p) => (p.vencimento ? dataBr(p.vencimento) : <Text type="secondary">sem prazo</Text>) },
            { title: 'Valor', width: 110, align: 'right', render: (_, p) => brl(p.valor) },
            { title: 'Pago', width: 110, align: 'right', render: (_, p) => (p.valorPago ? brl(p.valorPago) : '—') },
            { title: 'Situação', width: 130, render: (_, p) => <Tag color={SITUACOES_PARCELA[p.situacao].cor}>{SITUACOES_PARCELA[p.situacao].texto}{p.diasAtraso ? ` · ${p.diasAtraso} d` : ''}</Tag> },
            {
              title: '', width: 130, align: 'right', render: (_, p) => p.status === 'ABERTO' && (
                <Space size={2}>
                  <Button size="small" type="primary" ghost icon={<DollarOutlined />} onClick={() => setRecebendo(p)}>Receber</Button>
                  {p.tipo === 'SALDO' && !p.valorPago && (
                    <Popconfirm title="Cancelar a parcela?" description="O valor volta para o 'falta parcelar'." okText="Cancelar parcela" cancelText="Voltar"
                      onConfirm={async () => { try { await cobrancaApi.cancelarParcela(p.idParcela); feito(); } catch (e) { erro(e); } }}>
                      <Button size="small" type="text" danger icon={<StopOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]} />
      </Card>
      <Card size="small" title="Recebimentos">
        <Table size="small" rowKey="idRecebimento" dataSource={c.recebimentos} pagination={false} locale={{ emptyText: 'Nada recebido ainda' }}
          columns={[
            { title: 'Quando', width: 140, render: (_, x: Cobranca['recebimentos'][number]) => `${dataBr(x.em)} ${x.em.slice(11)}` },
            { title: 'Parcela', render: (_, x: Cobranca['recebimentos'][number]) => <>{x.parcela}{x.observacao ? <Text type="secondary"> · {x.observacao}</Text> : null}</> },
            { title: 'Forma', width: 110, render: (_, x: Cobranca['recebimentos'][number]) => FORMAS_RECEBIMENTO[x.forma] },
            { title: 'Valor', width: 110, align: 'right', render: (_, x: Cobranca['recebimentos'][number]) => <Text delete={!!x.estornadoEm}>{brl(x.valor)}</Text> },
            {
              title: '', width: 160, align: 'right', render: (_, x: Cobranca['recebimentos'][number]) => (x.estornadoEm
                ? <Tooltip title={x.estornoMotivo}><Tag>estornado {dataBr(x.estornadoEm)}</Tag></Tooltip>
                : <Button size="small" type="text" danger onClick={() => setEstorno({ id: x.idRecebimento, motivo: '' })}>Estornar</Button>),
            },
          ]} />
      </Card>
      <AdicionalModal aberto={adicional} idObra={idObra} onFechar={() => setAdicional(null)} onSalvo={feito} />
      <AprovarModal adicional={aprovando} onFechar={() => setAprovando(null)} onFeito={feito} />
      <ReceberModal parcela={recebendo} onFechar={() => setRecebendo(null)} onFeito={feito} />
      <SaldoModal aberto={saldo} idObra={idObra} semParcela={r.semParcela} onFechar={() => setSaldo(false)} onFeito={feito} />
      <Modal open={!!estorno} title="Estornar o recebimento" okText="Estornar" okButtonProps={{ danger: true }} cancelText="Voltar" onOk={estornar} onCancel={() => setEstorno(null)} destroyOnHidden>
        <Text>O recebimento fica marcado como estornado e a parcela reabre.</Text>
        <Input style={{ marginTop: 8 }} placeholder="Motivo (obrigatório)" value={estorno?.motivo || ''} onChange={e => setEstorno(s => (s ? { ...s, motivo: e.target.value } : s))} />
      </Modal>
    </Space>
  );
};

/** "A receber de obras": as parcelas em aberto de todas as obras (vencidas primeiro). */
export const AReceberObras: React.FC = () => {
  const [lista, setLista] = useState<AReceberObra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<'TODAS' | 'VENCIDO' | 'A_VENCER' | 'SEM_PRAZO'>('TODAS');
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await cobrancaApi.aReceber()); } catch (e) { erro(e); } finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const t = totaisAReceber(lista);
  const visiveis = lista.filter(p => filtro === 'TODAS' || (filtro === 'A_VENCER' ? p.situacao === 'A_VENCER' || p.situacao === 'VENCE_HOJE' : p.situacao === filtro));
  const cartao = (chave: typeof filtro, titulo: string, valor: number, cor?: string) => (
    <Col xs={12} md={6}>
      <Card size="small" hoverable onClick={() => setFiltro(filtro === chave ? 'TODAS' : chave)} style={filtro === chave ? { borderColor: '#1677ff' } : undefined}>
        <Statistic title={titulo} value={valor} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." valueStyle={cor && valor ? { color: cor } : undefined} />
      </Card>
    </Col>
  );
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {cartao('TODAS', 'Total a receber', t.total)}
        {cartao('VENCIDO', 'Vencido', t.VENCIDO, '#cf1322')}
        {cartao('A_VENCER', 'A vencer', t.A_VENCER + t.VENCE_HOJE)}
        {cartao('SEM_PRAZO', 'Sem prazo', t.SEM_PRAZO, '#722ed1')}
      </Row>
      <Card size="small" title="Parcelas em aberto das obras" extra={<Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>}>
        <Table<AReceberObra> size="small" rowKey="idParcela" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada a receber" /> }}
          onRow={p => ({ onClick: () => abrirObra(p.idObra, 'COBRANCA'), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Cliente', render: (_, p) => <><Text strong>{p.cliente}</Text>{p.telefone ? <Text type="secondary" style={{ fontSize: 12 }}> · {foneBr(p.telefone)}</Text> : null}</> },
            { title: 'Obra', render: (_, p) => <>{p.descricao}{p.obra ? <Text type="secondary" style={{ fontSize: 12 }}> · {p.obra}</Text> : null} <Tag style={{ marginLeft: 4 }}>{SITUACOES_OBRA[p.obraSituacao].texto}</Tag></> },
            { title: 'Vencimento', width: 110, render: (_, p) => (p.vencimento ? dataBr(p.vencimento) : <Text type="secondary">sem prazo</Text>) },
            { title: 'Saldo', width: 120, align: 'right', render: (_, p) => <Text strong>{brl(p.saldo)}</Text> },
            { title: 'Situação', width: 140, render: (_, p) => <Tag color={SITUACOES_PARCELA[p.situacao].cor}>{SITUACOES_PARCELA[p.situacao].texto}{p.diasAtraso ? ` · ${p.diasAtraso} d` : ''}</Tag> },
          ]} />
      </Card>
    </Space>
  );
};
