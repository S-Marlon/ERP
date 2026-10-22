// Obras de poços › mapa regional (etapa 2). Camadas que ligam e desligam: os poços dos clientes (marcador grande, com a
// cor da situação da última obra), os poços de referência da base pública (pontinhos cinza, nunca misturados com os
// nossos) e o potencial hídrico (a grade do maperf). A referência e o potencial vêm direto dos GeoJSON do maperf (o
// servidor lê a pasta; não vão para o banco). Clicar no mapa analisa o raio em volta do ponto; clicar no poço de um
// cliente mostra o dono e as obras, com atalhos para a obra, a ficha do poço e a do cliente.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Descriptions, Empty, Input, List, Modal, Row, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { AimOutlined, EnvironmentOutlined, FileSearchOutlined, FolderOpenOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { Circle, CircleMarker, MapContainer, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AnaliseRegiao, CelulaPotencial, foneBr, obrasApi, PocoNoMapa, ReferenciaNoMapa, ResumoMapa, SERVICOS, SITUACOES_OBRA } from './obrasApi';
import { Camadas, corDoPoco, corPotencial, enquadramento, FAIXAS_POTENCIAL, LEGENDA_POCOS, lerCamadas, lerGpsTexto, textoRaio } from './mapaRegional';
import { abrirCliente, abrirObra, abrirPoco, useNavPocos } from './navPocos';

const { Text } = Typography;
const CHAVE_CAMADAS = 'pocos.mapa.camadas';
const RAIOS = [500, 1000, 2000, 3000, 5000, 10000];
const COR_REFERENCIA = '#6b7c93';

// As camadas grandes ficam guardadas enquanto a tela está aberta (trocar de aba não baixa de novo).
let cacheReferencias: ReferenciaNoMapa[] | null = null;
let cachePotencial: CelulaPotencial[] | null = null;

const lerCamadasSalvas = () => { try { return lerCamadas(localStorage.getItem(CHAVE_CAMADAS)); } catch { return lerCamadas(null); } };

