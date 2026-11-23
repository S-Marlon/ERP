// Obras de poços › monitoramento remoto (etapa 7): o painel dos aparelhos (situação, última leitura, quadro de comando,
// consumo do dia), o detalhe com gráficos, simulador, comandos, relatório do mês e importação do poço sem internet, os
// alertas, o cadastro dos aparelhos (com a chave para o firmware) e o guia de como montar o quadro e ligar a placa.
// O servidor não depende da placa (ESP-01, ESP32, 4G, LoRa ou arquivo): vale o formato do envio.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Descriptions, Drawer, Empty, Input, Modal, Row, Segmented, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, Upload, message } from 'antd';
import {
  ApiOutlined, BellOutlined, DownloadOutlined, ExperimentOutlined, EyeOutlined, FileTextOutlined, KeyOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined,
  SendOutlined, ThunderboltOutlined, UploadOutlined,
} from '@ant-design/icons';
import GraficoBarras from '../../../shared/components/graficos/GraficoBarras';
import {
  AlertaIot, ALIMENTACOES_IOT, AlimentacaoIot, ComandoIot, COMANDOS_IOT, ComandoRegistro, CONEXOES_IOT, ConexaoIot, csvDoRelatorio, Dispositivo, DispositivoForm,
  DispositivoNoPainel, foneBr, haQuanto, iotApi, LeituraEnvio, LeituraIot, obrasApi, Poco, RelatorioIot, ResumoDiaIot, STATUS_IOT, TipoAlertaIot, TIPOS_ALERTA_IOT,
  URL_LEITURAS,
} from './obrasApi';
import { abrirPoco } from './navPocos';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';

const { Text, Paragraph } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const num = (v: number | null | undefined, un = '') => (v === null || v === undefined ? '—' : `${v.toLocaleString('pt-BR')}${un ? ` ${un}` : ''}`);
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const hora = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const baixar = (nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') => {
  const url = URL.createObjectURL(new Blob(['﻿', conteudo], { type: tipo }));
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); URL.revokeObjectURL(url);
};

/** O estado do quadro numa linha de etiquetas (fases, contator, térmico, boia, seletora, pressão). */
const EstadoQuadro: React.FC<{ l: LeituraIot | null; alimentacao: AlimentacaoIot }> = ({ l, alimentacao }) => {
  if (!l) return <Text type="secondary">sem leitura</Text>;
  const qtd = alimentacao === 'TRIFASICO' ? 3 : alimentacao === 'BIFASICO' ? 2 : 1;
  const fasesV = [l.faseAV, l.faseBV, l.faseCV].slice(0, qtd);
  const sim = (v: boolean | null, s: string, n: string, cor = 'green') => (v === null ? null : <Tag color={v ? cor : 'default'} style={{ marginBottom: 2 }}>{v ? s : n}</Tag>);
  return (
    <Space size={[2, 2]} wrap>
      {fasesV.some(x => x !== null) && fasesV.map((x, i) => (
        <Tooltip key={i} title={x === null ? 'sem dado' : `${num(x, 'V')}`}><Tag color={x === null ? 'default' : x < 50 ? 'red' : 'green'} style={{ marginBottom: 2 }}>{'RST'[i]}</Tag></Tooltip>
      ))}
      {sim(l.comandoLigado, 'contator ligado', 'contator desligado', 'blue')}
      {l.termicoOk === false && <Tag color="red">térmico desarmado</Tag>}
      {sim(l.boiaPedindo, 'boia pedindo', 'boia satisfeita', 'cyan')}
      {l.modo && <Tag color={l.modo === 'AUTO' ? 'default' : 'orange'}>{l.modo === 'AUTO' ? 'automático' : l.modo === 'MANUAL' ? 'manual' : 'seletora em 0'}</Tag>}
      {l.pressaoBar !== null && <Tag>{num(l.pressaoBar, 'bar')}</Tag>}
    </Space>
  );
};

// ------------------------------------------------------------------ detalhe do aparelho
const Simulador: React.FC<{ d: Dispositivo; onEnviado: () => void }> = ({ d, onEnviado }) => {
  const [l, setL] = useState<LeituraEnvio>({ nivel_m: null, corrente_a: null, vazao_lh: null, pressao_bar: null, tensao_v: 220,
    fase_a_v: 220, fase_b_v: 220, fase_c_v: 220, bomba: true, comando: true, termico_ok: true, boia: true, modo: 'AUTO' });
  const tri = d.alimentacao === 'TRIFASICO', bi = d.alimentacao === 'BIFASICO';
  const enviar = async () => {
    try {
      const corpo = { ...l, fase_b_v: tri || bi ? l.fase_b_v : null, fase_c_v: tri ? l.fase_c_v : null };
      const r = await iotApi.simular(d.idDispositivo, corpo);
      message.success(`Leitura gravada${r.alertasAbertos ? ` · ${r.alertasAbertos} alerta(s) aberto(s)` : ''}${r.alertasFechados ? ` · ${r.alertasFechados} normalizado(s)` : ''}.`);
      onEnviado();
    } catch (e) { erro(e); }
  };
  const campo = (k: keyof LeituraEnvio, rotulo: string, suf: string, span = 6) => (
    <Col span={span}><Text style={{ fontSize: 12 }}>{rotulo}</Text>
      <CampoNumero size="small" suffix={suf} style={{ width: '100%' }} value={(l[k] as number | null) ?? undefined}
        onChange={v => setL({ ...l, [k]: v === null ? null : Number(v) })} />
    </Col>
  );
  const chave = (k: 'bomba' | 'comando' | 'termico_ok' | 'boia', rotulo: string) => (
    <Space size={4}><Switch size="small" checked={!!l[k]} onChange={v => setL({ ...l, [k]: v })} /><Text style={{ fontSize: 12 }}>{rotulo}</Text></Space>
  );
  return (
    <Card size="small" title={<Space><ExperimentOutlined />Simular uma leitura (como se fosse o aparelho)</Space>}>
      <Row gutter={[8, 6]} align="bottom">
        {campo('nivel_m', 'Nível da água', 'm')}{campo('corrente_a', 'Corrente', 'A')}{campo('vazao_lh', 'Vazão', 'L/h')}{campo('pressao_bar', 'Pressão', 'bar')}
        {campo('fase_a_v', tri || bi ? 'Fase R' : 'Tensão', 'V')}{(tri || bi) && campo('fase_b_v', 'Fase S', 'V')}{tri && campo('fase_c_v', 'Fase T', 'V')}
      </Row>
      <Space wrap style={{ marginTop: 8 }} size={[14, 6]}>
        {chave('bomba', 'bomba girando')}{chave('comando', 'contator ligado')}{chave('termico_ok', 'térmico ok')}{chave('boia', 'boia pedindo')}
        <Select size="small" style={{ width: 130 }} value={l.modo ?? undefined} onChange={modo => setL({ ...l, modo })}
          options={[{ value: 'AUTO', label: 'Automático' }, { value: 'MANUAL', label: 'Manual' }, { value: 'DESLIGADO', label: 'Seletora em 0' }]} />
        <Button type="primary" size="small" onClick={enviar}>Enviar agora</Button>
      </Space>
      <div><Text type="secondary" style={{ fontSize: 12 }}>
        Teste os alertas antes de ter o hardware (as leituras simuladas ficam gravadas como as reais). Ex.: contator ligado + corrente 0 = sem funcionamento;
        boia pedindo + contator desligado 2 vezes = não parte; uma fase em 0 = falta de fase.
      </Text></div>
    </Card>
  );
};

