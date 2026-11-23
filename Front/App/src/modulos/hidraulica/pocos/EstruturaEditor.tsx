// Editar a estrutura direto no poço (ficha › Estrutura): para o poço que não tem obra no sistema (veio do sistema antigo
// ou de outra empresa). Perfuração por diâmetro, revestimentos (o de fora, o interno de complemento, filtro, tubo de boca)
// e o perfil geológico, com o desenho atualizando enquanto preenche. O que as obras registrarem depois entra por cima.
import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Flex, Form, Input, Modal, Row, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { CampoNumero } from '../../../shared/formularios/CamposNumero';
import { CAMADAS_GEOLOGICAS, resumoEstrutura, svgPerfil, temEstrutura, TIPOS_REVESTIMENTO } from './estruturaPoco';
import { encadear } from './relatorioPoco';
import { obrasApi, MaterialPoco } from './obrasApi';
import { CampoMaterial } from './CampoMaterial';
import { barrasDoTrecho, corDoMaterial, diametroEmNumero, textoBarras } from './materiaisPoco';

const { Text } = Typography;
type Dados = Record<string, any>;
const UNIDADES = [{ value: '"', label: 'pol (")' }, { value: 'mm', label: 'mm' }];

interface Props {
  idPoco: number | null;
  /** Estrutura já gravada no poço; sem ela, começa com a perfuração do cadastro (profundidade e diâmetro). */
  inicial: Dados | null;
  /** Nível estático e bomba (vêm do poço e das obras) só para o desenho. */
  extras?: { bombaNivelEstatico?: number | null; bombaProfundidade?: number | null };
  onFechar: () => void;
  onSalvo: () => void;
}

