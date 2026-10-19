// Oportunidades: itens do catálogo que ainda não estão no ML. Em cima, o que tem estoque e mais vende no balcão; para cada
// um, o que falta no cadastro e o lucro que daria no ML pelo preço do ERP (calculado só para a página na tela, pois
// consulta tarifa e frete no ML). Cria o rascunho com um clique, ou inclui o item no anúncio da família.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Card, Checkbox, Col, Flex, Input, Popover, Row, Segmented, Space, Spin, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { AppstoreOutlined, PictureOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { anunciosApi, formatarMoeda, LucroOportunidade, Oportunidade } from './mercadoLivreApi';
import { contarOportunidades, FiltroOportunidade, passaNaOportunidade } from './oportunidadesLista';
import { TagSituacao } from './colunasLucro';
import AnuncioEditor from './AnuncioEditor';

const { Text } = Typography;
const POR_PAGINA = 12;
const COR_FALTA = { erro: 'red', aviso: 'orange', info: 'default' } as const;

const Faltas: React.FC<{ o: Oportunidade }> = ({ o }) => {
  const relevantes = o.faltas.filter(f => f.nivel !== 'info');
  if (!relevantes.length) return <Tag color="green">pronto para anunciar</Tag>;
  const tags = (lista: Oportunidade['faltas']) => lista.map(f => <Tag key={f.texto} color={COR_FALTA[f.nivel]} style={{ marginBottom: 2 }}>{f.texto}</Tag>);
  return (
    <Popover title="O que falta" content={<div style={{ maxWidth: 360 }}>{tags(o.faltas)}<div><Text type="secondary" style={{ fontSize: 12 }}>Vermelho o ML recusa; laranja publica, mas muda a conta ou a venda. Dá para corrigir no editor do anúncio, na aba do item › Cadastro.</Text></div></div>}>
      <div>{tags(relevantes.slice(0, 2))}{relevantes.length > 2 && <Tag>+{relevantes.length - 2}</Tag>}</div>
    </Popover>
  );
};