const Comandos: React.FC<{ d: Dispositivo }> = ({ d }) => {
  const [lista, setLista] = useState<ComandoRegistro[]>([]);
  const [comando, setComando] = useState<ComandoIot>('BLOQUEAR');
  const [motivo, setMotivo] = useState('');
  const carregar = useCallback(() => iotApi.comandos(d.idDispositivo).then(setLista).catch(erro), [d.idDispositivo]);
  useEffect(() => { carregar(); }, [carregar]);
  const enviar = async () => {
    try { await iotApi.enviarComando(d.idDispositivo, comando, motivo || null); message.success('Comando na fila: vai na resposta do próximo envio do aparelho (vale 10 min).'); setMotivo(''); carregar(); }
    catch (e) { erro(e); }
  };
  if (!d.aceitaComandos) {
    return <Alert type="info" showIcon message="Este aparelho não aceita comandos" description='Ligue "aceita comandos" no cadastro quando o quadro tiver o relé de bloqueio (contato NF em série com a bobina).' />;
  }
  return (
    <Card size="small" title={<Space><SendOutlined />Comandos remotos</Space>}
      extra={<Text type="secondary" style={{ fontSize: 12 }}>O aparelho busca na resposta do envio e confirma no seguinte</Text>}>
      <Space wrap>
        <Select style={{ width: 200 }} value={comando} onChange={setComando} options={(Object.keys(COMANDOS_IOT) as ComandoIot[]).map(c => ({ value: c, label: COMANDOS_IOT[c] }))} />
        <Input style={{ width: 300 }} placeholder={comando === 'BLOQUEAR' ? 'Motivo (obrigatório para bloquear)' : 'Motivo (opcional)'} value={motivo} onChange={e => setMotivo(e.target.value)} />
        <Button type="primary" danger={comando === 'BLOQUEAR'} onClick={enviar}>Enviar</Button>
      </Space>
      <Table size="small" rowKey="idComando" dataSource={lista} pagination={false} style={{ marginTop: 8 }} locale={{ emptyText: 'Nenhum comando' }}
        columns={[
          { title: 'Comando', render: (_, c: ComandoRegistro) => <>{COMANDOS_IOT[c.comando]}{c.motivo ? <div><Text type="secondary" style={{ fontSize: 12 }}>{c.motivo}</Text></div> : null}</> },
          { title: 'Situação', width: 120, render: (_, c: ComandoRegistro) => <Tag color={c.situacao === 'EXECUTADO' ? 'green' : c.situacao === 'FALHOU' ? 'red' : c.situacao === 'PENDENTE' || c.situacao === 'ENVIADO' ? 'blue' : 'default'}>{c.situacao.toLowerCase()}</Tag> },
          { title: 'Quando', width: 200, render: (_, c: ComandoRegistro) => <Text style={{ fontSize: 12 }}>{hora(c.criadoEm)} por {c.operador}{c.respondidoEm ? ` · resposta ${hora(c.respondidoEm)}` : ''}{c.resposta ? `: ${c.resposta}` : ''}</Text> },
          { title: '', width: 90, render: (_, c: ComandoRegistro) => c.situacao === 'PENDENTE' && <Button size="small" type="link" onClick={async () => { try { await iotApi.cancelarComando(c.idComando); carregar(); } catch (e) { erro(e); } }}>cancelar</Button> },
        ]} />
    </Card>
  );
};

