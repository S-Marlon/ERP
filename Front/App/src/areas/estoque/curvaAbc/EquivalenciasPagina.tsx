// Estoque › Marcas e equivalentes: itens que servem para a mesma coisa (atributos que definem equivalência), quem vende e
// quem trava o estoque, a decisão de compra (preferido / não recomprar) e o preço para escoar; demanda por atributo, giro
// por marca, quais atributos definem equivalência e o cadastro pendente.
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Drawer, Empty, Flex, Input, Modal, Progress, Row, Segmented, Space, Statistic, Switch, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import { CheckCircleOutlined, DollarOutlined, ReloadOutlined, StopOutlined, WarningOutlined } from '@ant-design/icons';
import ProductCommercialSalesConfig from '../../catalogo/precos/ProductCommercialSalesConfig';
import { TagMarca } from '../../../shared/components/TagMarca';
import { AlertaGrupo, CONFIANCA, DecisaoCompra, equivalenciasApi, GrupoEquivalente, ItemGrupo, PAPEL, RelatorioEquivalencias, SugestaoMarca } from './equivalenciasApi';

/** "[TETIS] tem 78% do estoque e 0% das vendas · o cliente prefere [EBARA]" com as marcas em etiqueta. */
export const AlertaMarcas: React.FC<{ a: AlertaGrupo }> = ({ a }) => (
  <Space size={4} wrap style={{ lineHeight: '22px' }}>
    <TagMarca marca={a.trava} /><Text>tem</Text><Text strong type="danger">{Math.round(a.partEstoque * 100)}% do estoque</Text>
    <Text>e</Text><Text strong>{Math.round(a.partVendas * 100)}% das vendas</Text><Text type="secondary">· o cliente prefere</Text><TagMarca marca={a.preferida} />
  </Space>
);

const MarcaNoNome: React.FC<{ onAplicado: () => void }> = ({ onAplicado }) => {
  const [dados, setDados] = React.useState<{ sugestoes: SugestaoMarca[]; semMarca: number } | null>(null);
  const [selecionados, setSelecionados] = React.useState<number[]>([]);
  const [aplicando, setAplicando] = React.useState(false);
  const carregar = () => equivalenciasApi.sugestoesMarca().then(d => { setDados(d); setSelecionados(d.sugestoes.map(s => s.idItem)); }).catch(e => message.error(e.message));
  React.useEffect(() => { carregar(); }, []);
  if (!dados) return <Card loading size="small" />;
  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await equivalenciasApi.aplicarMarcas(dados.sugestoes.filter(s => selecionados.includes(s.idItem)).map(s => ({ idItem: s.idItem, marca: s.marca })));
      message.success(`${r.atribuidas} item(ns) com marca${r.criadas.length ? ` · marcas criadas: ${r.criadas.join(', ')}` : ''}.`);
      carregar(); onAplicado();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setAplicando(false); }
  };
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={`${dados.semMarca} itens sem marca; em ${dados.sugestoes.length} o nome cita a marca do próprio produto.`}
        description='Marca de compatibilidade não entra (ex.: "escova p/ DeWALT", "terminal para Karcher": é a máquina, não quem fabricou). Desmarque o que não estiver certo antes de aplicar.' />
      {dados.sugestoes.length > 0 && (
        <Flex justify="space-between" align="center">
          <Text type="secondary">{selecionados.length} selecionado(s)</Text>
          <Button type="primary" loading={aplicando} disabled={!selecionados.length} onClick={aplicar}>Aplicar marcas</Button>
        </Flex>
      )}
      <Table<SugestaoMarca> size="small" rowKey="idItem" dataSource={dados.sugestoes} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        rowSelection={{ selectedRowKeys: selecionados, onChange: k => setSelecionados(k as number[]) }}
        locale={{ emptyText: <Empty description="Nenhum item sem marca cita uma marca no nome." /> }}
        columns={[
          { title: 'Marca', dataIndex: 'marca', width: 170, render: (v: string, s) => <Space size={4}><TagMarca marca={v} />{s.marcaNova && <Tag color="blue" style={{ margin: 0 }}>nova</Tag>}</Space> },
          { title: 'Item', key: 'i', render: (_, s) => <><Text>{s.nome}</Text> <Text type="secondary" style={{ fontSize: 11 }}>{s.sku}</Text></> },
          { title: 'Categoria', dataIndex: 'categoria', width: 240 },
        ]} />
    </Space>
  );
};

