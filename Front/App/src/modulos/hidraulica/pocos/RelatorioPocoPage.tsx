// Módulo Poços (HIDRAULICA_POCOS, sem banco): formulário por seções, rascunho automático no navegador, modelos de
// impressão (completo, cobrança, teste de vazão, garantia, em branco) com pré-visualização e arquivo XML para guardar/reabrir.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Checkbox, Col, Collapse, DatePicker, Descriptions, Drawer, Dropdown, Flex, Form, Input, InputNumber, message, Row, Segmented, Select, Space,
  Statistic, Switch, Tag, Tooltip, Typography, Upload, theme,
} from 'antd';
import {
  ArrowLeftOutlined, BuildOutlined, CompassOutlined, DashboardOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined, ExperimentOutlined, EyeOutlined,
  FileAddOutlined, LineChartOutlined, PlusOutlined, PrinterOutlined, SettingOutlined, UploadOutlined, UserOutlined,
} from '@ant-design/icons';
import { useRelatorioPoco } from './useRelatorioPoco';
import {
  ANOMALIAS, brl, calcularFinanceiro, dataGarantia, FORMAS_PAGAMENTO, OCORRENCIAS_OBRA, progresso, resumoTeste, SecaoId, TEXTO_GARANTIA_PADRAO,
} from './relatorioPoco';
import { MODELOS, ModeloId } from './templatesPoco';

const { Title, Text } = Typography;
const { TextArea } = Input;

const UNIDADES = [{ value: '"', label: 'pol (")' }, { value: 'mm', label: 'mm' }];
const SOLOS = ['Arenoso', 'Argiloso', 'Silte (caxeta)', 'Rocha alterada', 'Rocha sã (cristalino)', 'Sedimentar (misto)'];
const MATERIAIS_TUBO = ['Aço galvanizado', 'PVC geomecânico', 'Tubo flexível (Subteck/PEX)', 'PEAD'];
const ROTULO_CURTO: Record<ModeloId, string> = { completo: 'Completo', cobranca: 'Cobrança', vazao: 'Teste de vazão', garantia: 'Garantia', branco: 'Em branco' };