export const EstruturaEditor: React.FC<Props> = ({ idPoco, inicial, extras, onFechar, onSalvo }) => {
  const [form] = Form.useForm();
  const valores: Dados = Form.useWatch([], form) || {};
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (idPoco === null) return;
    form.setFieldsValue({
      perfuracoes: inicial?.perfuracoes?.length ? inicial.perfuracoes : [{ perfDe: 0, perfDiamUnidade: '"' }],
      revestimentos: inicial?.revestimentos || [],
      perfilGeologico: inicial?.perfilGeologico || [],
      ...Object.fromEntries(['compPreFiltroDe', 'compPreFiltroAte', 'compPreFiltroMaterial', 'compPreFiltroQtd', 'compCimentoDe', 'compCimentoAte', 'compCimentoQtd', 'compLaje', 'compTampa']
        .map(k => [k, inicial?.[k] ?? null])),
    });
  }, [idPoco]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Perfuração e geologia: cada linha começa onde a anterior terminou; o revestimento é livre
  const aoMudar = (mudou: Dados) => {
    for (const [lista, de, ate] of [['perfuracoes', 'perfDe', 'perfAte'], ['perfilGeologico', 'geoDe', 'geoAte']] as const) {
      if (!(lista in mudou)) continue;
      const atual = form.getFieldValue(lista) || [];
      const ajustada = encadear(atual, de, ate);
      if (JSON.stringify(ajustada) !== JSON.stringify(atual)) form.setFieldValue(lista, ajustada);
    }
  };

  /** Material do cadastro na linha do revestimento: id, cor, comprimento da barra e o diâmetro se estiver vazio. */
  const aplicarMaterial = (idx: number, m: MaterialPoco | null) => {
    const linhas = [...(form.getFieldValue('revestimentos') || [])];
    const l = { ...linhas[idx], revIdMaterial: m?.idMaterial ?? null, revCor: m ? corDoMaterial(m) : null, revComprimentoBarra: m?.comprimentoM ?? null };
    const d = m ? diametroEmNumero(m.diametro) : null;
    if (d && !l.revDiam) { l.revDiam = d.valor; l.revDiamUnidade = d.unidade; }
    linhas[idx] = l;
    form.setFieldValue('revestimentos', linhas);
  };

  const salvar = async () => {
    if (idPoco === null) return;
    setSalvando(true);
    try {
      await obrasApi.salvarEstruturaPoco(idPoco, form.getFieldsValue(true));
      message.success('Estrutura do poço salva.');
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao salvar.'); } finally { setSalvando(false); }
  };

  const diametro = (name: number, campo: string, un: string) => (
    <Space.Compact style={{ width: '100%' }}>
      <Form.Item name={[name, campo]} noStyle><CampoNumero min={0} style={{ width: '100%' }} placeholder="6" /></Form.Item>
      <Form.Item name={[name, un]} noStyle initialValue={'"'}><Select style={{ width: 82 }} options={UNIDADES} /></Form.Item>
    </Space.Compact>
  );
  const apagar = (onClick: () => void) => <Button type="text" danger icon={<DeleteOutlined />} onClick={onClick} />;
  const desenho = { ...valores, ...extras };

  return (
    <Modal open={idPoco !== null} title="Estrutura do poço" width="min(1150px, 96vw)" okText="Salvar" cancelText="Cancelar"
      onOk={salvar} confirmLoading={salvando} onCancel={onFechar} destroyOnHidden>
      <Form form={form} layout="vertical" size="small" onValuesChange={aoMudar}>
        <Row gutter={14}>
          <Col xs={24} lg={15}>
            <Flex vertical gap={10}>
              <Card size="small" title="Perfuração (por diâmetro)">
                <Form.List name="perfuracoes">
                  {(campos, { add, remove }) => (
                    <Flex vertical gap={6}>
                      {campos.map(({ key, name }, i) => (
                        <Row key={key} gutter={6} align="bottom" wrap={false}>
                          <Col flex="90px"><Form.Item label={i === 0 ? 'De' : ''} name={[name, 'perfDe']} style={{ marginBottom: 0 }}><CampoNumero disabled style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                          <Col flex="100px"><Form.Item label={i === 0 ? 'Até' : ''} name={[name, 'perfAte']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                          <Col flex="auto"><Form.Item label={i === 0 ? 'Diâmetro' : ''} style={{ marginBottom: 0 }}>{diametro(name, 'perfDiam', 'perfDiamUnidade')}</Form.Item></Col>
                          <Col flex="32px">{apagar(() => { remove(name); aoMudar({ perfuracoes: true }); })}</Col>
                        </Row>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => { const l = form.getFieldValue('perfuracoes') || []; add({ perfDe: Number(l[l.length - 1]?.perfAte) || 0, perfDiamUnidade: '"' }); }}>Adicionar etapa</Button>
                    </Flex>
                  )}
                </Form.List>
              </Card>

              <Card size="small" title="Revestimento">
                <Form.List name="revestimentos">
                  {(campos, { add, remove }) => (
                    <Flex vertical gap={6}>
                      {campos.map(({ key, name }, i) => (
                        <Row key={key} gutter={6} align="bottom" wrap={false}>
                          <Col flex="150px"><Form.Item label={i === 0 ? 'Tipo' : ''} name={[name, 'revTipo']} initialValue="EXTERNO" style={{ marginBottom: 0 }}>
                            <Select popupMatchSelectWidth={false} options={TIPOS_REVESTIMENTO.map(t => ({ value: t.valor, label: t.rotulo }))} />
                          </Form.Item></Col>
                          <Col flex="85px"><Form.Item label={i === 0 ? 'De' : ''} name={[name, 'revDe']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                          <Col flex="90px"><Form.Item label={i === 0 ? 'Até' : ''} name={[name, 'revAte']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                          <Col flex="150px"><Form.Item label={i === 0 ? 'Diâmetro' : ''} style={{ marginBottom: 0 }}>{diametro(name, 'revDiam', 'revDiamUnidade')}</Form.Item></Col>
                          <Col flex="auto"><Form.Item label={i === 0 ? 'Material (cadastro) / motivo' : ''} style={{ marginBottom: 0 }}>
                            <Flex vertical gap={3}>
                              <Form.Item name={[name, 'revMaterial']} noStyle>
                                <CampoMaterial categorias={['TUBO', 'FILTRO']} placeholder="Tubo geomecânico 6&quot;..." cor={valores.revestimentos?.[name]?.revCor}
                                  onEscolher={m => aplicarMaterial(name, m)} style={{ width: '100%' }} />
                              </Form.Item>
                              <Space.Compact style={{ width: '100%' }}>
                                <Form.Item name={[name, 'revObs']} noStyle><Input size="small" placeholder="motivo (ex.: caimento aos 60 m)" /></Form.Item>
                              </Space.Compact>
                              {(() => {
                                const l = valores.revestimentos?.[name] || {};
                                const barras = textoBarras(barrasDoTrecho(l.revDe, l.revAte, l.revComprimentoBarra), l.revComprimentoBarra);
                                return barras ? <Tag color="blue" style={{ margin: 0, width: 'fit-content' }}>{barras}</Tag> : null;
                              })()}
                            </Flex>
                          </Form.Item></Col>
                          <Col flex="32px">{apagar(() => remove(name))}</Col>
                        </Row>
                      ))}
                      <Space wrap>
                        <Button type="dashed" icon={<PlusOutlined />} onClick={() => { const l = form.getFieldValue('revestimentos') || []; add({ revTipo: 'EXTERNO', revDe: Number(l[l.length - 1]?.revAte) || 0, revDiamUnidade: '"' }); }}>Adicionar revestimento</Button>
                        <Tooltip title="Tubo mais fino colocado por dentro (ex.: o poço desmoronou e foi revestido de novo até o fundo)">
                          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ revTipo: 'INTERNO', revDe: 0, revDiamUnidade: '"' })}>Revestimento interno (complemento)</Button>
                        </Tooltip>
                      </Space>
                    </Flex>
                  )}
                </Form.List>
              </Card>

              <Card size="small" title="Completação (pré-filtro, cimentação, laje e tampa)">
                <Row gutter={8}>
                  <Col span={4}><Form.Item label="Pré-filtro de" name="compPreFiltroDe" style={{ marginBottom: 6 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                  <Col span={4}><Form.Item label="até" name="compPreFiltroAte" style={{ marginBottom: 6 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                  <Col span={4}><Form.Item label="Cimentação de" name="compCimentoDe" style={{ marginBottom: 6 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                  <Col span={4}><Form.Item label="até" name="compCimentoAte" style={{ marginBottom: 6 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                  <Col span={4}><Form.Item label="Laje" name="compLaje" style={{ marginBottom: 6 }}><Input placeholder="1 x 1 m" /></Form.Item></Col>
                  <Col span={4}><Form.Item label="Tampa" name="compTampa" style={{ marginBottom: 6 }}><Input placeholder="6&quot; c/ cadeado" /></Form.Item></Col>
                </Row>
              </Card>

              <Card size="small" title="Perfil geológico (o que a perfuração atravessou)">
                <Form.List name="perfilGeologico">
                  {(campos, { add, remove }) => (
                    <Flex vertical gap={6}>
                      {campos.map(({ key, name }, i) => (
                        <Row key={key} gutter={6} align="bottom" wrap={false}>
                          <Col flex="90px"><Form.Item label={i === 0 ? 'De' : ''} name={[name, 'geoDe']} style={{ marginBottom: 0 }}><CampoNumero disabled style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                          <Col flex="100px"><Form.Item label={i === 0 ? 'Até' : ''} name={[name, 'geoAte']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                          <Col flex="170px"><Form.Item label={i === 0 ? 'Formação' : ''} name={[name, 'geoTipo']} style={{ marginBottom: 0 }}>
                            <Select options={CAMADAS_GEOLOGICAS.map(c => ({ value: c.valor, label: <Space size={6}><span style={{ display: 'inline-block', width: 10, height: 10, background: c.cor, borderRadius: 2 }} />{c.valor}</Space> }))} />
                          </Form.Item></Col>
                          <Col flex="auto"><Form.Item label={i === 0 ? 'Observação' : ''} name={[name, 'geoObs']} style={{ marginBottom: 0 }}><Input placeholder="Ex.: granito, entrada de água forte" /></Form.Item></Col>
                          <Col flex="32px">{apagar(() => { remove(name); aoMudar({ perfilGeologico: true }); })}</Col>
                        </Row>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => { const l = form.getFieldValue('perfilGeologico') || []; add({ geoDe: Number(l[l.length - 1]?.geoAte) || 0 }); }}>Adicionar camada</Button>
                    </Flex>
                  )}
                </Form.List>
              </Card>
            </Flex>
          </Col>
          <Col xs={24} lg={9}>
            <Card size="small" title="Como fica">
              {temEstrutura(desenho) ? (
                <Flex vertical gap={6}>
                  <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: svgPerfil(desenho, { altura: 440 }) }} />
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{resumoEstrutura(desenho).map(l => <li key={l}>{l}</li>)}</ul>
                </Flex>
              ) : <Text type="secondary">Preencha a perfuração (até onde e o diâmetro) para ver o desenho.</Text>}
            </Card>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};