const LucroCelula: React.FC<{ l: LucroOportunidade | undefined; calculando: boolean }> = ({ l, calculando }) => {
  if (!l) return calculando ? <Spin size="small" /> : <Text type="secondary">—</Text>;
  if (l.erro !== undefined) return <Tooltip title={l.erro}><Text type="secondary" style={{ fontSize: 12 }}>não calculado</Text></Tooltip>;
  const detalhe = (
    <div style={{ fontSize: 12 }}>
      <div>Preço do ERP {formatarMoeda(l.preco)} · Clássico · frete grátis {l.freteGratis ? 'ligado' : 'desligado'} (padrão da conta)</div>
      <div>Tarifa {formatarMoeda(l.tarifa)} · frete {formatarMoeda(l.frete)}{l.freteMinimo ? ' (menor faixa: falta o peso)' : ''} · custo {formatarMoeda(l.custo)}</div>
      <div>Categoria: {l.categoria.nome} ({l.categoria.fonte === 'FAMILIA' ? 'a do anúncio da família' : 'sugerida pelo ML'})</div>
      {l.precoAlvo !== null && <div>Para o alvo de {l.alvoPct}%: {formatarMoeda(l.precoAlvo)}{l.freteMinimo ? ' ou mais' : ''}</div>}
    </div>
  );
  return (
    <Tooltip title={detalhe}>
      <div style={{ lineHeight: 1.3 }}>
        <Text strong style={{ color: l.lucro < 0 ? '#cf1322' : undefined }}>{l.freteMinimo ? 'até ' : ''}{formatarMoeda(l.lucro)}</Text>
        {l.lucroPct !== null && <Text type="secondary" style={{ fontSize: 12 }}> {l.lucroPct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%</Text>}
        <div><TagSituacao nivel={l.nivel} alvoPct={l.alvoPct} />{l.freteMinimo && <Tooltip title="Sem peso no cadastro: a conta usou a menor faixa de frete do ML. O lucro real é este ou menor."><Tag style={{ marginLeft: 4 }}>sem peso</Tag></Tooltip>}</div>
      </div>
    </Tooltip>
  );
};

const OportunidadesMl: React.FC = () => {
  const [itens, setItens] = useState<Oportunidade[]>([]);
  const [dias, setDias] = useState(90);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroOportunidade>('todos');
  const [somenteEstoque, setSomenteEstoque] = useState(true);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [visiveis, setVisiveis] = useState<Oportunidade[] | null>(null);   // ordem da tabela depois de ordenar uma coluna
  const [lucros, setLucros] = useState<Map<number, LucroOportunidade>>(new Map());
  const [calculando, setCalculando] = useState<Set<number>>(new Set());
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [criando, setCriando] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const pedidos = useRef(new Set<number>());

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await anunciosApi.oportunidades();
      setItens(r.itens);
      setDias(r.dias);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => itens.filter(o => passaNaOportunidade(o, { filtro, somenteEstoque, busca })), [itens, filtro, somenteEstoque, busca]);
  const contagem = useMemo(() => contarOportunidades(itens, somenteEstoque), [itens, somenteEstoque]);
  useEffect(() => { setPagina(1); setVisiveis(null); }, [filtro, somenteEstoque, busca]);

  // lucro só da página na tela (cada item consulta tarifa e frete no ML)
  const naTela = useMemo(() => (visiveis ?? filtrados).slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), [visiveis, filtrados, pagina]);
  useEffect(() => {
    const faltam = naTela.map(o => o.idItem).filter(id => !pedidos.current.has(id));
    if (!faltam.length) return;
    faltam.forEach(id => pedidos.current.add(id));
    setCalculando(s => new Set([...s, ...faltam]));
    anunciosApi.lucroOportunidades(faltam)
      .then(r => setLucros(m => { const n = new Map(m); r.forEach(l => n.set(l.idItem, l)); return n; }))
      .catch(e => { faltam.forEach(id => pedidos.current.delete(id)); message.error(e instanceof Error ? e.message : 'Erro ao calcular o lucro.'); })
      .finally(() => setCalculando(s => { const n = new Set(s); faltam.forEach(id => n.delete(id)); return n; }));
  }, [naTela]);

  const saiDaLista = (ids: number[]) => {
    setItens(l => l.filter(o => !ids.includes(o.idItem)));
    setSelecionados(s => s.filter(id => !ids.includes(id)));
  };

  const criar = async (chave: string, idItens: number[], separados: boolean) => {
    setCriando(chave);
    try {
      const r = await anunciosApi.criar({ idItens, separados });
      saiDaLista(idItens);
      if (r.ids.length === 1) { message.success('Rascunho criado: confira e publique.'); setEditando(r.ids[0]); }
      else message.success(`${r.ids.length} rascunhos criados: estão na aba Anúncios.`);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao criar.'); }
    finally { setCriando(null); }
  };

  const incluir = async (o: Oportunidade) => {
    if (!o.familiaNoMl) return;
    setCriando(`i${o.idItem}`);
    try {
      await anunciosApi.adicionarItens(o.familiaNoMl.idAnuncio, [o.idItem]);
      saiDaLista([o.idItem]);
      message.success(`${o.sku} incluído no anúncio da família: confira e atualize no ML.`);
      setEditando(o.familiaNoMl.idAnuncio);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao incluir.'); }
    finally { setCriando(null); }
  };

  const cartao = (chave: FiltroOportunidade, titulo: React.ReactNode, valor: number, dica: string, cor?: string) => (
    <Col xs={12} md={6}>
      <Tooltip title={dica}>
        <Card size="small" hoverable onClick={() => setFiltro(chave)} style={filtro === chave ? { borderColor: '#1677ff' } : undefined}>
          <Statistic title={titulo} value={valor} valueStyle={cor ? { color: cor } : undefined} />
        </Card>
      </Tooltip>
    </Col>
  );

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {cartao('todos', 'Fora do ML', contagem.todos, `Itens ativos do catálogo que não estão em nenhum anúncio${somenteEstoque ? ' (com estoque)' : ''}.`)}
        {cartao('balcao', `Vendem no balcão (${dias} dias)`, contagem.balcao, 'Já têm procura na loja: os mais promissores para o ML.', '#1677ff')}
        {cartao('prontos', 'Prontos para anunciar', contagem.prontos, 'Têm foto, preço, peso, medidas e estoque: é criar e publicar.', '#3f8600')}
        {cartao('familia', 'Família já no ML', contagem.familia, 'A família já tem anúncio: dá para incluir o item como mais uma variação.', '#722ed1')}
      </Row>

      <Card size="small">
        <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
          <Space wrap>
            <Segmented<FiltroOportunidade> value={filtro} onChange={setFiltro} options={[
              { value: 'todos', label: `Todos (${contagem.todos})` },
              { value: 'balcao', label: `Vendem no balcão (${contagem.balcao})` },
              { value: 'prontos', label: `Prontos (${contagem.prontos})` },
              { value: 'familia', label: `Família no ML (${contagem.familia})` },
            ]} />
            <Checkbox checked={somenteEstoque} onChange={e => setSomenteEstoque(e.target.checked)}>Só com estoque</Checkbox>
          </Space>
          <Space>
            <Input.Search placeholder="Buscar item, SKU, família ou marca" allowClear value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 300 }} />
            <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={() => { pedidos.current.clear(); setLucros(new Map()); carregar(); }} /></Tooltip>
          </Space>
        </Flex>
        {(contagem.semFoto > 0 || contagem.semPeso > 0) && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
            No catálogo{somenteEstoque ? ' com estoque' : ''}: {contagem.semFoto} item(ns) sem foto (o ML recusa) e {contagem.semPeso} sem peso ou medidas (o frete fica de fora da conta).
            O lucro usa o preço do ERP, Clássico e o frete grátis padrão da conta.
          </Text>
        )}
        {selecionados.length > 0 && (
          <Flex align="center" gap={8} style={{ marginBottom: 8, padding: '6px 10px', background: '#e6f4ff', borderRadius: 6 }}>
            <Text>{selecionados.length} selecionado(s)</Text>
            <Button size="small" loading={criando === 'sep'} onClick={() => criar('sep', selecionados, true)}>Um anúncio para cada</Button>
            <Tooltip title="Um anúncio só, e o comprador escolhe a medida (os itens precisam ser da mesma família ou do mesmo tipo)">
              <Button size="small" type="primary" icon={<AppstoreOutlined />} disabled={selecionados.length < 2} loading={criando === 'jun'} onClick={() => criar('jun', selecionados, false)}>Um anúncio com variações</Button>
            </Tooltip>
            <Button size="small" type="link" onClick={() => setSelecionados([])}>Limpar seleção</Button>
          </Flex>
        )}
        <Table<Oportunidade>
          size="small" rowKey="idItem" loading={carregando} dataSource={filtrados}
          pagination={{ current: pagina, pageSize: POR_PAGINA, showSizeChanger: false, showTotal: t => `${t} item(ns)` }}
          onChange={(p, _f, _s, extra) => {
            setPagina(p.current || 1);
            if (extra.action === 'sort') { setVisiveis(extra.currentDataSource); setPagina(1); }
          }}
          rowSelection={{ selectedRowKeys: selecionados, preserveSelectedRowKeys: true, onChange: k => setSelecionados(k as number[]) }}
          columns={[
            {
              title: '', width: 52,
              render: (_, o) => o.fotoUrl
                ? <Avatar shape="square" size={40} src={o.fotoUrl} />
                : <Avatar shape="square" size={40} icon={<PictureOutlined />} style={{ background: '#f0f0f0', color: '#bbb' }} />,
            },
            {
              title: 'Item',
              render: (_, o) => (
                <div style={{ lineHeight: 1.35 }}>
                  <Text strong>{o.sku}</Text> <Text>{o.nome}</Text>
                  <div>
                    {o.familia && <Text type="secondary" style={{ fontSize: 12 }}>{o.familia}</Text>}
                    {o.familiaNoMl && <Tooltip title={`A família já está no anúncio "${o.familiaNoMl.titulo}"`}><Tag color="purple" style={{ marginLeft: 6 }}>família no ML #{o.familiaNoMl.idAnuncio}</Tag></Tooltip>}
                  </div>
                </div>
              ),
            },
            { title: 'Estoque', dataIndex: 'estoque', width: 85, align: 'right', sorter: (a, b) => a.estoque - b.estoque },
            {
              title: <Tooltip title={`Unidades vendidas no balcão (PDV) nos últimos ${dias} dias`}>Balcão</Tooltip>, dataIndex: 'vendidos90', width: 85, align: 'right',
              sorter: (a, b) => a.vendidos90 - b.vendidos90,
              render: v => v > 0 ? <Text strong>{v.toLocaleString('pt-BR')}</Text> : <Text type="secondary">0</Text>,
            },
            { title: 'Preço ERP', dataIndex: 'preco', width: 100, align: 'right', sorter: (a, b) => a.preco - b.preco, render: formatarMoeda },
            {
              title: <Tooltip title="Lucro por venda no ML pelo preço do ERP: Clássico, com o frete grátis padrão da conta e a tarifa da categoria. Calculado só para a página na tela.">Lucro no ML</Tooltip>,
              width: 150, render: (_, o) => <LucroCelula l={lucros.get(o.idItem)} calculando={calculando.has(o.idItem)} />,
            },
            { title: 'O que falta', width: 260, render: (_, o) => <Faltas o={o} /> },
            {
              title: '', width: 150, align: 'right',
              render: (_, o) => o.familiaNoMl ? (
                <Tooltip title={`Inclui como mais um item do anúncio "${o.familiaNoMl.titulo}" e abre o editor`}>
                  <Button size="small" icon={<PlusOutlined />} loading={criando === `i${o.idItem}`} onClick={() => incluir(o)}>Incluir no #{o.familiaNoMl.idAnuncio}</Button>
                </Tooltip>
              ) : (
                <Tooltip title="Cria o rascunho do anúncio (categoria e atributos já sugeridos) e abre o editor">
                  <Button size="small" type="primary" icon={<PlusOutlined />} loading={criando === `c${o.idItem}`} onClick={() => criar(`c${o.idItem}`, [o.idItem], true)}>Criar anúncio</Button>
                </Tooltip>
              ),
            },
          ]}
        />
      </Card>
      <AnuncioEditor id={editando} onFechar={() => setEditando(null)} onAlterado={() => undefined} />
    </div>
  );
};

export default OportunidadesMl;
