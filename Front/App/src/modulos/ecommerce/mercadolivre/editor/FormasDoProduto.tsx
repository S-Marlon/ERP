// Formas de venda de um produto (unidade, kit c/2, kit c/10...), uma em cada cartão, com a escada de preço por
// quantidade DAQUELA forma. Cada forma é um anúncio separado no ML e a quantidade da escada conta na unidade dele: no
// kit c/10, "a partir de 3" = 3 kits = 30 peças. O cartão mostra isso em cada degrau e avisa degrau com muitas peças.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Flex, Popconfirm, Space, Spin, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import { BarChartOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, DegrauEscada, EscadaLinha, FaixaQuantidade, foraDoMl, formatarMoeda, ItemDoAnuncio, ROTULO_STATUS_ML } from '../mercadoLivreApi';
import { rotuloDaUnidade } from '../linhasAnuncio';
import { SITUACAO_LUCRO } from '../colunasLucro';
import { AvisoMl } from '../AvisoMl';
import { CampoNumero } from '../../../../shared/formularios/CamposNumero';

const { Text } = Typography;
const MAX_DEGRAUS = 5;

const nomeDaForma = (l: ItemDoAnuncio) => (l.unidadeMl ? `Kit c/${l.unidadeMl.fator}` : 'Unidade');

const origemDaEscada = (l: ItemDoAnuncio, temDoAnuncio: boolean) => {
  if (l.faixasProprias) return l.faixasProprias.length ? { texto: 'escada própria', cor: 'blue' } : { texto: 'sem escada (escolhido)', cor: 'default' };
  if ((l.unidadeMl?.fator || 1) > 1) return { texto: 'sem escada (kit)', cor: 'default' };
  return temDoAnuncio ? { texto: 'segue a escada do anúncio', cor: 'purple' } : { texto: 'sem escada', cor: 'default' };
};

/** Tabela dos degraus: compra, peças, preço (por kit e por peça), frete de um envio e lucro. */
const TabelaEscada: React.FC<{ escada: EscadaLinha }> = ({ escada }) => (
  <Table<DegrauEscada>
    size="small" pagination={false} rowKey="quantidade" dataSource={escada.degraus}
    rowClassName={d => (d.lucro < 0 ? 'ml-linha-erro' : '')}
    columns={[
      {
        title: 'Comprando', render: (_, d) => (
          <Space size={4} wrap>
            <Text strong>{d.quantidade === 1 ? `1 ${escada.fator > 1 ? 'kit' : escada.siglaBase}` : `a partir de ${d.quantidade}`}</Text>
            {escada.fator > 1 && <Text type="secondary" style={{ fontSize: 12 }}>= {d.pecas} {escada.siglaBase}</Text>}
            {d.desconto > 0 && <Tag color="purple" style={{ marginInlineEnd: 0 }}>−{d.desconto}%</Tag>}
          </Space>
        ),
      },
      {
        title: escada.fator > 1 ? 'Preço do kit' : 'Preço', align: 'right', render: (_, d) => (
          <div style={{ lineHeight: 1.3 }}>
            <Text strong>{formatarMoeda(d.precoUnit)}</Text>
            {escada.fator > 1 && <div><Text type="secondary" style={{ fontSize: 11 }}>{formatarMoeda(d.precoPorPeca)}/{escada.siglaBase}</Text></div>}
          </div>
        ),
      },
      { title: <Tooltip title="Um envio por compra (a compra maior pode passar de R$ 79 e mudar o frete)">Frete</Tooltip>, dataIndex: 'frete', align: 'right', render: (v: number) => <Text type="secondary">{v ? `−${formatarMoeda(v)}` : '—'}</Text> },
      {
        title: 'Lucro da compra', align: 'right', render: (_, d) => (
          <div style={{ lineHeight: 1.3 }}>
            <Text strong style={{ color: d.lucro < 0 ? '#cf1322' : '#389e0d' }}>{formatarMoeda(d.lucro)}</Text>
            {d.quantidade > 1 && <div><Text type="secondary" style={{ fontSize: 11 }}>{formatarMoeda(d.lucroPorUnidade)}/{escada.fator > 1 ? 'kit' : escada.siglaBase}</Text></div>}
          </div>
        ),
      },
      { title: '', width: 120, render: (_, d) => SITUACAO_LUCRO[d.nivel] && <Tag color={SITUACAO_LUCRO[d.nivel].cor} style={{ marginInlineEnd: 0 }}>{SITUACAO_LUCRO[d.nivel].texto}</Tag> },
    ]}
  />
);

