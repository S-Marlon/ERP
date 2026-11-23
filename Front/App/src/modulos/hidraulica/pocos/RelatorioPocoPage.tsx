// Módulo Poços (HIDRAULICA_POCOS, sem banco): formulário por seções, rascunho automático no navegador, modelos de
// impressão (completo, cobrança, teste de vazão, garantia, em branco) com pré-visualização e arquivo XML para guardar/reabrir.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Checkbox, Col, Collapse, DatePicker, Descriptions, Drawer, Dropdown, Flex, Form, Input, message, Row, Segmented, Select, Space, Statistic, Switch, Tag, Tooltip, Typography, Upload, theme } from 'antd';
import {
  ArrowLeftOutlined, BuildOutlined, CompassOutlined, DashboardOutlined, DeleteOutlined, DollarOutlined, DownloadOutlined, ExperimentOutlined, EyeOutlined,
  FileAddOutlined, LineChartOutlined, PlusOutlined, PrinterOutlined, SettingOutlined, UnorderedListOutlined, UploadOutlined, UserOutlined,
} from '@ant-design/icons';
import { RelatorioDaObra, useRelatorioPoco } from './useRelatorioPoco';
import {
  ANOMALIAS, brl, calcularFinanceiro, dataGarantia, FORMAS_PAGAMENTO, progresso, resumoTeste, SecaoId, TEXTO_GARANTIA_PADRAO,
} from './relatorioPoco';
import { MODELOS, ModeloId } from './templatesPoco';
import { GRUPOS_OCORRENCIA, GrupoOcorrencia, itensDosGrupos } from './ocorrencias';
import { CAMADAS_GEOLOGICAS, resumoEstrutura, revestimentosDe, svgPerfil, temEstrutura, TIPOS_REVESTIMENTO } from './estruturaPoco';
import { CampoMaterial, useCatalogoMateriais } from './CampoMaterial';
import { barrasDoTrecho, caboSugerido, corDoMaterial, diametroEmNumero, textoBarras } from './materiaisPoco';
import { LancarMateriais } from './LancarMateriais';
import type { MaterialPoco } from './obrasApi';
import { mascaraCep, mascaraCnpj, mascaraCpfCnpj, mascaraTelefone, UFS } from '../../../shared/formularios/documentos';
import { CampoDinheiro, CampoNumero } from '../../../shared/formularios/CamposNumero';
import { FORMATOS_DATA } from '../../../shared/formularios/numeros';

const { Title, Text } = Typography;
const { TextArea } = Input;

const UNIDADES = [{ value: '"', label: 'pol (")' }, { value: 'mm', label: 'mm' }];
const SOLOS = ['Arenoso', 'Argiloso', 'Silte (caxeta)', 'Rocha alterada', 'Rocha sã (cristalino)', 'Sedimentar (misto)'];
const ROTULO_CURTO: Record<ModeloId, string> = { completo: 'Completo', cobranca: 'Cobrança', vazao: 'Teste de vazão', garantia: 'Garantia', branco: 'Em branco' };

