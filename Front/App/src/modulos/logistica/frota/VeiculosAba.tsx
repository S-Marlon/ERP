// Gestor de frotas › Veículos (etapa 1): a frota da loja com km e situação, cadastro, edição e ajuste do km.
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Checkbox, Col, Flex, Input, InputNumber, Modal, Row, Segmented, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CarOutlined, DashboardOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { COMBUSTIVEIS, frotaApi, resumoFrota, SITUACOES, SituacaoVeiculo, TIPOS, Veiculo, VeiculoForm } from './frotaApi';

const { Text } = Typography;
const km = (n: number) => `${n.toLocaleString('pt-BR')} km`;
const opcoes = <T extends string>(m: Record<T, string | { texto: string }>) =>
  (Object.keys(m) as T[]).map(k => ({ value: k, label: typeof m[k] === 'string' ? (m[k] as string) : (m[k] as { texto: string }).texto }));

const vazio = (): VeiculoForm & { kmAtual: number | null } => ({
  placa: '', apelido: null, tipo: 'CARRO', marca: null, modelo: null, anoFabricacao: null, anoModelo: null, cor: null, renavam: null, chassi: null,
  combustivel: 'FLEX', tanqueLitros: null, cargaKg: null, situacao: 'EM_USO', observacao: null, kmAtual: null,
});

const VeiculoModal: React.FC<{ veiculo: Veiculo | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ veiculo, onFechar, onSalvo }) => {
  const [f, setF] = useState(vazio());
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (veiculo) setF(veiculo === 'novo' ? vazio() : { ...veiculo, placa: veiculo.placaFormatada, kmAtual: null }); }, [veiculo]);
  const mudar = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const salvar = async () => {
    setSalvando(true);
    try {
      if (veiculo === 'novo') await frotaApi.criarVeiculo(f); else if (veiculo) await frotaApi.salvarVeiculo(veiculo.idVeiculo, f);
      message.success('Veículo salvo.');
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };
  const campo = (rotulo: string, el: React.ReactNode, span = 8) => <Col span={span}><Text>{rotulo}</Text>{el}</Col>;
  const txt = (k: keyof VeiculoForm, max: number, ph?: string) => (
    <Input maxLength={max} placeholder={ph} value={(f[k] as string) || ''} onChange={e => mudar({ [k]: e.target.value || null } as any)} />
  );
  const num = (k: 'anoFabricacao' | 'anoModelo' | 'tanqueLitros' | 'cargaKg' | 'kmAtual', props: object = {}) => (
    <InputNumber style={{ width: '100%' }} value={f[k] ?? undefined} onChange={v => mudar({ [k]: v === null || v === undefined ? null : Number(v) } as any)} {...props} />
  );
  return (
    <Modal open={veiculo !== null} title={veiculo === 'novo' ? 'Novo veículo' : `Editar ${veiculo && veiculo.placaFormatada}`} okText="Salvar" cancelText="Voltar"
      onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden width={680}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={10}>
          {campo('Placa', <Input maxLength={8} placeholder="ABC-1234 ou ABC1D23" value={f.placa} onChange={e => mudar({ placa: e.target.value.toUpperCase() })} />)}
          {campo('Apelido', txt('apelido', 60, 'Ex.: Strada branca'), 10)}
          {campo('Tipo', <Select style={{ width: '100%' }} value={f.tipo} options={opcoes(TIPOS)} onChange={tipo => mudar({ tipo })} />, 6)}
        </Row>
        <Row gutter={10}>
          {campo('Marca', txt('marca', 40, 'Ex.: Fiat'))}
          {campo('Modelo', txt('modelo', 60, 'Ex.: Strada Endurance'))}
          {campo('Cor', txt('cor', 30))}
        </Row>
        <Row gutter={10}>
          {campo('Ano fabricação', num('anoFabricacao', { min: 1950, max: 2100 }), 6)}
          {campo('Ano modelo', num('anoModelo', { min: 1950, max: 2100 }), 6)}
          {campo('Combustível', <Select style={{ width: '100%' }} value={f.combustivel} options={opcoes(COMBUSTIVEIS)} onChange={combustivel => mudar({ combustivel })} />, 6)}
          {campo('Situação', <Select style={{ width: '100%' }} value={f.situacao} options={opcoes(SITUACOES)} onChange={situacao => mudar({ situacao })} />, 6)}
        </Row>
        <Row gutter={10}>
          {campo('RENAVAM', txt('renavam', 13))}
          {campo('Chassi', txt('chassi', 20), 10)}
          {veiculo === 'novo' ? campo('Km atual', num('kmAtual', { min: 0 }), 6) : <Col span={6} />}
        </Row>
        <Row gutter={10}>
          {campo('Tanque (litros)', num('tanqueLitros', { min: 0, decimalSeparator: ',' }), 6)}
          {campo('Carga (kg)', num('cargaKg', { min: 0, decimalSeparator: ',' }), 6)}
          {campo('Observação', txt('observacao', 255), 12)}
        </Row>
        {veiculo !== 'novo' && <Text type="secondary" style={{ fontSize: 12 }}>O km muda pelo botão de km da lista (ou sozinho, quando os abastecimentos e as viagens abrirem).</Text>}
      </Space>
    </Modal>
  );
};

