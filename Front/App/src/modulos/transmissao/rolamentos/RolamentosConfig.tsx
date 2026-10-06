// Compras › Rolamentos (módulo TRANSMISSAO_ROLAMENTOS): estrutura no catálogo, linha (1ª/2ª) e apelidos das
// marcas, markup padrão, teste de leitura de descrição e medidas aprendidas.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Descriptions, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { BuildOutlined, DeleteOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalNovaMarca } from '../../../pages/Compras/StockEntry/ItemsConference/DefinicoesPimRapidas';
import { garantirFamilias, montarEstrutura } from './estruturaRolamentos';
import { updateFamilia } from '../../../pages/Catalogo/pages/FamilyManager/FamilyManager.api';
import { ConfigRolamentos, LinhaAnalisada, MarcaModulo, MedidaAprendida, nomeFamiliaDoCodigo, rolamentosApi, TIPOS, TipoRolamento } from './rolamentosApi';

const { Title, Text } = Typography;
const mm = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 }));

const RolamentosConfig: React.FC = () => {
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<ConfigRolamentos>({});
  const [familias, setFamilias] = useState<Record<number, { id: number; nome: string; status: string }>>({});
  const [subcategorias, setSubcategorias] = useState<Record<number, { id: number; nome: string; familias: number }>>({});
  // Reorganizar: itens das famílias amplas antigas vão para a família do seu código (Rolamento 6205)
  type ItemReorg = { idItem: number; sku: string; nome: string | null; tipo: TipoRolamento | null; codigo: string; medidas: { d: number | null; D: number | null; B: number | null } };
  const [previaReorg, setPreviaReorg] = useState<ItemReorg[] | null>(null);
  const [reorganizando, setReorganizando] = useState(false);
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

  // Dicionário de códigos do fabricante: os já conhecidos (fixos) e os definidos pelo operador
  const [dicionarioPadrao, setDicionarioPadrao] = useState<Array<{ codigo: string; categoria: string; significado: string }>>([]);
  const [novoCodigo, setNovoCodigo] = useState('');
  // Renomear itens já cadastrados pelo padrão de nome atual (prévia antes de aplicar)
  const [previaNomes, setPreviaNomes] = useState<Array<{ idItem: number; sku: string; nomeAtual: string | null; nomeNovo: string }> | null>(null);
  const [renomeando, setRenomeando] = useState(false);
  const verRenomear = async () => {
    setRenomeando(true);
    try { setPreviaNomes((await rolamentosApi.renomear(false)).mudancas); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setRenomeando(false); }
  };
  const aplicarRenomear = async () => {
    setRenomeando(true);
    try {
      const r = await rolamentosApi.renomear(true);
      message.success(`${r.aplicadas} item(ns) renomeado(s).`);
      setPreviaNomes(null);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setRenomeando(false); }
  };
  const [novoSignificado, setNovoSignificado] = useState('');

  const salvarSufixos = async (sufixos: Record<string, string>) => {
    try {
      const r = await rolamentosApi.salvarConfig({ sufixos });
      setConfig(c => ({ ...c, sufixos: r.configuracao.sufixos || {} }));
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar o dicionário.');
      return false;
    }
  };
  const adicionarSufixo = async () => {
    const codigo = novoCodigo.trim().toUpperCase();
    if (!codigo || !novoSignificado.trim()) return;
    if (await salvarSufixos({ ...(config.sufixos || {}), [codigo]: novoSignificado.trim() })) { setNovoCodigo(''); setNovoSignificado(''); }
  };

  const carregar = async () => {
    try {
      const r = await rolamentosApi.config();
      setConfig(r.configuracao);
      setFamilias(r.familias);
      setSubcategorias(r.subcategorias || {});
      setMarcas(r.marcas);
      setMedidas(r.medidas);
      rolamentosApi.dicionario().then(setDicionarioPadrao).catch(() => undefined);
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

  const verReorganizar = async () => {
    setReorganizando(true);
    try { setPreviaReorg((await rolamentosApi.itensParaReorganizar()).itens); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setReorganizando(false); }
  };
  const aplicarReorganizar = async () => {
    if (!previaReorg) return;
    if (!Object.keys(config.subcategorias || {}).length) { message.warning('Monte a estrutura (subcategorias) antes.'); return; }
    setReorganizando(true);
    try {
      const validos = previaReorg.filter(i => i.tipo && i.codigo);
      const fams = await garantirFamilias(config, validos.map(i => ({ tipo: i.tipo!, codigo: i.codigo, medidas: i.medidas })), setMontando);
      const r = await rolamentosApi.moverItens(validos.map(i => ({ idItem: i.idItem, idFamilia: fams[`${i.tipo}|${i.codigo}`] })));
      // Famílias amplas que ficaram vazias saem de uso (inativas; nada é apagado)
      const restantes = (await rolamentosApi.itensParaReorganizar()).itens.length;
      if (!restantes) {
        for (const id of Object.values(config.familias || {}).filter(Boolean)) await updateFamilia(String(id), { status: 'INATIVO' } as never);
        await rolamentosApi.salvarConfig({ familias: {} });
      }
      message.success(`${r.movidos} item(ns) nas famílias por código.${restantes ? ` ${restantes} ficaram (sem código ou tipo): ajuste no catálogo.` : ''}`);
      setPreviaReorg(null);
      await carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao reorganizar.');
    } finally {
      setReorganizando(false);
      setMontando(null);
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
  const subcategoriasOk = tipos.filter(t => config.subcategorias?.[t] && subcategorias[config.subcategorias[t]!]).length;
  const temFamiliasAntigas = Object.values(config.familias || {}).some(id => id && familias[id]);
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
                description={<div style={{ maxWidth: 340 }}>Cria (ou reaproveita pelo nome) a categoria Rolamentos com uma subcategoria por tipo,
                  os atributos (código, vedação, folga, linha, d, D, B) e a marca "2ª Linha" (sigla 2L). As famílias (Rolamento 6205...) nascem na entrada da nota. Nada é apagado.</div>}
                okText="Montar" cancelText="Voltar" onConfirm={montar}>
                <Button type="primary" icon={<BuildOutlined />} loading={montando !== null}>{subcategoriasOk ? 'Completar estrutura' : 'Montar estrutura'}</Button>
              </Popconfirm>
            }>
            {montando && <Alert type="info" showIcon message={montando} style={{ marginBottom: 10 }} />}
            <Descriptions size="small" column={1} bordered>
              {tipos.map(t => {
                const id = config.subcategorias?.[t];
                const sub = id ? subcategorias[id] : null;
                return (
                  <Descriptions.Item key={t} label={`Rolamentos › ${TIPOS[t].subcategoria}`}>
                    {sub ? <Space>{sub.familias} família(s) por código</Space> : <Text type="secondary">não criada</Text>}
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
            {temFamiliasAntigas && (
              <Alert type="warning" showIcon style={{ marginTop: 10 }}
                message="Há itens nas famílias amplas antigas (uma por tipo)."
                description="Reorganize para a família do código de cada um (Rolamento 6205...), com as medidas como DNA da família."
                action={<Button size="small" loading={reorganizando && !previaReorg} onClick={verReorganizar}>Reorganizar</Button>} />
            )}
            <div style={{ marginTop: 10 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Nome dos itens: ROLAMENTO 6205-2RS/C3 | 25 mm × 52 mm × 15 mm | SKF</Text>
              <Button size="small" style={{ marginTop: 4 }} loading={renomeando && !previaNomes} onClick={verRenomear}>Renomear itens já cadastrados</Button>
            </div>
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
                <Descriptions.Item label="Códigos do fabricante" span={2}>
                  {resultadoTeste.sufixos.length ? (
                    <Space size={4} wrap>
                      {resultadoTeste.sufixos.map(s => (
                        <Tooltip key={s.codigo} title={s.significado ? `${s.significado}${s.provavel ? ' (provável)' : ''}` : 'sem significado: defina no dicionário'}>
                          <Tag color={s.significado ? undefined : 'orange'}>{s.codigo}{s.significado ? '' : ' ?'}</Tag>
                        </Tooltip>
                      ))}
                    </Space>
                  ) : '—'}
                </Descriptions.Item>
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

          <Card size="small" title="Dicionário de códigos do fabricante" style={{ marginTop: 14 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Significado dos sufixos (ex.: CO7, #N1, J42B). Vai na descrição dos itens novos e não muda o SKU. Também dá para definir clicando no código laranja na entrada da nota.
            </Text>
            <Space.Compact style={{ width: '100%', marginTop: 8 }}>
              <Input style={{ width: 120 }} placeholder="Código" value={novoCodigo} maxLength={20} onChange={e => setNovoCodigo(e.target.value.toUpperCase())} />
              <Input placeholder="Significado" value={novoSignificado} maxLength={200} onChange={e => setNovoSignificado(e.target.value)} onPressEnter={adicionarSufixo} />
              <Button type="primary" disabled={!novoCodigo.trim() || !novoSignificado.trim()} onClick={adicionarSufixo}>Adicionar</Button>
            </Space.Compact>
            <Table
              size="small" rowKey="codigo" pagination={false} style={{ marginTop: 8 }}
              dataSource={Object.entries(config.sufixos || {}).map(([codigo, significado]) => ({ codigo, significado })).sort((a, b) => a.codigo.localeCompare(b.codigo))}
              locale={{ emptyText: 'Nenhum código definido por você ainda' }}
              columns={[
                { title: 'Código', dataIndex: 'codigo', width: 110, render: (v: string) => <Tag>{v}</Tag> },
                {
                  title: 'Significado', dataIndex: 'significado',
                  render: (v: string, r: { codigo: string }) => (
                    <Typography.Paragraph style={{ margin: 0 }} editable={{
                      onChange: texto => { if (texto.trim() && texto !== v) salvarSufixos({ ...(config.sufixos || {}), [r.codigo]: texto.trim() }); },
                    }}>{v}</Typography.Paragraph>
                  ),
                },
                {
                  title: '', key: 'x', width: 40,
                  render: (_: unknown, r: { codigo: string }) => (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => {
                      const resto = { ...(config.sufixos || {}) };
                      delete resto[r.codigo];
                      salvarSufixos(resto);
                    }} />
                  ),
                },
              ]}
            />
            <Collapse ghost size="small" style={{ marginTop: 6 }} items={[{
              key: 'padrao',
              label: `Códigos já conhecidos pelo sistema (${dicionarioPadrao.length})`,
              children: (
                <Table size="small" rowKey="codigo" pagination={false} dataSource={dicionarioPadrao} scroll={{ y: 260 }}
                  columns={[
                    { title: 'Código', dataIndex: 'codigo', width: 100, render: (v: string) => <Tag>{v}</Tag> },
                    { title: 'Significado', dataIndex: 'significado' },
                  ]} />
              ),
            }]} />
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

      <Modal open={previaNomes !== null} width={900} title={`Renomear itens de rolamento (${previaNomes?.length ?? 0})`} onCancel={() => setPreviaNomes(null)}
        okText={`Renomear ${previaNomes?.length ?? 0} item(ns)`} cancelText="Voltar" onOk={aplicarRenomear} okButtonProps={{ disabled: !previaNomes?.length }} confirmLoading={renomeando}>
        <Text type="secondary" style={{ fontSize: 12 }}>O nome é montado pelos atributos de cada item (código, vedação, folga, medidas) e pela marca. O SKU não muda.</Text>
        <Table size="small" rowKey="idItem" pagination={false} scroll={{ y: 420 }} style={{ marginTop: 8 }} dataSource={previaNomes || []}
          locale={{ emptyText: 'Todos os itens já estão no padrão' }}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 150 },
            { title: 'Nome atual', dataIndex: 'nomeAtual', render: (v: string | null) => <Text type="secondary">{v || '—'}</Text> },
            { title: 'Nome novo', dataIndex: 'nomeNovo', render: (v: string) => <b>{v}</b> },
          ]} />
      </Modal>

      <Modal open={previaReorg !== null} width={860} title={`Reorganizar itens nas famílias por código (${previaReorg?.length ?? 0})`} onCancel={() => setPreviaReorg(null)}
        okText="Reorganizar" cancelText="Voltar" onOk={aplicarReorganizar} okButtonProps={{ disabled: !previaReorg?.some(i => i.tipo && i.codigo) }} confirmLoading={reorganizando}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Cada item vai para a família do seu código, na subcategoria do tipo (cria a família se ainda não existir). As famílias amplas antigas ficam inativas no fim. SKU e nome não mudam.
        </Text>
        {montando && <Alert type="info" showIcon message={montando} style={{ marginTop: 8 }} />}
        <Table size="small" rowKey="idItem" pagination={false} scroll={{ y: 420 }} style={{ marginTop: 8 }} dataSource={previaReorg || []}
          columns={[
            { title: 'SKU', dataIndex: 'sku', width: 160 },
            { title: 'Subcategoria', dataIndex: 'tipo', width: 160, render: (v: TipoRolamento | null) => (v ? TIPOS[v].subcategoria : <Text type="danger">sem tipo</Text>) },
            { title: 'Família de destino', key: 'f', render: (_: unknown, i: ItemReorg) => (i.codigo ? <b>{nomeFamiliaDoCodigo(i.codigo)}</b> : <Text type="danger">sem código: fica onde está</Text>) },
          ]} />
      </Modal>

      <ModalNovaMarca open={novaMarca} onFechar={() => setNovaMarca(false)}
        onCriada={id => { setNovaMarca(false); adicionarMarca(id); }} />
    </div>
  );
};

export default RolamentosConfig;