const { Text, Title } = Typography;
const brl = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const qtd = (v: number) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const pct = (v: number) => `${Math.round(v * 100)}%`;
type Filtro = 'ALERTA' | 'TODOS' | 'DECISAO';

const GrupoCard: React.FC<{ g: GrupoEquivalente; onDecidir: (i: ItemGrupo, d: DecisaoCompra, sugestao: string) => void; onPreco: (i: ItemGrupo) => void }> = ({ g, onDecidir, onPreco }) => (
  <Card size="small" style={{ borderColor: g.alerta ? '#ffa39e' : undefined }}
    title={<Space wrap><Text strong>{g.valores.map(v => `${v.atributo} ${v.valor}`).join(' · ')}</Text><Text type="secondary" style={{ fontWeight: 400 }}>{g.categoria}</Text>
      <Tooltip title={CONFIANCA[g.confianca].ajuda}><Tag color={CONFIANCA[g.confianca].cor}>{CONFIANCA[g.confianca].rotulo} · {g.vendas} {g.vendas === 1 ? 'venda' : 'vendas'}</Tag></Tooltip>
      {g.conflito && <Tooltip title="A decisão gravada vai contra o que os números mostram: vale revisar"><Tag color="orange" icon={<WarningOutlined />}>decisão x números</Tag></Tooltip>}</Space>}
    extra={g.valorTravado > 0 && <Text type="danger">travado {brl0(g.valorTravado)}</Text>}>
    {g.alertas.length > 0 && <Alert type="warning" showIcon style={{ marginBottom: 8, padding: '4px 10px' }} title={<Space direction="vertical" size={2}>{g.alertas.map((a, k) => <AlertaMarcas key={k} a={a} />)}</Space>} />}
    <Table<ItemGrupo> size="small" rowKey="idItem" pagination={false} dataSource={g.itens} columns={[
      { title: '', dataIndex: 'papel', width: 70, render: (p: ItemGrupo['papel']) => <Tooltip title={PAPEL[p].ajuda}><Tag color={PAPEL[p].cor} style={{ margin: 0 }}>{PAPEL[p].rotulo}</Tag></Tooltip> },
      { title: 'Item', key: 'i', render: (_, i) => <><TagMarca marca={i.marca} vazio={i.familia || 'sem marca'} /> <Text type="secondary" style={{ fontSize: 12 }}>{i.sku}</Text><div><Text type="secondary" style={{ fontSize: 11 }}>{i.nome}</Text></div></> },
      { title: 'Vendas', key: 'v', width: 130, render: (_, i) => <><Text>{qtd(i.quantidade)}</Text><Progress percent={Math.round(i.partVendas * 100)} size="small" strokeColor="#52c41a" format={() => pct(i.partVendas)} /></> },
      { title: 'Estoque', key: 'e', width: 130, render: (_, i) => <><Text>{qtd(i.estoque)} <Text type="secondary" style={{ fontSize: 11 }}>{brl0(i.valorEstoque)}</Text></Text><Progress percent={Math.round(i.partEstoque * 100)} size="small" strokeColor={i.papel === 'TRAVA' ? '#ff4d4f' : '#1677ff'} format={() => pct(i.partEstoque)} /></> },
      { title: <Tooltip title="Vendido no período ÷ estoque médio">Giro</Tooltip>, dataIndex: 'giro', width: 60, align: 'right' as const, render: (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR')) },
      {
        title: 'Preço', key: 'p', width: 140, align: 'right' as const, render: (_, i) => <>
          {brl(i.precoVenda)}
          {i.precoEscoar !== null && <div><Tooltip title={i.precoEscoarNoMinimo ? 'No mínimo pela margem: abaixo disso perde dinheiro' : '10% abaixo do que mais vende'}><Text type="danger" style={{ fontSize: 11 }}>escoar a {brl(i.precoEscoar)}</Text></Tooltip></div>}
        </>,
      },
      {
        title: 'Decisão de compra', key: 'd', width: 250, render: (_, i) => {
          const sugestao = i.papel === 'TRAVA' && g.vencedor ? `Cliente prefere ${g.vencedor.marca}: ${pct(i.partEstoque)} do estoque e ${pct(i.partVendas)} das vendas`
            : i.papel === 'VENDE' ? `Mais vendido no grupo (${pct(i.partVendas)} das vendas)` : '';
          return <Space direction="vertical" size={2}>
            <Space size={4}>
              <Tooltip title={i.decisaoCompra === 'PREFERIDO' ? 'Tirar a decisão' : 'Preferir nas próximas compras'}>
                <Button size="small" type={i.decisaoCompra === 'PREFERIDO' ? 'primary' : 'default'} icon={<CheckCircleOutlined />}
                  onClick={() => onDecidir(i, i.decisaoCompra === 'PREFERIDO' ? null : 'PREFERIDO', sugestao)}>Preferido</Button>
              </Tooltip>
              <Tooltip title={i.decisaoCompra === 'NAO_RECOMPRAR' ? 'Tirar a decisão' : 'Não recomprar (vender o que tem)'}>
                <Button size="small" danger type={i.decisaoCompra === 'NAO_RECOMPRAR' ? 'primary' : 'default'} icon={<StopOutlined />}
                  onClick={() => onDecidir(i, i.decisaoCompra === 'NAO_RECOMPRAR' ? null : 'NAO_RECOMPRAR', sugestao)}>Não recomprar</Button>
              </Tooltip>
              <Tooltip title="Ajustar preço"><Button size="small" icon={<DollarOutlined />} onClick={() => onPreco(i)} /></Tooltip>
            </Space>
            {i.decisaoCompra && <Text type="secondary" style={{ fontSize: 11 }}>{i.decisaoMotivo || 'sem motivo'} · {i.decisaoPor} {i.decisaoEm?.split('-').reverse().join('/')}</Text>}
          </Space>;
        },
      },
    ]} />
  </Card>
);

const EquivalenciasPagina: React.FC = () => {
  const [r, setR] = useState<RelatorioEquivalencias | null>(null);
  const [dias, setDias] = useState(90);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('ALERTA');
  const [busca, setBusca] = useState('');
  const [decidindo, setDecidindo] = useState<{ item: ItemGrupo; decisao: DecisaoCompra; motivo: string } | null>(null);
  const [preco, setPreco] = useState<ItemGrupo | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try { setR(await equivalenciasApi.carregar(dias)); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); } finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (r?.grupos || [])
      .filter(g => filtro === 'TODOS' || (filtro === 'ALERTA' ? !!g.alerta || g.conflito : g.itens.some(i => i.decisaoCompra)))
      .filter(g => !t || `${g.titulo} ${g.itens.map(i => `${i.sku} ${i.nome} ${i.marca}`).join(' ')}`.toLowerCase().includes(t));
  }, [r, filtro, busca]);

  const decidir = (item: ItemGrupo, decisao: DecisaoCompra, sugestao: string) => {
    if (decisao === null) {
      equivalenciasApi.decisao(item.idItem, null).then(() => { message.success('Decisão retirada.'); carregar(); }).catch(e => message.error(e.message));
      return;
    }
    setDecidindo({ item, decisao, motivo: sugestao });
  };

  if (!r) return <div style={{ padding: 16 }}><Card loading /></div>;
  const comAlerta = r.grupos.filter(g => g.alerta).length;
  const travado = r.grupos.reduce((a, g) => a + g.valorTravado, 0);
  const decididos = r.grupos.reduce((a, g) => a + g.itens.filter(i => i.decisaoCompra).length, 0);

  return (
    <div style={{ padding: 16 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Marcas e equivalentes</Title>
            <Text type="secondary">Itens que servem para a mesma coisa: qual o cliente prefere, qual trava o estoque e o que comprar.</Text>
          </div>
          <Space wrap>
            <Segmented value={dias} onChange={v => setDias(Number(v))} options={[30, 90, 180, 365].map(d => ({ value: d, label: d === 365 ? '12 meses' : `${d} dias` }))} />
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando} />
          </Space>
        </Flex>
        {r.diasDeHistorico < 60 && <Alert type="info" showIcon title={`Vendas registradas há ${r.diasDeHistorico} dias: os sinais ainda são fracos. A sua decisão (preferido / não recomprar) vale mais que a estatística.`} />}
        <Row gutter={10}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Grupos de equivalentes" value={r.grupos.length} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Com item travando" value={comAlerta} valueStyle={{ color: comAlerta ? '#cf1322' : undefined }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Estoque travado" value={brl0(travado)} valueStyle={{ color: travado ? '#cf1322' : undefined }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Tooltip title="Sem marca o item não é comparado com os equivalentes"><Statistic title="Itens sem marca" value={r.itensSemMarca} suffix={<Text type="secondary" style={{ fontSize: 12 }}>{decididos} decididos</Text>} /></Tooltip></Card></Col>
        </Row>

        <Tabs items={[
          {
            key: 'grupos', label: 'Quem vende e quem trava', children: (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Flex gap={8} wrap align="center">
                  <Segmented value={filtro} onChange={v => setFiltro(v as Filtro)} options={[
                    { value: 'ALERTA', label: `Com alerta (${r.grupos.filter(g => g.alerta || g.conflito).length})` },
                    { value: 'DECISAO', label: `Com decisão (${r.grupos.filter(g => g.itens.some(i => i.decisaoCompra)).length})` },
                    { value: 'TODOS', label: `Todos (${r.grupos.length})` },
                  ]} />
                  <Input.Search allowClear placeholder="Marca, código, valor (ex.: 6203, Tetis)" style={{ width: 280 }} value={busca} onChange={e => setBusca(e.target.value)} />
                </Flex>
                {grupos.length === 0 ? <Empty description={filtro === 'ALERTA' ? 'Nenhum grupo com item travando.' : 'Nenhum grupo neste filtro.'} />
                  : grupos.map(g => <GrupoCard key={g.chave} g={g} onDecidir={decidir} onPreco={setPreco} />)}
              </Space>
            ),
          },
          {
            key: 'demanda', label: 'Demanda por atributo', children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">O que o cliente procura, somando todas as marcas: guia o que manter em estoque (a aba anterior diz de qual marca).</Text>
                <Table size="small" rowKey={x => `${x.categoria}|${x.atributo}|${x.valor}`} dataSource={r.demanda} pagination={{ pageSize: 30, hideOnSinglePage: true }} columns={[
                  { title: 'Atributo', dataIndex: 'atributo', width: 180 },
                  { title: 'Valor', dataIndex: 'valor', width: 120, render: (v: string) => <Text strong>{v}</Text> },
                  { title: 'Categoria', dataIndex: 'categoria' },
                  { title: 'Vendidos', dataIndex: 'quantidade', width: 90, align: 'right' as const, render: (v: number) => qtd(v) },
                  { title: 'Faturou', dataIndex: 'receita', width: 110, align: 'right' as const, render: (v: number) => (v ? brl(v) : '—') },
                  { title: 'Em estoque', dataIndex: 'estoque', width: 100, align: 'right' as const, render: (v: number) => qtd(v) },
                  { title: 'Marcas', dataIndex: 'marcas', width: 220, render: (v: string[]) => <Space size={4} wrap>{v.map(m => <TagMarca key={m} marca={m} />)}</Space> },
                ]} />
              </Space>
            ),
          },
          {
            key: 'marcas', label: 'Marcas', children: (
              <Table size="small" rowKey="marca" dataSource={r.marcas} pagination={{ pageSize: 30, hideOnSinglePage: true }} columns={[
                { title: 'Marca', dataIndex: 'marca', render: (v: string) => <TagMarca marca={v} /> },
                { title: 'Itens', dataIndex: 'itens', width: 70, align: 'right' as const },
                { title: 'Vendidos', dataIndex: 'quantidade', width: 90, align: 'right' as const, render: (v: number) => qtd(v) },
                { title: 'Faturou', dataIndex: 'receita', width: 110, align: 'right' as const, sorter: (a, b) => a.receita - b.receita, render: (v: number) => brl(v) },
                { title: 'Estoque', dataIndex: 'valorEstoque', width: 110, align: 'right' as const, sorter: (a, b) => a.valorEstoque - b.valorEstoque, render: (v: number) => brl0(v) },
                {
                  title: <Tooltip title="Vendido no período ÷ estoque médio (quanto maior, mais a marca gira)">Giro</Tooltip>, dataIndex: 'giro', width: 90, align: 'right' as const,
                  sorter: (a, b) => (a.giro ?? -1) - (b.giro ?? -1), render: (v: number | null) => (v === null ? '—' : <Text type={v < 0.05 ? 'danger' : undefined}>{v.toLocaleString('pt-BR')}</Text>),
                },
              ]} />
            ),
          },
          {
            key: 'atributos', label: 'Atributos de equivalência', children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert type="info" showIcon title="Ligue as características que fazem dois produtos serem a mesma coisa para o cliente. Itens da mesma categoria com os mesmos valores nesses atributos são comparados."
                  description={<>Não ligue o que muda de marca para marca (ex.: "Modelo da bomba"). Ex.: rolamento 6000 ZZ e 2RS só são trocáveis se o cliente não se importa com a vedação; se importa, ligue também <b>Vedação</b>.</>} />
                <Table size="small" rowKey="id" dataSource={r.atributos} pagination={{ pageSize: 40, hideOnSinglePage: true }} columns={[
                  {
                    title: 'Define equivalência', dataIndex: 'define', width: 150, render: (v: boolean, a) => (
                      <Switch checked={v} onChange={x => equivalenciasApi.marcarAtributo(a.id, x).then(() => { message.success(x ? `"${a.nome}" passa a definir equivalência.` : `"${a.nome}" desligado.`); carregar(); }).catch(e => message.error(e.message))} />),
                  },
                  { title: 'Atributo', dataIndex: 'nome', render: (v: string) => <Text strong>{v}</Text> },
                  { title: 'Itens', dataIndex: 'itens', width: 80, align: 'right' as const },
                  { title: 'Exemplos de valores', dataIndex: 'exemplos', render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
                ]} />
              </Space>
            ),
          },
          { key: 'marcaNome', label: 'Marca no nome', children: <MarcaNoNome onAplicado={carregar} /> },
          {
            key: 'pendencias', label: `Cadastro pendente (${r.pendencias.length})`, children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text type="secondary">Itens das categorias com equivalentes que estão sem marca ou sem o atributo de equivalência: sem isso eles ficam de fora da comparação. Complete no catálogo.</Text>
                <Table size="small" rowKey="idItem" dataSource={r.pendencias} pagination={{ pageSize: 30, hideOnSinglePage: true }} columns={[
                  { title: 'Código', dataIndex: 'sku', width: 160 },
                  { title: 'Item', dataIndex: 'nome' },
                  { title: 'Categoria', dataIndex: 'categoria', width: 220 },
                  { title: 'Falta', dataIndex: 'falta', width: 220, render: (v: string) => <Tag color="orange">{v}</Tag> },
                ]} />
              </Space>
            ),
          },
        ]} />
      </Space>

      <Modal open={!!decidindo} title={decidindo ? `${decidindo.decisao === 'PREFERIDO' ? 'Preferir' : 'Não recomprar'}: ${decidindo.item.marca || ''} ${decidindo.item.sku}` : ''}
        okText="Gravar" cancelText="Voltar" onCancel={() => setDecidindo(null)} okButtonProps={{ danger: decidindo?.decisao === 'NAO_RECOMPRAR' }} destroyOnHidden
        onOk={() => decidindo && equivalenciasApi.decisao(decidindo.item.idItem, decidindo.decisao, decidindo.motivo)
          .then(() => { message.success('Decisão gravada: os relatórios de compra passam a respeitar.'); setDecidindo(null); carregar(); })
          .catch(e => message.error(e.message))}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{decidindo?.decisao === 'PREFERIDO'
            ? 'O item fica como preferido nas compras: não aparece em "não recomprar" e é o sugerido quando o grupo precisar de reposição.'
            : 'O item sai da lista de reposição e entra em "não recomprar". O estoque que já tem continua à venda (vale escoar com o preço sugerido).'}</Text>
          <Input.TextArea rows={2} maxLength={150} placeholder="Motivo" value={decidindo?.motivo || ''} onChange={e => decidindo && setDecidindo({ ...decidindo, motivo: e.target.value })} />
        </Space>
      </Modal>
      <Drawer open={!!preco} onClose={() => { setPreco(null); carregar(); }} width="min(1100px, 100vw)" destroyOnHidden title={preco ? `Preço · ${preco.marca || ''} ${preco.sku}` : ''}>
        {preco && <ProductCommercialSalesConfig idItem={preco.idItem} />}
      </Drawer>
    </div>
  );
};

export default EquivalenciasPagina;
