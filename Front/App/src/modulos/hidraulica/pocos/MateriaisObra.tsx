// Obras de poços › materiais (etapa 4): os materiais de cada obra (previsto, usado e o custo real) e o cadastro de
// materiais do módulo. Não usa o catálogo nem o estoque da loja. Material cobrado à parte vira adicional da obra.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Empty, Input, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CopyOutlined, DeleteOutlined, DollarOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  CATEGORIAS_MATERIAL, CategoriaMaterial, LinhaMaterialObra, MaterialForm, MaterialPoco, materiaisApi, obrasApi, ResumoMateriais, SITUACOES_ADICIONAL,
  UNIDADES_MATERIAL, Obra,
} from './obrasApi';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');

/** Número editável na tabela: grava ao sair do campo (ou Enter) quando mudou. */
const CelulaNumero: React.FC<{ valor: number | null; onSalvar: (v: number | null) => void; disabled?: boolean; prefixo?: string; vazio?: string }> = ({ valor, onSalvar, disabled, prefixo, vazio }) => {
  const [v, setV] = useState<number | null>(valor);
  useEffect(() => setV(valor), [valor]);
  const gravar = () => { if (v !== valor) onSalvar(v); };
  return (
    <CampoNumero size="small" min={0} style={{ width: '100%' }} prefix={prefixo} placeholder={vazio} disabled={disabled}
      value={v ?? undefined} onChange={x => setV(x === null || x === undefined ? null : Number(x))} onBlur={gravar} onPressEnter={gravar} />
  );
};

const CobrarModal: React.FC<{ linha: LinhaMaterialObra | null; onFechar: () => void; onFeito: () => void }> = ({ linha, onFechar, onFeito }) => {
  const [preco, setPreco] = useState<number | null>(null);
  useEffect(() => { if (linha) setPreco(linha.precoVenda); }, [linha]);
  const qtd = linha ? linha.qtdUsada ?? linha.qtdPrevista : 0;
  const cobrar = async () => {
    if (!linha) return;
    try {
      const r = await materiaisApi.cobrar(linha.idLinha, preco);
      message.success(`Adicional de ${brl(r.valor)} lançado: aguardando a aprovação do cliente (em "Sinal e cobrança").`);
      onFeito();
    } catch (e) { erro(e); }
  };
  return (
    <Modal open={!!linha} title="Cobrar o material do cliente" okText="Lançar adicional" cancelText="Voltar" onOk={cobrar} onCancel={onFechar} destroyOnHidden>
      {linha && (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Text>{linha.descricao}: {String(qtd).replace('.', ',')} {linha.unidade} {linha.qtdUsada === null ? <Text type="secondary">(previsto; ainda não conferido)</Text> : null}</Text>
          <Row gutter={8} align="bottom">
            <Col span={12}><Text>Preço por {linha.unidade}</Text>
              <CampoDinheiro min={0} precision={2} style={{ width: '100%' }} value={preco ?? undefined} onChange={v => setPreco(v === null ? null : Number(v))} />
            </Col>
            <Col span={12}><Text strong>Total: {brl(preco ? Math.round(qtd * preco * 100) / 100 : 0)}</Text></Col>
          </Row>
          <Text type="secondary" style={{ fontSize: 12 }}>Vira um adicional da obra: só entra no saldo depois que o cliente aprovar. Custo deste material: {brl(linha.custoUnitario)} por {linha.unidade}.</Text>
        </Space>
      )}
    </Modal>
  );
};