/** Editor da escada de uma forma, com a prévia calculada enquanto digita. */
const EditorEscada: React.FC<{
  idAnuncio: number; linha: ItemDoAnuncio; inicial: FaixaQuantidade[]; temDoAnuncio: boolean;
  onSalvar: (faixas: FaixaQuantidade[] | null) => Promise<void>; onCancelar: () => void;
}> = ({ idAnuncio, linha, inicial, temDoAnuncio, onSalvar, onCancelar }) => {
  const [faixas, setFaixas] = useState<FaixaQuantidade[]>(inicial.length ? inicial : [{ minimo: 2, desconto: 3 }]);
  const [previa, setPrevia] = useState<EscadaLinha | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fator = linha.unidadeMl?.fator || 1;
  const sigla = linha.siglaBase || 'un';
  const vez = useRef(0);
  useEffect(() => {
    const minha = ++vez.current;
    const t = window.setTimeout(() => {
      anunciosApi.escada(idAnuncio, linha.idLinha, faixas).then(r => { if (minha === vez.current) setPrevia(r); }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(t);
  }, [faixas, idAnuncio, linha.idLinha]);

  const mudar = (k: number, campo: keyof FaixaQuantidade, v: number | null) => setFaixas(fs => fs.map((f, i) => (i === k ? { ...f, [campo]: Number(v) || 0 } : f)));
  const salvar = async (valor: FaixaQuantidade[] | null) => { setSalvando(true); try { await onSalvar(valor); } finally { setSalvando(false); } };

  return (
    <div style={{ border: '1px dashed #91caff', borderRadius: 8, padding: 12, background: '#f8fbff' }}>
      <Text strong>Escada desta forma ({nomeDaForma(linha)})</Text>
      <div style={{ fontSize: 12, margin: '2px 0 8px' }}>
        <Text type="secondary">
          A quantidade conta na unidade deste anúncio{fator > 1 ? `: ${fator} ${sigla} por kit, então "a partir de 3" = 3 kits = ${3 * fator} ${sigla}` : ''}.
          Vale para compradores empresa (preço por quantidade do ML).
        </Text>
      </div>
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        {faixas.map((f, k) => (
          <Flex key={k} gap={8} align="center" wrap>
            <Text style={{ width: 70 }}>a partir de</Text>
            <CampoNumero min={2} max={100} precision={0} value={f.minimo} onChange={v => mudar(k, 'minimo', v)} style={{ width: 90 }} addonAfter={fator > 1 ? 'kits' : sigla} />
            {fator > 1 && <Text type="secondary" style={{ fontSize: 12, width: 80 }}>= {f.minimo * fator} {sigla}</Text>}
            <CampoNumero min={0.5} max={99} step={0.5} value={f.desconto} onChange={v => mudar(k, 'desconto', v)} style={{ width: 110 }} addonAfter="% off" />
            <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setFaixas(fs => fs.filter((_, i) => i !== k))} />
          </Flex>
        ))}
        {faixas.length < MAX_DEGRAUS && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setFaixas(fs => [...fs, { minimo: (fs[fs.length - 1]?.minimo || 1) + (fator > 1 ? 2 : 5), desconto: (fs[fs.length - 1]?.desconto || 0) + 2 }])}>
            degrau
          </Button>
        )}
      </Space>
      {previa?.erros.length ? <Alert type="error" showIcon style={{ marginTop: 8, padding: '4px 10px' }} message={previa.erros[0]} /> : null}
      {previa?.avisos.map((a, k) => <Alert key={k} type="warning" showIcon style={{ marginTop: 8, padding: '4px 10px' }} message={a} />)}
      <div style={{ marginTop: 10 }}>{previa ? <TabelaEscada escada={previa} /> : <Spin size="small" />}</div>
      <Flex gap={8} wrap style={{ marginTop: 10 }}>
        <Button type="primary" loading={salvando} disabled={!!previa?.erros.length} onClick={() => salvar(faixas)}>Salvar escada</Button>
        <Button disabled={salvando} onClick={() => salvar([])}>Sem escada</Button>
        {fator === 1 && temDoAnuncio && <Button disabled={salvando} onClick={() => salvar(null)}>Usar a do anúncio</Button>}
        <Button type="text" disabled={salvando} onClick={onCancelar}>Cancelar</Button>
      </Flex>
      {linha.ml.mlbId && !foraDoMl(linha.ml.status) && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>Esta forma já está no ML: a escada vai na hora ao salvar.</Text>}
    </div>
  );
};

