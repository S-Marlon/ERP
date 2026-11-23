// Obras de poços › ficha do poço › "Bomba e instalação": o conjunto motobomba instalado (bomba ou motor + bombeador, tubo,
// fio, corda, quadro e cabeça do poço), o histórico de trocas e as fotos do poço (bomba, cabeça, quadro, local).
import React, { useEffect, useState } from 'react';
import { Alert, AutoComplete, Button, Card, Col, Descriptions, Divider, Empty, Flex, Form, Image, Input, Modal, Popconfirm, Row, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography, Upload, message, theme } from 'antd';
import {
  ApiOutlined, CameraOutlined, ColumnHeightOutlined, DeleteOutlined, EditOutlined, HistoryOutlined, HomeOutlined, PlusOutlined, SwapOutlined, ThunderboltOutlined, ToolOutlined,
} from '@ant-design/icons';
import {
  Conjunto, conjuntoApi, ConjuntoDoPoco, ConjuntoForm, dataBr, ETAPAS_FOTO, FotoPoco, TIPOS_BOMBA, TIPOS_FOTO_POCO, TipoFotoPoco, urlArquivo,
} from './obrasApi';
import { reduzirImagem } from './ProcessoObra';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';
import { conferirConjunto, LUVAS, luvaPeloMaterial, PocoDoConjunto, precisaCorda, sugestoesTubo, svgConjunto, textoTubo, tipoLuva } from './desenhoConjunto';

const { Text } = Typography;
const erro = (e: unknown) => message.error(e instanceof Error ? e.message : 'Erro.');
const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const num = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
/** Bomba com esse tempo de uso já pede atenção (igual à prévia do plano mensal). */
const BOMBA_VELHA_ANOS = 5;

const opcoes = (l: string[]) => l.map(v => ({ value: v }));
// (rosca) com luva aguenta o peso: corda opcional; (soldado), PEAD, flexível e mangueira pedem corda
const MATERIAIS_TUBO = opcoes(['PVC geomecânico (rosca)', 'Aço galvanizado (rosca)', 'PVC irrigação (soldado)', 'PEAD', 'Tubo flexível (Subteck/PEX)', 'Mangueira']);
const TENSOES = opcoes(['220 V mono', '220 V tri', '380 V tri', '127 V mono']);
const FIOS = opcoes(['Cabo PP', 'Cabo plano', 'Paralelo']);
const BITOLAS = opcoes(['3 x 1,5 mm²', '3 x 2,5 mm²', '3 x 4 mm²', '3 x 6 mm²', '4 x 4 mm²', '4 x 6 mm²']);
const CORDAS = opcoes(['Corda de nylon', 'Corda de polipropileno', 'Cabo de aço inox']);

type Modo = 'NOVO' | 'TROCAR' | 'EDITAR' | 'ANTIGO';
const TITULOS: Record<Modo, string> = {
  NOVO: 'Registrar o conjunto instalado', TROCAR: 'Trocar o conjunto (o atual vai para o histórico)', EDITAR: 'Corrigir o conjunto',
  ANTIGO: 'Registrar um conjunto que já saiu do poço',
};

/** Campos de um conjunto (dentro de um <Form>): o modal do conjunto e o "Novo poço" usam os mesmos. */
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
  <Form.Item label={label} name={name}><CampoNumero min={0} step={passo} style={{ width: '100%' }} suffix={sufixo} /></Form.Item>
);
/**
 * Tubo contado por barra: informa as barras e o comprimento de cada uma (6 m quando vazio) e o total sai sozinho
 * (gravado em tuboMetros). Sem saber as barras, dá para informar só o total.
 */