/** Os materiais de uma obra (fica dentro da obra aberta). */
export const MateriaisDaObra: React.FC<{ idObra: number; cancelada: boolean }> = ({ idObra, cancelada }) => {
  const [linhas, setLinhas] = useState<LinhaMaterialObra[]>([]);
  const [resumo, setResumo] = useState<ResumoMateriais | null>(null);
  const [cadastro, setCadastro] = useState<MaterialPoco[]>([]);
  const [novo, setNovo] = useState<{ idMaterial?: number; descricao: string; unidade: string; qtd: number | null; custo: number | null; avulso: boolean }>({ descricao: '', unidade: 'un', qtd: null, custo: null, avulso: false });
  const [cobrando, setCobrando] = useState<LinhaMaterialObra | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [obras, setObras] = useState<Obra[]>([]);
  const [deObra, setDeObra] = useState<number | undefined>();
  const carregar = useCallback(() => materiaisApi.daObra(idObra).then(r => { setLinhas(r.linhas); setResumo(r.resumo); }).catch(erro), [idObra]);
  useEffect(() => { carregar(); materiaisApi.cadastro().then(setCadastro).catch(() => setCadastro([])); }, [carregar]);
  const adicionar = async () => {
    if (!(novo.qtd && novo.qtd > 0)) { message.warning('Informe a quantidade prevista.'); return; }
    try {
      await materiaisApi.adicionar(idObra, novo.avulso
        ? { descricao: novo.descricao, unidade: novo.unidade, qtdPrevista: novo.qtd, custoUnitario: novo.custo ?? 0 }
        : { idMaterial: novo.idMaterial, qtdPrevista: novo.qtd });
      setNovo({ descricao: '', unidade: 'un', qtd: null, custo: null, avulso: novo.avulso });
      carregar();
    } catch (e) { erro(e); }
  };
  const salvar = async (l: LinhaMaterialObra, mudou: Partial<LinhaMaterialObra>) => {
    try {
      const n = { ...l, ...mudou };
      await materiaisApi.salvarLinha(l.idLinha, { qtdPrevista: n.qtdPrevista ?? 0, qtdUsada: n.qtdUsada, custoUnitario: n.custoUnitario, observacao: n.observacao });
      carregar();
    } catch (e) { erro(e); carregar(); }
  };
  const abrirCopia = () => {
    setCopiando(true); setDeObra(undefined);
    obrasApi.obras().then(l => setObras(l.filter(o => o.idObra !== idObra))).catch(() => setObras([]));
  };
  const copiar = async () => {
    if (!deObra) { message.warning('Escolha a obra.'); return; }
    try { const r = await materiaisApi.copiar(idObra, deObra); message.success(`${r.copiados} material(is) copiado(s) com o custo atual do cadastro.`); setCopiando(false); carregar(); }
    catch (e) { erro(e); }
  };
  const escolhido = cadastro.find(m => m.idMaterial === novo.idMaterial);
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Row gutter={[10, 10]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Custo previsto" value={resumo?.custoPrevisto ?? 0} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title={resumo?.completo ? 'Custo real' : 'Custo real (parcial)'} value={resumo?.custoReal ?? 0} precision={2} prefix="R$" decimalSeparator="," groupSeparator="." /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Diferença" value={resumo?.diferenca ?? 0} precision={2} prefix="R$" decimalSeparator="," groupSeparator="."
          valueStyle={resumo?.diferenca ? { color: resumo.diferenca > 0 ? '#cf1322' : '#389e0d' } : undefined} />
          {resumo && !resumo.completo && <Text type="secondary" style={{ fontSize: 12 }}>quando todos forem conferidos</Text>}</Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Conferidos" value={resumo?.conferidas ?? 0} suffix={`/ ${resumo?.linhas ?? 0}`} /></Card></Col>
      </Row>
      <Card size="small" title="Materiais da obra"
        extra={!cancelada && <Button size="small" icon={<CopyOutlined />} onClick={abrirCopia}>Copiar de outra obra</Button>}>
        {!cancelada && (
          <Row gutter={8} align="bottom" style={{ marginBottom: 10 }}>
            <Col flex="none"><Checkbox checked={novo.avulso} onChange={e => setNovo({ ...novo, avulso: e.target.checked, idMaterial: undefined })}>Item avulso</Checkbox></Col>
            {novo.avulso
              ? <>
                  <Col flex="auto"><Input placeholder="Descrição do item" value={novo.descricao} onChange={e => setNovo({ ...novo, descricao: e.target.value })} /></Col>
                  <Col flex="90px"><Select style={{ width: '100%' }} value={novo.unidade} onChange={unidade => setNovo({ ...novo, unidade })} options={UNIDADES_MATERIAL.map(u => ({ value: u, label: u }))} /></Col>
                  <Col flex="130px"><CampoDinheiro min={0} precision={2} placeholder="custo" style={{ width: '100%' }} value={novo.custo ?? undefined} onChange={v => setNovo({ ...novo, custo: v === null ? null : Number(v) })} /></Col>
                </>
              : <Col flex="auto">
                  <Select showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Material do cadastro" value={novo.idMaterial}
                    onChange={idMaterial => setNovo({ ...novo, idMaterial })}
                    options={(Object.keys(CATEGORIAS_MATERIAL) as CategoriaMaterial[]).map(cat => ({
                      label: CATEGORIAS_MATERIAL[cat],
                      options: cadastro.filter(m => m.categoria === cat).map(m => ({ value: m.idMaterial, label: `${m.nome} · ${brl(m.custo)}/${m.unidade}` })),
                    })).filter(g => g.options.length)} />
                </Col>}
            <Col flex="130px"><CampoNumero min={0} placeholder="previsto" suffix={novo.avulso ? novo.unidade : escolhido?.unidade} style={{ width: '100%' }}
              value={novo.qtd ?? undefined} onChange={v => setNovo({ ...novo, qtd: v === null ? null : Number(v) })} onPressEnter={adicionar} /></Col>
            <Col flex="none"><Button type="primary" icon={<PlusOutlined />} onClick={adicionar} disabled={novo.avulso ? !novo.descricao.trim() : !novo.idMaterial}>Lançar</Button></Col>
          </Row>
        )}
        <Table<LinhaMaterialObra> size="small" rowKey="idLinha" dataSource={linhas} pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum material: lance pelo cadastro ou copie de uma obra parecida" /> }}
          columns={[
            { title: 'Material', render: (_, l) => <><Text>{l.descricao}</Text>{!l.idMaterial && <Tag style={{ marginLeft: 6 }}>avulso</Tag>}</> },
            { title: 'Previsto', width: 110, render: (_, l) => <CelulaNumero valor={l.qtdPrevista} disabled={cancelada} onSalvar={v => salvar(l, { qtdPrevista: v ?? 0 })} /> },
            { title: 'Usado', width: 110, render: (_, l) => <CelulaNumero valor={l.qtdUsada} disabled={cancelada} vazio="conferir" onSalvar={v => salvar(l, { qtdUsada: v })} /> },
            { title: 'Un.', width: 50, dataIndex: 'unidade' },
            { title: 'Custo un.', width: 120, render: (_, l) => <CelulaNumero valor={l.custoUnitario} prefixo="R$" disabled={cancelada} onSalvar={v => salvar(l, { custoUnitario: v ?? 0 })} /> },
            { title: 'Previsto R$', width: 110, align: 'right', render: (_, l) => brl(l.totalPrevisto) },
            { title: 'Real R$', width: 110, align: 'right', render: (_, l) => (l.totalReal === null ? <Text type="secondary">—</Text> : brl(l.totalReal)) },
            {
              title: 'Cliente', width: 150, render: (_, l) => (l.idAdicional && l.adicionalSituacao && l.adicionalSituacao !== 'CANCELADO' && l.adicionalSituacao !== 'RECUSADO'
                ? <Tooltip title={`Adicional de ${brl(l.adicionalValor)}`}><Tag color={SITUACOES_ADICIONAL[l.adicionalSituacao].cor}>cobrado · {SITUACOES_ADICIONAL[l.adicionalSituacao].texto.toLowerCase()}</Tag></Tooltip>
                : !cancelada && <Button size="small" type="link" icon={<DollarOutlined />} onClick={() => setCobrando(l)}>cobrar à parte</Button>),
            },
            {
              title: '', width: 40, render: (_, l) => !cancelada && (
                <Popconfirm title="Tirar este material da obra?" okText="Tirar" cancelText="Voltar"
                  onConfirm={async () => { try { await materiaisApi.removerLinha(l.idLinha); carregar(); } catch (e) { erro(e); } }}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ),
            },
          ]} />
      </Card>
      <CobrarModal linha={cobrando} onFechar={() => setCobrando(null)} onFeito={() => { setCobrando(null); carregar(); }} />
      <Modal open={copiando} title="Copiar materiais de outra obra" okText="Copiar" cancelText="Voltar" onOk={copiar} onCancel={() => setCopiando(false)} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Obra de onde copiar" value={deObra} onChange={setDeObra}
            options={obras.map(o => ({ value: o.idObra, label: `Nº ${o.idObra} · ${o.titulo || o.cliente}${o.cidade ? ` · ${o.cidade}` : ''}` }))} />
          <Text type="secondary" style={{ fontSize: 12 }}>Vêm os materiais e as quantidades previstas, com o custo atual do cadastro. As quantidades usadas não vêm.</Text>
        </Space>
      </Modal>
    </Space>
  );
};

