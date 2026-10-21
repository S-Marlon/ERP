// Aba Envio do Mercado Livre: cada forma de venda com o pacote que está no anúncio e o do ERP (embalagem recomendada +
// produto × quantidade), o frete hoje e com o pacote do ERP, o custo da embalagem e o lucro com ela, e o que falta.
// O interruptor põe o custo da embalagem no lucro (e na trava de prejuízo). "Enviar pacote" manda só peso e medidas.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Col, Flex, Popconfirm, Row, Segmented, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CloudUploadOutlined, InboxOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { anunciosApi, Caixa, formatarMoeda, LinhaEnvio } from './mercadoLivreApi';
import { cairiaEmPrejuizo, contarEnvio, FiltroEnvio, passaNoFiltroEnvio, podeEnviarPacote } from './envioLista';

const { Text } = Typography;
const caixaTexto = (c: Caixa | null | undefined) => (c ? `${c.altura} × ${c.largura} × ${c.comprimento} cm` : '—');
const pesoTexto = (g: number | null | undefined) => (g ? (g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg` : `${g} g`) : '—');
const SITUACAO: Record<LinhaEnvio['situacaoPacote'], { cor: string; texto: string; dica: string }> = {
  IGUAL: { cor: 'green', texto: 'confere', dica: 'O pacote do anúncio bate com o do ERP.' },
  DIFERENTE: { cor: 'orange', texto: 'diferente', dica: 'O ML calcula o frete pelo pacote de lá: mande o do ERP para cobrar o frete certo.' },
  FALTA_NO_ML: { cor: 'orange', texto: 'falta no ML', dica: 'O anúncio está sem peso ou medidas do pacote.' },
  SEM_ERP: { cor: 'default', texto: 'sem pacote no ERP', dica: 'Falta a embalagem recomendada (com medidas) ou o peso do produto: Catálogo › Logística em lote.' },
  NAO_PUBLICADO: { cor: 'blue', texto: 'vai ao publicar', dica: 'Ainda não está no ML: o pacote do ERP vai junto quando publicar.' },
};
const FALTA: Record<string, string> = { PESO: 'sem peso', MEDIDAS: 'sem medidas', EMBALAGEM: 'sem embalagem', FOTO: 'sem foto' };

const EnvioMl: React.FC = () => {
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<LinhaEnvio[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroEnvio>('todos');
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [naConta, setNaConta] = useState(false);
  const [trocando, setTrocando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try { const r = await anunciosApi.envio(); setLinhas(r.linhas); setNaConta(r.custoEmbalagemNoLucro); setMarcadas([]); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const chave = (l: LinhaEnvio) => `${l.idAnuncio}-${l.idLinha}`;
  const contagem = useMemo(() => contarEnvio(linhas), [linhas]);
  const filtradas = linhas.filter(l => passaNoFiltroEnvio(l, filtro));
  const custoEmbalagens = linhas.reduce((a, l) => a + (l.embalagem?.custo || 0), 0);

  const enviar = async (alvo: LinhaEnvio[]) => {
    let ok = 0;
    const erros: string[] = [];
    for (const l of alvo) {
      setEnviando(chave(l));
      try { await anunciosApi.enviarPacote(l.idAnuncio, l.idLinha); ok++; }
      catch (e) { erros.push(`${l.sku}: ${e instanceof Error ? e.message : 'erro'}`); }
    }
    setEnviando(null);
    if (ok) message.success(`Pacote enviado a ${ok} anúncio(s).`);
    if (erros.length) message.error(erros.slice(0, 3).join(' · '), 8);
    carregar();
  };
  const trocarInterruptor = async (ligado: boolean) => {
    setTrocando(true);
    try {
      await anunciosApi.custoEmbalagemNoLucro(ligado);
      message.success(ligado ? 'O custo da embalagem entrou no lucro dos anúncios.' : 'O custo da embalagem saiu do lucro dos anúncios.');
      await carregar();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setTrocando(false); }
  };
  const resolver = (l: LinhaEnvio) => navigate(`/catalogo/logistica${l.idFamilia ? `?familia=${l.idFamilia}` : ''}`);
  const marcadasParaEnviar = linhas.filter(l => marcadas.includes(chave(l)) && podeEnviarPacote(l));

  return (
    <div>
      <Alert type={naConta ? 'success' : 'info'} showIcon style={{ marginBottom: 12 }}
        message={naConta ? 'O custo da embalagem entra no lucro dos anúncios' : 'Prévia: o custo da embalagem ainda não entra no lucro dos anúncios'}
        description={naConta
          ? 'Preço, sugestões, lucro da lista e a trava de prejuízo já descontam a embalagem de cada forma de venda.'
          : 'Veja abaixo como fica o lucro de cada forma de venda com a embalagem. Ligado, o custo passa a entrar na conta (e na trava de prejuízo).'}
        action={
          <Popconfirm
            title={naConta ? 'Tirar o custo da embalagem do lucro?' : 'Pôr o custo da embalagem no lucro?'}
            description={naConta ? 'O lucro dos anúncios volta a ser sem a embalagem.'
              : contagem.prejuizo > 0
                ? `${contagem.prejuizo} forma(s) de venda passam a dar prejuízo: a trava de prejuízo vai pausá-las na próxima sincronização (veja o cartão "Cairiam em prejuízo").`
                : 'Nenhum anúncio cai em prejuízo com a embalagem.'}
            okText={naConta ? 'Tirar' : 'Pôr no lucro'} okButtonProps={{ danger: !naConta && contagem.prejuizo > 0 }} cancelText="Voltar"
            onConfirm={() => trocarInterruptor(!naConta)}>
            <Space><Text>Custo da embalagem no lucro</Text><Switch checked={naConta} loading={trocando} /></Space>
          </Popconfirm>
        } />
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {([
          ['diferente', 'Pacote diferente do ML', contagem.diferente, '#d46b08', 'O ML cobra o frete pelo pacote de lá: mande o do ERP.'],
          ['semErp', 'Sem pacote no ERP', contagem.semErp, undefined, 'Falta embalagem recomendada ou peso do produto.'],
          ['prejuizo', naConta ? 'Em prejuízo pela embalagem' : 'Cairiam em prejuízo', contagem.prejuizo, contagem.prejuizo ? '#cf1322' : '#389e0d', 'Sem a embalagem dão lucro; com o custo dela, prejuízo.'],
          ['falta', 'Com algo faltando', contagem.falta, undefined, 'Sem peso, medidas, embalagem ou foto.'],
        ] as const).map(([f, titulo, valor, cor, dica]) => (
          <Col xs={12} lg={6} key={f}>
            <Tooltip title={dica}>
              <Card size="small" hoverable onClick={() => setFiltro(filtro === f ? 'todos' : f)} style={filtro === f ? { borderColor: '#1677ff' } : undefined}>
                <Statistic title={titulo} value={valor} valueStyle={cor ? { color: cor } : undefined} />
              </Card>
            </Tooltip>
          </Col>
        ))}
      </Row>

      <Card size="small"
        title={<Space wrap>
          <Segmented size="small" value={filtro} onChange={v => setFiltro(v as FiltroEnvio)} options={[
            { value: 'todos', label: `Todas (${contagem.todos})` }, { value: 'diferente', label: `Diferente (${contagem.diferente})` },
            { value: 'semErp', label: `Sem pacote no ERP (${contagem.semErp})` }, { value: 'prejuizo', label: `Prejuízo (${contagem.prejuizo})` },
            { value: 'falta', label: `Faltando (${contagem.falta})` },
          ]} />
          {custoEmbalagens > 0 && <Text type="secondary" style={{ fontSize: 12 }}>embalagens: {formatarMoeda(custoEmbalagens)} por envio de cada forma</Text>}
        </Space>}
        extra={<Space>
          {marcadasParaEnviar.length > 0 && (
            <Popconfirm title={`Mandar o pacote do ERP a ${marcadasParaEnviar.length} anúncio(s)?`} description="Só peso e medidas do pacote: preço, título e fotos não mudam. O frete passa a ser calculado por ele."
              okText="Enviar" cancelText="Voltar" onConfirm={() => enviar(marcadasParaEnviar)}>
              <Button type="primary" icon={<CloudUploadOutlined />} loading={!!enviando}>Enviar pacote ({marcadasParaEnviar.length})</Button>
            </Popconfirm>
          )}
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        </Space>}>
        <Table<LinhaEnvio>
          size="small" rowKey={chave} loading={carregando} dataSource={filtradas} pagination={{ pageSize: 50, hideOnSinglePage: true }}
          rowSelection={{ selectedRowKeys: marcadas, onChange: k => setMarcadas(k as string[]), getCheckboxProps: l => ({ disabled: !podeEnviarPacote(l) }) }}
          columns={[
            {
              title: 'Anúncio', render: (_, l) => (
                <div style={{ lineHeight: 1.3 }}>
                  <Text strong ellipsis style={{ maxWidth: 320 }}>{l.titulo}</Text>
                  <div>
                    <Tag style={{ marginRight: 4 }}>{l.forma}</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{l.sku}{l.mlbId ? ` · ${l.mlbId}` : ' · rascunho'}{!l.linhaAtiva ? ' · desligada' : ''}</Text>
                  </div>
                </div>
              ),
            },
            {
              title: <Tooltip title="Peso e medidas do pacote: no anúncio (ML) e o que o ERP calcula (embalagem + produto × quantidade)">Pacote ML → ERP</Tooltip>, width: 250,
              render: (_, l) => (
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {l.publicado && <div><Text type="secondary">ML:</Text> {caixaTexto(l.pacoteMl?.caixa)} · {pesoTexto(l.pacoteMl?.pesoG)}</div>}
                  <div><Text type="secondary">ERP:</Text> {caixaTexto(l.pacoteErp?.caixa)} · {pesoTexto(l.pacoteErp?.pesoG)}</div>
                  <Tooltip title={SITUACAO[l.situacaoPacote].dica}><Tag color={SITUACAO[l.situacaoPacote].cor} style={{ marginTop: 2 }}>{SITUACAO[l.situacaoPacote].texto}</Tag></Tooltip>
                </div>
              ),
            },
            {
              title: 'Embalagem', width: 170,
              render: (_, l) => l.embalagem
                ? <div style={{ fontSize: 12 }}>{l.embalagem.nome}<div><Text type="secondary">{formatarMoeda(l.embalagem.custo)}</Text></div></div>
                : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
            },
            {
              title: <Tooltip title="Frete que você paga hoje e com o pacote do ERP no anúncio">Frete</Tooltip>, width: 120, align: 'right',
              render: (_, l) => (
                <div style={{ fontSize: 12 }}>
                  <div>{formatarMoeda(l.frete)}</div>
                  {l.freteComPacote !== null && l.frete !== null && Math.abs(l.freteComPacote - l.frete) >= 0.01 && (
                    <Text style={{ color: l.freteComPacote > l.frete ? '#cf1322' : '#389e0d' }}>→ {formatarMoeda(l.freteComPacote)}</Text>
                  )}
                </div>
              ),
            },
            {
              title: <Tooltip title="Lucro por venda hoje e com o custo da embalagem">Lucro</Tooltip>, width: 130, align: 'right',
              render: (_, l) => (
                <div style={{ fontSize: 12 }}>
                  <div>{formatarMoeda(l.lucro)}</div>
                  {l.embalagem && l.lucroComEmbalagem !== null && (
                    <Text style={{ color: l.lucroComEmbalagem < 0 ? '#cf1322' : undefined }}>
                      {cairiaEmPrejuizo(l) && <WarningOutlined />} c/ emb. {formatarMoeda(l.lucroComEmbalagem)}
                    </Text>
                  )}
                </div>
              ),
            },
            {
              title: 'O que falta', width: 160,
              render: (_, l) => l.faltas.length
                ? <div>{l.faltas.map(f => <Tag key={f} color={f === 'FOTO' ? 'default' : 'orange'} style={{ marginBottom: 2 }}>{FALTA[f]}</Tag>)}</div>
                : <Tag color="green">completo</Tag>,
            },
            {
              title: '', width: 140, align: 'right',
              render: (_, l) => (
                <Flex vertical gap={2} align="flex-end">
                  {podeEnviarPacote(l) && (
                    <Popconfirm title="Mandar o pacote do ERP a este anúncio?" description="Só peso e medidas do pacote." okText="Enviar" cancelText="Voltar" onConfirm={() => enviar([l])}>
                      <Button size="small" type="primary" ghost icon={<CloudUploadOutlined />} loading={enviando === chave(l)}>Enviar pacote</Button>
                    </Popconfirm>
                  )}
                  {(l.faltas.length > 0 || l.situacaoPacote === 'SEM_ERP') && (
                    <Button size="small" type="link" icon={<InboxOutlined />} onClick={() => resolver(l)}>Resolver em lote</Button>
                  )}
                </Flex>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default EnvioMl;