const TuboPorBarra: React.FC = () => {
  const form = Form.useFormInstance();
  const barras = Number(Form.useWatch('tuboBarras', form)) || 0;
  const metros = Number(Form.useWatch('tuboMetros', form)) || 0;
  const profundidade = Number(Form.useWatch('profundidadeBombaM', form)) || 0;
  const [comprimento, setComprimento] = useState<number | null>(null);
  // regra de 3 com a profundidade da bomba: falta as barras ou o comprimento, sugere
  const sug = sugestoesTubo(profundidade, barras, comprimento);
  const compPelaBomba = profundidade > 0 && barras > 0 && !comprimento ? Math.round((profundidade / barras) * 100) / 100 : null;
  const link = (texto: string, acao: () => void) => <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={acao}>{texto}</Button>;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  // abrindo um conjunto salvo: o comprimento sai do total ÷ barras
  useEffect(() => { if (comprimento === null && barras > 0 && metros > 0) setComprimento(r2(metros / barras)); }, [barras, metros]);   // eslint-disable-line react-hooks/exhaustive-deps
  // barras ou comprimento mudou: recalcula o total (barra de 6 m quando não informada)
  useEffect(() => {
    if (!(barras > 0)) return;
    const total = r2(barras * (comprimento || 6));
    if (total !== metros) form.setFieldValue('tuboMetros', total);
  }, [barras, comprimento]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Col xs={12} md={6}>
        <Form.Item label="Tubo: barras" name="tuboBarras"
          extra={sug.barras || (!barras && profundidade > 0)
            ? (() => {
                const c = comprimento || 6;
                const n = Math.ceil(profundidade / c - 1e-6);
                const exata = Math.abs(profundidade / c - Math.round(profundidade / c)) < 1e-6;
                return link(`${exata ? '' : '≈ '}${n} barras de ${String(c).replace('.', ',')} m (bomba a ${String(profundidade).replace('.', ',')} m)`, () => form.setFieldValue('tuboBarras', n));
              })()
            : null}>
          <CampoNumero min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item label="Comprimento da barra"
          extra={compPelaBomba && compPelaBomba !== 6
            ? link(`usar ${String(compPelaBomba).replace('.', ',')} m (${String(profundidade).replace('.', ',')} m ÷ ${barras} barras)`, () => setComprimento(compPelaBomba))
            : barras > 0 && !comprimento ? <Text type="secondary" style={{ fontSize: 12 }}>vazio = 6 m (o comum)</Text> : null}>
          <CampoNumero min={0} max={100} style={{ width: '100%' }} suffix="m" placeholder="6" value={comprimento ?? undefined}
            onChange={v => setComprimento(v === null || v === undefined ? null : Number(v))} />
        </Form.Item>
      </Col>
      {barras > 0 ? (
        <Col xs={12} md={6}>
          <Form.Item label="Tubo: total">
            <Text strong>{String(metros).replace('.', ',')} m</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{textoTubo({ tuboBarras: barras, tuboMetros: metros })}</Text>
          </Form.Item>
          <Form.Item name="tuboMetros" hidden><CampoNumero /></Form.Item>
        </Col>
      ) : (
        <Col xs={12} md={6}>{numero('Tubo: total (sem as barras)', 'tuboMetros', 'm')}</Col>
      )}
    </>
  );
};

/** Bloco do formulário do conjunto: borda colorida, ícone e título (Bomba, Tubo, Fio e corda, Superfície). */
const Bloco: React.FC<{ icone: React.ReactNode; titulo: string; cor: string; extra?: React.ReactNode; children: React.ReactNode }> = ({ icone, titulo, cor, extra, children }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ border: `1px solid ${token.colorBorderSecondary}`, borderLeft: `3px solid ${cor}`, borderRadius: token.borderRadiusLG, padding: '10px 12px 2px', background: token.colorBgContainer }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Space size={6}><span style={{ color: cor, fontSize: 15 }}>{icone}</span><Text strong>{titulo}</Text></Space>
        {extra}
      </Flex>
      {children}
    </div>
  );
};