const vazio = (): MaterialForm => ({ nome: '', categoria: 'OUTRO', unidade: 'un', custo: 0, precoVenda: null, observacao: null, ativo: true });

/** Cadastro de materiais do módulo. */
export const CadastroMateriais: React.FC = () => {
  const [lista, setLista] = useState<MaterialPoco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [todos, setTodos] = useState(false);
  const [aberto, setAberto] = useState<MaterialPoco | 'novo' | null>(null);
  const [f, setF] = useState<MaterialForm>(vazio());
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setLista(await materiaisApi.cadastro({ busca, todos })); } catch (e) { erro(e); } finally { setCarregando(false); }
  }, [busca, todos]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? vazio() : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try {
      if (aberto === 'novo') await materiaisApi.criar(f); else if (aberto) await materiaisApi.salvar(aberto.idMaterial, f);
      message.success('Material salvo.'); setAberto(null); carregar();
    } catch (e) { erro(e); }
  };
  return (
    <Card size="small"
      title={<Space><Input allowClear placeholder="Buscar material" style={{ width: 260 }} value={busca} onChange={e => setBusca(e.target.value)} />
        <Checkbox checked={todos} onChange={e => setTodos(e.target.checked)}>mostrar inativos</Checkbox></Space>}
      extra={<Space>
        <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo material</Button>
      </Space>}>
      <Alert type="info" showIcon style={{ marginBottom: 8 }} message="Materiais do módulo de poços: separados do catálogo e do estoque da loja. O custo daqui é o sugerido ao lançar na obra." />
      <Table<MaterialPoco> size="small" rowKey="idMaterial" loading={carregando} dataSource={lista} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        onRow={m => ({ onClick: () => setAberto(m), style: { cursor: 'pointer', opacity: m.ativo ? 1 : 0.55 } })}
        columns={[
          { title: 'Material', dataIndex: 'nome' },
          { title: 'Categoria', width: 160, render: (_, m) => CATEGORIAS_MATERIAL[m.categoria] },
          { title: 'Un.', width: 60, dataIndex: 'unidade' },
          { title: 'Custo', width: 120, align: 'right', render: (_, m) => (m.custo ? brl(m.custo) : <Text type="warning">sem custo</Text>) },
          { title: 'Preço (à parte)', width: 130, align: 'right', render: (_, m) => brl(m.precoVenda) },
          { title: 'Obras', width: 70, align: 'center', dataIndex: 'usos' },
        ]} />
      <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo material' : 'Material'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={() => setAberto(null)} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div><Text>Nome</Text><Input maxLength={120} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder='Ex.: Tubo geomecânico 6" (barra)' /></div>
          <Row gutter={8}>
            <Col span={14}><Text>Categoria</Text>
              <Select style={{ width: '100%' }} value={f.categoria} onChange={categoria => setF({ ...f, categoria })}
                options={(Object.keys(CATEGORIAS_MATERIAL) as CategoriaMaterial[]).map(c => ({ value: c, label: CATEGORIAS_MATERIAL[c] }))} />
            </Col>
            <Col span={10}><Text>Unidade</Text>
              <Select style={{ width: '100%' }} value={f.unidade} onChange={unidade => setF({ ...f, unidade })} options={UNIDADES_MATERIAL.map(u => ({ value: u, label: u }))} />
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}><Text>Custo por {f.unidade}</Text>
              <CampoDinheiro min={0} precision={4} style={{ width: '100%' }} value={f.custo} onChange={v => setF({ ...f, custo: Number(v) || 0 })} />
            </Col>
            <Col span={12}><Text>Preço quando cobrado à parte</Text>
              <CampoDinheiro min={0} precision={2} style={{ width: '100%' }} value={f.precoVenda ?? undefined} onChange={v => setF({ ...f, precoVenda: v === null ? null : Number(v) })} />
            </Col>
          </Row>
          <div><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => setF({ ...f, observacao: e.target.value || null })} /></div>
          <Space><Switch checked={f.ativo} onChange={ativo => setF({ ...f, ativo })} /><Text>{f.ativo ? 'Ativo (aparece ao lançar na obra)' : 'Inativo'}</Text></Space>
        </Space>
      </Modal>
    </Card>
  );
};
