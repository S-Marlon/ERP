// Obras de poços › ficha do poço › "Bomba e instalação": o conjunto motobomba instalado (bomba ou motor + bombeador, tubo,
// fio, corda, quadro e cabeça do poço), o histórico de trocas e as fotos do poço (bomba, cabeça, quadro, local).
import React, { useEffect, useState } from 'react';
import {
  AutoComplete, Button, Card, Col, Descriptions, Divider, Empty, Form, Image, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag,
  Tooltip, Typography, Upload, message,
} from 'antd';
import { CameraOutlined, DeleteOutlined, EditOutlined, HistoryOutlined, PlusOutlined, SwapOutlined, ToolOutlined } from '@ant-design/icons';
import {
  Conjunto, conjuntoApi, ConjuntoDoPoco, ConjuntoForm, dataBr, ETAPAS_FOTO, FotoPoco, TIPOS_BOMBA, TIPOS_FOTO_POCO, TipoFotoPoco, urlArquivo,
} from './obrasApi';
import { reduzirImagem } from './ProcessoObra';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const num = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
/** Bomba com esse tempo de uso já pede atenção (igual à prévia do plano mensal). */
const BOMBA_VELHA_ANOS = 5;

const opcoes = (l: string[]) => l.map(v => ({ value: v }));
const MATERIAIS_TUBO = opcoes(['PVC geomecânico', 'Aço galvanizado', 'PEAD', 'Tubo flexível (Subteck/PEX)', 'Mangueira']);
const TENSOES = opcoes(['220 V mono', '220 V tri', '380 V tri', '127 V mono']);
const FIOS = opcoes(['Cabo PP', 'Cabo plano', 'Paralelo']);
const BITOLAS = opcoes(['3 x 1,5 mm²', '3 x 2,5 mm²', '3 x 4 mm²', '3 x 6 mm²', '4 x 4 mm²', '4 x 6 mm²']);
const CORDAS = opcoes(['Corda de nylon', 'Corda de polipropileno', 'Cabo de aço inox']);

type Modo = 'NOVO' | 'TROCAR' | 'EDITAR' | 'ANTIGO';
const TITULOS: Record<Modo, string> = {
  NOVO: 'Registrar o conjunto instalado', TROCAR: 'Trocar o conjunto (o atual vai para o histórico)', EDITAR: 'Corrigir o conjunto',
  ANTIGO: 'Registrar um conjunto que já saiu do poço',
};