/** Um cartão por forma de venda. */
const CartaoForma: React.FC<{
  det: AnuncioDetalhe; linha: ItemDoAnuncio;
  onAtivar: (idLinha: number, ativo: boolean) => void;
  onSalvarEscada: (idLinha: number, faixas: FaixaQuantidade[] | null) => Promise<void>;
  onAnalise: (idLinha: number) => void;
}> = ({ det, linha, onAtivar, onSalvarEscada, onAnalise }) => {
  const [escada, setEscada] = useState<EscadaLinha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const fator = linha.unidadeMl?.fator || 1;
  const temDoAnuncio = det.faixasGerenciadas && det.faixasQuantidade.length > 0;
  const origem = origemDaEscada(linha, temDoAnuncio);

  useEffect(() => {
    let vivo = true;
    setErro(null);
    anunciosApi.escada(det.id, linha.idLinha).then(r => vivo && setEscada(r)).catch(e => vivo && setErro(e instanceof Error ? e.message : 'Erro.'));
    return () => { vivo = false; };
  }, [det, linha.idLinha]);

  const status = linha.ml.mlbId ? ROTULO_STATUS_ML[linha.ml.status || ''] : null;
  return (
    <Card
      size="small" style={{ marginBottom: 12, borderLeft: `4px solid ${fator > 1 ? '#722ed1' : '#1677ff'}` }}
      title={(
        <Flex align="center" gap={8} wrap>
          <Text strong style={{ fontSize: 15 }}>{nomeDaForma(linha)}</Text>
          {linha.unidadeMl && <Text type="secondary" style={{ fontSize: 12 }}>{rotuloDaUnidade(linha)}</Text>}
          <Text type="secondary" style={{ fontSize: 12 }}>{linha.sku}</Text>
          {status ? <Tag color={status.cor}>{status.texto}</Tag> : <Tag>a publicar</Tag>}
          <AvisoMl erro={linha.ml.erro} publicado={!!linha.ml.mlbId} />
        </Flex>
      )}
      extra={(
        <Space size={10}>
          <Text strong style={{ fontSize: 15 }}>{formatarMoeda(linha.precoAnuncio)}</Text>
          <Tooltip title={linha.linhaAtiva === false ? 'Fora da venda: clique para vender' : 'Vendendo: clique para tirar da venda (no ML, pausa)'}>
            <Switch size="small" checked={linha.linhaAtiva !== false} disabled={foraDoMl(linha.ml.status)} onChange={v => onAtivar(linha.idLinha, v)} checkedChildren="vende" unCheckedChildren="não vende" />
          </Tooltip>
          <Tooltip title="Análise completa: cenários, mercado e a conta do frete"><Button size="small" icon={<BarChartOutlined />} onClick={() => onAnalise(linha.idLinha)}>Análise</Button></Tooltip>
        </Space>
      )}
    >
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
        <Space size={6}>
          <Text type="secondary" style={{ fontSize: 12 }}>Preço por quantidade:</Text>
          <Tag color={origem.cor}>{origem.texto}</Tag>
        </Space>
        {!editando && <Button size="small" icon={<EditOutlined />} onClick={() => setEditando(true)}>Editar escada</Button>}
      </Flex>
      {editando ? (
        <EditorEscada
          idAnuncio={det.id} linha={linha} inicial={escada?.faixas || []} temDoAnuncio={temDoAnuncio}
          onCancelar={() => setEditando(false)}
          onSalvar={async faixas => { await onSalvarEscada(linha.idLinha, faixas); setEditando(false); }}
        />
      ) : erro ? <Alert type="warning" showIcon message={erro} /> : !escada ? <Spin size="small" /> : (
        <>
          {escada.avisos.map((a, k) => <Alert key={k} type="warning" showIcon style={{ marginBottom: 8, padding: '4px 10px' }} message={a} />)}
          <TabelaEscada escada={escada} />
          {escada.freteDesconhecido && <Text type="warning" style={{ fontSize: 12 }}>Item sem peso no cadastro: o frete não entrou na conta.</Text>}
        </>
      )}
    </Card>
  );
};