const VeiculosAba: React.FC = () => {
  const [lista, setLista] = useState<Veiculo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoVeiculo | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Veiculo | 'novo' | null>(null);
  const [ajuste, setAjuste] = useState<{ v: Veiculo; km: number | null; corrigir: boolean } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await frotaApi.veiculos()); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const r = resumoFrota(lista);
  const termo = busca.trim().toUpperCase();
  const visiveis = lista.filter(v => (situacao === 'TODOS' || v.situacao === situacao)
    && (!termo || `${v.placa} ${v.placaFormatada} ${v.apelido || ''} ${v.marca || ''} ${v.modelo || ''}`.toUpperCase().includes(termo)));

  const salvarKm = async () => {
    if (!ajuste || ajuste.km === null) return;
    try {
      await frotaApi.ajustarKm(ajuste.v.idVeiculo, ajuste.km, ajuste.corrigir);
      message.success('Km ajustado.');
      setAjuste(null);
      carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Veículos na frota" value={r.total} prefix={<CarOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Em uso" value={r.emUso} valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Em manutenção" value={r.manutencao} valueStyle={r.manutencao ? { color: '#d46b08' } : undefined} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Parados" value={r.parados} /></Card></Col>
      </Row>
      <Card size="small"
        title={<Space wrap>
          <Segmented size="small" value={situacao} onChange={v => setSituacao(v as SituacaoVeiculo | 'TODOS')}
            options={[{ value: 'TODOS', label: 'Todos' }, ...opcoes(SITUACOES)]} />
          <Input allowClear placeholder="Placa, apelido, marca ou modelo" style={{ width: 240 }} value={busca} onChange={e => setBusca(e.target.value)} />
        </Space>}
        extra={<Space>
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditando('novo')}>Novo veículo</Button>
        </Space>}>
        <Table<Veiculo>
          size="small" rowKey="idVeiculo" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{ emptyText: 'Nenhum veículo ainda: cadastre o primeiro.' }}
          columns={[
            {
              title: 'Veículo', render: (_, v) => (
                <div style={{ lineHeight: 1.3 }}>
                  <Tag style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{v.placaFormatada}</Tag>
                  <Text strong>{v.apelido || [v.marca, v.modelo].filter(Boolean).join(' ') || TIPOS[v.tipo]}</Text>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>
                    {[TIPOS[v.tipo], [v.marca, v.modelo].filter(Boolean).join(' '), v.anoModelo || v.anoFabricacao, v.cor, COMBUSTIVEIS[v.combustivel]].filter(Boolean).join(' · ')}
                  </Text></div>
                </div>
              ),
            },
            {
              title: 'Km atual', width: 170, align: 'right', sorter: (a, b) => a.kmAtual - b.kmAtual,
              render: (_, v) => (
                <div>
                  <Text strong>{km(v.kmAtual)}</Text>
                  {v.kmAtualizadoEm && <div><Text type="secondary" style={{ fontSize: 11 }}>em {v.kmAtualizadoEm.slice(8, 10)}/{v.kmAtualizadoEm.slice(5, 7)}/{v.kmAtualizadoEm.slice(0, 4)}</Text></div>}
                </div>
              ),
            },
            { title: 'Situação', width: 140, render: (_, v) => <Tag color={SITUACOES[v.situacao].cor}>{SITUACOES[v.situacao].texto}</Tag> },
            {
              title: '', width: 120, align: 'right',
              render: (_, v) => (
                <Space size={2}>
                  <Tooltip title="Atualizar o km"><Button size="small" type="text" icon={<DashboardOutlined />} onClick={() => setAjuste({ v, km: v.kmAtual, corrigir: false })} /></Tooltip>
                  <Tooltip title="Editar"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditando(v)} /></Tooltip>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <VeiculoModal veiculo={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />

      <Modal open={!!ajuste} title={`Km do ${ajuste?.v.apelido || ajuste?.v.placaFormatada}`} okText="Salvar" cancelText="Voltar"
        onOk={salvarKm} onCancel={() => setAjuste(null)} destroyOnHidden width={380}>
        {ajuste && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">Atual: {km(ajuste.v.kmAtual)}</Text>
            <InputNumber min={0} style={{ width: '100%' }} addonAfter="km" value={ajuste.km ?? undefined}
              formatter={v => (v === undefined || v === null || String(v) === '' ? '' : Number(v).toLocaleString('pt-BR'))}
              parser={v => Number(String(v || '').replace(/\D/g, '')) as unknown as number}
              onChange={v => setAjuste(a => a && { ...a, km: v === null ? null : Number(v) })} />
            <Flex vertical>
              <Checkbox checked={ajuste.corrigir} onChange={e => setAjuste(a => a && { ...a, corrigir: e.target.checked })}>Corrigir (o km atual estava errado)</Checkbox>
              <Text type="secondary" style={{ fontSize: 12 }}>O km só sobe. Para pôr um valor menor, marque corrigir.</Text>
            </Flex>
          </Space>
        )}
      </Modal>
    </Space>
  );
};

export default VeiculosAba;