const ConjuntoModal: React.FC<{
  aberto: { modo: Modo; base?: Conjunto | null } | null; idPoco: number; onFechar: () => void; onSalvo: () => void;
}> = ({ aberto, idPoco, onFechar, onSalvo }) => {
  const [form] = Form.useForm<ConjuntoForm>();
  const [salvando, setSalvando] = useState(false);
  const modo = aberto?.modo;
  useEffect(() => {
    if (!aberto) return;
    form.resetFields();
    const b = aberto.base;
    if (modo === 'EDITAR' && b) form.setFieldsValue(b);
    // na troca, tubo, fio, corda, quadro e cabeça costumam ficar: já vêm preenchidos
    else if (modo === 'TROCAR' && b) form.setFieldsValue({
      instaladoEm: hojeIso(), profundidadeBombaM: b.profundidadeBombaM, tuboMaterial: b.tuboMaterial, tuboDiametro: b.tuboDiametro, tuboBarras: b.tuboBarras,
      tuboMetros: b.tuboMetros, fioTipo: b.fioTipo, fioBitola: b.fioBitola, fioMetros: b.fioMetros, cordaMaterial: b.cordaMaterial, cordaMetros: b.cordaMetros,
      quadroComando: b.quadroComando, cabecaPoco: b.cabecaPoco, tensao: b.tensao,
    });
    else if (modo === 'NOVO') form.setFieldsValue({ bombaTipo: 'SUBMERSA' });
  }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    const v = await form.validateFields();
    setSalvando(true);
    try {
      if (modo === 'EDITAR' && aberto?.base) await conjuntoApi.salvar(aberto.base.idConjunto, v);
      else await conjuntoApi.criar(idPoco, { ...v, substituir: modo === 'TROCAR' });
      message.success(modo === 'TROCAR' ? 'Conjunto trocado: o anterior foi para o histórico.' : 'Conjunto salvo.');
      onSalvo();
    } catch (e) { erro(e); } finally { setSalvando(false); }
  };
  const data = (label: string, name: keyof ConjuntoForm, obrigatoria = false) => (
    <Form.Item label={label} name={name} rules={obrigatoria ? [{ required: true, message: 'Informe a data.' }] : undefined}
      getValueFromEvent={e => e.target.value || null}>
      <Input type="date" max={hojeIso()} />
    </Form.Item>
  );
  const texto = (label: string, name: keyof ConjuntoForm, placeholder?: string, lista?: { value: string }[]) => (
    <Form.Item label={label} name={name} normalize={v => (v ? v : null)}>
      {lista ? <AutoComplete options={lista} placeholder={placeholder} allowClear filterOption={(t, o) => String(o?.value).toLowerCase().includes(t.toLowerCase())} />
        : <Input placeholder={placeholder} />}
    </Form.Item>
  );
  const numero = (label: string, name: keyof ConjuntoForm, sufixo?: string, passo = 1) => (
    <Form.Item label={label} name={name}><InputNumber min={0} step={passo} decimalSeparator="," style={{ width: '100%' }} suffix={sufixo} /></Form.Item>
  );
  const comRetirada = modo === 'ANTIGO' || (modo === 'EDITAR' && aberto?.base?.situacao === 'RETIRADO');

  return (
    <Modal open={!!aberto} title={modo ? TITULOS[modo] : ''} onCancel={onFechar} onOk={salvar} okText="Salvar" cancelText="Voltar"
      confirmLoading={salvando} destroyOnHidden width={820} styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}>
      {modo === 'TROCAR' && <Text type="secondary">Tubo, fio, corda, quadro e cabeça vieram do conjunto atual: mude só o que foi trocado.</Text>}
      <Form form={form} layout="vertical" size="small" style={{ marginTop: 8 }}>
        <Row gutter={10}>
          <Col xs={12} md={6}>{data('Instalado em', 'instaladoEm')}</Col>
          {comRetirada && <Col xs={12} md={6}>{data('Retirado em', 'retiradoEm', modo === 'ANTIGO')}</Col>}
        </Row>
        <Divider titlePlacement="start" plain style={{ margin: '4px 0 8px' }}>Bomba</Divider>
        <Row gutter={10}>
          <Col xs={12} md={6}><Form.Item label="Tipo" name="bombaTipo"><Select allowClear options={Object.entries(TIPOS_BOMBA).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
          <Col xs={12} md={6}>{texto('Marca', 'bombaMarca', 'Ebara, Leão, Schneider')}</Col>
          <Col xs={12} md={6}>{texto('Modelo', 'bombaModelo', '4BPS3-12')}</Col>
          <Col xs={12} md={6}>{numero('Potência', 'potenciaCv', 'CV', 0.5)}</Col>
          <Col xs={12} md={6}>{texto('Tensão', 'tensao', '220 V mono', TENSOES)}</Col>
          <Col xs={12} md={6}>{numero('Estágios', 'estagios')}</Col>
          <Col xs={12} md={6}>{numero('Profundidade da bomba', 'profundidadeBombaM', 'm')}</Col>
        </Row>
        <Divider titlePlacement="start" plain style={{ margin: '4px 0 8px' }}>Motor e bombeador <Text type="secondary" style={{ fontSize: 12 }}>(quando são peças separadas)</Text></Divider>
        <Row gutter={10}>
          <Col xs={12} md={6}>{texto('Motor: marca', 'motorMarca', 'Franklin, WEG')}</Col>
          <Col xs={12} md={6}>{texto('Motor: modelo', 'motorModelo')}</Col>
          <Col xs={12} md={6}>{texto('Bombeador: marca', 'bombeadorMarca')}</Col>
          <Col xs={12} md={6}>{texto('Bombeador: modelo', 'bombeadorModelo', '3BPS2-14')}</Col>
        </Row>
        <Divider titlePlacement="start" plain style={{ margin: '4px 0 8px' }}>Tubo, fio e corda</Divider>
        <Row gutter={10}>
          <Col xs={12} md={6}>{texto('Tubo: material', 'tuboMaterial', 'PVC geomecânico', MATERIAIS_TUBO)}</Col>
          <Col xs={12} md={6}>{texto('Tubo: diâmetro', 'tuboDiametro', '1 1/4"')}</Col>
          <Col xs={12} md={6}>{numero('Tubo: barras', 'tuboBarras')}</Col>
          <Col xs={12} md={6}>{numero('Tubo: metros', 'tuboMetros', 'm')}</Col>
          <Col xs={12} md={6}>{texto('Fio: tipo', 'fioTipo', 'Cabo PP', FIOS)}</Col>
          <Col xs={12} md={6}>{texto('Fio: bitola', 'fioBitola', '3 x 4 mm²', BITOLAS)}</Col>
          <Col xs={12} md={6}>{numero('Fio: metros', 'fioMetros', 'm')}</Col>
          <Col xs={12} md={6} />
          <Col xs={12} md={6}>{texto('Corda', 'cordaMaterial', 'Corda de nylon 10 mm', CORDAS)}</Col>
          <Col xs={12} md={6}>{numero('Corda: metros', 'cordaMetros', 'm')}</Col>
        </Row>
        <Divider titlePlacement="start" plain style={{ margin: '4px 0 8px' }}>Quadro e cabeça do poço</Divider>
        <Row gutter={10}>
          <Col xs={24} md={12}>{texto('Quadro de comando', 'quadroComando', 'Chave de partida, relé de nível, boia')}</Col>
          <Col xs={24} md={12}>{texto('Cabeça do poço', 'cabecaPoco', 'Curva 90°, válvula de retenção, registro, manômetro, tampa')}</Col>
          <Col xs={24}>{texto('Observação', 'observacao')}</Col>
        </Row>
      </Form>
    </Modal>
  );
};