/** A aba "Formas e escada" do produto escolhido. */
const FormasDoProduto: React.FC<{
  det: AnuncioDetalhe;                                   // só as linhas do produto
  onAtivar: (idLinha: number, ativo: boolean) => void;
  onSalvarEscada: (idLinha: number, faixas: FaixaQuantidade[] | null) => Promise<void>;
  onCriarKit: (idLinha: number, quantidade: number) => void;
  onAnalise: (idLinha: number) => void;
}> = ({ det, onAtivar, onSalvarEscada, onCriarKit, onAnalise }) => {
  const [quantidade, setQuantidade] = useState<number>(10);
  if (!det.itens.length) return <Card size="small"><Empty description="Sem formas de venda" /></Card>;
  if (!det.categoria) return <Card size="small"><Text type="secondary">Escolha a categoria do ML (no Geral): a tarifa depende dela.</Text></Card>;
  const base = det.itens.find(l => !l.unidadeMl) || det.itens[0];
  return (
    <>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="Cada forma de venda é um anúncio separado no Mercado Livre, com preço e escada próprios"
        description={`A quantidade da escada conta na unidade do anúncio: no kit c/10, "a partir de 3" são 3 kits = 30 peças.`}
      />
      {det.itens.map(l => <CartaoForma key={l.idLinha} det={det} linha={l} onAtivar={onAtivar} onSalvarEscada={onSalvarEscada} onAnalise={onAnalise} />)}
      <Card size="small" style={{ borderStyle: 'dashed' }}>
        <Flex align="center" gap={8} wrap>
          <Text>Vender também em kit com</Text>
          <CampoNumero min={2} max={999} precision={0} value={quantidade} onChange={v => setQuantidade(Number(v) || 2)} style={{ width: 90 }} addonAfter={base.siglaBase || 'un'} />
          <Popconfirm
            title={`Criar o kit c/${quantidade}?`} okText="Criar"
            description={det.itens.some(l => (l.unidadeMl?.fator || 1) === quantidade) ? 'Essa forma já existe neste produto.' : 'Vira uma forma nova (anúncio próprio no ML, com SKU e título próprios).'}
            onConfirm={() => onCriarKit(base.idLinha, quantidade)}
          >
            <Button icon={<PlusOutlined />}>Criar kit</Button>
          </Popconfirm>
        </Flex>
      </Card>
    </>
  );
};

export default FormasDoProduto;
