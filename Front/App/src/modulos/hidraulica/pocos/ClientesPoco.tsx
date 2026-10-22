// Obras de poços › clientes de poço: cadastro próprio do módulo (separado do cadastro geral do ERP por enquanto).
// A escolha do cliente na obra (com cadastro rápido de nome e telefone), a lista e a ficha com os poços e as obras dele.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Empty, Input, List, Modal, Row, Space, Table, Tag, Tooltip, Typography, message } from 'antd';
import { EnvironmentOutlined, PlusOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons';
import { ClientePoco, ClientePocoForm, foneBr, Obra, obrasApi, Poco, SERVICOS, SITUACOES_OBRA } from './obrasApi';
import { abrirObra, abrirPoco, verClienteNoMapa } from './navPocos';

const { Text } = Typography;

const vazio = (): ClientePocoForm => ({ nome: '', telefone: null, documento: null, email: null, endereco: null, bairro: null, cidade: null, uf: null, observacao: null });

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

/** Ficha do cliente: dados (editáveis), os poços e as obras dele, e "ver no mapa". */
export const ClienteFicha: React.FC<{ idCliente: number | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ idCliente, onFechar, onSalvo }) => {
  const [f, setF] = useState(vazio());
  const [cliente, setCliente] = useState<ClientePoco | null>(null);
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  useEffect(() => {
    setCliente(null); setPocos([]); setObras([]);
    if (idCliente === 'novo') { setF(vazio()); return; }
    if (!idCliente) return;
    obrasApi.cliente(idCliente).then(c => { setCliente(c); setF({ ...c }); }).catch(e => message.error(e.message));
    obrasApi.pocos({ idProprietario: idCliente }).then(setPocos).catch(() => setPocos([]));
    obrasApi.obrasDe({ idCliente }).then(setObras).catch(() => setObras([]));
  }, [idCliente]);
  const mudar = (x: Partial<ClientePocoForm>) => setF(a => ({ ...a, ...x }));
  const campo = (k: keyof ClientePocoForm, rotulo: string, span: number, props: object = {}) => (
    <Col span={span}><Text>{rotulo}</Text><Input value={(f[k] as string) || ''} onChange={e => mudar({ [k]: e.target.value || null } as any)} {...props} /></Col>
  );
  const salvar = async () => {
    try {
      if (idCliente === 'novo') await obrasApi.criarCliente(f); else if (idCliente) await obrasApi.salvarCliente(idCliente, f);
      message.success('Cliente salvo.');
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  const ir = (fn: () => void) => { onFechar(); fn(); };
  return (
    <Modal open={!!idCliente} title={idCliente === 'novo' ? 'Novo cliente de poço' : cliente?.nome || 'Cliente'} okText="Salvar" cancelText="Voltar"
      onOk={salvar} onCancel={onFechar} width={760} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={8}>
          {campo('nome', 'Nome', 12, { maxLength: 120 })}
          <Col span={6}><Text>Telefone</Text><Input value={foneBr(f.telefone) || f.telefone || ''} onChange={e => mudar({ telefone: e.target.value || null })} /></Col>
          {campo('documento', 'CPF / CNPJ', 6)}
        </Row>
        <Row gutter={8}>
          {campo('endereco', 'Endereço', 10, { maxLength: 150 })}
          {campo('bairro', 'Bairro', 5, { maxLength: 60 })}
          {campo('cidade', 'Cidade', 6, { maxLength: 60 })}
          {campo('uf', 'UF', 3, { maxLength: 2 })}
        </Row>
        <Row gutter={8}>
          {campo('email', 'E-mail', 10, { maxLength: 120 })}
          {campo('observacao', 'Observação', 14, { maxLength: 255 })}
        </Row>
        {cliente && (
          <Row gutter={12}>
            <Col span={12}>
              <Card size="small" title={`Poços (${pocos.length})`}
                extra={<Button size="small" icon={<EnvironmentOutlined />} disabled={!cliente.pocosComGps} onClick={() => ir(() => verClienteNoMapa(cliente.idCliente))}>Ver no mapa</Button>}>
                <List size="small" dataSource={pocos} locale={{ emptyText: 'Nenhum poço' }} renderItem={p => (
                  <List.Item style={{ cursor: 'pointer', padding: '4px 0' }} onClick={() => ir(() => abrirPoco(p.idPoco))}>
                    <Text>{p.identificacao}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{p.profundidadeM ? `${p.profundidadeM} m` : ''}{p.latitude === null ? ' · sem GPS' : ''}</Text>
                  </List.Item>
                )} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" title={`Obras (${obras.length})`}>
                <List size="small" dataSource={obras} locale={{ emptyText: 'Nenhuma obra' }} renderItem={o => (
                  <List.Item style={{ cursor: 'pointer', padding: '4px 0' }} onClick={() => ir(() => abrirObra(o.idObra))}>
                    <Text>Nº {o.idObra} · {o.titulo || o.servicos.map(s => SERVICOS[s]).join(' + ')}</Text>
                    <Tag color={SITUACOES_OBRA[o.situacao].cor}>{SITUACOES_OBRA[o.situacao].texto}</Tag>
                  </List.Item>
                )} />
              </Card>
            </Col>
          </Row>
        )}
      </Space>
    </Modal>
  );
};

export const ListaClientes: React.FC<{ abrir?: number; pedido?: number }> = ({ abrir, pedido }) => {
  const [lista, setLista] = useState<ClientePoco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<number | 'novo' | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await obrasApi.clientes(busca)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [busca]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);
  useEffect(() => { if (abrir) setAberto(abrir); }, [abrir, pedido]);
  return (
    <Card size="small"
      title={<Input allowClear placeholder="Nome, telefone, CPF/CNPJ ou cidade" style={{ width: 320 }} value={busca} onChange={e => setBusca(e.target.value)} />}
      extra={<Space>
        <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo cliente</Button>
      </Space>}>
      <Alert type="info" showIcon style={{ marginBottom: 8 }}
        message="Os clientes de poço têm cadastro próprio, separado dos clientes da loja (dá para juntar mais adiante)." />
      <Table<ClientePoco>
        size="small" rowKey="idCliente" loading={carregando} dataSource={lista} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum cliente de poço ainda" /> }}
        onRow={c => ({ onClick: () => setAberto(c.idCliente), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Cliente', render: (_, c) => <><Text strong>{c.nome}</Text>{c.documento ? <Text type="secondary" style={{ fontSize: 12 }}> · {c.documento}</Text> : null}</> },
          { title: 'Telefone', width: 150, render: (_, c) => foneBr(c.telefone) || '—' },
          { title: 'Cidade', width: 160, render: (_, c) => (c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ''}` : '—') },
          { title: 'Poços', dataIndex: 'pocos', width: 70, align: 'center' },
          { title: 'Obras', width: 110, align: 'center', render: (_, c) => <>{c.obras}{c.obrasAbertas ? <Tag color="processing" style={{ marginLeft: 6 }}>{c.obrasAbertas} aberta(s)</Tag> : null}</> },
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
      <ClienteFicha idCliente={aberto} onFechar={() => setAberto(null)} onSalvo={() => { setAberto(null); carregar(); }} />
    </Card>
  );
};