export const CamposConjunto: React.FC<{ comDataDeInstalacao?: boolean }> = ({ comDataDeInstalacao }) => {
  const form = Form.useFormInstance();
  const v: Partial<ConjuntoForm> = Form.useWatch([], form) || {};
  // motor e bombeador separados: aparece aberto se já tem algum preenchido
  const [separados, setSeparados] = useState(false);
  useEffect(() => { if (v.motorMarca || v.motorModelo || v.bombeadorMarca || v.bombeadorModelo) setSeparados(true); }, [v.motorMarca, v.motorModelo, v.bombeadorMarca, v.bombeadorModelo]);
  const bomba = Number(v.profundidadeBombaM) || 0;
  const tubos = Number(v.tuboMetros) || 0;
  // material soldado (PVC de irrigação) não tem luva: preenche sozinho
  useEffect(() => { const l = luvaPeloMaterial(v.tuboMaterial); if (l && !v.tuboLuva) form.setFieldValue('tuboLuva', l); }, [v.tuboMaterial]);   // eslint-disable-line react-hooks/exhaustive-deps
  const sugestao = (campo: keyof ConjuntoForm, valor: number, texto: string) => (
    bomba > 0 && Number(v[campo]) !== valor
      ? <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => form.setFieldValue(campo, valor)}>{texto}</Button>
      : null
  );
  return (
    <Flex vertical gap={10}>
      {comDataDeInstalacao && <Row gutter={10}><Col xs={12} md={8}>{data('Instalado em', 'instaladoEm')}</Col></Row>}

      <Bloco icone={<ThunderboltOutlined />} titulo="Bomba" cor="#2f54eb"
        extra={<Space size={6}><Text type="secondary" style={{ fontSize: 12 }}>motor e bombeador separados</Text><Switch size="small" checked={separados} onChange={setSeparados} /></Space>}>
        <Form.Item name="bombaTipo" style={{ marginBottom: 10 }}>
          <Segmented block options={Object.entries(TIPOS_BOMBA).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <Row gutter={10}>
          <Col xs={12} md={8}>{texto('Marca', 'bombaMarca', 'Ebara, Leão, Schneider')}</Col>
          <Col xs={12} md={8}>{texto('Modelo', 'bombaModelo', '3BPS2-14')}</Col>
          <Col xs={8} md={8}>{numero('Potência', 'potenciaCv', 'CV', 0.5)}</Col>
          <Col xs={8} md={8}>{texto('Tensão', 'tensao', '220 V mono', TENSOES)}</Col>
          <Col xs={8} md={8}>{numero('Estágios', 'estagios')}</Col>
        </Row>
        {separados && (
          <Row gutter={10}>
            <Col xs={12} md={6}>{texto('Motor: marca', 'motorMarca', 'Franklin, WEG')}</Col>
            <Col xs={12} md={6}>{texto('Motor: modelo', 'motorModelo')}</Col>
            <Col xs={12} md={6}>{texto('Bombeador: marca', 'bombeadorMarca')}</Col>
            <Col xs={12} md={6}>{texto('Bombeador: modelo', 'bombeadorModelo', '3BPS2-14')}</Col>
          </Row>
        )}
      </Bloco>

      <Bloco icone={<ColumnHeightOutlined />} titulo="Profundidade e tubo edutor" cor="#fa8c16">
        <Row gutter={10}>
          <Col xs={12} md={8}>
            <Form.Item label="Profundidade da bomba" name="profundidadeBombaM"
              extra={tubos > 0 && Math.abs(tubos - bomba) > 0.01 ? sugestao('profundidadeBombaM', tubos, `usar ${String(tubos).replace('.', ',')} m dos tubos`) || (bomba ? null : <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => form.setFieldValue('profundidadeBombaM', tubos)}>usar {String(tubos).replace('.', ',')} m dos tubos</Button>) : null}>
              <CampoNumero min={0} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>{texto('Material do tubo', 'tuboMaterial', 'PVC geomecânico', MATERIAIS_TUBO)}</Col>
          <Col xs={12} md={8}>{texto('Diâmetro', 'tuboDiametro', '1 1/4"')}</Col>
          <TuboPorBarra />
          <Col xs={12} md={6}>
            <Form.Item label="Luva (união das barras)" name="tuboLuva" normalize={x => (x ? x : null)}
              extra={tipoLuva(v.tuboLuva) === 'METAL' ? <Text type="secondary" style={{ fontSize: 12 }}>metal: conferir oxidação nas retiradas</Text>
                : tipoLuva(v.tuboLuva) === 'PVC' ? <Text type="secondary" style={{ fontSize: 12 }}>PVC: cuidado com o aperto</Text> : null}>
              <AutoComplete options={LUVAS.map(value => ({ value }))} placeholder="Luva galvanizada" allowClear
                filterOption={(t, o) => String(o?.value).toLowerCase().includes(t.toLowerCase())} />
            </Form.Item>
          </Col>
        </Row>
      </Bloco>

      <Bloco icone={<ApiOutlined />} titulo="Fio e corda (o que desce junto)" cor="#cf1322">
        <Row gutter={10}>
          <Col xs={12} md={8}>{texto('Fio: tipo', 'fioTipo', 'Cabo PP', FIOS)}</Col>
          <Col xs={12} md={8}>{texto('Fio: bitola', 'fioBitola', '3 x 4 mm²', BITOLAS)}</Col>
          <Col xs={12} md={8}>
            <Form.Item label="Fio: metros" name="fioMetros" extra={sugestao('fioMetros', Math.ceil(bomba + 10), `sugerido ${Math.ceil(bomba + 10)} m (bomba + 10 m)`)}>
              <CampoNumero min={0} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
          </Col>
          <Col xs={12} md={16}>
            <Form.Item label="Corda" name="cordaMaterial" normalize={x => (x ? x : null)}
              extra={precisaCorda(v.tuboMaterial) === false ? <Text type="secondary" style={{ fontSize: 12 }}>Tubo de rosca com luva aguenta a bomba: corda opcional.</Text>
                : precisaCorda(v.tuboMaterial) ? <Text type="warning" style={{ fontSize: 12 }}>Tubo soldado/flexível: use corda de segurança.</Text> : null}>
              <AutoComplete options={CORDAS} placeholder="Corda de nylon 10 mm (opcional no tubo de rosca)" allowClear
                filterOption={(t, o) => String(o?.value).toLowerCase().includes(t.toLowerCase())} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item label="Corda: metros" name="cordaMetros" extra={precisaCorda(v.tuboMaterial) === false && !v.cordaMetros ? null : sugestao('cordaMetros', Math.ceil(bomba + 5), `sugerido ${Math.ceil(bomba + 5)} m (bomba + 5 m)`)}>
              <CampoNumero min={0} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
          </Col>
        </Row>
      </Bloco>

      <Bloco icone={<HomeOutlined />} titulo="Superfície: quadro e cabeça do poço" cor="#595959">
        <Row gutter={10}>
          <Col xs={24} md={12}>
            <Form.Item label="Quadro de comando" name="quadroComando" normalize={x => (x ? x : null)}>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Chave de partida, relé de nível, boia" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Cabeça do poço" name="cabecaPoco" normalize={x => (x ? x : null)}>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="Curva 90°, válvula de retenção, registro, manômetro, tampa" />
            </Form.Item>
          </Col>
          <Col xs={24}>{texto('Observação', 'observacao')}</Col>
        </Row>
      </Bloco>
    </Flex>
  );
};