export default function RelatorioPocoPage({ obra, titulo, onVoltar }: { obra?: RelatorioDaObra; titulo?: string; onVoltar?: () => void } = {}) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const p = useRelatorioPoco(obra);
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

  const catalogo = useCatalogoMateriais();
  const [lancando, setLancando] = useState(false);
  /** Material escolhido na linha do revestimento: guarda o id, a cor e o comprimento da barra; o diâmetro, se estiver vazio. */
  const aplicarMaterial = (idx: number, m: MaterialPoco | null) => {
    const linhas = [...(form.getFieldValue('revestimentos') || [])];
    const l = { ...linhas[idx], revIdMaterial: m?.idMaterial ?? null, revCor: m ? corDoMaterial(m) : null, revComprimentoBarra: m?.comprimentoM ?? null };
    const d = m ? diametroEmNumero(m.diametro) : null;
    if (d && !l.revDiam) { l.revDiam = d.valor; l.revDiamUnidade = d.unidade; }
    linhas[idx] = l;
    form.setFieldValue('revestimentos', linhas);
    p.aoMudar({});
  };
  /** Material de um campo simples (tubo edutor, cabo, corda, pré-filtro, cimento): guarda o id (e a cor) no campo dado. */
  const aplicarSimples = (campoId: string, m: MaterialPoco | null, extra: Record<string, unknown> = {}) => {
    form.setFieldsValue({ [campoId]: m?.idMaterial ?? null, ...extra });
    p.aoMudar({});
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
              <Flex key={key} vertical gap={2}>
              <Row gutter={6} align="bottom" wrap={false}>
                {!perf && <Col flex="150px"><Form.Item label={i === 0 ? 'Tipo' : ''} name={[name, 'revTipo']} initialValue="EXTERNO" style={{ marginBottom: 0 }}>
                  <Select popupMatchSelectWidth={false} options={TIPOS_REVESTIMENTO.map(t => ({ value: t.valor, label: t.rotulo }))} />
                </Form.Item></Col>}
                <Col flex="90px"><Form.Item label={i === 0 ? 'De' : ''} name={[name, de]} style={{ marginBottom: 0 }}><CampoNumero disabled={perf} min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
                <Col flex="100px"><Form.Item label={i === 0 ? 'Até' : ''} name={[name, ate]} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" placeholder="35" /></Form.Item></Col>
                <Col flex="auto">
                  <Form.Item label={i === 0 ? 'Diâmetro' : ''} style={{ marginBottom: 0 }}>
                    <Space.Compact style={{ width: '100%' }}>
                      <Form.Item name={[name, diam]} noStyle><CampoNumero min={0} style={{ width: '100%' }} placeholder="6" /></Form.Item>
                      {unidade([name, un])}
                    </Space.Compact>
                  </Form.Item>
                </Col>
                {!perf && (
                  <Col flex="230px"><Form.Item label={i === 0 ? 'Material (cadastro)' : ''} name={[name, 'revMaterial']} style={{ marginBottom: 0 }}>
                    <CampoMaterial categorias={['TUBO', 'FILTRO']} placeholder="Tubo geomecânico 6&quot;..." cor={valores.revestimentos?.[name]?.revCor}
                      onEscolher={m => aplicarMaterial(name, m)} style={{ width: '100%' }} />
                  </Form.Item></Col>
                )}
                <Col flex="32px">
                  <Button type="text" danger icon={<DeleteOutlined />} disabled={campos.length === 1} onClick={() => { remove(name); p.aoMudar({ [nome]: true }); }} />
                </Col>
              </Row>
              {!perf && (() => {
                const l = valores.revestimentos?.[name] || {};
                const barras = textoBarras(barrasDoTrecho(l.revDe, l.revAte, l.revComprimentoBarra), l.revComprimentoBarra);
                return (
                  <Row gutter={6} wrap={false} align="middle" style={{ paddingLeft: 156 }}>
                    <Col flex="110px"><Form.Item name={[name, 'revUniao']} style={{ marginBottom: 0 }}><Input size="small" placeholder="União (rosca)" /></Form.Item></Col>
                    <Col flex="auto"><Form.Item name={[name, 'revObs']} style={{ marginBottom: 0 }}><Input size="small" placeholder="Motivo / obs. (ex.: caimento aos 60 m)" /></Form.Item></Col>
                    <Col flex="190px">{barras ? <Tag color="blue" style={{ margin: 0 }}>{barras}</Tag> : <Text type="secondary" style={{ fontSize: 11 }}>{l.revIdMaterial ? 'sem comprimento de barra no cadastro' : ''}</Text>}</Col>
                  </Row>
                );
              })()}
              </Flex>
            ))}
            <Space wrap>
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => { const l = form.getFieldValue(nome) || []; add({ [de]: Number(l[l.length - 1]?.[ate]) || 0, [un]: '"', ...(perf ? {} : { revTipo: 'EXTERNO' }) }); }}>
                {perf ? 'Adicionar etapa de perfuração' : 'Adicionar revestimento'}
              </Button>
              {!perf && (
                <Tooltip title="Tubo mais fino colocado por dentro (ex.: o poço desmoronou e foi revestido de novo até o fundo)">
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => { add({ revDe: 0, revDiamUnidade: '"', revTipo: 'INTERNO' }); p.aoMudar({}); }}>Revestimento interno (complemento)</Button>
                </Tooltip>
              )}
            </Space>
          </Flex>
        )}
      </Form.List>
    );
  };

  // Perfil geológico: camadas de cima para baixo (cada uma começa onde a anterior terminou)
  const perfilGeologico = (
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
              <Col flex="32px"><Button type="text" danger icon={<DeleteOutlined />} onClick={() => { remove(name); p.aoMudar({ perfilGeologico: true }); }} /></Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => { const l = form.getFieldValue('perfilGeologico') || []; add({ geoDe: Number(l[l.length - 1]?.geoAte) || 0 }); }}>Adicionar camada</Button>
        </Flex>
      )}
    </Form.List>
  );

  // Leituras do teste de vazão: tempo (min), nível (m) e, no bombeamento, vazão (L/h)
  const leituras = (nome: 'testeLeituras' | 'testeRecuperacao', comVazao: boolean) => (
    <Form.List name={nome}>
      {(campos, { add, remove }) => (
        <Flex vertical gap={6}>
          {campos.map(({ key, name }, i) => (
            <Row key={key} gutter={6} align="bottom" wrap={false}>
              <Col flex="1"><Form.Item label={i === 0 ? 'Tempo' : ''} name={[name, 'tempo']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="min" /></Form.Item></Col>
              <Col flex="1"><Form.Item label={i === 0 ? 'Nível' : ''} name={[name, 'nivel']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
              {comVazao && <Col flex="1"><Form.Item label={i === 0 ? 'Vazão' : ''} name={[name, 'vazao']} style={{ marginBottom: 0 }}><CampoNumero min={0} style={{ width: '100%' }} suffix="L/h" /></Form.Item></Col>}
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
  // Checklist por grupo, com a contagem de marcados no título
  const grupos = (titulo: string, lista: GrupoOcorrencia[]) => (
    <Card size="small" title={titulo} styles={{ body: { padding: '8px 12px' } }}>
      <Flex vertical gap={8}>{lista.map(g => {
        const itens = itensDosGrupos(g);
        const quantos = itens.filter(([k]) => valores[k]).length;
        return (
          <div key={g}>
            <Text strong style={{ fontSize: 12 }}>{GRUPOS_OCORRENCIA[g].titulo}</Text>
            {quantos > 0 && <Tag color="red" style={{ marginLeft: 6, fontSize: 10 }}>{quantos} marcada{quantos > 1 ? 's' : ''}</Tag>}
            {checks(itens)}
          </div>
        );
      })}</Flex>
    </Card>
  );

  const secoes = [
    {
      key: 'cliente', label: cabecalho(<UserOutlined style={{ color: token.colorPrimary }} />, 'Cliente / proprietário', 'cliente'),
      children: (
        <Row gutter={12}>
          <Col xs={24} md={12}><Form.Item label="Nome / razão social" name="cliente"><Input placeholder="Nome completo" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="CPF / CNPJ" name="documento" normalize={v => mascaraCpfCnpj(v)}><Input inputMode="numeric" placeholder="CPF ou CNPJ" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Telefone" name="celular" normalize={v => mascaraTelefone(v)}><Input inputMode="tel" placeholder="(00) 00000-0000" /></Form.Item></Col>
          <Col xs={24} md={10}><Form.Item label="Endereço (rua, nº)" name="endereco"><Input placeholder="Estrada Municipal, km 4" /></Form.Item></Col>
          <Col xs={12} md={5}><Form.Item label="Bairro" name="bairro"><Input /></Form.Item></Col>
          <Col xs={12} md={4}><Form.Item label="Cidade" name="cidade"><Input /></Form.Item></Col>
          <Col xs={8} md={2}><Form.Item label="UF" name="uf"><Select showSearch allowClear options={UFS.map(u => ({ value: u, label: u }))} /></Form.Item></Col>
          <Col xs={16} md={3}><Form.Item label="CEP" name="cep" normalize={v => mascaraCep(v)}><Input inputMode="numeric" placeholder="00000-000" /></Form.Item></Col>
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
              <CampoNumero min={0} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
          </Col>
          <Col xs={12} md={4}>
            <Form.Item label="Diâmetro interno" extra={(() => {
              const menor = revestimentosDe(valores).filter(r => r.diametro > 0).sort((a, b) => a.diametro - b.diametro)[0];
              if (!menor) return null;
              const original = (valores.revestimentos || []).find((r: any) => Number(r?.revAte) === menor.ate && Number(r?.revDe) === menor.de);
              if (!original || Number(valores.diametroInterno) === Number(original.revDiam)) return null;
              return <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { form.setFieldsValue({ diametroInterno: original.revDiam, diamInternoUnidade: original.revDiamUnidade || '"' }); p.aoMudar({}); }}>usar {menor.texto} do revestimento</Button>;
            })()}>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="diametroInterno" noStyle><CampoNumero min={0} style={{ width: '100%' }} /></Form.Item>{unidade('diamInternoUnidade')}
              </Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={12} md={5}><Form.Item label="Última limpeza" name="dtLimpeza"><DatePicker format={FORMATOS_DATA} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={12} md={8}>
            <Form.Item label="Vazão na perfuração">
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="vazaoAprox" noStyle><CampoNumero min={0} style={{ width: '100%' }} suffix="L/h" /></Form.Item>
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
            <Col xs={12} md={5}><Form.Item label="Início" name="dtInicio"><DatePicker format={FORMATOS_DATA} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={5}><Form.Item label="Conclusão" name="dtTermino"><DatePicker format={FORMATOS_DATA} style={{ width: '100%' }} /></Form.Item></Col>
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
            <Col xs={24} xl={14}><Card size="small" title="Perfil geológico (o que a perfuração atravessou)">{perfilGeologico}</Card></Col>
            <Col xs={24} xl={10}>
              <Card size="small" title="Estrutura do poço">
                {temEstrutura(valores) ? (
                  <Flex vertical gap={6}>
                    <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: svgPerfil(valores, { altura: 420 }) }} />
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>{resumoEstrutura(valores).map(l => <li key={l}>{l}</li>)}</ul>
                  </Flex>
                ) : <Text type="secondary">Preencha a perfuração e o revestimento para ver o desenho do poço.</Text>}
              </Card>
            </Col>
          </Row>
          <Card size="small" title="Completação (pré-filtro, cimentação, laje e tampa)">
            <Row gutter={10}>
              <Col xs={8} md={3}><Form.Item label="Pré-filtro de" name="compPreFiltroDe"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
              <Col xs={8} md={3}><Form.Item label="até" name="compPreFiltroAte"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
              <Col xs={16} md={6}><Form.Item label="Material (cascalho)" name="compPreFiltroMaterial">
                <CampoMaterial categorias={['PRE_FILTRO']} onEscolher={m => aplicarSimples('compIdPreFiltro', m)} style={{ width: '100%' }} />
              </Form.Item></Col>
              <Col xs={8} md={3}><Form.Item label="Quantidade" name="compPreFiltroQtd"><CampoNumero min={0} style={{ width: '100%' }} placeholder="sacos" /></Form.Item></Col>
              <Col xs={8} md={3}><Form.Item label="Cimentação de" name="compCimentoDe"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
              <Col xs={8} md={3}><Form.Item label="até" name="compCimentoAte"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
              <Col xs={8} md={3}><Form.Item label="Cimento" name="compCimentoQtd" tooltip="Sacos de cimento (o material é o 'Cimento' do cadastro)">
                <CampoNumero min={0} style={{ width: '100%' }} placeholder="sacos" />
              </Form.Item></Col>
              <Col xs={12} md={6}><Form.Item label="Laje de proteção" name="compLaje"><Input placeholder="Ex.: 1 x 1 m, 10 cm" /></Form.Item></Col>
              <Col xs={12} md={6}><Form.Item label="Tampa" name="compTampa"><Input placeholder="Ex.: tampa 6&quot; com cadeado" /></Form.Item></Col>
            </Row>
          </Card>
          {grupos('Ocorrências na obra (checklist)', ['PERFURACAO', 'LOCAL'])}
          <Form.Item label="Outras ocorrências na obra" name="obsOcorrencias" style={{ marginBottom: 0 }}>
            <TextArea autoSize={{ minRows: 1, maxRows: 4 }} placeholder="O que não está na lista: o que aconteceu, a profundidade, o que foi feito..." />
          </Form.Item>
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
          {grupos('Anomalias encontradas (checklist; só as marcadas saem na impressão)', ['AGUA', 'POCO', 'BOMBA'])}
          <Row gutter={12}>
            <Col xs={12} md={6}><Form.Item label="Amperagem (leitura)" name="manutAmperagem"><CampoNumero min={0} style={{ width: '100%' }} suffix="A" /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Isolamento (megômetro)" name="manutMegometro"><CampoNumero min={0} style={{ width: '100%' }} suffix="MΩ" /></Form.Item></Col>
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
          <Col xs={12} md={6}><Form.Item label="Instalação" name="bombaDtInstalacao"><DatePicker format={FORMATOS_DATA} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={8} md={4}><Form.Item label="Tubos (barras)" name="bombaQtdTubos"><CampoNumero min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col xs={8} md={4}><Form.Item label="Comp. do tubo" name="bombaTamTubo"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={8} md={5}>
            <Form.Item label="Diâmetro do tubo">
              <Space.Compact style={{ width: '100%' }}><Form.Item name="bombaMedidaTubo" noStyle><Input placeholder="1" /></Form.Item>{unidade('bombaTuboUnidade')}</Space.Compact>
            </Form.Item>
          </Col>
          <Col xs={12} md={6}><Form.Item label="Tubo edutor (cadastro)" name="bombaTubulacao">
            <CampoMaterial categorias={['TUBO']} cor={valores.bombaTuboCor} style={{ width: '100%' }}
              onEscolher={m => aplicarSimples('bombaIdTubo', m, m ? {
                bombaTuboCor: corDoMaterial(m), ...(m.comprimentoM ? { bombaTamTubo: m.comprimentoM } : {}),
                ...(m.diametro ? { bombaMedidaTubo: String(m.diametro).replace(/["”]/g, '').trim(), bombaTuboUnidade: /mm/i.test(m.diametro) ? 'mm' : '"' } : {}),
              } : { bombaTuboCor: null })} />
          </Form.Item></Col>
          <Col xs={12} md={5}>
            {(() => {
              const total = Number(valores.bombaQtdTubos) * Number(valores.bombaTamTubo);
              const prof = Number(valores.bombaProfundidade) || 0;
              const difere = total > 0 && prof > 0 && Math.abs(total - prof) > 1;
              return (
                <Form.Item label="Profundidade da bomba" name="bombaProfundidade" validateStatus={difere ? 'warning' : undefined}
                  extra={total > 0 ? (
                    <Space size={4} wrap>
                      <Text type={difere ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>
                        {textoBarras(Number(valores.bombaQtdTubos), valores.bombaTamTubo)} = {String(total).replace('.', ',')} m{difere ? ' (não bate com a bomba)' : ''}
                      </Text>
                      {total !== prof && <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { form.setFieldValue('bombaProfundidade', total); p.aoMudar({}); }}>usar {String(total).replace('.', ',')} m</Button>}
                    </Space>
                  ) : null}>
                  <CampoNumero min={0} style={{ width: '100%' }} suffix="m" />
                </Form.Item>
              );
            })()}
          </Col>
          <Col xs={12} md={6}><Form.Item label="Cabo elétrico (cadastro)" name="bombaCabeamento">
            <CampoMaterial categorias={['CABO']} placeholder="Cabo PP 3x4 mm" style={{ width: '100%' }} onEscolher={m => aplicarSimples('bombaIdCabo', m)} />
          </Form.Item></Col>
          <Col xs={12} md={4}>
            <Form.Item label="Metros de cabo" name="bombaCaboMetros"
              extra={caboSugerido(valores.bombaProfundidade) && Number(valores.bombaCaboMetros) !== caboSugerido(valores.bombaProfundidade)
                ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { form.setFieldValue('bombaCaboMetros', caboSugerido(valores.bombaProfundidade)); p.aoMudar({}); }}>
                    sugerido {caboSugerido(valores.bombaProfundidade)} m (bomba + 10 m)</Button>
                : null}>
              <CampoNumero min={0} style={{ width: '100%' }} suffix="m" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}><Form.Item label="Corda de segurança" name="bombaCorda">
            <CampoMaterial categorias={['CABO']} placeholder="Corda de segurança" style={{ width: '100%' }} onEscolher={m => aplicarSimples('bombaIdCorda', m)} />
          </Form.Item></Col>
          <Col xs={12} md={4}><Form.Item label="Metros de corda" name="bombaCordaMetros"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Cavalete de saída" name="bombaCavalete"><Input placeholder="PEAD / galvanizado" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Nível estático (NE)" name="bombaNivelEstatico"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Nível dinâmico (ND)" name="bombaNivelDinamico"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
          <Col xs={24} md={8}>
            <Form.Item label="Vazão regulada">
              <Form.Item name="bombaVazaoEstimada" noStyle><CampoNumero min={0} style={{ width: '100%' }} suffix="L/h" /></Form.Item>
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
          <Col xs={12} md={8}><Form.Item label="Duração do ensaio" name="testeVazaoDuracao"><CampoNumero min={0} style={{ width: '100%' }} suffix="h" /></Form.Item></Col>
          <Col xs={12} md={8}>
            <Form.Item label="Método" name="testeVazaoMetodo">
              <Select allowClear options={['Fluxo contínuo', 'Estágios', 'Air-lift (compressor)'].map(m => ({ value: m, label: m }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}><Form.Item label="Vazão estabilizada" name="testeVazaoEstabilizada"><CampoNumero min={0} style={{ width: '100%' }} suffix="m³/h" /></Form.Item></Col>
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
            <Col xs={12} md={6}><Form.Item label="Metros contratados" name="finMetrosContratados"><CampoNumero min={0} style={{ width: '100%' }} suffix="m" /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Valor contratado (pacote)" name="finValorContratado"><CampoDinheiro min={0} style={{ width: '100%' }} precision={2} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item label="Valor do metro excedente" name="finValorMetroExcedente"><CampoDinheiro min={0} style={{ width: '100%' }} precision={2} /></Form.Item></Col>
            <Col xs={12} md={6}>
              <Form.Item label="Poço mais raso que o contratado">
                <Form.Item name="finAbaterFalta" valuePropName="checked" noStyle><Checkbox>abater os metros a menos</Checkbox></Form.Item>
                {valores.finAbaterFalta && (
                  <Form.Item name="finValorMetroFalta" noStyle>
                    <CampoDinheiro min={0} size="small" style={{ width: '100%', marginTop: 4 }}
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
                          <Col flex="130px"><Form.Item name={[name, 'valor']} noStyle><CampoDinheiro min={0} style={{ width: '100%' }} precision={2} /></Form.Item></Col>
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
                          <Col flex="130px"><Form.Item name={[name, 'data']} noStyle><DatePicker format={FORMATOS_DATA} style={{ width: '100%' }} /></Form.Item></Col>
                          <Col flex="120px"><Form.Item name={[name, 'forma']} noStyle><Select style={{ width: '100%' }} options={FORMAS_PAGAMENTO.map(x => ({ value: x, label: x }))} /></Form.Item></Col>
                          <Col flex="130px"><Form.Item name={[name, 'valor']} noStyle><CampoDinheiro min={0} style={{ width: '100%' }} precision={2} /></Form.Item></Col>
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => (onVoltar ? onVoltar() : navigate('/relatorios'))}>Voltar</Button>
            <Title level={4} style={{ margin: 0 }}>{titulo || 'Poços · relatório avulso'}</Title>
          </Space>
          <Space wrap>
            {!obra && <Button icon={<FileAddOutlined />} onClick={p.novo}>Novo</Button>}
            <Upload accept=".xml" showUploadList={false} beforeUpload={p.importar}><Button icon={<UploadOutlined />}>Abrir arquivo</Button></Upload>
            <Button icon={<DownloadOutlined />} onClick={p.exportar}>Salvar arquivo</Button>
            <Button icon={<EyeOutlined />} onClick={() => setPrevia('completo')}>Pré-visualizar</Button>
            {obra?.idObra && (
              <Tooltip title="Barras de revestimento e filtro, tubo edutor, cabo, corda, pré-filtro e cimento do relatório em Materiais da obra">
                <Button icon={<UnorderedListOutlined />} onClick={() => setLancando(true)}>Lançar materiais na obra</Button>
              </Tooltip>
            )}
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

      {obra?.idObra && <LancarMateriais aberto={lancando} idObra={obra.idObra} dados={valores} catalogo={catalogo} onFechar={() => setLancando(false)} />}
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
                  {obra
                    ? (p.salvoEm ? `Salvo na obra em ${p.salvoEm}.` : 'Grava sozinho na obra a cada alteração.')
                    : <>{p.salvoEm ? `Rascunho salvo neste computador em ${p.salvoEm}.` : 'O rascunho é salvo sozinho neste computador.'} Para guardar de vez, use "Salvar arquivo" (ou crie uma obra).</>}
                </Text>
              </Card>
              <Card size="small" title="Empresa no cabeçalho">
                <Flex vertical gap={6}>
                  <Input size="small" placeholder="Nome da empresa" value={p.empresa.nome} onChange={e => p.setEmpresa({ nome: e.target.value })} />
                  <Input size="small" placeholder="CNPJ" value={p.empresa.documento} onChange={e => p.setEmpresa({ documento: mascaraCnpj(e.target.value) })} />
                  <Input size="small" placeholder="Telefone" value={p.empresa.telefone} onChange={e => p.setEmpresa({ telefone: mascaraTelefone(e.target.value) })} />
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
