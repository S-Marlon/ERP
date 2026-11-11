// Obras de poços › clientes de poço: cadastro próprio do módulo (separado do cadastro geral do ERP). A escolha do
// cliente na obra (com cadastro rápido), a lista com busca e filtros, e a ficha completa: dados com a qualificação para o
// contrato (PF/PJ, RG, estado civil, representante), contratos, poços, financeiro, linha do tempo e a prévia do plano mensal.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Drawer, Empty, Input, List, Modal, Row, Segmented, Select, Space, Statistic, Table, Tabs, Tag, Timeline, Tooltip, Typography, message,
} from 'antd';
import { CalculatorOutlined, EnvironmentOutlined, PlusOutlined, ReloadOutlined, UserAddOutlined, WhatsAppOutlined } from '@ant-design/icons';
import {
  ClienteCompleto, ClientePoco, ClientePocoForm, dataBr, ESTADOS_CIVIS, FiltroClientes, foneBr, obrasApi, SERVICOS, SITUACOES_OBRA,
} from './obrasApi';
import { abrirFichaPoco, abrirObra, verClienteNoMapa } from './navPocos';
import { OrcamentoRapido } from './OrcamentoContrato';

const { Text } = Typography;

const vazio = (): ClientePocoForm => ({
  nome: '', tipoPessoa: 'PF', telefone: null, telefone2: null, documento: null, rgIe: null, estadoCivil: null, profissao: null, email: null, endereco: null,
  bairro: null, cidade: null, uf: null, cep: null, representante: null, representanteDocumento: null, observacao: null,
});
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const docBr = (d: string | null | undefined) => {
  const x = String(d ?? '').replace(/\D/g, '');
  return x.length === 14 ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}`
    : x.length === 11 ? `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}` : x;
};

/** Escolher o cliente da obra (ou do poço): busca por nome, telefone, documento ou cidade, e cadastro rápido. */
export const ClientePocoModal: React.FC<{ open: boolean; onSelecionar: (c: ClientePoco) => void; onFechar: () => void }> = ({ open, onSelecionar, onFechar }) => {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<ClientePoco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; telefone: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (open) { setBusca(''); setNovo(null); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setCarregando(true);
      obrasApi.clientes(busca).then(setLista).catch(e => message.error(e.message)).finally(() => setCarregando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, busca]);
  const cadastrar = async () => {
    if (!novo) return;
    setSalvando(true);
    try { onSelecionar(await obrasApi.criarCliente({ nome: novo.nome, telefone: novo.telefone || null })); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setSalvando(false); }
  };
  const comecarNovo = () => {
    const soDigitos = busca.replace(/\D/g, '');
    setNovo(soDigitos.length >= 8 && soDigitos.length === busca.replace(/[\s()-]/g, '').length ? { nome: '', telefone: busca } : { nome: busca, telefone: '' });
  };
  return (
    <Modal open={open} title="Cliente de poço" footer={null} onCancel={onFechar} width={620} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Input autoFocus allowClear placeholder="Nome, telefone, CPF/CNPJ ou cidade" value={busca} onChange={e => setBusca(e.target.value)} />
        <List size="small" loading={carregando} dataSource={lista} style={{ maxHeight: 320, overflow: 'auto' }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={busca ? 'Ninguém com essa busca' : 'Nenhum cliente de poço ainda'} /> }}
          renderItem={c => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => onSelecionar(c)} extra={<Text type="secondary" style={{ fontSize: 12 }}>{c.pocos} poço(s) · {c.obras} obra(s)</Text>}>
              <List.Item.Meta title={c.nome} description={[foneBr(c.telefone), c.cidade].filter(Boolean).join(' · ') || '—'} />
            </List.Item>
          )} />
        {!novo
          ? <Button block icon={<UserAddOutlined />} onClick={comecarNovo}>Cadastrar cliente novo{busca ? ` "${busca}"` : ''}</Button>
          : (
            <Card size="small" title="Cliente novo (o resto da ficha dá para completar depois)">
              <Row gutter={8} align="bottom">
                <Col span={12}><Text>Nome</Text><Input autoFocus value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></Col>
                <Col span={7}><Text>Telefone</Text><Input value={novo.telefone} placeholder="(11) 99999-9999" onChange={e => setNovo({ ...novo, telefone: e.target.value })} /></Col>
                <Col span={5}><Button type="primary" block loading={salvando} disabled={!novo.nome.trim()} onClick={cadastrar}>Cadastrar</Button></Col>
              </Row>
            </Card>
          )}
      </Space>
    </Modal>
  );
};

/** Dados do cliente (editáveis), com o que o contrato precisa. */
const DadosCliente: React.FC<{ f: ClientePocoForm; mudar: (x: Partial<ClientePocoForm>) => void }> = ({ f, mudar }) => {
  const campo = (k: keyof ClientePocoForm, rotulo: string, span: number, props: object = {}) => (
    <Col xs={24} md={span}><Text>{rotulo}</Text><Input value={(f[k] as string) || ''} onChange={e => mudar({ [k]: e.target.value || null } as Partial<ClientePocoForm>)} {...props} /></Col>
  );
  const pj = f.tipoPessoa === 'PJ';
  return (
    <Row gutter={[8, 8]}>
      <Col xs={24} md={5}><Text>Tipo</Text>
        <Segmented block value={f.tipoPessoa} onChange={v => mudar({ tipoPessoa: v as 'PF' | 'PJ' })} options={[{ value: 'PF', label: 'Pessoa' }, { value: 'PJ', label: 'Empresa' }]} />
      </Col>
      {campo('nome', pj ? 'Razão social' : 'Nome completo', 12, { maxLength: 120 })}
      <Col xs={24} md={7}><Text>{pj ? 'CNPJ' : 'CPF'}</Text><Input value={docBr(f.documento) || f.documento || ''} onChange={e => mudar({ documento: e.target.value || null })} /></Col>
      {campo('rgIe', pj ? 'Inscrição estadual' : 'RG', 6, { maxLength: 20 })}
      {!pj && (
        <Col xs={24} md={6}><Text>Estado civil</Text>
          <Select allowClear style={{ width: '100%' }} value={f.estadoCivil || undefined} onChange={v => mudar({ estadoCivil: v || null })}
            options={ESTADOS_CIVIS.map(e => ({ value: e, label: e }))} />
        </Col>
      )}
      {!pj && campo('profissao', 'Profissão', 12, { maxLength: 60 })}
      {pj && campo('representante', 'Representante (quem assina)', 11, { maxLength: 120 })}
      {pj && (
        <Col xs={24} md={7}><Text>CPF do representante</Text>
          <Input value={docBr(f.representanteDocumento) || f.representanteDocumento || ''} onChange={e => mudar({ representanteDocumento: e.target.value || null })} />
        </Col>
      )}
      <Col xs={12} md={6}><Text>Telefone (WhatsApp)</Text><Input value={foneBr(f.telefone) || f.telefone || ''} onChange={e => mudar({ telefone: e.target.value || null })} /></Col>
      <Col xs={12} md={6}><Text>Outro telefone</Text><Input value={foneBr(f.telefone2) || f.telefone2 || ''} onChange={e => mudar({ telefone2: e.target.value || null })} /></Col>
      {campo('email', 'E-mail', 12, { maxLength: 120 })}
      {campo('endereco', 'Endereço', 10, { maxLength: 150 })}
      {campo('bairro', 'Bairro', 5, { maxLength: 60 })}
      {campo('cidade', 'Cidade', 4, { maxLength: 60 })}
      {campo('uf', 'UF', 2, { maxLength: 2 })}
      {campo('cep', 'CEP', 3, { maxLength: 9 })}
      {campo('observacao', 'Observação', 24, { maxLength: 255 })}
    </Row>
  );
};

const COR_TEMPO: Record<ClienteCompleto['linhaDoTempo'][number]['tipo'], string> = { CONTATO: 'blue', OBRA: 'green', PROCESSO: 'gray', ALERTA: 'red' };
const FAIXA: Record<string, string> = { ALTA: 'alta', MEDIA: 'média', BAIXA: 'baixa' };

/** Ficha completa do cliente de poço. */
export const ClienteFicha: React.FC<{ idCliente: number | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ idCliente, onFechar, onSalvo }) => {
  const [f, setF] = useState(vazio());
  const [d, setD] = useState<ClienteCompleto | null>(null);
  const [aba, setAba] = useState('DADOS');
  const [salvando, setSalvando] = useState(false);
  const [orcamento, setOrcamento] = useState(false);
  const carregar = useCallback(() => {
    if (!idCliente || idCliente === 'novo') return;
    obrasApi.clienteCompleto(idCliente).then(r => { setD(r); setF({ ...r.cliente }); }).catch(e => message.error(e.message));
  }, [idCliente]);
  useEffect(() => {
    setD(null); setAba('DADOS');
    if (idCliente === 'novo') setF(vazio()); else carregar();
  }, [idCliente, carregar]);
  const mudar = (x: Partial<ClientePocoForm>) => setF(a => ({ ...a, ...x }));
  const salvar = async () => {
    setSalvando(true);
    try {
      if (idCliente === 'novo') await obrasApi.criarCliente(f); else if (idCliente) await obrasApi.salvarCliente(idCliente, f);
      message.success('Cliente salvo.');
      carregar();
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setSalvando(false); }
  };
  const ir = (fn: () => void) => { onFechar(); fn(); };
  const r = d?.resumo;
  const digitos = String(f.telefone || '').replace(/\D/g, '');
  const whats = digitos.length >= 10 ? `https://wa.me/55${digitos}` : null;
  const abas = [
    { key: 'DADOS', label: 'Dados', children: <DadosCliente f={f} mudar={mudar} /> },
    ...(d ? [
      {
        key: 'CONTRATOS', label: `Contratos (${d.contratos.length})`, children: (
          <Table size="small" rowKey="idObra" pagination={false} dataSource={d.contratos} locale={{ emptyText: 'Nenhum orçamento ou obra.' }}
            onRow={o => ({ onClick: () => ir(() => abrirObra(o.idObra, 'ORCAMENTO')), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'Nº', dataIndex: 'idObra', width: 60 },
              {
                title: 'Obra', render: (_, o) => (
                  <>{o.titulo}<div><Text type="secondary" style={{ fontSize: 12 }}>{o.servicos.map(s => SERVICOS[s]).join(' + ')}{o.poco ? ` · ${o.poco}` : ''} · {dataBr(o.criadaEm)}</Text></div></>
                ),
              },
              {
                title: 'Situação', width: 170, render: (_, o) => (
                  <><Tag color={SITUACOES_OBRA[o.situacao].cor}>{SITUACOES_OBRA[o.situacao].texto}</Tag>{o.contratoAssinado && <Tag color="green">assinado</Tag>}{o.aditivos > 0 && <Tag>{o.aditivos} aditivo(s)</Tag>}</>
                ),
              },
              { title: 'Total', width: 110, align: 'right', render: (_, o) => brl(o.total) },
              { title: 'A receber', width: 110, align: 'right', render: (_, o) => (o.aReceber ? <Text type={o.vencido ? 'danger' : undefined}>{brl(o.aReceber)}</Text> : '—') },
              { title: 'Garantia até', width: 100, render: (_, o) => dataBr(o.garantiaAte) },
            ]} />
        ),
      },
      {
        key: 'POCOS', label: `Poços (${d.pocos.length})`, children: (
          <List size="small" dataSource={d.pocos} locale={{ emptyText: 'Nenhum poço.' }} renderItem={p => (
            <List.Item style={{ cursor: 'pointer' }} onClick={() => ir(() => abrirFichaPoco(p.idPoco))}
              extra={<Space size={4}>{p.iot && <Tag color="purple">sensores</Tag>}{p.planos > 0 && <Tag color="cyan">plano de manutenção</Tag>}<Tag>{p.situacao.toLowerCase()}</Tag></Space>}>
              <List.Item.Meta title={p.identificacao} description={[
                p.profundidadeM && `${p.profundidadeM} m`, p.vazaoLh && `${p.vazaoLh.toLocaleString('pt-BR')} L/h`, p.nivelEstaticoM !== null && `NE ${p.nivelEstaticoM} m`,
                p.nivelDinamicoM !== null && `ND ${p.nivelDinamicoM} m`, p.diametro, p.dataPerfuracao && `perfurado em ${dataBr(p.dataPerfuracao)}`, p.cidade,
                p.latitude === null && 'sem GPS', `${p.obras} obra(s)`,
              ].filter(Boolean).join(' · ')} />
            </List.Item>
          )} />
        ),
      },
      {
        key: 'FINANCEIRO', label: 'Financeiro', children: (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>Parcelas em aberto</Text>
            <Table size="small" rowKey="idParcela" pagination={false} dataSource={d.parcelas} locale={{ emptyText: 'Nada a receber.' }}
              onRow={p => ({ onClick: () => ir(() => abrirObra(p.idObra, 'COBRANCA')), style: { cursor: 'pointer' } })}
              columns={[
                { title: 'Obra', dataIndex: 'idObra', width: 60 }, { title: 'Parcela', dataIndex: 'descricao' },
                { title: 'Vencimento', width: 110, render: (_, p) => <Text type={p.vencida ? 'danger' : undefined}>{dataBr(p.vencimento)}</Text> },
                { title: 'Saldo', width: 110, align: 'right', render: (_, p) => brl(p.saldo) },
              ]} />
            <Text strong>Recebimentos</Text>
            <Table size="small" rowKey={x => `${x.em}-${x.idObra}-${x.valor}-${x.descricao}`} pagination={{ pageSize: 10, hideOnSinglePage: true }} dataSource={d.recebimentos}
              locale={{ emptyText: 'Nenhum recebimento.' }}
              columns={[
                { title: 'Quando', width: 140, render: (_, x) => `${dataBr(x.em)} ${x.em.slice(11)}` }, { title: 'Obra', dataIndex: 'idObra', width: 60 },
                { title: 'Parcela', dataIndex: 'descricao' }, { title: 'Forma', dataIndex: 'forma', width: 120 },
                { title: 'Valor', width: 110, align: 'right', render: (_, x) => brl(x.valor) },
              ]} />
          </Space>
        ),
      },
      {
        key: 'TEMPO', label: 'Linha do tempo', children: d.linhaDoTempo.length ? (
          <Timeline style={{ marginTop: 8 }} items={d.linhaDoTempo.map(e => ({
            color: COR_TEMPO[e.tipo],
            children: (
              <div style={{ cursor: e.idObra ? 'pointer' : undefined }} onClick={() => { if (e.idObra) ir(() => abrirObra(e.idObra!)); }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{dataBr(e.data)}</Text> <Text strong>{e.titulo}</Text>
                {e.detalhe && <div><Text type="secondary" style={{ fontSize: 12 }}>{e.detalhe}</Text></div>}
              </div>
            ),
          }))} />
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nada registrado ainda." />,
      },
      {
        key: 'PLANO', label: 'Plano mensal', children: d.plano ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row gutter={12}>
              <Col span={8}><Statistic title="Chance de assinar" value={FAIXA[d.plano.faixa]} suffix={`· ${d.plano.pontos} pts`} /></Col>
              <Col span={8}><Statistic title="Estimativa" value={brl(d.plano.estimativa.valorMensal)} suffix="/mês" /></Col>
              <Col span={8}><Statistic title="Faixa" value={`${brl(d.plano.estimativa.minimo)} a ${brl(d.plano.estimativa.maximo)}`} valueStyle={{ fontSize: 16 }} /></Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>{d.plano.estimativa.base}</Text>
            <List size="small" header={<Text strong>Por quê</Text>} dataSource={d.plano.motivos} renderItem={m => (
              <List.Item><Text>{m.texto}</Text><Tag color={m.pontos >= 0 ? 'green' : 'red'}>{m.pontos > 0 ? '+' : ''}{m.pontos}</Tag></List.Item>
            )} />
          </Space>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sem poço cadastrado: ainda não entra na prévia do plano." />,
      },
    ] : []),
  ];
  return (
    <Drawer open={!!idCliente} onClose={onFechar} width={1000} destroyOnHidden
      title={idCliente === 'novo' ? 'Novo cliente de poço' : d?.cliente.nome || 'Cliente'}
      extra={<Space>
        {whats && <Button icon={<WhatsAppOutlined />} onClick={() => window.open(whats, '_blank')}>WhatsApp</Button>}
        {d && <Button icon={<EnvironmentOutlined />} disabled={!d.pocos.some(p => p.latitude !== null)} onClick={() => ir(() => verClienteNoMapa(d.cliente.idCliente))}>Mapa</Button>}
        {d && <Button icon={<CalculatorOutlined />} onClick={() => setOrcamento(true)}>Novo orçamento</Button>}
        <Button type="primary" loading={salvando} onClick={salvar}>Salvar dados</Button>
      </Space>}>
      {r && (
        <Row gutter={12} style={{ marginBottom: 8 }}>
          <Col xs={12} md={5}><Statistic title="Contratos" value={r.contratos} suffix={r.abertos ? `· ${r.abertos} em aberto` : ''} /></Col>
          <Col xs={12} md={5}><Statistic title="Contratado" value={brl(r.valorTotal)} valueStyle={{ fontSize: 18 }} /></Col>
          <Col xs={12} md={5}><Statistic title="Recebido" value={brl(r.recebido)} valueStyle={{ fontSize: 18 }} /></Col>
          <Col xs={12} md={5}><Statistic title="A receber" value={brl(r.aReceber)} valueStyle={{ fontSize: 18, color: r.vencido ? '#cf1322' : undefined }} /></Col>
          <Col xs={12} md={4}><Statistic title="Poços" value={r.pocos} /></Col>
        </Row>
      )}
      {d && (!f.documento || !f.endereco) && (
        <Alert type="warning" showIcon style={{ marginBottom: 8 }}
          message={`Para o contrato falta: ${[!f.documento && (f.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'), !f.endereco && 'endereço'].filter(Boolean).join(' e ')}.`} />
      )}
      <Tabs activeKey={aba} onChange={setAba} items={abas} />
      {d && (
        <OrcamentoRapido aberto={orcamento} cliente={{ idCliente: d.cliente.idCliente, nome: d.cliente.nome }} onFechar={() => setOrcamento(false)}
          onCriado={id => { onFechar(); abrirObra(id, 'ORCAMENTO'); }} />
      )}
    </Drawer>
  );
};

const FILTROS: { value: FiltroClientes | 'TODOS'; label: string }[] = [
  { value: 'TODOS', label: 'Todos' }, { value: 'ABERTA', label: 'Com obra aberta' }, { value: 'VENCIDO', label: 'Com vencido' }, { value: 'SEM_TELEFONE', label: 'Sem telefone' },
];

export const ListaClientes: React.FC<{ abrir?: number; pedido?: number }> = ({ abrir, pedido }) => {
  const [lista, setLista] = useState<ClientePoco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [cidade, setCidade] = useState('');
  const [filtro, setFiltro] = useState<FiltroClientes | 'TODOS'>('TODOS');
  const [aberto, setAberto] = useState<number | 'novo' | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await obrasApi.clientes(busca, { cidade, filtro: filtro === 'TODOS' ? null : filtro })); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [busca, cidade, filtro]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);
  useEffect(() => { if (abrir) setAberto(abrir); }, [abrir, pedido]);
  return (
    <Card size="small"
      title={<Space wrap>
        <Input allowClear placeholder="Nome, telefone, CPF/CNPJ ou representante" style={{ width: 280 }} value={busca} onChange={e => setBusca(e.target.value)} />
        <Input allowClear placeholder="Cidade" style={{ width: 140 }} value={cidade} onChange={e => setCidade(e.target.value)} />
        <Segmented size="small" value={filtro} onChange={v => setFiltro(v as typeof filtro)} options={FILTROS} />
      </Space>}
      extra={<Space>
        <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo cliente</Button>
      </Space>}>
      <Alert type="info" showIcon style={{ marginBottom: 8 }}
        message="Os clientes de poço têm cadastro próprio, separado dos clientes da loja. Clique num cliente para ver contratos, poços, financeiro e a linha do tempo." />
      <Table<ClientePoco>
        size="small" rowKey="idCliente" loading={carregando} dataSource={lista} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum cliente de poço com esse filtro" /> }}
        onRow={c => ({ onClick: () => setAberto(c.idCliente), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Cliente', render: (_, c) => (
              <><Text strong>{c.nome}</Text>{c.tipoPessoa === 'PJ' && <Tag style={{ marginLeft: 6 }}>empresa</Tag>}
                {c.documento ? <Text type="secondary" style={{ fontSize: 12 }}> · {docBr(c.documento)}</Text> : null}</>
            ),
          },
          { title: 'Telefone', width: 150, render: (_, c) => foneBr(c.telefone) || '—' },
          { title: 'Cidade', width: 160, render: (_, c) => (c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : '—') },
          { title: 'Poços', dataIndex: 'pocos', width: 70, align: 'center' },
          { title: 'Obras', width: 110, align: 'center', render: (_, c) => <>{c.obras}{c.obrasAbertas ? <Tag color="processing" style={{ marginLeft: 6 }}>{c.obrasAbertas} aberta(s)</Tag> : null}</> },
          { title: 'A receber', width: 120, align: 'right', render: (_, c) => (c.aReceber ? <Text type={c.vencido ? 'danger' : undefined}>{brl(c.aReceber)}</Text> : '—') },
          {
            title: '', width: 60, align: 'center', render: (_, c) => (
              <Tooltip title={c.pocosComGps ? 'Ver os poços no mapa' : 'Nenhum poço com GPS'}>
                <Button size="small" type="text" icon={<EnvironmentOutlined />} disabled={!c.pocosComGps}
                  onClick={e => { e.stopPropagation(); verClienteNoMapa(c.idCliente); }} />
              </Tooltip>
            ),
          },
        ]}
      />
      <ClienteFicha idCliente={aberto} onFechar={() => setAberto(null)} onSalvo={() => { carregar(); if (aberto === 'novo') setAberto(null); }} />
    </Card>
  );
};