const ConjuntoModal: React.FC<{
  aberto: { modo: Modo; base?: Conjunto | null } | null; idPoco: number; onFechar: () => void; onSalvo: () => void; poco?: PocoDoConjunto;
}> = ({ aberto, idPoco, onFechar, onSalvo, poco }) => {
  const [form] = Form.useForm<ConjuntoForm>();
  const valores: Partial<ConjuntoForm> = Form.useWatch([], form) || {};
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
      tuboMetros: b.tuboMetros, tuboLuva: b.tuboLuva, fioTipo: b.fioTipo, fioBitola: b.fioBitola, fioMetros: b.fioMetros, cordaMaterial: b.cordaMaterial, cordaMetros: b.cordaMetros,
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
  const comRetirada = modo === 'ANTIGO' || (modo === 'EDITAR' && aberto?.base?.situacao === 'RETIRADO');

  return (
    <Modal open={!!aberto} title={modo ? TITULOS[modo] : ''} onCancel={onFechar} onOk={salvar} okText="Salvar" cancelText="Voltar"
      confirmLoading={salvando} destroyOnHidden width="min(1180px, 96vw)" styles={{ body: { maxHeight: '76vh', overflowY: 'auto', paddingRight: 8 } }}>
      {modo === 'TROCAR' && <Alert type="info" showIcon style={{ marginBottom: 8 }} message="Tubo, fio, corda, quadro e cabeça vieram do conjunto atual: mude só o que foi trocado." />}
      <Form form={form} layout="vertical" style={{ marginTop: 4 }}>
        <Row gutter={16}>
          <Col xs={24} lg={15}>
            <Row gutter={10}>
              <Col xs={12} md={8}>{data('Instalado em', 'instaladoEm')}</Col>
              {comRetirada && <Col xs={12} md={8}>{data('Retirado em', 'retiradoEm', modo === 'ANTIGO')}</Col>}
            </Row>
            <CamposConjunto />
          </Col>
          <Col xs={24} lg={9}>
            {/* o desenho e a conferência acompanham o que está sendo preenchido */}
            <div style={{ position: 'sticky', top: 0 }}>
              <Card size="small" title="Como fica no poço">
                <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: svgConjunto(valores, poco, { altura: 440, largura: 420 }) }} />
                <ul style={{ paddingLeft: 18, margin: '6px 0 0', fontSize: 12 }}>
                  {conferirConjunto(valores, poco).map(x => <li key={x.texto} style={{ color: x.ok ? undefined : '#d46b08' }}>{x.ok ? '✓ ' : '⚠ '}{x.texto}</li>)}
                </ul>
              </Card>
            </div>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