/** Move o mapa quando chega um pedido de foco (ponto ou os poços de um cliente). */
const Foco: React.FC<{ alvo: { centro: [number, number]; zoom: number } | null; limites: [number, number][] | null; pedido: number }> = ({ alvo, limites, pedido }) => {
  const map = useMap();
  useEffect(() => {
    if (limites && limites.length > 1) map.fitBounds(limites, { padding: [40, 40], maxZoom: 15 });
    else if (limites && limites.length === 1) map.setView(limites[0], 15);
    else if (alvo) map.setView(alvo.centro, alvo.zoom);
  }, [pedido]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

const CliqueNoMapa: React.FC<{ onClique: (lat: number, lon: number) => void }> = ({ onClique }) => {
  useMapEvents({ click: e => onClique(e.latlng.lat, e.latlng.lng) });
  return null;
};

const Analise: React.FC<{ a: AnaliseRegiao }> = ({ a }) => (
  <Descriptions size="small" column={1} items={[
    { key: 'q', label: 'Poços no raio', children: <>{a.quantidade}{a.nossos ? <Text type="secondary"> ({a.nossos} nosso{a.nossos > 1 ? 's' : ''})</Text> : null}</> },
    { key: 'm', label: 'Profundidade', children: a.profundidadeMedia === null ? '—' : <>média {a.profundidadeMedia} m · mediana {a.profundidadeMediana} m</> },
    { key: 'f', label: 'Faixa', children: a.profundidadeMin === null ? '—' : `${a.profundidadeMin} a ${a.profundidadeMax} m` },
    { key: 'v', label: 'Vazão média', children: a.vazaoMediaM3h === null ? '—' : `${a.vazaoMediaM3h.toLocaleString('pt-BR')} m³/h (${Math.round(a.vazaoMediaM3h * 1000).toLocaleString('pt-BR')} L/h)` },
    { key: 'p', label: 'Potencial', children: a.potencial === null ? '—' : <><span style={{ display: 'inline-block', width: 12, height: 12, background: corPotencial(a.potencial), border: '1px solid #999', marginRight: 6, verticalAlign: 'middle' }} />{a.potencial.toFixed(1)}</> },
    { key: 's', label: 'Para o orçamento', children: a.metrosSugeridos === null ? '—' : <Text strong>{a.metrosSugeridos} m</Text> },
  ]} />
);

/** Os arquivos do maperf que o servidor leu (para trocar uma região, é só trocar o arquivo na pasta). */
const ArquivosModal: React.FC<{ open: boolean; resumo: ResumoMapa | null; onFechar: () => void }> = ({ open, resumo, onFechar }) => {
  const lista = (tipo: 'POCOS' | 'POTENCIAL', unidade: string) => (
    <List size="small" dataSource={(resumo?.arquivos || []).filter(a => a.tipo === tipo)} locale={{ emptyText: 'Nenhum arquivo' }} renderItem={a => (
      <List.Item><Tooltip title={a.caminho}><Text>{a.regiao}</Text></Tooltip><Text type="secondary">{a.quantidade.toLocaleString('pt-BR')} {unidade}</Text></List.Item>
    )} />
  );
  return (
    <Modal open={open} title="Arquivos do maperf" footer={null} onCancel={onFechar} width={600}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text type="secondary">Lidos direto da pasta (não vão para o banco). Para mudar uma região, troque o arquivo e clique em recarregar.</Text>
        <Text code copyable style={{ fontSize: 12 }}>{resumo?.pasta}</Text>
        {!!resumo?.erros.length && <Alert type="warning" showIcon message="Arquivos que não deu para ler" description={resumo.erros.join(' · ')} />}
        <Row gutter={12}>
          <Col span={12}><Text strong>Poços de referência</Text>{lista('POCOS', 'poços')}</Col>
          <Col span={12}><Text strong>Potencial hídrico</Text>{lista('POTENCIAL', 'células')}</Col>
        </Row>
      </Space>
    </Modal>
  );
};

const MapaPocos: React.FC = () => {
  const nav = useNavPocos();
  const [camadas, setCamadas] = useState<Camadas>(lerCamadasSalvas);
  const [resumo, setResumo] = useState<ResumoMapa | null>(null);
  const [nossos, setNossos] = useState<PocoNoMapa[]>([]);
  const [referencias, setReferencias] = useState<ReferenciaNoMapa[]>(cacheReferencias || []);
  const [potencial, setPotencial] = useState<CelulaPotencial[]>(cachePotencial || []);
  const [raio, setRaio] = useState(2000);
  const [ponto, setPonto] = useState<{ latitude: number; longitude: number } | null>(null);
  const [analise, setAnalise] = useState<AnaliseRegiao | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [selecionado, setSelecionado] = useState<PocoNoMapa | null>(null);
  const [referencia, setReferencia] = useState<ReferenciaNoMapa | null>(null);
  const [irPara, setIrPara] = useState('');
  const [verArquivos, setVerArquivos] = useState(false);
  const [focoLocal, setFocoLocal] = useState<{ pedido: number; alvo: { centro: [number, number]; zoom: number } | null; limites: [number, number][] | null }>({ pedido: 0, alvo: null, limites: null });

  const carregar = useCallback(async () => {
    try {
      const [r, n] = await Promise.all([obrasApi.mapaResumo(), obrasApi.mapaPocos()]);
      setResumo(r); setNossos(n);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (camadas.referencias && !cacheReferencias) obrasApi.mapaReferencias().then(r => { cacheReferencias = r; setReferencias(r); }).catch(e => message.error(e.message));
    if (camadas.potencial && !cachePotencial) obrasApi.mapaPotencial().then(p => { cachePotencial = p; setPotencial(p); }).catch(e => message.error(e.message));
  }, [camadas.referencias, camadas.potencial]);
  const mudarCamada = (k: keyof Camadas, v: boolean) => setCamadas(c => {
    const n = { ...c, [k]: v };
    try { localStorage.setItem(CHAVE_CAMADAS, JSON.stringify(n)); } catch { /* sem armazenamento: só não lembra */ }
    return n;
  });

  const analisar = useCallback(async (latitude: number, longitude: number, r = raio) => {
    setPonto({ latitude, longitude });
    setAnalisando(true);
    try { setAnalise(await obrasApi.analisar(latitude, longitude, r)); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setAnalisando(false); }
  }, [raio]);
  useEffect(() => { if (ponto) analisar(ponto.latitude, ponto.longitude, raio); }, [raio]);   // eslint-disable-line react-hooks/exhaustive-deps

  // pedidos de "ver no mapa" vindos da obra, do poço ou do cliente
  useEffect(() => {
    if (nav.aba !== 'mapa') return;
    if (nav.foco) {
      const { latitude, longitude, idPoco } = nav.foco;
      setFocoLocal(f => ({ pedido: f.pedido + 1, alvo: enquadramento([], { latitude, longitude }), limites: null }));
      setSelecionado(nossos.find(p => p.idPoco === idPoco) || null);
      mudarCamada('nossos', true);
    } else if (nav.focoCliente) {
      const dele = nossos.filter(p => p.idProprietario === nav.focoCliente);
      if (dele.length) {
        setFocoLocal(f => ({ pedido: f.pedido + 1, alvo: null, limites: dele.map(p => [p.latitude, p.longitude] as [number, number]) }));
        setSelecionado(dele.length === 1 ? dele[0] : null);
        mudarCamada('nossos', true);
      }
    }
  }, [nav.pedido, nossos.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const inicio = useMemo(() => enquadramento(nossos, nav.foco), []);   // eslint-disable-line react-hooks/exhaustive-deps
  // quando os poços chegam depois do mapa abrir (sem foco pedido), enquadra neles
  useEffect(() => {
    if (!nav.foco && !nav.focoCliente && nossos.length) setFocoLocal(f => (f.pedido ? f : { pedido: 1, alvo: enquadramento(nossos), limites: null }));
  }, [nossos.length]);   // eslint-disable-line react-hooks/exhaustive-deps

  const recarregarCamadas = async () => {
    cacheReferencias = null; cachePotencial = null;
    await carregar();
    if (camadas.referencias) { const r = await obrasApi.mapaReferencias(); cacheReferencias = r; setReferencias(r); } else setReferencias([]);
    if (camadas.potencial) { const p = await obrasApi.mapaPotencial(); cachePotencial = p; setPotencial(p); } else setPotencial([]);
  };
  const totalRef = resumo?.referencias ?? 0;
  const totalPot = resumo?.potencial ?? 0;

  const irParaPonto = () => {
    const gps = lerGpsTexto(irPara);
    if (!gps) { message.warning('Cole as coordenadas no formato "-23.117100, -46.556500".'); return; }
    setFocoLocal(f => ({ pedido: f.pedido + 1, alvo: enquadramento([], gps), limites: null }));
    analisar(gps.latitude, gps.longitude);
  };

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Card size="small" styles={{ body: { padding: '8px 12px' } }}>
        <Row gutter={[12, 8]} align="middle" justify="space-between">
          <Col>
            <Space wrap size={[16, 4]}>
              <Checkbox checked={camadas.nossos} onChange={e => mudarCamada('nossos', e.target.checked)}>
                <Tag color="green" style={{ marginRight: 4 }}>●</Tag>Poços dos clientes ({nossos.length}{resumo && resumo.nossos.total > resumo.nossos.comGps ? ` de ${resumo.nossos.total}` : ''})
              </Checkbox>
              <Checkbox checked={camadas.referencias} onChange={e => mudarCamada('referencias', e.target.checked)} disabled={!totalRef}>
                <span style={{ color: COR_REFERENCIA }}>•</span> Referência pública ({totalRef.toLocaleString('pt-BR')})
              </Checkbox>
              <Checkbox checked={camadas.potencial} onChange={e => mudarCamada('potencial', e.target.checked)} disabled={!totalPot}>
                Potencial hídrico{totalPot ? '' : ' (sem arquivos)'}
              </Checkbox>
              <Checkbox checked={camadas.satelite} onChange={e => mudarCamada('satelite', e.target.checked)}>Satélite</Checkbox>
            </Space>
          </Col>
          <Col>
            <Space wrap>
              <Text type="secondary">Raio</Text>
              <Select size="small" style={{ width: 90 }} value={raio} onChange={setRaio} options={RAIOS.map(r => ({ value: r, label: textoRaio(r) }))} />
              <Input size="small" style={{ width: 230 }} placeholder="Ir para: -23.1171, -46.5565" value={irPara} onChange={e => setIrPara(e.target.value)} onPressEnter={irParaPonto}
                suffix={<AimOutlined onClick={irParaPonto} style={{ cursor: 'pointer' }} />} />
              <Tooltip title="Os GeoJSON do maperf que o servidor leu"><Button size="small" icon={<FolderOpenOutlined />} onClick={() => setVerArquivos(true)}>Arquivos</Button></Tooltip>
              <Tooltip title="Recarregar (relê os arquivos que mudaram)"><Button size="small" icon={<ReloadOutlined />} onClick={recarregarCamadas} /></Tooltip>
            </Space>
          </Col>
        </Row>
      </Card>
      {resumo && !totalRef && !totalPot && (
        <Alert type="info" showIcon closable message="Mapa sem a base pública"
          description={`O servidor não achou os GeoJSON do maperf em ${resumo.pasta} (subpastas get_pocos_with_center e get_hydric_potential_raster_with_center). Também dá para apontar MAPERF_DIR no .env do backend para a pasta do maperf.`} />
      )}
      <Row gutter={10}>
        <Col xs={24} lg={17}>
          <div style={{ height: 'calc(100vh - 330px)', minHeight: 460, borderRadius: 8, overflow: 'hidden', border: '1px solid #f0f0f0', position: 'relative' }}>
            <MapContainer center={inicio.centro} zoom={inicio.zoom} preferCanvas style={{ height: '100%', width: '100%' }}>
              {camadas.satelite
                ? <TileLayer key="sat" attribution="Imagens &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                : <TileLayer key="osm" attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />}
              <Foco alvo={focoLocal.alvo} limites={focoLocal.limites} pedido={focoLocal.pedido} />
              <CliqueNoMapa onClique={(lat, lon) => { setSelecionado(null); setReferencia(null); analisar(lat, lon); }} />
              {camadas.potencial && potencial.map((c, i) => (
                <Rectangle key={`p${i}`} bounds={[[c[0], c[2]], [c[1], c[3]]]} interactive={false}
                  pathOptions={{ stroke: false, fillColor: corPotencial(c[4]), fillOpacity: 0.5 }} />
              ))}
              {ponto && <Circle center={[ponto.latitude, ponto.longitude]} radius={raio} interactive={false} pathOptions={{ color: '#cf1322', weight: 2, fillOpacity: 0.08 }} />}
              {camadas.referencias && referencias.map(r => (
                <CircleMarker key={`r${r[0]}`} center={[r[1], r[2]]} radius={3} bubblingMouseEvents={false}
                  pathOptions={{ color: COR_REFERENCIA, weight: 1, fillColor: referencia?.[0] === r[0] ? '#ffd666' : '#a7b4c6', fillOpacity: 0.9 }}
                  eventHandlers={{ click: () => { setReferencia(r); setSelecionado(null); } }} />
              ))}
              {camadas.nossos && nossos.map(p => (
                <CircleMarker key={`n${p.idPoco}`} center={[p.latitude, p.longitude]} radius={selecionado?.idPoco === p.idPoco ? 11 : 8} bubblingMouseEvents={false}
                  pathOptions={{ color: selecionado?.idPoco === p.idPoco ? '#000' : '#fff', weight: 3, fillColor: corDoPoco(p), fillOpacity: 1 }}
                  eventHandlers={{ click: () => { setSelecionado(p); setReferencia(null); } }} />
              ))}
            </MapContainer>
            <div style={{ position: 'absolute', left: 10, bottom: 22, zIndex: 500, background: 'rgba(255,255,255,0.92)', padding: '6px 8px', borderRadius: 6, fontSize: 11, lineHeight: 1.6 }}>
              {camadas.nossos && LEGENDA_POCOS.map(l => (
                <div key={l.texto}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: l.cor, border: '2px solid #fff', boxShadow: '0 0 0 1px #bbb', marginRight: 6 }} />{l.texto}</div>
              ))}
              {camadas.referencias && <div><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: '#a7b4c6', border: `1px solid ${COR_REFERENCIA}`, margin: '0 8px 0 2px' }} />referência pública</div>}
              {camadas.potencial && (
                <div style={{ marginTop: 4 }}>
                  potencial: {[...FAIXAS_POTENCIAL].reverse().slice(1).map(f => <span key={f.cor} title={`> ${f.acima}`} style={{ display: 'inline-block', width: 14, height: 10, background: f.cor, border: '1px solid #ccc' }} />)} mais água
                </div>
              )}
            </div>
          </div>
        </Col>
        <Col xs={24} lg={7}>
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {selecionado && (
              <Card size="small" title={<Space><EnvironmentOutlined />{selecionado.identificacao}</Space>}
                extra={<Button size="small" type="link" onClick={() => analisar(selecionado.latitude, selecionado.longitude)}>Analisar aqui</Button>}>
                <Descriptions size="small" column={1} items={[
                  { key: 'c', label: 'Cliente', children: selecionado.proprietario ? <>{selecionado.proprietario}{selecionado.telefone ? <Text type="secondary"> · {foneBr(selecionado.telefone)}</Text> : null}</> : '—' },
                  { key: 'l', label: 'Local', children: selecionado.cidade || `${selecionado.latitude}, ${selecionado.longitude}` },
                  { key: 'p', label: 'Profundidade', children: selecionado.profundidadeM ? `${selecionado.profundidadeM} m` : '—' },
                  { key: 'v', label: 'Vazão', children: selecionado.vazaoLh ? `${selecionado.vazaoLh.toLocaleString('pt-BR')} L/h` : '—' },
                  { key: 'n', label: 'Nível estático', children: selecionado.nivelEstaticoM ? `${selecionado.nivelEstaticoM} m` : '—' },
                  { key: 'o', label: 'Obras', children: selecionado.ultimaObra
                    ? <>{selecionado.obras} · última Nº {selecionado.ultimaObra.idObra} <Tag color={SITUACOES_OBRA[selecionado.ultimaObra.situacao].cor}>{SITUACOES_OBRA[selecionado.ultimaObra.situacao].texto}</Tag>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{selecionado.ultimaObra.servicos.map(s => SERVICOS[s]).join(' + ')}</Text></div></>
                    : 'nenhuma' },
                ]} />
                <Space wrap style={{ marginTop: 6 }}>
                  {selecionado.ultimaObra && <Button size="small" type="primary" icon={<FileSearchOutlined />} onClick={() => abrirObra(selecionado.ultimaObra!.idObra)}>Abrir obra</Button>}
                  <Button size="small" icon={<EnvironmentOutlined />} onClick={() => abrirPoco(selecionado.idPoco)}>Ficha do poço</Button>
                  {selecionado.idProprietario && <Button size="small" icon={<UserOutlined />} onClick={() => abrirCliente(selecionado.idProprietario!)}>Cliente</Button>}
                </Space>
              </Card>
            )}
            {referencia && (
              <Card size="small" title="Poço de referência (base pública)" extra={<Button size="small" type="link" onClick={() => analisar(referencia[1], referencia[2])}>Analisar aqui</Button>}>
                <Descriptions size="small" column={1} items={[
                  { key: 'm', label: 'Município', children: referencia[5] || '—' },
                  { key: 'p', label: 'Profundidade', children: referencia[3] !== null ? `${referencia[3]} m` : '—' },
                  { key: 'v', label: 'Vazão', children: referencia[4] !== null ? `${referencia[4].toLocaleString('pt-BR')} m³/h` : '—' },
                  { key: 'g', label: 'GPS', children: `${referencia[1]}, ${referencia[2]}` },
                ]} />
              </Card>
            )}
            <Card size="small" loading={analisando} title={`Região (raio de ${textoRaio(raio)})`}>
              {analise
                ? <>
                    <Analise a={analise} />
                    <Text type="secondary" style={{ fontSize: 12 }}>A sugestão é a mediana das profundidades, arredondada de 10 em 10 m. Na obra nova, o botão da calculadora faz a mesma conta.</Text>
                  </>
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Clique no mapa para ver os poços em volta: quantos, a profundidade e a vazão" />}
            </Card>
          </Space>
        </Col>
      </Row>
      <ArquivosModal open={verArquivos} resumo={resumo} onFechar={() => setVerArquivos(false)} />
    </Space>
  );
};

export default MapaPocos;