/** Descrição do conjunto em blocos (só o que foi preenchido). */
const Detalhe: React.FC<{ c: Conjunto }> = ({ c }) => {
  const junta = (...v: (string | null | false | undefined)[]) => v.filter(Boolean).join(' · ');
  const itens = [
    { key: 'b', label: 'Bomba', children: junta(c.bombaTipo && TIPOS_BOMBA[c.bombaTipo], [c.bombaMarca, c.bombaModelo].filter(Boolean).join(' '),
      c.potenciaCv !== null && `${num(c.potenciaCv)} CV`, c.tensao, c.estagios !== null && `${c.estagios} estágios`) },
    { key: 'm', label: 'Motor / bombeador', children: junta([c.motorMarca, c.motorModelo].filter(Boolean).join(' ') && `motor ${[c.motorMarca, c.motorModelo].filter(Boolean).join(' ')}`,
      [c.bombeadorMarca, c.bombeadorModelo].filter(Boolean).join(' ') && `bombeador ${[c.bombeadorMarca, c.bombeadorModelo].filter(Boolean).join(' ')}`) },
    { key: 'p', label: 'Profundidade da bomba', children: c.profundidadeBombaM !== null ? `${num(c.profundidadeBombaM)} m` : '' },
    { key: 't', label: 'Tubo', children: junta(c.tuboMaterial, c.tuboDiametro, c.tuboBarras !== null && `${c.tuboBarras} barras`, c.tuboMetros !== null && `${num(c.tuboMetros)} m`) },
    { key: 'f', label: 'Fio', children: junta(c.fioTipo, c.fioBitola, c.fioMetros !== null && `${num(c.fioMetros)} m`) },
    { key: 'c', label: 'Corda', children: junta(c.cordaMaterial, c.cordaMetros !== null && `${num(c.cordaMetros)} m`) },
    { key: 'q', label: 'Quadro de comando', children: c.quadroComando || '' },
    { key: 'h', label: 'Cabeça do poço', children: c.cabecaPoco || '' },
    { key: 'o', label: 'Observação', children: c.observacao || '' },
  ].filter(i => i.children);
  return <Descriptions size="small" bordered column={{ xs: 1, md: 2 }} items={itens.map(i => ({ ...i, span: ['h', 'q', 'o'].includes(i.key) ? 2 : 1 }))} />;
};

const Uso: React.FC<{ c: Conjunto }> = ({ c }) => (
  c.anosDeUso === null ? null
    : <Tag color={c.situacao === 'INSTALADO' && c.anosDeUso >= BOMBA_VELHA_ANOS ? 'orange' : 'default'}>
        {c.anosDeUso < 1 ? 'menos de 1 ano' : `${c.anosDeUso} ano${c.anosDeUso > 1 ? 's' : ''}`} de uso
        {c.situacao === 'INSTALADO' && c.anosDeUso >= BOMBA_VELHA_ANOS ? ' · perto da troca' : ''}
      </Tag>
);