/** Descrição do conjunto em blocos (só o que foi preenchido). */
/** Desenho do que desce no poço e a conferência (tubos × bomba, fio, corda, nível dinâmico, fundo). */
const DesenhoConjunto: React.FC<{ c: Conjunto; poco?: PocoDoConjunto; altura?: number }> = ({ c, poco, altura }) => {
  const conf = conferirConjunto(c, poco);
  return (
    <Row gutter={12}>
      <Col xs={24} lg={14}><div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: svgConjunto(c, poco, { altura }) }} /></Col>
      <Col xs={24} lg={10}>
        <Text strong>Conferência</Text>
        {conf.length ? (
          <ul style={{ paddingLeft: 18, marginTop: 6 }}>
            {conf.map(x => <li key={x.texto} style={{ color: x.ok ? undefined : '#d46b08', marginBottom: 4 }}>{x.ok ? '✓ ' : '⚠ '}{x.texto}</li>)}
          </ul>
        ) : <div><Text type="secondary">Informe a profundidade da bomba, o tubo (barras e metros), o fio e a corda para conferir.</Text></div>}
        {textoTubo(c) && <Text type="secondary" style={{ fontSize: 12 }}>Tubo: {textoTubo(c)}. Numa troca de tubulação ou para subir/baixar a bomba, é a altura de cada emenda no desenho.</Text>}
      </Col>
    </Row>
  );
};

const Detalhe: React.FC<{ c: Conjunto }> = ({ c }) => {
  const junta = (...v: (string | null | false | undefined)[]) => v.filter(Boolean).join(' · ');
  const itens = [
    { key: 'b', label: 'Bomba', children: junta(c.bombaTipo && TIPOS_BOMBA[c.bombaTipo], [c.bombaMarca, c.bombaModelo].filter(Boolean).join(' '),
      c.potenciaCv !== null && `${num(c.potenciaCv)} CV`, c.tensao, c.estagios !== null && `${c.estagios} estágios`) },
    { key: 'm', label: 'Motor / bombeador', children: junta([c.motorMarca, c.motorModelo].filter(Boolean).join(' ') && `motor ${[c.motorMarca, c.motorModelo].filter(Boolean).join(' ')}`,
      [c.bombeadorMarca, c.bombeadorModelo].filter(Boolean).join(' ') && `bombeador ${[c.bombeadorMarca, c.bombeadorModelo].filter(Boolean).join(' ')}`) },
    { key: 'p', label: 'Profundidade da bomba', children: c.profundidadeBombaM !== null ? `${num(c.profundidadeBombaM)} m` : '' },
    { key: 't', label: 'Tubo', children: junta(c.tuboMaterial, c.tuboDiametro, textoTubo(c), c.tuboLuva) },
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

export const ConjuntoPoco: React.FC<{ idPoco: number; onAbrirObra?: (idObra: number) => void; poco?: PocoDoConjunto }> = ({ idPoco, onAbrirObra, poco }) => {
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
            <DesenhoConjunto c={a} poco={poco} />
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
            expandable={{ expandedRowRender: c => <Space direction="vertical" style={{ width: '100%' }}><DesenhoConjunto c={c} poco={poco} altura={380} /><Detalhe c={c} /></Space> }}
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

      <ConjuntoModal aberto={editando} idPoco={idPoco} poco={poco} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
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