export default function RelatorioPocoPage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const p = useRelatorioPoco();
  const { form, valores } = p;
  const [previa, setPrevia] = useState<ModeloId | null>(null);

  const unidade = (name: string | Array<string | number>) => (
    <Form.Item name={name} noStyle initialValue={'"'}><Select style={{ width: 82 }} options={UNIDADES} /></Form.Item>
  );

  const obterGps = () => {
    if (!('geolocation' in navigator)) { message.error('Este aparelho não informa a localização.'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { form.setFieldValue('localizacao', `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); p.aoMudar({}); message.success('Coordenadas obtidas.'); },
      () => message.error('Não foi possível obter a localização (permita o acesso ao GPS).'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  // Cabeçalho de cada seção: título, quanto já foi preenchido e se entra no relatório
  const cabecalho = (icone: React.ReactNode, titulo: string, secao: string, id?: SecaoId) => {
    const pr = progresso(valores, secao);
    return (
      <Flex justify="space-between" align="center" gap={8} wrap>
        <Space>{icone}<b>{titulo}</b>
          {pr.total > 0 && <Tag color={pr.feitos === pr.total ? 'green' : pr.feitos ? 'blue' : 'default'} style={{ margin: 0 }}>{pr.feitos}/{pr.total}</Tag>}
        </Space>
        {id && (
          <span onClick={e => e.stopPropagation()}>
            <Tooltip title="Incluir esta seção no relatório impresso">
              <Space size={4}><Switch size="small" checked={p.secoes[id]} onChange={v => p.alternarSecao(id, v)} /><Text type="secondary" style={{ fontSize: 12 }}>no relatório</Text></Space>
            </Tooltip>
          </span>
        )}
      </Flex>
    );
  };

  // Lista de camadas (perfuração/revestimento): "De" vem da camada anterior
  const camadas = (nome: 'perfuracoes' | 'revestimentos') => {
    const perf = nome === 'perfuracoes';
    const [de, ate, diam, un] = perf ? ['perfDe', 'perfAte', 'perfDiam', 'perfDiamUnidade'] : ['revDe', 'revAte', 'revDiam', 'revDiamUnidade'];
    return (
      <Form.List name={nome}>
        {(campos, { add, remove }) => (
          <Flex vertical gap={6}>
            {campos.map(({ key, name }, i) => (
              <Row key={key} gutter={6} align="bottom" wrap={false}>
                <Col flex="90px"><Form.Item label={i === 0 ? 'De' : ''} name={[name, de]} style={{ marginBottom: 0 }}><InputNumber disabled style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                <Col flex="100px"><Form.Item label={i === 0 ? 'Até' : ''} name={[name, ate]} style={{ marginBottom: 0 }}><InputNumber min={0} style={{ width: '100%' }} suffix="m" placeholder="35" /></Form.Item></Col>
                <Col flex="auto">
                  <Form.Item label={i === 0 ? 'Diâmetro' : ''} style={{ marginBottom: 0 }}>
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item name={[name, diam]} noStyle><InputNumber min={0} style={{ width: '100%' }} placeholder="6" /></Form.Item>
                      {unidade([name, un])}
                    </Space.Compact>
                  </Form.Item>
                </Col>
                {!perf && <>
                  <Col flex="120px"><Form.Item label={i === 0 ? 'Material' : ''} name={[name, 'revMaterial']} style={{ marginBottom: 0 }}><Input placeholder="PVC geomec." /></Form.Item></Col>
                  <Col flex="90px"><Form.Item label={i === 0 ? 'União' : ''} name={[name, 'revUniao']} style={{ marginBottom: 0 }}><Input placeholder="Rosca" /></Form.Item></Col>
                </>}
                <Col flex="32px">
                  <Button type="text" danger icon={<DeleteOutlined />} disabled={campos.length === 1} onClick={() => { remove(name); p.aoMudar({ [nome]: true }); }} />
                </Col>
              </Row>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => { const l = form.getFieldValue(nome) || []; add({ [de]: Number(l[l.length - 1]?.[ate]) || 0, [un]: '"' }); }}>
              {perf ? 'Adicionar etapa de perfuração' : 'Adicionar revestimento'}
            </Button>
          </Flex>
        )}
      </Form.List>
    );
  };

  // Leituras do teste de vazão: tempo (min), nível (m) e, no bombeamento, vazão (L/h)
  const leituras = (nome: 'testeLeituras' | 'testeRecuperacao', comVazao: boolean) => (
    <Form.List name={nome}>
      {(campos, { add, remove }) => (
        <Flex vertical gap={6}>
          {campos.map(({ key, name }, i) => (
            <Row key={key} gutter={6} align="bottom" wrap={false}>
              <Col flex="1"><Form.Item label={i === 0 ? 'Tempo' : ''} name={[name, 'tempo']} style={{ marginBottom: 0 }}><InputNumber min={0} style={{ width: '100%' }} suffix="min" /></Form.Item></Col>
              <Col flex="1"><Form.Item label={i === 0 ? 'Nível' : ''} name={[name, 'nivel']} style={{ marginBottom: 0 }}><InputNumber min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
              {comVazao && <Col flex="1"><Form.Item label={i === 0 ? 'Vazão' : ''} name={[name, 'vazao']} style={{ marginBottom: 0 }}><InputNumber min={0} style={{ width: '100%' }} suffix="L/h" /></Form.Item></Col>}
              <Col flex="32px"><Button type="text" danger icon={<DeleteOutlined />} onClick={() => { remove(name); p.aoMudar({}); }} /></Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => {
            // Próximo tempo: repete o intervalo das duas últimas leituras (15 min no começo)
            const l = form.getFieldValue(nome) || [];
            const passo = l.length >= 2 ? Number(l[l.length - 1]?.tempo || 0) - Number(l[l.length - 2]?.tempo || 0) : 15;
            add({ tempo: l.length ? Number(l[l.length - 1]?.tempo || 0) + (passo > 0 ? passo : 15) : 0 });
          }}>Adicionar leitura</Button>
        </Flex>
      )}
    </Form.List>
  );
  const fin = calcularFinanceiro(valores);
  const teste = resumoTeste(valores);

  const fundoPerfuracao = (valores.perfuracoes || []).reduce((m: number, c: Record<string, unknown>) => Math.max(m, Number(c?.perfAte) || 0), 0);
  const garantiaAte = dataGarantia(valores.dtTermino, valores.garantiaMeses);
  const checks = (itens: Array<[string, string]>) => (
    <Row gutter={[8, 4]}>{itens.map(([k, t]) => (
      <Col xs={24} sm={12} md={8} key={k}><Form.Item name={k} valuePropName="checked" style={{ margin: 0 }}><Checkbox>{t}</Checkbox></Form.Item></Col>
    ))}</Row>
  );

  const secoes = [
    {
      key: 'cliente', label: cabecalho(<UserOutlined style={{ color: token.colorPrimary }} />, 'Cliente / proprietário', 'cliente'),
      children: (
        <Row gutter={12}>
          <Col xs={24} md={12}><Form.Item label="Nome / razão social" name="cliente"><Input placeholder="Nome completo" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="CPF / CNPJ" name="documento"><Input placeholder="000.000.000-00" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Telefone" name="celular"><Input placeholder="(00) 00000-0000" /></Form.Item></Col>
          <Col xs={24} md={10}><Form.Item label="Endereço (rua, nº)" name="endereco"><Input placeholder="Estrada Municipal, km 4" /></Form.Item></Col>
          <Col xs={12} md={5}><Form.Item label="Bairro" name="bairro"><Input /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item label="Cidade" name="cidade"><Input /></Form.Item></Col>
          <Col xs={8} md={2}><Form.Item label="UF" name="uf" normalize={v => String(v || '').toUpperCase()}><Input maxLength={2} /></Form.Item></Col>
          <Col xs={16} md={3}><Form.Item label="CEP" name="cep"><Input placeholder="00000-000" /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'dadosPoco', label: cabecalho(<DashboardOutlined style={{ color: token.colorPrimary }} />, 'Dados do poço', 'dadosPoco', 'dadosPoco'),
      children: (
        <Row gutter={12}>
          <Col xs={24} md={10}>
            <Form.Item label="Localização (GPS)" name="localizacao">
              <Input placeholder="-23.550520, -46.633308" suffix={<Button type="link" size="small" icon={<CompassOutlined />} onClick={obterGps}>Obter</Button>} />
            </Form.Item>
          </Col>
          <Col xs={12} md={5}>
            <Form.Item label="Profundidade" name="profundidade"
              extra={fundoPerfuracao > 0 && Number(valores.profundidade) !== fundoPerfuracao
                ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { form.setFieldValue('profundidade', fundoPerfuracao); p.aoMudar({}); }}>usar {fundoPerfuracao} m da perfuração</Button>
                : null}>
              <InputNumber min={0} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item label="Diâmetro interno">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="diametroInterno" noStyle><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>{unidade('diamInternoUnidade')}
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={12} md={5}><Form.Item label="Última limpeza" name="dtLimpeza"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={8}>
            <Form.Item label="Vazão na perfuração">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="vazaoAprox" noStyle><InputNumber min={0} style={{ width: '100%' }} suffix="L/h" /></Form.Item>
              </Space.Compact>
              <Form.Item name="vazaoAproxAproximada" valuePropName="checked" noStyle><Checkbox style={{ marginTop: 4 }}>valor aproximado (~)</Checkbox></Form.Item>
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'perfuracao', label: cabecalho(<BuildOutlined style={{ color: '#8c5e3c' }} />, 'Perfuração e revestimento', 'perfuracao', 'perfuracao'),
      children: (
        <Flex vertical gap={12}>
          <Row gutter={12}>
            <Col xs={12} md={5}><Form.Item label="Início" name="dtInicio"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={5}><Form.Item label="Conclusão" name="dtTermino"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Formação / solo" name="tipoSolo"><Select allowClear options={SOLOS.map(s => ({ value: s, label: s }))} /></Form.Item></Col>
            <Col xs={12} md={8}>
              <Form.Item label="Garantia" name="garantiaMeses" extra={garantiaAte ? <Text type="success">válida até {garantiaAte}</Text> : 'informe a conclusão e os meses'}>
                <Select allowClear options={[3, 6, 9, 12, 18, 24, 36].map(m => ({ value: m, label: `${m} meses` }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} xl={10}><Card size="small" title="Etapas de perfuração">{camadas('perfuracoes')}</Card></Col>
            <Col xs={24} xl={14}><Card size="small" title="Revestimento">{camadas('revestimentos')}</Card></Col>
          </Row>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Ocorrências na obra</Text>{checks(OCORRENCIAS_OBRA)}</div>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item label="Equipe / sonda" name="equipePerfuracao"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label="Responsável técnico" name="respNomePerf"><Input placeholder="Nome e registro (CREA/CFT)" /></Form.Item></Col>
            <Col xs={24}><Form.Item label="Observações geológicas" name="obsGeraisPerfuracao"><TextArea autoSize={{ minRows: 2, maxRows: 5 }} /></Form.Item></Col>
          </Row>
        </Flex>
      ),
    },
    {
      key: 'diagnostico', label: cabecalho(<ExperimentOutlined style={{ color: '#08979c' }} />, 'Diagnóstico técnico', 'diagnostico', 'diagnostico'),
      children: (
        <Flex vertical gap={12}>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Anomalias encontradas (as marcadas saem em destaque)</Text>{checks(ANOMALIAS)}</div>
          <Row gutter={12}>
            <Col xs={12} md={6}><Form.Item label="Amperagem (leitura)" name="manutAmperagem"><InputNumber min={0} style={{ width: '100%' }} suffix="A" /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Isolamento (megômetro)" name="manutMegometro"><InputNumber min={0} style={{ width: '100%' }} suffix="MΩ" /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item label="Limpeza química" name="manutPeriodicidadeLimpeza">
                <Select allowClear options={[{ value: '6_meses', label: 'A cada 6 meses' }, { value: '12_meses', label: 'Anual' }]} />
              </Form.Item>
            </Col>
            <Col xs={24}><Form.Item label="Diretrizes preventivas / observações" name="manutDiretrizesTexto"><TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="Ex.: monitorar a queda de vazão e o nível dinâmico..." /></Form.Item></Col>
          </Row>
        </Flex>
      ),
    },
    {
      key: 'bombeamento', label: cabecalho(<SettingOutlined style={{ color: '#006d77' }} />, 'Sistema de bombeamento', 'bombeamento', 'bombeamento'),
      children: (
        <Row gutter={12}>
          <Col xs={12} md={6}><Form.Item label="Marca da bomba" name="bombaMarca"><Input placeholder="Ebara" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Motor (modelo / potência)" name="imgMotorModelo"><Input placeholder="Franklin 1 HP" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Bombeador" name="imgBombeadorModelo"><Input placeholder="3BPS2-14" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Instalação" name="bombaDtInstalacao"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={8} md={4}><Form.Item label="Tubos (barras)" name="bombaQtdTubos"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={8} md={4}><Form.Item label="Comp. do tubo" name="bombaTamTubo"><InputNumber min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={8} md={5}>
            <Form.Item label="Diâmetro do tubo">
              <Space.Compact style={{ width: '100%' }}><Form.Item name="bombaMedidaTubo" noStyle><Input placeholder="1" /></Form.Item>{unidade('bombaTuboUnidade')}</Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={12} md={6}><Form.Item label="Material do tubo" name="bombaTubulacao"><Select allowClear options={MATERIAIS_TUBO.map(m => ({ value: m, label: m }))} /></Form.Item></Col>
          <Col xs={12} md={5}><Form.Item label="Profundidade da bomba" name="bombaProfundidade"
            extra={Number(valores.bombaQtdTubos) > 0 && Number(valores.bombaTamTubo) > 0 ? `tubos somam ${Number(valores.bombaQtdTubos) * Number(valores.bombaTamTubo)} m` : null}>
            <InputNumber min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Cabo elétrico" name="bombaCabeamento"><Input placeholder="3 x 4 mm²" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Cavalete de saída" name="bombaCavalete"><Input placeholder="PEAD / galvanizado" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Nível estático (NE)" name="bombaNivelEstatico"><InputNumber min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Nível dinâmico (ND)" name="bombaNivelDinamico"><InputNumber min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={24} md={8}>
            <Form.Item label="Vazão regulada">
              <Form.Item name="bombaVazaoEstimada" noStyle><InputNumber min={0} style={{ width: '100%' }} suffix="L/h" /></Form.Item>
              <Form.Item name="bombaVazaoAproximada" valuePropName="checked" noStyle><Checkbox style={{ marginTop: 4 }}>valor aproximado (~)</Checkbox></Form.Item>
            </Form.Item>
          </Col>
          <Col xs={12} md={8}><Form.Item label="Equipe de instalação" name="equipeInstalacaoBomba"><Input /></Form.Item></Col>
          <Col xs={12} md={8}><Form.Item label="Responsável" name="respNomeBomba"><Input /></Form.Item></Col>
          <Col xs={24}><Form.Item label="Observações da instalação" name="bombaObsGerais"><TextArea autoSize={{ minRows: 2, maxRows: 5 }} /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'testeVazao', label: cabecalho(<DashboardOutlined style={{ color: '#1d39c4' }} />, 'Teste de vazão', 'testeVazao', 'testeVazao'),
      children: (
        <Row gutter={12}>
          <Col xs={12} md={8}><Form.Item label="Duração do ensaio" name="testeVazaoDuracao"><InputNumber min={0} style={{ width: '100%' }} suffix="h" /></Form.Item></Col>
          <Col xs={12} md={8}>
            <Form.Item label="Método" name="testeVazaoMetodo">
              <Select allowClear options={['Fluxo contínuo', 'Estágios', 'Air-lift (compressor)'].map(m => ({ value: m, label: m }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}><Form.Item label="Vazão estabilizada" name="testeVazaoEstabilizada"><InputNumber min={0} style={{ width: '100%' }} suffix="m³/h" /></Form.Item></Col>
          <Col xs={24} lg={14}><Card size="small" title="Leituras do bombeamento">{leituras('testeLeituras', true)}</Card></Col>
          <Col xs={24} lg={10}><Card size="small" title="Leituras da recuperação (após desligar)">{leituras('testeRecuperacao', false)}</Card></Col>
          <Col xs={24} style={{ marginTop: 8 }}>
            <Flex gap={16} wrap>
              <Statistic title="Rebaixamento" value={teste.rebaixamento ?? '—'} suffix={teste.rebaixamento !== null ? 'm' : ''} />
              <Statistic title="Vazão" value={teste.vazaoM3h ?? '—'} suffix={teste.vazaoM3h !== null ? 'm³/h' : ''} />
              <Statistic title="Vazão específica" value={teste.vazaoEspecifica ?? '—'} suffix={teste.vazaoEspecifica !== null ? 'm³/h/m' : ''} />
              <Statistic title="Recuperação" value={teste.recuperacaoPct ?? '—'} suffix={teste.recuperacaoPct !== null ? '%' : ''} />
            </Flex>
          </Col>
          <Col xs={24} style={{ marginTop: 8 }}><Form.Item label="Comportamento do nível e da recuperação" name="testeVazaoDados"><TextArea autoSize={{ minRows: 3, maxRows: 8 }} /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'financeiro', label: cabecalho(<DollarOutlined style={{ color: '#389e0d' }} />, 'Financeiro da obra', 'financeiro', 'financeiro'),
      children: (
        <Flex vertical gap={12}>
          <Row gutter={12}>
            <Col xs={12} md={6}><Form.Item label="Metros contratados" name="finMetrosContratados"><InputNumber min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Valor contratado (pacote)" name="finValorContratado"><InputNumber min={0} style={{ width: '100%' }} prefix="R$" precision={2} decimalSeparator="," /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Valor do metro excedente" name="finValorMetroExcedente"><InputNumber min={0} style={{ width: '100%' }} prefix="R$" precision={2} decimalSeparator="," /></Form.Item></Col>
            <Col xs={12} md={6}>
              <Form.Item label="Poço mais raso que o contratado">
                <Form.Item name="finAbaterFalta" valuePropName="checked" noStyle><Checkbox>abater os metros a menos</Checkbox></Form.Item>
                {valores.finAbaterFalta && (
                  <Form.Item name="finValorMetroFalta" noStyle>
                    <InputNumber min={0} size="small" style={{ width: '100%', marginTop: 4 }} prefix="R$"
                      placeholder={fin.contratados ? `${(fin.valorContratado / fin.contratados).toFixed(2)} (média)` : 'valor do metro'} />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} lg={10}>
              <Card size="small" title="Adicionais (bomba, instalação, materiais...)">
                <Form.List name="finAdicionais">
                  {(campos, { add, remove }) => (
                    <Flex vertical gap={6}>
                      {campos.map(({ key, name }) => (
                        <Row key={key} gutter={6} wrap={false}>
                          <Col flex="auto"><Form.Item name={[name, 'descricao']} noStyle><Input placeholder="Descrição" /></Form.Item></Col>
                          <Col flex="130px"><Form.Item name={[name, 'valor']} noStyle><InputNumber min={0} style={{ width: '100%' }} prefix="R$" precision={2} decimalSeparator="," /></Form.Item></Col>
                          <Col flex="32px"><Button type="text" danger icon={<DeleteOutlined />} onClick={() => { remove(name); p.aoMudar({}); }} /></Col>
                        </Row>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})}>Adicionar</Button>
                    </Flex>
                  )}
                </Form.List>
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card size="small" title="Pagamentos recebidos">
                <Form.List name="finPagamentos">
                  {(campos, { add, remove }) => (
                    <Flex vertical gap={6}>
                      {campos.map(({ key, name }) => (
                        <Row key={key} gutter={6} wrap={false}>
                          <Col flex="130px"><Form.Item name={[name, 'data']} noStyle><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item></Col>
                          <Col flex="120px"><Form.Item name={[name, 'forma']} noStyle><Select style={{ width: '100%' }} options={FORMAS_PAGAMENTO.map(x => ({ value: x, label: x }))} /></Form.Item></Col>
                          <Col flex="130px"><Form.Item name={[name, 'valor']} noStyle><InputNumber min={0} style={{ width: '100%' }} prefix="R$" precision={2} decimalSeparator="," /></Form.Item></Col>
                          <Col flex="auto"><Form.Item name={[name, 'obs']} noStyle><Input placeholder="Obs. (entrada, parcela...)" /></Form.Item></Col>
                          <Col flex="32px"><Button type="text" danger icon={<DeleteOutlined />} onClick={() => { remove(name); p.aoMudar({}); }} /></Col>
                        </Row>
                      ))}
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ forma: 'PIX' })}>Registrar pagamento</Button>
                    </Flex>
                  )}
                </Form.List>
              </Card>
            </Col>
          </Row>
          <Card size="small" style={{ background: token.colorFillQuaternary }}>
            <Flex gap={24} wrap align="center">
              <Statistic title={`Contratado${fin.contratados ? ` (${fin.contratados} m)` : ''}`} value={brl(fin.valorContratado)} />
              {fin.excedente > 0 && <Statistic title={`Excedente ${fin.excedente} m × ${brl(fin.valorMetroExcedente)}`} value={brl(fin.valorExcedente)} />}
              {fin.falta > 0 && <Statistic title={`${fin.falta} m a menos`} value={fin.abatimento ? `− ${brl(fin.abatimento)}` : 'sem abatimento'} />}
              {fin.totalAdicionais > 0 && <Statistic title="Adicionais" value={brl(fin.totalAdicionais)} />}
              <Statistic title="Total da obra" value={brl(fin.total)} valueStyle={{ fontWeight: 700 }} />
              <Statistic title="Pago" value={brl(fin.pago)} />
              <Statistic title={fin.saldo > 0 ? 'Saldo a receber' : fin.saldo < 0 ? 'Crédito do cliente' : 'Quitado'} value={brl(Math.abs(fin.saldo))}
                valueStyle={{ color: fin.saldo > 0 ? token.colorError : token.colorSuccess, fontWeight: 700 }} />
            </Flex>
            {!fin.profundidade && <Text type="warning" style={{ fontSize: 12 }}>Informe a profundidade do poço (ou a perfuração) para calcular o excedente.</Text>}
          </Card>
          <Form.Item label="Observações para o cliente" name="finObs" style={{ marginBottom: 0 }}><TextArea autoSize={{ minRows: 1, maxRows: 4 }} placeholder="Ex.: saldo em 2 parcelas..." /></Form.Item>
        </Flex>
      ),
    },
  ];

  return (
    <div style={{ padding: 16, background: token.colorBgLayout, minHeight: '100vh' }}>
      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '10px 16px' } }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/relatorios')}>Voltar</Button>
            <Title level={4} style={{ margin: 0 }}>Poços · relatórios</Title>
          </Space>
          <Space wrap>
            <Button icon={<FileAddOutlined />} onClick={p.novo}>Novo</Button>
            <Upload accept=".xml" showUploadList={false} beforeUpload={p.importar}><Button icon={<UploadOutlined />}>Abrir arquivo</Button></Upload>
            <Button icon={<DownloadOutlined />} onClick={p.exportar}>Salvar arquivo</Button>
            <Button icon={<EyeOutlined />} onClick={() => setPrevia('completo')}>Pré-visualizar</Button>
            <Dropdown.Button type="primary" icon={<PrinterOutlined />} onClick={() => p.imprimir('completo')}
              menu={{
                items: MODELOS.map(m => ({
                  key: m.id,
                  icon: m.id === 'cobranca' ? <DollarOutlined /> : m.id === 'vazao' ? <LineChartOutlined /> : <PrinterOutlined />,
                  label: <div><div>{m.nome}</div><Text type="secondary" style={{ fontSize: 11 }}>{m.descricao}</Text></div>,
                })),
                onClick: ({ key }) => p.imprimir(key as ModeloId),
              }}>
              Imprimir relatório
            </Dropdown.Button>
          </Space>
        </Flex>
      </Card>

      <Form form={form} layout="vertical" onValuesChange={p.aoMudar}>
        <Row gutter={12}>
          <Col xs={24} xl={18}>
            <Collapse items={secoes} defaultActiveKey={secoes.map(s => s.key)} style={{ background: token.colorBgContainer }} />
          </Col>
          <Col xs={24} xl={6}>
            <Flex vertical gap={12} style={{ position: 'sticky', top: 12 }}>
              <Card size="small" title="Resumo">
                <Descriptions size="small" column={1} items={[
                  { key: 'c', label: 'Cliente', children: valores.cliente || <Text type="secondary">—</Text> },
                  { key: 'p', label: 'Profundidade', children: valores.profundidade ? `${valores.profundidade} m` : <Text type="secondary">—</Text> },
                  { key: 'g', label: 'Garantia até', children: garantiaAte || <Text type="secondary">—</Text> },
                  { key: 'a', label: 'Anomalias', children: ANOMALIAS.filter(([k]) => valores[k]).length || 'nenhuma' },
                ]} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {p.salvoEm ? `Rascunho salvo neste computador em ${p.salvoEm}.` : 'O rascunho é salvo sozinho neste computador.'} Para guardar de vez, use "Salvar arquivo".
                </Text>
              </Card>
              <Card size="small" title="Empresa no cabeçalho">
                <Flex vertical gap={6}>
                  <Input size="small" placeholder="Nome da empresa" value={p.empresa.nome} onChange={e => p.setEmpresa({ nome: e.target.value })} />
                  <Input size="small" placeholder="CNPJ" value={p.empresa.documento} onChange={e => p.setEmpresa({ documento: e.target.value })} />
                  <Input size="small" placeholder="Telefone" value={p.empresa.telefone} onChange={e => p.setEmpresa({ telefone: e.target.value })} />
                  <Input size="small" placeholder="Cidade / UF" value={p.empresa.cidade} onChange={e => p.setEmpresa({ cidade: e.target.value })} />
                  <Input size="small" placeholder="Chave PIX (sai na cobrança)" value={p.empresa.pix} onChange={e => p.setEmpresa({ pix: e.target.value })} />
                  <TextArea size="small" autoSize={{ minRows: 1, maxRows: 3 }} placeholder="Outros dados para pagamento (banco, agência...)"
                    value={p.empresa.dadosPagamento} onChange={e => p.setEmpresa({ dadosPagamento: e.target.value })} />
                  <Collapse size="small" items={[{
                    key: 'g', label: 'Condições da garantia',
                    children: <TextArea autoSize={{ minRows: 3, maxRows: 8 }} value={p.empresa.textoGarantia ?? TEXTO_GARANTIA_PADRAO} onChange={e => p.setEmpresa({ textoGarantia: e.target.value })} />,
                  }]} />
                  <Text type="secondary" style={{ fontSize: 11 }}>Fica guardado neste computador e sai em todos os relatórios.</Text>
                </Flex>
              </Card>
              <Card size="small" title="Assinaturas">
                <Space size={4}><Switch size="small" checked={p.secoes.assinaturas} onChange={v => p.alternarSecao('assinaturas', v)} /> Campos de assinatura no fim</Space>
              </Card>
            </Flex>
          </Col>
        </Row>
      </Form>

      <Drawer open={!!previa} onClose={() => setPrevia(null)} size={960} title="Pré-visualização (A4)" destroyOnHidden
        extra={<Button type="primary" icon={<PrinterOutlined />} onClick={() => { const m = previa; setPrevia(null); if (m) p.imprimir(m); }}>Imprimir este modelo</Button>}>
        {previa && (
          <Flex vertical gap={8} style={{ height: '100%' }}>
            <Segmented block value={previa} onChange={v => setPrevia(v as ModeloId)} options={MODELOS.map(m => ({ value: m.id, label: ROTULO_CURTO[m.id] }))} />
            <iframe title="Pré-visualização do relatório" srcDoc={p.html(previa)} style={{ width: '100%', flex: 1, minHeight: '75vh', border: '1px solid #e2e8f0', background: '#fff' }} />
          </Flex>
        )}
      </Drawer>
    </div>
  );
}