const FotosDoPoco: React.FC<{ idPoco: number; d: ConjuntoDoPoco; onMudou: () => void }> = ({ idPoco, d, onMudou }) => {
  const [tipo, setTipo] = useState<TipoFotoPoco>('BOMBA');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo: File) => {
    setEnviando(true);
    try { await conjuntoApi.enviarFoto(idPoco, { tipo, conteudo: await reduzirImagem(arquivo), nome: arquivo.name, tiradaEm: hojeIso() }); onMudou(); }
    catch (e) { erro(e); } finally { setEnviando(false); }
  };
  const salvar = async (f: FotoPoco, mudou: Partial<FotoPoco>) => {
    try { await conjuntoApi.salvarFoto(f.idFoto, { tipo: f.tipo, legenda: f.legenda, tiradaEm: f.tiradaEm, ...mudou }); onMudou(); } catch (e) { erro(e); }
  };
  return (
    <Card size="small" title={<Space><CameraOutlined />Fotos do poço ({d.fotos.length})</Space>}
      extra={<Space.Compact>
        <Select size="small" value={tipo} onChange={setTipo} style={{ width: 160 }} options={Object.entries(TIPOS_FOTO_POCO).map(([value, label]) => ({ value, label }))} />
        <Upload accept="image/*" multiple showUploadList={false} beforeUpload={f => { enviar(f); return false; }}>
          <Button size="small" type="primary" icon={<PlusOutlined />} loading={enviando}>Enviar foto</Button>
        </Upload>
      </Space.Compact>}>
      {!d.fotos.length && <Text type="secondary">Tire foto da bomba antes de descer, da cabeça do poço (curvas, válvulas, registro) e do quadro: ajuda na próxima manutenção e no orçamento sem visita.</Text>}
      <Image.PreviewGroup>
        <Row gutter={[10, 10]}>
          {d.fotos.map(f => (
            <Col key={f.idFoto} xs={12} md={6}>
              <Card size="small" styles={{ body: { padding: 6 } }}
                cover={<Image src={urlArquivo(f.url) || undefined} height={120} style={{ objectFit: 'cover' }} />}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space size={4} style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Select size="small" variant="borderless" value={f.tipo} style={{ width: 130 }} popupMatchSelectWidth={false}
                      onChange={t => salvar(f, { tipo: t })} options={Object.entries(TIPOS_FOTO_POCO).map(([value, label]) => ({ value, label }))} />
                    <Popconfirm title="Apagar esta foto?" okText="Apagar" cancelText="Não"
                      onConfirm={async () => { try { await conjuntoApi.apagarFoto(f.idFoto); onMudou(); } catch (e) { erro(e); } }}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>{dataBr(f.tiradaEm || f.criadaEm)}{f.idConjunto ? ' · com o conjunto da época' : ''}</Text>
                  <Text style={{ fontSize: 12 }} editable={{ onChange: v => { if ((v || null) !== f.legenda) salvar(f, { legenda: v || null }); }, text: f.legenda || '' }}>
                    {f.legenda || <Text type="secondary" style={{ fontSize: 12 }}>legenda</Text>}
                  </Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        {d.fotosDasObras.length > 0 && (
          <>
            <Divider titlePlacement="start" plain style={{ margin: '12px 0 8px' }}>Fotos das obras neste poço ({d.fotosDasObras.length})</Divider>
            <Row gutter={[8, 8]}>
              {d.fotosDasObras.map(f => (
                <Col key={f.idFoto} xs={8} md={4}>
                  <Tooltip title={`${f.obra} · ${ETAPAS_FOTO[f.etapa]} · ${dataBr(f.criadaEm)}${f.legenda ? ` · ${f.legenda}` : ''}`}>
                    <Image src={urlArquivo(f.url) || undefined} height={80} width="100%" style={{ objectFit: 'cover', borderRadius: 4 }} />
                  </Tooltip>
                </Col>
              ))}
            </Row>
          </>
        )}
      </Image.PreviewGroup>
    </Card>
  );
};

export const ConjuntoPoco: React.FC<{ idPoco: number; onAbrirObra?: (idObra: number) => void }> = ({ idPoco, onAbrirObra }) => {
  const [d, setD] = useState<ConjuntoDoPoco | null>(null);
  const [editando, setEditando] = useState<{ modo: Modo; base?: Conjunto | null } | null>(null);
  const [retirando, setRetirando] = useState<string | null>(null);
  const carregar = () => conjuntoApi.doPoco(idPoco).then(setD).catch(erro);
  useEffect(() => { carregar(); }, [idPoco]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <Card size="small" loading />;
  const a = d.atual;
  const obraLink = (c: Conjunto) => (c.idObra ? (onAbrirObra ? <a onClick={() => onAbrirObra(c.idObra!)}>{c.obra}</a> : c.obra) : null);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small" title={<Space><ToolOutlined />Conjunto instalado</Space>}
        extra={a ? <Space wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditando({ modo: 'EDITAR', base: a })}>Corrigir</Button>
          <Button size="small" type="primary" icon={<SwapOutlined />} onClick={() => setEditando({ modo: 'TROCAR', base: a })}>Trocar conjunto</Button>
          <Button size="small" onClick={() => setRetirando(hojeIso())}>Retirar</Button>
        </Space> : <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setEditando({ modo: 'NOVO' })}>Registrar conjunto</Button>}>
        {a ? (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Space wrap>
              <Text strong>{a.resumo}</Text>
              <Uso c={a} />
              {a.instaladoEm && <Text type="secondary">instalado em {dataBr(a.instaladoEm)}</Text>}
              {a.idObra && <Text type="secondary">· {obraLink(a)}</Text>}
            </Space>
            <Detalhe c={a} />
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={d.historico.length ? 'Nenhum conjunto instalado agora (o último foi retirado).' : 'Ainda não sabemos o que está instalado neste poço: bomba, tubo, fio, corda e quadro.'} />
        )}
      </Card>

      <FotosDoPoco idPoco={idPoco} d={d} onMudou={carregar} />

      <Card size="small" title={<Space><HistoryOutlined />Histórico de trocas ({d.historico.length})</Space>}
        extra={<Button size="small" onClick={() => setEditando({ modo: 'ANTIGO' })}>Registrar conjunto antigo</Button>}>
        {d.historico.length ? (
          <Table size="small" rowKey="idConjunto" pagination={false} dataSource={d.historico}
            expandable={{ expandedRowRender: c => <Detalhe c={c} /> }}
            columns={[
              { title: 'Período', key: 'p', width: 200, render: (_, c) => `${c.instaladoEm ? dataBr(c.instaladoEm) : '?'} → ${c.retiradoEm ? dataBr(c.retiradoEm) : '?'}` },
              { title: 'Uso', key: 'u', width: 130, render: (_, c) => <Uso c={c} /> },
              { title: 'Conjunto', dataIndex: 'resumo' },
              { title: 'Obra', key: 'o', width: 160, render: (_, c) => obraLink(c) || '—' },
              {
                key: 'a', width: 80, render: (_, c) => <Space size={0}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditando({ modo: 'EDITAR', base: c })} />
                  <Popconfirm title="Apagar este registro do histórico?" description="Use só para lançamento errado." okText="Apagar" cancelText="Não"
                    onConfirm={async () => { try { await conjuntoApi.apagar(c.idConjunto); carregar(); } catch (e) { erro(e); } }}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>,
              },
            ]} />
        ) : <Text type="secondary">As trocas aparecem aqui com o tempo de uso de cada bomba: ajuda a prever a próxima troca e a calcular o plano mensal.</Text>}
      </Card>

      <ConjuntoModal aberto={editando} idPoco={idPoco} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
      <Modal open={retirando !== null} title="Retirar o conjunto sem pôr outro no lugar" okText="Retirar" cancelText="Voltar" destroyOnHidden
        onCancel={() => setRetirando(null)}
        onOk={async () => { try { await conjuntoApi.retirar(a!.idConjunto, retirando!); setRetirando(null); carregar(); } catch (e) { erro(e); } }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">Ex.: a bomba foi para o conserto. Para pôr outra no lugar, use "Trocar conjunto".</Text>
          <Text>Retirado em</Text>
          <Input type="date" max={hojeIso()} value={retirando || ''} onChange={e => setRetirando(e.target.value || hojeIso())} />
        </Space>
      </Modal>
    </Space>
  );
};
