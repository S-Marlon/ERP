// Compras › Rolamentos (módulo TRANSMISSAO_ROLAMENTOS): estrutura no catálogo, linha (1ª/2ª) e apelidos das
// marcas, markup padrão, teste de leitura de descrição e medidas aprendidas.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Input, InputNumber, Popconfirm, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { BuildOutlined, DeleteOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalNovaMarca } from '../../../pages/Compras/StockEntry/ItemsConference/DefinicoesPimRapidas';
import { montarEstrutura } from './estruturaRolamentos';
import { ConfigRolamentos, LinhaAnalisada, MarcaModulo, MedidaAprendida, rolamentosApi, TIPOS, TipoRolamento } from './rolamentosApi';

const { Title, Text } = Typography;
const mm = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }));

const RolamentosConfig: React.FC = () => {
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<ConfigRolamentos>({});
  const [familias, setFamilias] = useState<Record<number, { id: number; nome: string; status: string }>>({});
  const [marcas, setMarcas] = useState<MarcaModulo[]>([]);
  const [medidas, setMedidas] = useState<MedidaAprendida[]>([]);
  const [montando, setMontando] = useState<string | null>(null);
  const [apelidos, setApelidos] = useState<Record<number, string>>({});
  const [novaMarca, setNovaMarca] = useState(false);
  // Trazer para o módulo uma marca que já existe no sistema (ou a recém-criada) com a linha escolhida
  const [adicionarId, setAdicionarId] = useState<number | null>(null);
  const [adicionarLinha, setAdicionarLinha] = useState<1 | 2>(1);
  const [teste, setTeste] = useState('ROLAMENTO 6205-2RS/C3 SKF');
  const [resultadoTeste, setResultadoTeste] = useState<LinhaAnalisada | null>(null);

  const carregar = async () => {
    try {
      const r = await rolamentosApi.config();
      setConfig(r.configuracao);
      setFamilias(r.familias);
      setMarcas(r.marcas);
      setMedidas(r.medidas);
      setApelidos(Object.fromEntries(r.marcas.map(m => [m.id, m.apelidos.join(', ')])));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const montar = async () => {
    setMontando('Iniciando...');
    try {
      const nova = await montarEstrutura(config, setMontando);
      await rolamentosApi.salvarConfig(nova);
      message.success('Estrutura de rolamentos pronta no catálogo.');
      await carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao montar a estrutura.');
    } finally {
      setMontando(null);
    }
  };

  const salvarMarca = async (m: MarcaModulo, linha: 1 | 2 | null) => {
    try {
      await rolamentosApi.salvarMarca(m.id, linha, apelidos[m.id] || '');
      setMarcas(ms => ms.map(x => (x.id === m.id ? { ...x, linha, apelidos: (apelidos[m.id] || '').split(',').map(a => a.trim()).filter(Boolean) } : x)));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar a marca.');
    }
  };

  const removerMarca = async (m: MarcaModulo) => {
    try {
      await rolamentosApi.salvarMarca(m.id, null, '');
      setMarcas(ms => ms.map(x => (x.id === m.id ? { ...x, linha: null, apelidos: [] } : x)));
      setApelidos(x => ({ ...x, [m.id]: '' }));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao remover a marca.');
    }
  };

  const adicionarMarca = async (id: number) => {
    try {
      await rolamentosApi.salvarMarca(id, adicionarLinha, '');
      setAdicionarId(null);
      await carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao adicionar a marca.');
    }
  };

  const testar = async () => {
    try {
      const r = await rolamentosApi.analisar([{ chave: 't', descricao: teste }]);
      setResultadoTeste(r.linhas[0]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao testar.');
    }
  };

  if (carregando) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  const tipos = Object.keys(TIPOS) as TipoRolamento[];
  const familiasOk = tipos.filter(t => config.familias?.[t] && familias[config.familias[t]!]).length;
  // Só as marcas de rolamento (com linha definida); as demais do sistema podem ser trazidas para cá
  const marcaUtil = (m: MarcaModulo) => m.id !== config.idMarcaSegundaLinha && m.nome.toLowerCase() !== 'sem marca';
  const marcasDoModulo = marcas.filter(m => marcaUtil(m) && m.linha !== null);
  const outrasMarcas = marcas.filter(m => marcaUtil(m) && m.linha === null);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ margin: 0 }}>Rolamentos</Title>
      <Text type="secondary">Módulo de entrada de rolamentos: o botão "Rolamentos" na conferência da nota lê as descrições, sugere as medidas e cadastra em lote.</Text>

      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} xl={12}>
          <Card size="small" title="Estrutura no catálogo"
            extra={
              <Popconfirm
                title="Montar a estrutura de rolamentos?"
                description={<div style={{ maxWidth: 340 }}>Cria (ou reaproveita pelo nome) a categoria Rolamentos, uma família por tipo com a marca na grade,
                  os atributos (código, vedação, folga, linha, d, D, B) e a marca "2ª Linha" (sigla 2L). Nada é apagado.</div>}
                okText="Montar" cancelText="Voltar" onConfirm={montar}>
                <Button type="primary" icon={<BuildOutlined />} loading={montando !== null}>{familiasOk ? 'Completar estrutura' : 'Montar estrutura'}</Button>
              </Popconfirm>
            }>
            {montando && <Alert type="info" showIcon message={montando} style={{ marginBottom: 10 }} />}
            <Descriptions size="small" column={1} bordered>
              {tipos.map(t => {
                const id = config.familias?.[t];
                const f = id ? familias[id] : null;
                return (
                  <Descriptions.Item key={t} label={TIPOS[t].familia}>
                    {f ? <Space>{f.nome}<Tag color={f.status === 'ATIVO' ? 'green' : 'orange'}>{f.status.toLowerCase()}</Tag></Space> : <Text type="secondary">não configurada</Text>}
                  </Descriptions.Item>
                );
              })}
              <Descriptions.Item label="Marca da 2ª linha">
                {config.idMarcaSegundaLinha ? <Tag>2ª Linha · 2L</Tag> : <Text type="secondary">não configurada</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Atributos">
                {Object.keys(config.atributos || {}).length ? `${Object.keys(config.atributos || {}).length} ligados` : <Text type="secondary">não configurados</Text>}
              </Descriptions.Item>
            </Descriptions>
            <Space style={{ marginTop: 10 }}>
              <Text>Markup padrão dos itens novos</Text>
              <InputNumber min={1} step={0.1} precision={2} decimalSeparator="," value={config.markup ?? 2} style={{ width: 90 }}
                onChange={v => setConfig(c => ({ ...c, markup: Number(v) || 2 }))} />
              <Button size="small" onClick={() => rolamentosApi.salvarConfig({ markup: config.markup ?? 2 }).then(() => message.success('Markup salvo.')).catch(e => message.error(e.message))}>Salvar</Button>
            </Space>
          </Card>

          <Card size="small" title={<Space><ExperimentOutlined />Testar uma descrição</Space>} style={{ marginTop: 14 }}>
            <Input.Search value={teste} onChange={e => setTeste(e.target.value)} onSearch={testar} enterButton="Ler" placeholder="Cole a descrição da nota" />
            {resultadoTeste && (
              <Descriptions size="small" column={2} style={{ marginTop: 10 }}>
                <Descriptions.Item label="Rolamento">{resultadoTeste.ehRolamento ? 'sim' : 'não reconhecido'}</Descriptions.Item>
                <Descriptions.Item label="Tipo">{resultadoTeste.tipo ? TIPOS[resultadoTeste.tipo].familia : '—'}</Descriptions.Item>
                <Descriptions.Item label="Código">{resultadoTeste.codigo || '—'}</Descriptions.Item>
                <Descriptions.Item label="Vedação / folga">{resultadoTeste.vedacao} {resultadoTeste.folga || ''}</Descriptions.Item>
                <Descriptions.Item label="Marca">{resultadoTeste.marca?.nome || (resultadoTeste.marcaTexto ? `${resultadoTeste.marcaTexto} (não cadastrada)` : '—')}</Descriptions.Item>
                <Descriptions.Item label="Linha">{resultadoTeste.linha ? `${resultadoTeste.linha}ª` : 'defina na marca'}</Descriptions.Item>
                <Descriptions.Item label="Medidas">
                  {resultadoTeste.medidas ? `${mm(resultadoTeste.medidas.d)} × ${mm(resultadoTeste.medidas.D)} × ${mm(resultadoTeste.medidas.B)} mm` : 'fora da tabela'}
                </Descriptions.Item>
                <Descriptions.Item label="SKU">{resultadoTeste.sku || '—'}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card size="small" title="Marcas: 1ª ou 2ª linha" extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setNovaMarca(true)}>Nova marca</Button>}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              1ª linha: cada marca é um item (6205-2RS-SKF). 2ª linha: todas viram o mesmo item (6205-2RS-2L). Apelidos: como a marca aparece nas notas (ex.: GTOP, GBR, PEER/SKF).
            </Text>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
              <Select style={{ flex: 1 }} showSearch optionFilterProp="label" placeholder="Trazer uma marca que já existe no sistema" value={adicionarId ?? undefined}
                onChange={setAdicionarId} options={outrasMarcas.map(m => ({ value: m.id, label: m.nome }))} notFoundContent="Nenhuma outra marca" />
              <Select style={{ width: 110 }} value={adicionarLinha} onChange={setAdicionarLinha} options={[{ value: 1, label: '1ª linha' }, { value: 2, label: '2ª linha' }]} />
              <Button type="primary" disabled={!adicionarId} onClick={() => adicionarId && adicionarMarca(adicionarId)}>Adicionar</Button>
            </Space.Compact>
            <Table<MarcaModulo>
              size="small" rowKey="id" dataSource={marcasDoModulo} pagination={false} style={{ marginTop: 8 }} scroll={{ y: 420 }}
              locale={{ emptyText: 'Nenhuma marca de rolamento ainda: adicione acima ou crie em "Nova marca".' }}
              columns={[
                { title: 'Marca', dataIndex: 'nome' },
                {
                  title: 'Linha', key: 'l', width: 110,
                  render: (_, m) => (
                    <Select size="small" style={{ width: '100%' }} value={m.linha ?? undefined}
                      onChange={v => salvarMarca(m, v as 1 | 2)} options={[{ value: 1, label: '1ª linha' }, { value: 2, label: '2ª linha' }]} />
                  ),
                },
                {
                  title: 'Apelidos nas notas', key: 'a', width: 220,
                  render: (_, m) => (
                    <Input size="small" placeholder="separe por vírgula" value={apelidos[m.id] ?? ''}
                      onChange={e => setApelidos(x => ({ ...x, [m.id]: e.target.value }))}
                      onBlur={() => { if ((apelidos[m.id] ?? '') !== m.apelidos.join(', ')) salvarMarca(m, m.linha ?? 1); }} />
                  ),
                },
                {
                  title: '', key: 'x', width: 40,
                  render: (_, m) => (
                    <Popconfirm title={`Tirar ${m.nome} dos rolamentos?`} description="A marca continua no sistema; só deixa de aparecer aqui." okText="Tirar" cancelText="Voltar" onConfirm={() => removerMarca(m)}>
                      <Tooltip title="Tirar do módulo"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>

          <Card size="small" title="Medidas aprendidas" style={{ marginTop: 14 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Códigos fora da tabela padrão (ou corrigidos) digitados na entrada de nota.</Text>
            <Table<MedidaAprendida>
              size="small" rowKey="idMedida" dataSource={medidas} pagination={{ pageSize: 10, hideOnSinglePage: true }} style={{ marginTop: 8 }}
              locale={{ emptyText: 'Nenhuma ainda' }}
              columns={[
                { title: 'Código', dataIndex: 'codigo' },
                { title: 'Tipo', dataIndex: 'tipo', render: (v: string | null) => (v && TIPOS[v as TipoRolamento] ? TIPOS[v as TipoRolamento].familia.replace('Rolamento ', '') : '—') },
                { title: 'd × D × B', key: 'm', render: (_, m) => `${mm(m.d)} × ${mm(m.D)} × ${mm(m.B)}` },
                {
                  title: '', key: 'x', width: 40,
                  render: (_, m) => <Button size="small" type="text" danger icon={<DeleteOutlined />}
                    onClick={() => rolamentosApi.excluirMedida(m.idMedida).then(() => setMedidas(ms => ms.filter(x => x.idMedida !== m.idMedida)))} />,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <ModalNovaMarca open={novaMarca} onFechar={() => setNovaMarca(false)}
        onCriada={id => { setNovaMarca(false); adicionarMarca(id); }} />
    </div>
  );
};

export default RolamentosConfig;