const Relatorio: React.FC<{ d: Dispositivo | null; onFechar: () => void }> = ({ d, onFechar }) => {
  const [mes, setMes] = useState(mesAtual());
  const [r, setR] = useState<RelatorioIot | null>(null);
  useEffect(() => { if (d) { setR(null); iotApi.relatorio(d.idDispositivo, mes).then(setR).catch(erro); } }, [d, mes]);
  const imprimir = () => {
    if (!r || !d) return;
    const t = r.totais;
    const linhas = r.dias.map(x => `<tr><td>${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}</td><td>${num(x.horasBomba)}</td><td>${x.partidas}</td><td>${num(x.volumeM3)}</td><td>${num(x.energiaKwh)}</td><td>${num(x.nivelEstaticoM)}</td><td>${num(x.nivelDinamicoM)}</td></tr>`).join('');
    const alertas = Object.entries(r.alertasPorTipo).map(([k, v]) => `${TIPOS_ALERTA_IOT[k as TipoAlertaIot]?.texto || k}: ${v}`).join(' · ') || 'nenhum';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Relatório ${d.poco} ${mes}</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:3px 6px;text-align:right}td:first-child,th:first-child{text-align:left}</style></head><body>
      <h2>Monitoramento do poço · ${d.poco}</h2><p>${d.cliente || ''} · mês ${mes.slice(5, 7)}/${mes.slice(0, 4)}</p>
      <p><b>Bomba:</b> ${num(t.horasBomba, 'h')} · ${t.partidas} partidas · <b>Volume:</b> ${num(t.volumeM3, 'm³')} · <b>Energia:</b> ${num(t.energiaKwh, 'kWh')} (${brl(t.custoEnergia)})
      · <b>m³/kWh:</b> ${num(t.m3PorKwh)} · <b>Nível estático médio:</b> ${num(t.nivelEstaticoMedioM, 'm')} · <b>Disponibilidade:</b> ${num(t.disponibilidade, '%')}</p>
      <p><b>Alertas:</b> ${alertas}</p>
      <table><tr><th>Dia</th><th>Horas bomba</th><th>Partidas</th><th>Volume m³</th><th>Energia kWh</th><th>NE m</th><th>ND m</th></tr>${linhas}</table>
      <script>window.print()</script></body></html>`);
    w.document.close();
  };
  const t = r?.totais;
  return (
    <Modal open={!!d} title={`Relatório do mês · ${d?.poco || ''}`} width={900} onCancel={onFechar} destroyOnHidden
      footer={<Space>
        <Button icon={<DownloadOutlined />} disabled={!r} onClick={() => r && d && baixar(`poco-${d.identificador}-${mes}.csv`, csvDoRelatorio(r))}>CSV</Button>
        <Button icon={<PrinterOutlined />} disabled={!r} onClick={imprimir}>Imprimir</Button>
        <Button onClick={onFechar}>Fechar</Button>
      </Space>}>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Input type="month" style={{ width: 180 }} value={mes} onChange={e => e.target.value && setMes(e.target.value)} />
        {!r || !t ? <Card loading /> : <>
          <Row gutter={[8, 8]}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Horas de bomba" value={t.horasBomba} decimalSeparator="," /><Text type="secondary" style={{ fontSize: 12 }}>{t.partidas} partidas</Text></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Volume (m³)" value={t.volumeM3} decimalSeparator="," /><Text type="secondary" style={{ fontSize: 12 }}>{t.m3PorKwh !== null ? `${num(t.m3PorKwh)} m³/kWh` : 'sem energia medida'}</Text></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Energia (kWh)" value={t.energiaKwh ?? '—'} decimalSeparator="," /><Text type="secondary" style={{ fontSize: 12 }}>{t.custoEnergia !== null ? brl(t.custoEnergia) : 'cadastre a tarifa para o custo'}</Text></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Disponibilidade" value={t.disponibilidade ?? '—'} suffix={t.disponibilidade !== null ? '%' : ''} decimalSeparator="," /><Text type="secondary" style={{ fontSize: 12 }}>{t.leituras} leituras</Text></Card></Col>
          </Row>
          <Space wrap>{Object.entries(r.alertasPorTipo).map(([k, v]) => <Tag key={k} color={TIPOS_ALERTA_IOT[k as TipoAlertaIot]?.cor}>{TIPOS_ALERTA_IOT[k as TipoAlertaIot]?.texto || k}: {v}</Tag>)}
            {!Object.keys(r.alertasPorTipo).length && <Text type="secondary">Nenhum alerta no mês.</Text>}</Space>
          <Table size="small" rowKey="dia" pagination={false} dataSource={r.dias} scroll={{ y: 320 }}
            columns={[
              { title: 'Dia', render: (_, x: ResumoDiaIot) => `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}` },
              { title: 'Bomba', align: 'right', render: (_, x: ResumoDiaIot) => `${num(x.horasBomba)} h` },
              { title: 'Partidas', align: 'right', dataIndex: 'partidas' },
              { title: 'Volume', align: 'right', render: (_, x: ResumoDiaIot) => num(x.volumeM3, 'm³') },
              { title: 'Energia', align: 'right', render: (_, x: ResumoDiaIot) => num(x.energiaKwh, 'kWh') },
              { title: 'NE', align: 'right', render: (_, x: ResumoDiaIot) => num(x.nivelEstaticoM, 'm') },
              { title: 'ND', align: 'right', render: (_, x: ResumoDiaIot) => num(x.nivelDinamicoM, 'm') },
              { title: 'Pressão', align: 'right', render: (_, x: ResumoDiaIot) => num(x.pressaoMediaBar, 'bar') },
            ]} />
          <Text type="secondary" style={{ fontSize: 12 }}>m³ por kWh caindo mês a mês: bomba gasta ou poço perdendo vazão. Disponibilidade baixa: aparelho sem sinal ou sem energia.</Text>
        </>}
      </Space>
    </Modal>
  );
};

const DetalheDispositivo: React.FC<{ id: number | null; onFechar: () => void; onMudou: () => void }> = ({ id, onFechar, onMudou }) => {
  const [horas, setHoras] = useState(24);
  const [dados, setDados] = useState<{ dispositivo: Dispositivo; total: number; leituras: LeituraIot[]; dias: ResumoDiaIot[] } | null>(null);
  const [relatorio, setRelatorio] = useState(false);
  const [importando, setImportando] = useState(false);
  const carregar = useCallback(() => { if (id) iotApi.leituras(id, horas).then(setDados).catch(erro); }, [id, horas]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);
  const d = dados?.dispositivo;
  const porLeitura = horas <= 48;
  const importar = async (arquivo: File) => {
    if (!d) return;
    setImportando(true);
    try {
      const r = await iotApi.importar(d.idDispositivo, await arquivo.text());
      message.success(`${r.gravadas} de ${r.recebidas} leitura(s) gravada(s)${r.recebidas > r.gravadas ? ' (as outras já estavam)' : ''}${r.alertasAbertos ? ` · ${r.alertasAbertos} alerta(s)` : ''}.`);
      carregar(); onMudou();
    } catch (e) { erro(e); } finally { setImportando(false); }
  };
  const ultima = dados?.leituras[dados.leituras.length - 1] || null;
  return (
    <Drawer open={!!id} onClose={onFechar} width={940} title={d ? `${d.nome} · ${d.poco || ''}` : 'Aparelho'} destroyOnHidden
      extra={<Space>
        <Upload accept=".csv,.json,.jsonl,.txt" showUploadList={false} beforeUpload={f => { importar(f); return false; }}>
          <Tooltip title="Arquivo do poço sem internet (CSV, JSON ou uma leitura JSON por linha)"><Button icon={<UploadOutlined />} loading={importando}>Importar arquivo</Button></Tooltip>
        </Upload>
        <Button icon={<FileTextOutlined />} onClick={() => setRelatorio(true)}>Relatório do mês</Button>
        <Segmented value={horas} onChange={v => setHoras(Number(v))} options={[{ value: 24, label: '24 h' }, { value: 168, label: '7 dias' }, { value: 720, label: '30 dias' }]} />
      </Space>}>
      {!dados || !d ? <Card loading /> : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions size="small" column={{ xs: 1, md: 3 }} items={[
            { key: 'p', label: 'Poço', children: <a onClick={() => { onFechar(); abrirPoco(d.idPoco); }}>{d.poco}</a> },
            { key: 'c', label: 'Cliente', children: <>{d.cliente || '—'}{d.telefone ? ` · ${foneBr(d.telefone)}` : ''}</> },
            { key: 'u', label: 'Última leitura', children: d.ultimaLeituraEm ? `${hora(d.ultimaLeituraEm)} (${haQuanto(d.ultimaLeituraEm, new Date())})` : 'nunca' },
            { key: 'q', label: 'Quadro agora', span: 3, children: <EstadoQuadro l={ultima} alimentacao={d.alimentacao} /> },
            { key: 'i', label: 'Envio', children: `${CONEXOES_IOT[d.conexao]} · mede a cada ${d.intervaloMin} min · ${ALIMENTACOES_IOT[d.alimentacao].toLowerCase()}` },
            { key: 't', label: 'Leituras no período', children: dados.total },
          ]} />
          {!dados.total ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={d.conexao === 'OFFLINE' ? 'Nenhuma leitura no período: importe o arquivo do aparelho' : 'Nenhuma leitura no período'} /> : porLeitura ? (
            <>
              <Card size="small" title="Nível da água (m, a partir da boca do poço; maior = mais fundo)">
                <GraficoBarras altura={170} semLegenda formatar={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`}
                  pontos={dados.leituras.map(l => ({ chave: l.em, rotulo: l.em.slice(11, 16), valores: { nivel: l.nivelM ?? 0 } }))}
                  series={[{ chave: 'nivel', nome: 'Nível', cor: '#1677ff' }]} />
              </Card>
              <Card size="small" title="Corrente da bomba (A, barras) e pressão (bar, linha)">
                <GraficoBarras altura={160} formatar={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  pontos={dados.leituras.map(l => ({ chave: l.em, rotulo: l.em.slice(11, 16), valores: { corrente: l.correnteA ?? 0 }, linha: l.pressaoBar ?? undefined }))}
                  series={[{ chave: 'corrente', nome: 'Corrente (A)', cor: '#fa8c16' }]} linha={{ nome: 'Pressão (bar)', cor: '#722ed1' }} />
              </Card>
            </>
          ) : (
            <>
              <Card size="small" title="Por dia: horas de bomba (barras) e volume estimado em m³ (linha)">
                <GraficoBarras altura={170} formatar={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  pontos={dados.dias.map(x => ({ chave: x.dia, rotulo: `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}`, valores: { horas: x.horasBomba }, linha: x.volumeM3 }))}
                  series={[{ chave: 'horas', nome: 'Horas de bomba', cor: '#fa8c16' }]} linha={{ nome: 'Volume (m³)', cor: '#1677ff' }} />
              </Card>
              <Card size="small" title="Por dia: nível dinâmico (barras) e estático (linha), em m">
                <GraficoBarras altura={150} formatar={v => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`}
                  pontos={dados.dias.map(x => ({ chave: x.dia, rotulo: `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}`, valores: { nd: x.nivelDinamicoM ?? 0 }, linha: x.nivelEstaticoM ?? undefined }))}
                  series={[{ chave: 'nd', nome: 'Nível dinâmico', cor: '#91caff' }]} linha={{ nome: 'Nível estático', cor: '#1677ff' }} />
              </Card>
            </>
          )}
          <Comandos d={d} />
          <Simulador d={d} onEnviado={() => { carregar(); onMudou(); }} />
          <Relatorio d={relatorio ? d : null} onFechar={() => setRelatorio(false)} />
        </Space>
      )}
    </Drawer>
  );
};

// ------------------------------------------------------------------ painel
const PainelAparelhos: React.FC<{ onCadastrar: () => void }> = ({ onCadastrar }) => {
  const [dados, setDados] = useState<{ dispositivos: DispositivoNoPainel[]; alertas: AlertaIot[]; chaveConfigurada: boolean } | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const carregar = useCallback(() => iotApi.painel().then(setDados).catch(erro), []);
  useEffect(() => { carregar(); const t = setInterval(carregar, 60000); return () => clearInterval(t); }, [carregar]);   // atualiza a cada minuto
  if (!dados) return <Card loading />;
  const agora = new Date();
  const ativos = dados.dispositivos.filter(d => d.status !== 'INATIVO');
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {!dados.chaveConfigurada && (
        <Alert type="warning" showIcon message="IOT_CHAVE_MESTRA não está no .env do backend"
          description="Sem ela os aparelhos não conseguem enviar pela internet (o simulador e a importação de arquivo funcionam). Ponha uma frase longa e aleatória no Backend/.env e reinicie o backend." />
      )}
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Aparelhos ativos" value={ativos.length} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Online" value={ativos.filter(d => d.status === 'ONLINE').length} valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Sem sinal / atrasados" value={ativos.filter(d => d.status === 'SEM_SINAL' || d.status === 'ATRASADO').length}
          valueStyle={ativos.some(d => d.status === 'SEM_SINAL') ? { color: '#cf1322' } : undefined} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Alertas abertos" value={dados.alertas.length} valueStyle={dados.alertas.length ? { color: '#d48806' } : undefined} /></Card></Col>
      </Row>
      {!dados.dispositivos.length ? (
        <Card><Empty description="Nenhum aparelho cadastrado. Cadastre o primeiro e use o simulador para testar antes de ter o hardware.">
          <Button type="primary" icon={<PlusOutlined />} onClick={onCadastrar}>Cadastrar aparelho</Button>
        </Empty></Card>
      ) : (
        <Row gutter={[12, 12]}>
          {dados.dispositivos.map(d => (
            <Col xs={24} md={12} xl={8} key={d.idDispositivo}>
              <Badge.Ribbon text={STATUS_IOT[d.status].texto} color={STATUS_IOT[d.status].cor === 'default' ? 'gray' : STATUS_IOT[d.status].cor}>
                <Card size="small" hoverable onClick={() => setAberto(d.idDispositivo)} style={{ height: '100%', opacity: d.status === 'INATIVO' ? 0.6 : 1 }}
                  title={<Space direction="vertical" size={0}><Text strong>{d.poco}</Text><Text type="secondary" style={{ fontSize: 12 }}>{d.cliente || d.nome}</Text></Space>}>
                  <Row gutter={8}>
                    <Col span={12}><Statistic title="Nível da água" value={d.ultima?.nivelM ?? '—'} suffix={d.ultima?.nivelM != null ? 'm' : ''} precision={d.ultima?.nivelM != null ? 1 : undefined} decimalSeparator="," /></Col>
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Bomba</Text>
                      <div style={{ fontSize: 18 }}>{!d.ultima || (d.ultima.bombaLigada === null && d.ultima.correnteA === null) ? '—'
                        : (d.ultima.bombaLigada ?? (d.ultima.correnteA ?? 0) > 0.5) ? <Tag color="green" icon={<ThunderboltOutlined />}>girando</Tag> : <Tag>parada</Tag>}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{num(d.ultima?.correnteA, 'A')} · {num(d.ultima?.vazaoLh, 'L/h')}</Text>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 6 }}><EstadoQuadro l={d.ultima} alimentacao={d.alimentacao} /></div>
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {haQuanto(d.ultimaLeituraEm, agora)}{d.ultima?.sinalDbm != null ? ` · sinal ${d.ultima.sinalDbm} dBm` : ''}{d.ultima?.bateriaV != null ? ` · bateria ${num(d.ultima.bateriaV, 'V')}` : ''}
                    </Text>
                    {d.hoje && <div><Text type="secondary" style={{ fontSize: 12 }}>Hoje: bomba {d.hoje.horasBomba.toLocaleString('pt-BR')} h · {d.hoje.partidas} partida(s) · {d.hoje.volumeM3.toLocaleString('pt-BR')} m³{d.hoje.energiaKwh !== null ? ` · ${num(d.hoje.energiaKwh, 'kWh')}` : ''}</Text></div>}
                    {d.alertasAbertos > 0 && <Tag color="red" icon={<BellOutlined />} style={{ marginTop: 4 }}>{d.alertasAbertos} alerta(s)</Tag>}
                  </div>
                </Card>
              </Badge.Ribbon>
            </Col>
          ))}
        </Row>
      )}
      {!!dados.alertas.length && <ListaAlertas lista={dados.alertas} onMudou={carregar} titulo="Alertas abertos" />}
      <DetalheDispositivo id={aberto} onFechar={() => setAberto(null)} onMudou={carregar} />
    </Space>
  );
};

const ListaAlertas: React.FC<{ lista: AlertaIot[]; onMudou: () => void; titulo: string }> = ({ lista, onMudou, titulo }) => (
  <Card size="small" title={<Space><BellOutlined />{titulo}</Space>}>
    <Table<AlertaIot> size="small" rowKey="idAlerta" dataSource={lista} pagination={{ pageSize: 30, hideOnSinglePage: true }} locale={{ emptyText: 'Nenhum alerta' }}
      columns={[
        { title: 'Alerta', width: 150, render: (_, a) => <Tag color={TIPOS_ALERTA_IOT[a.tipo]?.cor}>{TIPOS_ALERTA_IOT[a.tipo]?.texto || a.tipo}</Tag> },
        { title: 'Poço', render: (_, a) => <>{a.idPoco ? <a onClick={() => abrirPoco(a.idPoco!)}>{a.poco}</a> : a.poco}<div><Text type="secondary" style={{ fontSize: 12 }}>{a.cliente}{a.telefone ? ` · ${foneBr(a.telefone)}` : ''}</Text></div></> },
        { title: 'O que aconteceu', dataIndex: 'mensagem' },
        { title: 'Quando', width: 170, render: (_, a) => <>{hora(a.inicio)}{a.fim ? <div><Text type="secondary" style={{ fontSize: 12 }}>normalizou {hora(a.fim)}</Text></div> : <div><Tag color="red">aberto</Tag></div>}</> },
        {
          title: '', width: 110, render: (_, a) => (a.vistoEm
            ? <Tooltip title={`Visto por ${a.vistoPor} em ${hora(a.vistoEm)}`}><Tag icon={<EyeOutlined />}>visto</Tag></Tooltip>
            : <Button size="small" onClick={async () => { try { await iotApi.visto(a.idAlerta); onMudou(); } catch (e) { erro(e); } }}>Marcar visto</Button>),
        },
      ]} />
  </Card>
);

const TodosAlertas: React.FC = () => {
  const [dias, setDias] = useState(30);
  const [lista, setLista] = useState<AlertaIot[]>([]);
  const carregar = useCallback(() => iotApi.alertas(dias).then(setLista).catch(erro), [dias]);
  useEffect(() => { carregar(); }, [carregar]);
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Segmented value={dias} onChange={v => setDias(Number(v))} options={[{ value: 7, label: '7 dias' }, { value: 30, label: '30 dias' }, { value: 90, label: '90 dias' }, { value: 365, label: '1 ano' }]} />
      <ListaAlertas lista={lista} onMudou={carregar} titulo="Alertas (abertos e dos últimos dias)" />
    </Space>
  );
};

// ------------------------------------------------------------------ aparelhos
const vazio = (): DispositivoForm => ({
  idPoco: null, nome: '', identificador: '', conexao: 'WIFI', alimentacao: 'MONOFASICO', intervaloMin: 15, profundidadeSensorM: null, nivelAlertaM: null,
  correnteMinA: null, correnteMaxA: null, vazaoMinLh: null, tensaoMinV: 190, tensaoMaxV: 245, pressaoMinBar: null, horasMaxLigada: null, partidasMaxHora: null,
  tarifaKwh: null, aceitaComandos: false, situacao: 'ATIVO', observacao: null,
});

const Aparelhos: React.FC<{ novo: boolean; onNovoFeito: () => void }> = ({ novo, onNovoFeito }) => {
  const [lista, setLista] = useState<Dispositivo[]>([]);
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [aberto, setAberto] = useState<Dispositivo | 'novo' | null>(null);
  const [f, setF] = useState<DispositivoForm>(vazio());
  const [chave, setChave] = useState<{ identificador: string; chave: string } | null>(null);
  const carregar = useCallback(() => iotApi.dispositivos().then(setLista).catch(erro), []);
  useEffect(() => { carregar(); obrasApi.pocos().then(setPocos).catch(() => setPocos([])); }, [carregar]);
  useEffect(() => { if (novo) { setAberto('novo'); onNovoFeito(); } }, [novo, onNovoFeito]);
  useEffect(() => { if (aberto) setF(aberto === 'novo' ? vazio() : { ...aberto }); }, [aberto]);
  const salvar = async () => {
    try { if (aberto === 'novo') await iotApi.criar(f); else if (aberto) await iotApi.salvar(aberto.idDispositivo, f); setAberto(null); carregar(); message.success('Aparelho salvo.'); }
    catch (e) { erro(e); }
  };
  const verChave = async (d: Dispositivo) => { try { setChave(await iotApi.chave(d.idDispositivo)); } catch (e) { erro(e); } };
  const n = (k: keyof DispositivoForm, rotulo: string, suf: string, dica?: string) => (
    <Col span={8}><Tooltip title={dica}><Text>{rotulo}{dica ? ' ⓘ' : ''}</Text></Tooltip>
      <CampoNumero min={0} suffix={suf} style={{ width: '100%' }} value={(f[k] as number | null) ?? undefined}
        onChange={v => setF({ ...f, [k]: v === null ? null : Number(v) })} />
    </Col>
  );
  return (
    <Card size="small" title="Aparelhos" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setAberto('novo')}>Novo aparelho</Button>}>
      <Table<Dispositivo> size="small" rowKey="idDispositivo" dataSource={lista} pagination={false} locale={{ emptyText: 'Nenhum aparelho' }}
        onRow={d => ({ onClick: () => setAberto(d), style: { cursor: 'pointer', opacity: d.situacao === 'ATIVO' ? 1 : 0.55 } })}
        columns={[
          { title: 'Aparelho', render: (_, d) => <>{d.nome}<div><Text code style={{ fontSize: 11 }}>{d.identificador}</Text></div></> },
          { title: 'Poço', render: (_, d) => <>{d.poco}{d.cliente ? <div><Text type="secondary" style={{ fontSize: 12 }}>{d.cliente}</Text></div> : null}</> },
          { title: 'Quadro', width: 130, render: (_, d) => <>{ALIMENTACOES_IOT[d.alimentacao]}{d.aceitaComandos && <div><Tag color="blue">aceita comandos</Tag></div>}</> },
          { title: 'Envio', width: 170, render: (_, d) => `${CONEXOES_IOT[d.conexao]} · ${d.intervaloMin} min` },
          { title: 'Última leitura', width: 120, render: (_, d) => haQuanto(d.ultimaLeituraEm, new Date()) },
          { title: '', width: 100, render: (_, d) => <Button size="small" icon={<KeyOutlined />} onClick={e => { e.stopPropagation(); verChave(d); }}>Chave</Button> },
        ]} />
      <Modal open={!!aberto} title={aberto === 'novo' ? 'Novo aparelho' : 'Aparelho'} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={() => setAberto(null)} width={760} destroyOnHidden>
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Row gutter={8}>
            <Col span={12}><Text>Poço</Text>
              <Select showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Escolha o poço" value={f.idPoco ?? undefined} onChange={idPoco => setF({ ...f, idPoco })}
                options={pocos.map(p => ({ value: p.idPoco, label: `${p.identificacao}${p.proprietario ? ` · ${p.proprietario}` : ''}` }))} />
            </Col>
            <Col span={12}><Text>Nome</Text><Input maxLength={100} value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Quadro do poço 1 (ESP-01)" /></Col>
          </Row>
          <Row gutter={8}>
            <Col span={8}><Text>Identificador (nº de série / MAC)</Text><Input maxLength={40} value={f.identificador} onChange={e => setF({ ...f, identificador: e.target.value.toUpperCase() })} placeholder="ESP01-0001" /></Col>
            <Col span={6}><Text>Conexão</Text>
              <Select style={{ width: '100%' }} value={f.conexao} onChange={conexao => setF({ ...f, conexao })} options={(Object.keys(CONEXOES_IOT) as ConexaoIot[]).map(c => ({ value: c, label: CONEXOES_IOT[c] }))} />
            </Col>
            <Col span={5}><Text>Quadro</Text>
              <Select style={{ width: '100%' }} value={f.alimentacao} onChange={alimentacao => setF({ ...f, alimentacao })} options={(Object.keys(ALIMENTACOES_IOT) as AlimentacaoIot[]).map(a => ({ value: a, label: ALIMENTACOES_IOT[a] }))} />
            </Col>
            <Col span={5}><Tooltip title="De quanto em quanto tempo o aparelho mede (e, com internet, envia)"><Text>Mede a cada ⓘ</Text></Tooltip>
              <CampoNumero min={1} max={1440} suffix="min" style={{ width: '100%' }} value={f.intervaloMin} onChange={v => setF({ ...f, intervaloMin: Number(v) || 15 })} />
            </Col>
          </Row>
          {f.conexao === 'OFFLINE' && <Alert type="info" showIcon message="Sem internet: as leituras entram pelo botão Importar arquivo (no detalhe do aparelho). Não gera alerta de sem sinal." />}
          <Text strong>Limites dos alertas (vazio = sem aquele alerta)</Text>
          <Row gutter={8}>
            {n('profundidadeSensorM', 'Profundidade do sensor', 'm', 'Onde o sensor de pressão está pendurado. Com ela o aparelho pode mandar só a coluna d\'água (coluna_m).')}
            {n('nivelAlertaM', 'Alerta se a água passar de', 'm', 'Nível (a partir da boca) mais fundo que isso = água acabando. Use alguns metros acima da bomba.')}
            {n('vazaoMinLh', 'Vazão mínima (bomba ligada)', 'L/h')}
          </Row>
          <Row gutter={8}>
            {n('correnteMinA', 'Corrente mínima (a seco)', 'A', 'Bomba girando sem água puxa menos corrente: uns 60–70% da corrente normal.')}
            {n('correnteMaxA', 'Corrente máxima', 'A', 'Acima da corrente nominal da placa do motor (ex.: +15%).')}
            <Col span={8}><Text>Tensão (mín. / máx.)</Text>
              <Space.Compact style={{ width: '100%' }}>
                <CampoNumero min={0} style={{ width: '50%' }} value={f.tensaoMinV ?? undefined} onChange={v => setF({ ...f, tensaoMinV: v === null ? null : Number(v) })} />
                <CampoNumero min={0} style={{ width: '50%' }} value={f.tensaoMaxV ?? undefined} onChange={v => setF({ ...f, tensaoMaxV: v === null ? null : Number(v) })} />
              </Space.Compact>
            </Col>
          </Row>
          <Row gutter={8}>
            {n('pressaoMinBar', 'Pressão mínima (trabalhando)', 'bar', 'Bomba puxando corrente e pressão abaixo disso = cano ou edutor estourado.')}
            {n('horasMaxLigada', 'Ligada sem parar no máximo', 'h', 'Mais que isso = boia travada/queimada ou vazamento na caixa/rede.')}
            {n('partidasMaxHora', 'Partidas por hora no máximo', '', 'Mais que isso = boia oscilando, pressostato desregulado ou tanque de pressão sem ar.')}
          </Row>
          <Row gutter={8}>
            {n('tarifaKwh', 'Tarifa de energia', 'R$/kWh', 'Para o custo de energia no relatório do mês.')}
            <Col span={8}><Tooltip title="Só quando o quadro tiver o relé de bloqueio (contato NF em série com a bobina do contator)."><Text>Aceita comandos ⓘ</Text></Tooltip>
              <div><Switch checked={f.aceitaComandos} onChange={aceitaComandos => setF({ ...f, aceitaComandos })} /> {f.aceitaComandos ? 'sim' : 'não'}</div>
            </Col>
            <Col span={8}><Text>Situação</Text><div><Switch checked={f.situacao === 'ATIVO'} onChange={v => setF({ ...f, situacao: v ? 'ATIVO' : 'INATIVO' })} /> {f.situacao === 'ATIVO' ? 'Ativo' : 'Inativo'}</div></Col>
          </Row>
          <div><Text>Observação (placa, onde está o quadro...)</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => setF({ ...f, observacao: e.target.value || null })} placeholder="Ex.: ESP-01 + PCF8574 + ADS1115 + PZEM, quadro na casa de máquinas" /></div>
        </Space>
      </Modal>
      <Modal open={!!chave} title="Chave do aparelho (para o firmware)" footer={null} onCancel={() => setChave(null)} width={680}>
        {chave && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="A chave não fica guardada: é calculada da IOT_CHAVE_MESTRA do .env. Se a mestra mudar, grave a nova chave nos aparelhos." />
            <Descriptions size="small" column={1} bordered items={[
              { key: 'u', label: 'Endereço', children: <Text copyable code>{URL_LEITURAS}</Text> },
              { key: 'i', label: 'X-Dispositivo', children: <Text copyable code>{chave.identificador}</Text> },
              { key: 'c', label: 'X-Chave', children: <Text copyable code>{chave.chave}</Text> },
            ]} />
            <Text type="secondary" style={{ fontSize: 12 }}>Teste pelo terminal (troque o endereço pelo do servidor que o aparelho alcança):</Text>
            <Paragraph copyable code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {`curl -X POST "${URL_LEITURAS}" -H "Content-Type: application/json" -H "X-Dispositivo: ${chave.identificador}" -H "X-Chave: ${chave.chave}" -d "{\\"leituras\\":[{\\"nivel_m\\":38.4,\\"corrente_a\\":6.8,\\"bomba\\":true}]}"`}
            </Paragraph>
          </Space>
        )}
      </Modal>
    </Card>
  );
};

// ------------------------------------------------------------------ guia
const QUADRO = `REDE (3F + N + T)
 ├─ DPS (protetor de surto) ─────────────── raio é o que mais queima bomba e placa
 ├─ Disjuntor geral (curva C ou D)
 │   ├─ Disjuntor-motor (ou disjuntor + relé térmico) ── CONTATOR ── cabo ── BOMBA
 │   │        └─ contato auxiliar "desarmou" ──────────────► entrada TERMICO
 │   │
 │   └─ Comando (disjuntor 2 A), tudo EM SÉRIE com a bobina do contator:
 │        Seletora MAN-0-AUTO ─► Relé falta/sequência de fase ─► Relé de nível (eletrodos, a seco)
 │        ─► Boia/pressostato da caixa ─► [relé da placa, contato NF = bloqueio remoto] ─► BOBINA
 │
 └─ Fonte 5 V (HLK-PM01 ou fonte DIN) ── placa + módulos

Entradas (220 V sempre por módulo detector de tensão AC optoacoplado, PC817):
  FASE_R, FASE_S, FASE_T · TERMICO (auxiliar do disjuntor-motor) · BOIA (saída da boia/pressostato)
  BOBINA (contator energizado) · SELETORA em AUTO
Medidas: corrente (PZEM mono / Modbus tri / SCT-013) · pressão (transdutor 0–10 bar) · vazão (pulsos)
         nível do poço (4–20 mA)

Regra de ouro: a placa NUNCA liga a bomba por cima das proteções. O relé dela é NF em série:
desligado = libera. Se a placa queimar ou travar, o poço segue no automático como sempre.`;

const FIRMWARE_ESP01 = `// ESP-01 (ESP8266) + PCF8574 (entradas do quadro + relé) + ADS1115 (pressão, nível) + PZEM-004T v3
// GPIO0 = SDA, GPIO2 = SCL (pull-up de 10 kΩ para 3,3 V: os dois têm de estar em ALTO no boot)
// RX/TX = PZEM (você perde a serial de debug). Bibliotecas: PCF8574 (Rob Tillaart), Adafruit ADS1X15,
// PZEM004Tv30, ArduinoJson. Exemplo para começar: confira os pinos e as faixas no seu quadro.
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <Wire.h>
#include <PCF8574.h>
#include <Adafruit_ADS1X15.h>
#include <PZEM004Tv30.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <time.h>

const char* REDE = "sua-rede"; const char* SENHA = "sua-senha";
const char* URL = "https://SEU-SERVIDOR/api/modulos/hidraulica/pocos/iot/leituras";
const char* ID = "ESP01-0001";  const char* CHAVE = "cole-aqui-a-chave-da-tela";
const unsigned long INTERVALO = 5UL * 60UL * 1000UL;        // igual ao "mede a cada" do cadastro

PCF8574 pcf(0x20);  Adafruit_ADS1115 ads;  PZEM004Tv30 pzem(Serial);
// PCF8574: 0..6 entradas (optoacoplador puxa para 0 quando tem tensão), 7 = saída do relé de bloqueio
enum { FASE_R, FASE_S, FASE_T, TERMICO, BOIA, BOBINA, SEL_AUTO, RELE_BLOQUEIO };
bool tem(uint8_t p) { return pcf.read(p) == LOW; }
long confirmar = 0;                                          // id do comando a confirmar no próximo envio

String leitura() {
  time_t t = time(nullptr); struct tm tm; localtime_r(&t, &tm);
  char em[32]; strftime(em, sizeof em, "%Y-%m-%dT%H:%M:%S-03:00", &tm);
  float i = pzem.current(), v = pzem.voltage(), e = pzem.energy();
  // transdutor 0,5–4,5 V = 0–10 bar, com divisor 10k/20k (4,5 V → 3,0 V) antes do ADS1115 alimentado em 3,3 V
  float vp = ads.computeVolts(ads.readADC_SingleEnded(0)) * 1.5;
  float pressao = max(0.0f, (vp - 0.5f) / 4.0f * 10.0f);
  String s = String("{\\"em\\":\\"") + em + "\\"";
  s += ",\\"corrente_a\\":" + String(isnan(i) ? 0 : i, 2) + ",\\"fase_a_v\\":" + String(isnan(v) ? 0 : v, 1);
  s += ",\\"fase_b_v\\":" + String(tem(FASE_S) ? 220 : 0) + ",\\"fase_c_v\\":" + String(tem(FASE_T) ? 220 : 0);
  s += ",\\"energia_kwh\\":" + String(isnan(e) ? 0 : e, 3) + ",\\"pressao_bar\\":" + String(pressao, 2);
  s += String(",\\"termico_ok\\":") + (tem(TERMICO) ? "true" : "false") + ",\\"boia\\":" + (tem(BOIA) ? "true" : "false");
  s += String(",\\"comando\\":") + (tem(BOBINA) ? "true" : "false") + ",\\"modo\\":\\"" + (tem(SEL_AUTO) ? "AUTO" : "MANUAL") + "\\"";
  s += ",\\"sinal_dbm\\":" + String(WiFi.RSSI()) + "}";
  return s;
}

bool enviar(const String& leituras) {                         // leituras = "{...},{...}"
  if (WiFi.status() != WL_CONNECTED) return false;
  std::unique_ptr<BearSSL::WiFiClientSecure> cli(new BearSSL::WiFiClientSecure); cli->setInsecure();
  HTTPClient http; http.begin(*cli, URL);
  http.addHeader("Content-Type", "application/json"); http.addHeader("X-Dispositivo", ID); http.addHeader("X-Chave", CHAVE);
  String corpo = "{\\"leituras\\":[" + leituras + "]";
  if (confirmar) corpo += ",\\"confirmacoes\\":[{\\"id\\":" + String(confirmar) + ",\\"ok\\":true}]";
  int st = http.POST(corpo + "}");
  if (st == 201) {
    confirmar = 0;
    JsonDocument r; deserializeJson(r, http.getString());
    for (JsonObject c : r["comandos"].as<JsonArray>()) {       // BLOQUEAR / LIBERAR / RECONHECER
      String cmd = c["comando"];
      if (cmd == "BLOQUEAR") pcf.write(RELE_BLOQUEIO, LOW);    // energiza o relé: abre o NF, a bomba não parte
      if (cmd == "LIBERAR")  pcf.write(RELE_BLOQUEIO, HIGH);
      confirmar = c["id"];
    }
  }
  http.end();
  return st == 201;
}

void setup() {
  Serial.begin(9600);  Wire.begin(0, 2);  pcf.begin();  pcf.write(RELE_BLOQUEIO, HIGH);
  ads.begin();  ads.setGain(GAIN_ONE);  LittleFS.begin();
  WiFi.begin(REDE, SENHA);  configTime(-3 * 3600, 0, "pool.ntp.org");
}

void loop() {
  String l = leitura();
  // sem rede: guarda na memória e manda tudo junto quando voltar (o servidor não duplica a mesma hora)
  File f = LittleFS.open("/fila.txt", "a"); f.println(l); f.close();
  File g = LittleFS.open("/fila.txt", "r"); String lote; int n = 0;
  while (g.available() && n < 100) { String x = g.readStringUntil('\\n'); x.trim(); if (x.length()) { lote += (n ? "," : "") + x; n++; } }
  g.close();
  if (n && enviar(lote)) LittleFS.remove("/fila.txt");      // (simplificado: manda até 100 por vez)
  delay(INTERVALO);
}`;

type LinhaGuia = { t: TipoAlertaIot; o: string; c: string };

const ComoLigar: React.FC = () => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Alert type="info" showIcon message="O servidor não depende da placa"
      description="ESP-01, ESP32, ESP32 4G, LoRa ou sem internet: qualquer uma que mande o formato abaixo (pela rota ou por arquivo importado) funciona. A escolha pode mudar em cada poço." />
    <Card size="small" title="1. O quadro de comando e os pontos que a placa lê">
      <pre style={{ fontSize: 11, background: '#fafafa', padding: 10, borderRadius: 6, overflow: 'auto', margin: 0 }}>{QUADRO}</pre>
    </Card>
    <Card size="small" title="2. O que a placa envia">
      <Paragraph>
        <Text code>POST {URL_LEITURAS}</Text> com <Text code>X-Dispositivo</Text> e <Text code>X-Chave</Text> (botão "Chave" em Aparelhos). Lote de até 500;
        a mesma hora não duplica. A resposta traz <Text code>comandos</Text>; confirme com <Text code>confirmacoes</Text> no envio seguinte.
      </Paragraph>
      <Paragraph code copyable style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
        {`{ "leituras": [ { "em": "2026-10-22T14:05:00-03:00",
    "nivel_m": 38.4, "vazao_lh": 3200, "pressao_bar": 3.1, "corrente_a": 6.8,
    "fase_a_v": 221, "fase_b_v": 220, "fase_c_v": 219,
    "bomba": true, "comando": true, "termico_ok": true, "boia": true, "modo": "AUTO",
    "horimetro_h": 1532.4, "energia_kwh": 8421.35, "partidas": 1203,
    "temp_c": 31.5, "sinal_dbm": -71, "bateria_v": 12.6 } ],
  "confirmacoes": [ { "id": 12, "ok": true, "resposta": "relé acionado" } ] }`}
      </Paragraph>
      <Text type="secondary" style={{ fontSize: 12 }}>Todos os campos são opcionais: mande só o que o quadro tem. "coluna_m" no lugar de "nivel_m" usa a profundidade do sensor do cadastro.</Text>
    </Card>
    <Card size="small" title="3. Poço sem internet">
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Cadastre o aparelho com conexão <b>Sem internet (arquivo)</b>: não gera "sem sinal".</li>
        <li>A placa grava as leituras na memória (LittleFS) ou num cartão SD, uma por linha (JSON) ou em CSV com cabeçalho nos mesmos nomes (<Text code>em;nivel_m;corrente_a;...</Text>).</li>
        <li>Para buscar sem abrir o quadro: a placa cria uma rede Wi-Fi própria (modo AP, ex.: "POCO-0001"), o celular conecta e baixa o arquivo; ou leva-se o cartão SD.</li>
        <li>No detalhe do aparelho, <b>Importar arquivo</b>: aceita até 1 ano de leituras; reimportar não duplica.</li>
        <li>Sem internet a hora do relógio importa: use um módulo RTC (DS3231) para a hora não se perder sem energia.</li>
      </ul>
    </Card>
    <Card size="small" title="4. ESP-01 ou ESP32">
      <Row gutter={[16, 8]}>
        <Col xs={24} md={12}>
          <Text strong>ESP-01 (ESP8266)</Text>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            <li>Só GPIO0 e GPIO2 livres (+ RX/TX) e sem entrada analógica: use GPIO0/2 como I2C.</li>
            <li>PCF8574 = 8 pinos (7 entradas do quadro + 1 saída para o relé de bloqueio). ADS1115 = 4 entradas analógicas (pressão, nível 4–20 mA).</li>
            <li>RX/TX = PZEM (monofásico) ou MAX485 (medidor Modbus trifásico).</li>
            <li>Pull-up 10 kΩ em GPIO0/2; regulador AMS1117 3,3 V + capacitor 470 µF; <b>snubber RC na bobina do contator</b> (o ESP-01 reinicia com o ruído).</li>
            <li>Só Wi-Fi; memória curta (dias de fila, não semanas).</li>
          </ul>
        </Col>
        <Col xs={24} md={12}>
          <Text strong>ESP32</Text>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            <li>GPIO e ADC de sobra, 3 seriais: dispensa PCF8574 (use optoacopladores direto nos pinos).</li>
            <li>Versões com 4G (LilyGO T-A7670 / T-SIM7600) para poço sem Wi-Fi; LoRa (Heltec V3) para vários poços perto.</li>
            <li>Mais memória para fila longa e para servir o arquivo no modo AP.</li>
          </ul>
        </Col>
      </Row>
      <div style={{ marginTop: 8 }}>
        <Text strong>Peças comuns: </Text>
        <Text>módulo detector de tensão AC optoacoplado (1 por ponto de 220 V) · transdutor de pressão 0–10 bar 0,5–4,5 V · transmissor de nível 4–20 mA com cabo ventilado ·
          PZEM-004T v3 (mono) ou medidor Modbus RS485 (tri) · hidrômetro com saída de pulsos · módulo relé 1 canal (NF em série com a bobina) · DPS · HLK-PM01 · caixa IP65 · RTC DS3231 (sem internet).</Text>
      </div>
    </Card>
    <Card size="small" title="5. Exemplo de firmware para o ESP-01 (quadro completo, fila sem rede e comandos)">
      <Paragraph copyable={{ text: FIRMWARE_ESP01 }} style={{ marginBottom: 0 }}>
        <pre style={{ fontSize: 11, maxHeight: 460, overflow: 'auto', background: '#fafafa', padding: 10, borderRadius: 6 }}>{FIRMWARE_ESP01}</pre>
      </Paragraph>
    </Card>
    <Card size="small" title="6. O que cada alerta indica">
      <Table<LinhaGuia> size="small" pagination={false} rowKey="t" dataSource={[
        { t: 'FALTA_FASE', o: 'Uma fase sem tensão', c: 'queda de fase da concessionária, fusível/disjuntor de uma fase' },
        { t: 'SEM_ENERGIA', o: 'Nenhuma fase com tensão', c: 'falta de energia (os alertas da bomba ficam em espera)' },
        { t: 'NAO_PARTE', o: 'Boia pede, energia ok, AUTO, contator não liga (2 leituras)', c: 'relé de nível (poço baixo), relé de fase, bobina ou boia com defeito' },
        { t: 'SEM_FUNCIONAMENTO', o: 'Contator ligado e corrente ≈ 0', c: 'bomba queimada, cabo rompido, emenda solta' },
        { t: 'TERMICO', o: 'Disjuntor-motor/térmico desarmado', c: 'sobrecarga, bomba travada (areia), tensão baixa' },
        { t: 'PRESSAO_BAIXA', o: 'Corrente normal e pressão baixa', c: 'cano ou edutor estourado, bomba girando sem bombear' },
        { t: 'LIGADA_DEMAIS', o: 'Ligada sem parar além do limite', c: 'boia travada/queimada (não desliga), vazamento na caixa ou rede' },
        { t: 'PARTIDAS_DEMAIS', o: 'Muitas partidas na hora', c: 'boia oscilando, pressostato desregulado, tanque de pressão sem ar' },
        { t: 'A_SECO', o: 'Girando com corrente baixa', c: 'água acabou na bomba' },
      ]} columns={[
        { title: 'Alerta', width: 160, render: (_, x) => <Tag color={TIPOS_ALERTA_IOT[x.t].cor}>{TIPOS_ALERTA_IOT[x.t].texto}</Tag> },
        { title: 'O que os sensores mostram', dataIndex: 'o' }, { title: 'Causa provável', dataIndex: 'c' },
      ]} />
    </Card>
    <Card size="small" title="7. Dicas de instalação">
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Sensor de nível abaixo do nível dinâmico e acima da bomba, preso ao edutor; anote a profundidade no cadastro.</li>
        <li>Primeiro dia: deixe sem limites, olhe a corrente e a pressão normais, e depois ponha os limites (a seco ≈ 60–70% da corrente normal).</li>
        <li>Com internet, o servidor precisa de um endereço que a placa alcance (domínio com HTTPS); "localhost" só funciona no computador.</li>
        <li>Teste tudo pelo simulador (no detalhe do aparelho) antes de ir a campo.</li>
      </ul>
    </Card>
  </Space>
);

const MonitoramentoPocos: React.FC = () => {
  const [vista, setVista] = useState<'PAINEL' | 'ALERTAS' | 'APARELHOS' | 'GUIA'>('PAINEL');
  const [novo, setNovo] = useState(false);
  const [versao, setVersao] = useState(0);
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Segmented value={vista} onChange={v => setVista(v as typeof vista)} options={[
          { value: 'PAINEL', label: <span><ApiOutlined /> Painel</span> }, { value: 'ALERTAS', label: 'Alertas' },
          { value: 'APARELHOS', label: 'Aparelhos' }, { value: 'GUIA', label: 'Como montar e ligar' },
        ]} />
        {vista === 'PAINEL' && <Tooltip title="Recarregar (o painel também atualiza sozinho a cada minuto)"><Button icon={<ReloadOutlined />} onClick={() => setVersao(v => v + 1)} /></Tooltip>}
      </Space>
      {vista === 'PAINEL' && <PainelAparelhos key={versao} onCadastrar={() => { setVista('APARELHOS'); setNovo(true); }} />}
      {vista === 'ALERTAS' && <TodosAlertas />}
      {vista === 'APARELHOS' && <Aparelhos novo={novo} onNovoFeito={() => setNovo(false)} />}
      {vista === 'GUIA' && <ComoLigar />}
    </Space>
  );
};

export default MonitoramentoPocos;
