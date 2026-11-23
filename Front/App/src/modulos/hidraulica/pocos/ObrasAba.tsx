// Obras de poços › Obras e poços (etapa 1): a lista de obras por situação, a obra nova (cliente de poço, poço já
// cadastrado, novo ou criado ao concluir a perfuração), a obra aberta com a situação e o relatório técnico gravando nela,
// a ficha dos poços e os clientes de poço. "Ver no mapa" leva à aba do mapa (etapa 2) já no ponto.
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Empty, Flex, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Statistic, Steps, Switch, Table, Tag, Tooltip,
  Typography, message,
} from 'antd';
import {
  AimOutlined, ArrowRightOutlined, CalculatorOutlined, CalendarOutlined, CheckCircleOutlined, EditOutlined, EnvironmentOutlined, PlusOutlined, ReloadOutlined,
  ToolOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  centralApi, ConjuntoForm, ContratoCentral, contarObras, dataBr, FechamentoContrato, foneBr, GRAVIDADES, Obra, ObraForm, obrasApi, Poco, PocoForm, Servico, SERVICOS, SituacaoObra, SITUACOES_OBRA,
} from './obrasApi';
import RelatorioPocoPage from './RelatorioPocoPage';
import { CampoCep, CampoUf } from '../../../shared/formularios/Campos';
import { ClientePocoModal, ListaClientes } from './ClientesPoco';
import { FechamentoModal } from './FechamentoContrato';
import { CamposConjunto } from './ConjuntoPoco';
import { AReceberObras, CobrancaDaObra } from './CobrancaObra';
import { CadastroMateriais, MateriaisDaObra } from './MateriaisObra';
import { HistoricoDoPoco } from './ManutencaoPocos';
import { ProcessoDaObra } from './ProcessoObra';
import { OrcamentoEContrato, OrcamentoRapido } from './OrcamentoContrato';
import { lerGpsTexto, textoRaio } from './mapaRegional';
import { abrirFichaCliente, abrirFichaPoco, agendarObra, ParteObra, useNavPocos, useNivelPocos, verNoMapa, VistaObras } from './navPocos';
import { DestinoPasso, parteDaSituacao, proximoPasso, rotuloDestino } from './proximoPasso';

const { Text } = Typography;
const brl = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const ORDEM: SituacaoObra[] = ['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CONCLUIDA'];

const pocoVazio = (): PocoForm => ({
  identificacao: '', idProprietario: null, endereco: null, bairro: null, cidade: null, uf: null, cep: null, gps: null, profundidadeM: null, diametro: null,
  vazaoLh: null, nivelEstaticoM: null, nivelDinamicoM: null, tipoSolo: null, dataPerfuracao: null, perfuradoPor: 'NOS', perfuradoPorNome: null, situacao: 'ATIVO', observacao: null,
});
const obraVazia = (): ObraForm => ({
  idCliente: null, idPoco: null, servicos: ['PERFURACAO'], titulo: null, dataPrevisao: null, garantiaMeses: 12, metrosPrevistos: null,
  valorContratado: null, valorParcelado: null, valorMetroExcedente: null, valorSinal: null, sinalQuando: 'ANTES', observacao: null,
  escopo: null, prazoExecucaoDias: null, formaPagamento: null, validadeOrcamentoDias: null,
});

/** Campos de endereço e GPS do poço (usados no poço novo da obra e na ficha). */

const CamposLocal: React.FC<{ p: Partial<PocoForm>; mudar: (x: Partial<PocoForm>) => void }> = ({ p, mudar }) => {
  const obterGps = () => navigator.geolocation?.getCurrentPosition(
    pos => mudar({ gps: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` }),
    () => message.warning('Não deu para pegar a localização deste aparelho.'),
  );
  return (
    <Row gutter={8}>
      <Col span={14}><Text>Endereço</Text><Input value={p.endereco || ''} onChange={e => mudar({ endereco: e.target.value || null })} placeholder="Estrada Municipal, km 4" /></Col>
      <Col span={10}><Text>Bairro</Text><Input value={p.bairro || ''} onChange={e => mudar({ bairro: e.target.value || null })} /></Col>
      <Col span={8}><Text>Cidade</Text><Input value={p.cidade || ''} onChange={e => mudar({ cidade: e.target.value || null })} /></Col>
      <Col span={3}><Text>UF</Text><CampoUf style={{ width: '100%' }} value={p.uf || undefined} onChange={v => mudar({ uf: v || null })} /></Col>
      <Col span={5}><Text>CEP</Text>
        <CampoCep value={p.cep} onChange={cep => mudar({ cep: cep || null })}
          onEndereco={e => mudar({ endereco: p.endereco || e.logradouro || null, bairro: p.bairro || e.bairro || null, cidade: e.cidade || p.cidade || null, uf: e.uf || p.uf || null })} />
      </Col>
      <Col span={8}>
        <Text>Localização (GPS)</Text>
        <Input value={p.gps || ''} onChange={e => mudar({ gps: e.target.value || null })} placeholder="-23.550520, -46.633308"
          suffix={<Button type="link" size="small" icon={<EnvironmentOutlined />} onClick={obterGps}>Obter</Button>} />
      </Col>
    </Row>
  );
};

const PocoModal: React.FC<{ poco: Poco | 'novo' | null; onFechar: () => void; onSalvo: () => void }> = ({ poco, onFechar, onSalvo }) => {
  const [p, setP] = useState(pocoVazio());
  const [cliente, setCliente] = useState<{ id: number; nome: string } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [parte, setParte] = useState<'FICHA' | 'HISTORICO'>('FICHA');
  // motobomba já instalada (só no poço novo; depois fica na ficha do poço › Bomba e instalação)
  const [formBomba] = Form.useForm<ConjuntoForm>();
  const [comBomba, setComBomba] = useState(false);
  useEffect(() => {
    if (!poco) return;
    setParte('FICHA');
    setComBomba(false);
    formBomba.resetFields();
    if (poco === 'novo') { setP(pocoVazio()); setCliente(null); return; }
    setP({ ...poco, gps: poco.latitude !== null && poco.longitude !== null ? `${poco.latitude}, ${poco.longitude}` : null });
    setCliente(poco.idProprietario ? { id: poco.idProprietario, nome: poco.proprietario || '' } : null);
  }, [poco]);
  const mudar = (x: Partial<PocoForm>) => setP(a => ({ ...a, ...x }));
  const num = (k: 'profundidadeM' | 'vazaoLh' | 'nivelEstaticoM' | 'nivelDinamicoM', suf: string) => (
    <InputNumber min={0} style={{ width: '100%' }} suffix={suf} decimalSeparator="," value={p[k] ?? undefined} onChange={v => mudar({ [k]: v === null ? null : Number(v) } as any)} />
  );
  const salvar = async () => {
    try {
      const dados = { ...p, idProprietario: cliente?.id ?? null };
      if (poco === 'novo') {
        const conjunto = comBomba ? formBomba.getFieldsValue() : null;
        const novo = await obrasApi.criarPoco({ ...dados, conjunto });
        message.success(`Poço salvo: ${novo.identificacao}${conjunto ? ' (com a motobomba)' : ''}.`);
      } else if (poco) { await obrasApi.salvarPoco(poco.idPoco, dados); message.success('Poço salvo.'); }
      onSalvo();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  return (
    <Modal open={!!poco} title={poco === 'novo' ? 'Novo poço' : `Poço · ${poco && poco.identificacao}`} okText="Salvar" cancelText="Voltar" onOk={salvar} onCancel={onFechar}
      width={parte === 'HISTORICO' ? 900 : 720} okButtonProps={{ style: parte === 'HISTORICO' ? { display: 'none' } : undefined }} destroyOnHidden>
      {poco && poco !== 'novo' && (
        <Segmented style={{ marginBottom: 10 }} value={parte} onChange={v => setParte(v as 'FICHA' | 'HISTORICO')}
          options={[{ value: 'FICHA', label: 'Ficha' }, { value: 'HISTORICO', label: 'Histórico e manutenção' }]} />
      )}
      {parte === 'HISTORICO' && poco && poco !== 'novo' ? <HistoricoDoPoco idPoco={poco.idPoco} onAbrirObra={onFechar} /> : (
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {poco && poco !== 'novo' && (poco.latitude !== null || poco.idProprietario) && (
          <Space wrap>
            {poco.latitude !== null && poco.longitude !== null && (
              <Button size="small" icon={<EnvironmentOutlined />} onClick={() => { onFechar(); verNoMapa(poco.latitude!, poco.longitude!, poco.idPoco); }}>Ver no mapa</Button>
            )}
            {poco.idProprietario && <Button size="small" icon={<UserOutlined />} onClick={() => { onFechar(); abrirFichaCliente(poco.idProprietario!); }}>Ficha do cliente</Button>}
          </Space>
        )}
        {poco && poco !== 'novo' && (
          <Button size="small" icon={<ToolOutlined />} onClick={() => { onFechar(); abrirFichaPoco(poco.idPoco, 'BOMBA'); }}>Motobomba e fotos do poço</Button>
        )}
        <Row gutter={8}>
          <Col span={14}><Text>Identificação</Text><Input maxLength={100} value={p.identificacao} onChange={e => mudar({ identificacao: e.target.value })}
            placeholder={cliente ? `Vazio = "Poço de ${cliente.nome}"` : p.cidade || p.bairro ? `Vazio = "Poço (${p.cidade || p.bairro}) #1"` : 'Vazio = "Poço (cidade) #1"'} /></Col>
          <Col span={10}>
            <Text>Proprietário</Text>
            <Button block icon={<UserOutlined />} onClick={() => setEscolhendo(true)}>{cliente?.nome || 'Escolher no cadastro'}</Button>
          </Col>
        </Row>
        <CamposLocal p={p} mudar={mudar} />
        <Row gutter={8}>
          <Col span={6}><Text>Profundidade</Text>{num('profundidadeM', 'm')}</Col>
          <Col span={6}><Text>Vazão</Text>{num('vazaoLh', 'L/h')}</Col>
          <Col span={6}><Text>Nível estático</Text>{num('nivelEstaticoM', 'm')}</Col>
          <Col span={6}><Text>Nível dinâmico</Text>{num('nivelDinamicoM', 'm')}</Col>
        </Row>
        <Row gutter={8}>
          <Col span={6}><Text>Diâmetro</Text><Input value={p.diametro || ''} placeholder='6"' onChange={e => mudar({ diametro: e.target.value || null })} /></Col>
          <Col span={6}><Text>Solo</Text><Input value={p.tipoSolo || ''} onChange={e => mudar({ tipoSolo: e.target.value || null })} /></Col>
          <Col span={6}><Text>Perfurado em</Text><Input type="date" value={p.dataPerfuracao || ''} onChange={e => mudar({ dataPerfuracao: e.target.value || null })} /></Col>
          <Col span={6}><Text>Situação</Text>
            <Select style={{ width: '100%' }} value={p.situacao} onChange={situacao => mudar({ situacao })}
              options={[{ value: 'ATIVO', label: 'Ativo' }, { value: 'SECO', label: 'Seco' }, { value: 'DESATIVADO', label: 'Desativado' }]} />
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={8}><Text>Quem perfurou</Text>
            <Select style={{ width: '100%' }} value={p.perfuradoPor} onChange={perfuradoPor => mudar({ perfuradoPor })}
              options={[{ value: 'NOS', label: 'Nós' }, { value: 'TERCEIRO', label: 'Outra empresa' }, { value: 'DESCONHECIDO', label: 'Não sei' }]} />
          </Col>
          {p.perfuradoPor === 'TERCEIRO' && <Col span={16}><Text>Empresa que perfurou</Text><Input value={p.perfuradoPorNome || ''} onChange={e => mudar({ perfuradoPorNome: e.target.value || null })} /></Col>}
        </Row>
        {poco === 'novo' && (
          <Card size="small" title={<Space><ToolOutlined />Motobomba instalada</Space>}
            extra={<Switch size="small" checked={comBomba} onChange={setComBomba} checkedChildren="informar" unCheckedChildren="não sei agora" />}>
            {comBomba ? (
              <Form form={formBomba} layout="vertical" size="small" initialValues={{ bombaTipo: 'SUBMERSA' }}>
                <CamposConjunto comDataDeInstalacao />
              </Form>
            ) : <Text type="secondary">Bomba, motor/bombeador, tubo, fio, corda, quadro e cabeça do poço. Dá para informar depois na ficha do poço.</Text>}
          </Card>
        )}
      </Space>
      )}
      <ClientePocoModal open={escolhendo} onFechar={() => setEscolhendo(false)}
        onSelecionar={c => { setEscolhendo(false); setCliente({ id: c.idCliente, nome: c.nome }); }} />
    </Modal>
  );
};

/** Obra nova ou edição dos dados da obra (a situação muda na obra aberta). */
const ObraModal: React.FC<{ obra: Obra | 'nova' | null; onFechar: () => void; onSalva: (o: Obra) => void }> = ({ obra, onFechar, onSalva }) => {
  const [f, setF] = useState(obraVazia());
  const [cliente, setCliente] = useState<{ id: number; nome: string } | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);
  const [modoPoco, setModoPoco] = useState<'EXISTENTE' | 'NOVO' | 'DEPOIS'>('DEPOIS');
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [novoPoco, setNovoPoco] = useState<Partial<PocoForm>>({ perfuradoPor: 'NOS' });
  const [salvando, setSalvando] = useState(false);
  const [estimativa, setEstimativa] = useState<string | null>(null);
  useEffect(() => {
    if (!obra) return;
    setEstimativa(null);
    if (obra === 'nova') { setF(obraVazia()); setCliente(null); setModoPoco('DEPOIS'); setNovoPoco({ perfuradoPor: 'NOS' }); return; }
    setF({ ...obra });
    setCliente({ id: obra.idCliente, nome: obra.cliente });
    setModoPoco(obra.idPoco ? 'EXISTENTE' : 'DEPOIS');
  }, [obra]);
  useEffect(() => { if (obra) obrasApi.pocos({ idProprietario: cliente?.id ?? null }).then(setPocos).catch(() => setPocos([])); }, [obra, cliente]);
  const mudar = (x: Partial<ObraForm>) => setF(a => ({ ...a, ...x }));
  const salvar = async () => {
    setSalvando(true);
    try {
      const dados = { ...f, idCliente: cliente?.id ?? null, idPoco: modoPoco === 'EXISTENTE' ? f.idPoco : null };
      const r = obra === 'nova'
        ? await obrasApi.criarObra(modoPoco === 'NOVO' ? { ...dados, novoPoco: novoPoco } : dados)
        : await obrasApi.salvarObra((obra as Obra).idObra, dados);
      message.success(obra === 'nova' ? `Obra ${r.idObra} criada.` : 'Obra salva.');
      onSalva(r);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setSalvando(false); }
  };
  /** GPS do poço escolhido (ou do poço novo) para estimar a profundidade pelos poços da região. */
  const gpsDaObra = () => {
    if (modoPoco === 'NOVO') return lerGpsTexto(novoPoco.gps);
    const p = modoPoco === 'EXISTENTE' ? pocos.find(x => x.idPoco === f.idPoco) : null;
    return p && p.latitude !== null && p.longitude !== null ? { latitude: p.latitude, longitude: p.longitude } : null;
  };
  const estimar = async () => {
    const gps = gpsDaObra();
    if (!gps) { message.info('Para estimar, o poço precisa do GPS (escolha um poço com GPS ou preencha a localização do poço novo).'); return; }
    try {
      const a = await obrasApi.analisar(gps.latitude, gps.longitude, 2000);
      if (!a.metrosSugeridos) { setEstimativa(`Nenhum poço com profundidade num raio de ${textoRaio(a.raioM)}.`); return; }
      mudar({ metrosPrevistos: a.metrosSugeridos });
      setEstimativa(`${a.quantidade} poço(s) em ${textoRaio(a.raioM)}: mediana ${a.profundidadeMediana} m (de ${a.profundidadeMin} a ${a.profundidadeMax} m)`
        + `${a.vazaoMediaM3h !== null ? `, vazão média ${a.vazaoMediaM3h} m³/h` : ''}${a.potencial !== null ? `, potencial ${a.potencial.toFixed(0)}` : ''}.`);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  const num = (k: 'metrosPrevistos' | 'valorContratado' | 'valorParcelado' | 'valorMetroExcedente' | 'garantiaMeses' | 'valorSinal', props: object) => (
    <InputNumber min={0} style={{ width: '100%' }} decimalSeparator="," value={f[k] ?? undefined} onChange={v => mudar({ [k]: v === null ? null : Number(v) } as any)} {...props} />
  );
  return (
    <Modal open={!!obra} title={obra === 'nova' ? 'Nova obra' : `Obra ${obra && (obra as Obra).idObra}`} okText={obra === 'nova' ? 'Criar obra' : 'Salvar'} cancelText="Voltar"
      onOk={salvar} confirmLoading={salvando} onCancel={onFechar} width={720} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Row gutter={8}>
          <Col span={12}>
            <Text>Cliente</Text>
            <Button block icon={<UserOutlined />} onClick={() => setEscolhendo(true)} type={cliente ? 'default' : 'primary'} ghost={!cliente}>{cliente?.nome || 'Escolher cliente de poço (ou cadastrar)'}</Button>
          </Col>
          <Col span={12}><Text>Título</Text><Input maxLength={150} value={f.titulo || ''} onChange={e => mudar({ titulo: e.target.value || null })} placeholder="Ex.: Perfuração + bomba - Sítio São José" /></Col>
        </Row>
        <div>
          <Text>Serviços</Text>
          <Checkbox.Group value={f.servicos} onChange={v => mudar({ servicos: v as Servico[] })}
            options={(Object.keys(SERVICOS) as Servico[]).map(s => ({ value: s, label: SERVICOS[s] }))} />
        </div>
        <div>
          <Text>Poço</Text>
          <Segmented block size="small" value={modoPoco} onChange={v => setModoPoco(v as typeof modoPoco)} options={[
            { value: 'EXISTENTE', label: `Já cadastrado${pocos.length ? ` (${pocos.length})` : ''}` },
            ...(obra === 'nova' ? [{ value: 'NOVO', label: 'Cadastrar agora' }] : []),
            { value: 'DEPOIS', label: 'Criar ao concluir a perfuração' },
          ]} />
          {modoPoco === 'EXISTENTE' && (
            <Select style={{ width: '100%', marginTop: 6 }} showSearch optionFilterProp="label" placeholder={cliente ? 'Poços do cliente' : 'Escolha o cliente para ver os poços dele'}
              value={f.idPoco ?? undefined} onChange={idPoco => mudar({ idPoco })}
              options={pocos.map(p => ({ value: p.idPoco, label: `${p.identificacao}${p.cidade ? ` · ${p.cidade}` : ''}${p.profundidadeM ? ` · ${p.profundidadeM} m` : ''}` }))} />
          )}
          {modoPoco === 'NOVO' && (
            <div style={{ marginTop: 6 }}>
              <Text>Identificação do poço</Text>
              <Input value={novoPoco.identificacao || ''} onChange={e => setNovoPoco(p => ({ ...p, identificacao: e.target.value }))} placeholder='Vazio = "Poço de <cliente>" (2º poço: #2)' />
              <CamposLocal p={novoPoco} mudar={x => setNovoPoco(p => ({ ...p, ...x }))} />
            </div>
          )}
          {modoPoco === 'DEPOIS' && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>Na perfuração, o poço é criado ao concluir a obra, com a profundidade, a vazão e o GPS do relatório.</Text>}
        </div>
        <Row gutter={8}>
          <Col span={6}><Text>Início previsto</Text><Input type="date" value={f.dataPrevisao || ''} onChange={e => mudar({ dataPrevisao: e.target.value || null })} /></Col>
          <Col span={6}>
            <Text>Metros previstos</Text>
            <Space.Compact style={{ width: '100%' }}>
              {num('metrosPrevistos', { suffix: 'm' })}
              <Tooltip title="Estimar pelos poços da região (raio de 2 km)"><Button icon={<CalculatorOutlined />} onClick={estimar} /></Tooltip>
            </Space.Compact>
          </Col>
          <Col span={6}><Text>Valor contratado</Text>{num('valorContratado', { prefix: 'R$', precision: 2 })}</Col>
          <Col span={6}><Text>Metro excedente</Text>{num('valorMetroExcedente', { prefix: 'R$', precision: 2 })}</Col>
        </Row>
        {estimativa && <Alert type="info" showIcon style={{ padding: '4px 10px' }} message={<Text style={{ fontSize: 12 }}>{estimativa}</Text>} closable onClose={() => setEstimativa(null)} />}
        <Row gutter={8}>
          <Col span={6}><Text>Sinal</Text>{num('valorSinal', { prefix: 'R$', precision: 2 })}</Col>
          <Col span={6}><Tooltip title="Total se pago parcelado no cartão; vazio = só à vista"><Text>Parcelado (cartão)</Text></Tooltip>{num('valorParcelado', { prefix: 'R$', precision: 2 })}</Col>
          <Col span={8}><Text>Quando paga o sinal</Text>
            <Select style={{ width: '100%' }} value={f.sinalQuando} onChange={sinalQuando => mudar({ sinalQuando })} disabled={!f.valorSinal}
              options={[{ value: 'ANTES', label: 'Antes (libera o início)' }, { value: 'NO_ATO', label: 'No ato da perfuração' }]} />
          </Col>
          <Col span={10}><Text type="secondary" style={{ fontSize: 12, display: 'block', paddingTop: 22 }}>
            {f.valorSinal ? (f.sinalQuando === 'ANTES' ? 'A obra só começa com o sinal recebido.' : 'O sinal fica cobrando e é recebido no dia.') : 'Sem sinal combinado.'}
          </Text></Col>
        </Row>
        <Row gutter={8}>
          <Col span={6}><Text>Garantia</Text>{num('garantiaMeses', { suffix: 'meses', max: 120 })}</Col>
          <Col span={18}><Text>Observação</Text><Input maxLength={255} value={f.observacao || ''} onChange={e => mudar({ observacao: e.target.value || null })} /></Col>
        </Row>
        <Text strong style={{ marginTop: 4 }}>Para o orçamento em PDF</Text>
        <div><Text>Escopo (o que será feito)</Text>
          <Input.TextArea rows={3} maxLength={5000} value={f.escopo || ''} onChange={e => mudar({ escopo: e.target.value || null })}
            placeholder={'Ex.: Perfuração de até 120 m em 6"\nRevestimento geomecânico, pré-filtro e laje de proteção\nTeste de vazão de 6 h'} />
        </div>
        <Row gutter={8}>
          <Col span={6}><Text>Prazo de execução</Text>
            <InputNumber min={1} max={365} suffix="dias" style={{ width: '100%' }} value={f.prazoExecucaoDias ?? undefined} onChange={v => mudar({ prazoExecucaoDias: v === null ? null : Number(v) })} />
          </Col>
          <Col span={12}><Text>Forma de pagamento</Text><Input maxLength={255} value={f.formaPagamento || ''} onChange={e => mudar({ formaPagamento: e.target.value || null })} placeholder="Vazio = a padrão da configuração" /></Col>
          <Col span={6}><Text>Validade</Text>
            <InputNumber min={1} max={365} suffix="dias" placeholder="padrão" style={{ width: '100%' }} value={f.validadeOrcamentoDias ?? undefined} onChange={v => mudar({ validadeOrcamentoDias: v === null ? null : Number(v) })} />
          </Col>
        </Row>
        {obra === 'nova' && <Text type="secondary" style={{ fontSize: 12 }}>A obra começa como orçamento, com o relatório técnico já preenchido com o cliente, o poço e os valores.</Text>}
      </Space>
      <ClientePocoModal open={escolhendo} onFechar={() => setEscolhendo(false)}
        onSelecionar={c => { setEscolhendo(false); setCliente({ id: c.idCliente, nome: c.nome }); mudar({ idPoco: null }); }} />
    </Modal>
  );
};

/** A obra aberta: a situação (com as passagens possíveis) e o relatório técnico gravando nela. */
const ObraAberta: React.FC<{ idObra: number; parte?: ParteObra; onVoltar: () => void }> = ({ idObra, parte: parteInicial, onVoltar }) => {
  const [obra, setObra] = useState<Obra | null>(null);
  // sem parte pedida, a obra abre onde está o trabalho da situação (orçamento, sinal, relatório, processo)
  const [parteEscolhida, setParte] = useState<ParteObra | null>(parteInicial || null);
  const [versaoCobranca, setVersaoCobranca] = useState(0);
  const [editando, setEditando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [fechando, setFechando] = useState<{ para?: SituacaoObra } | null>(null);
  // o que falta nesta obra: as mesmas pendências da Central
  const [pendencias, setPendencias] = useState<ContratoCentral['pendencias']>([]);
  const carregar = useCallback(() => {
    obrasApi.obra(idObra).then(setObra).catch(e => message.error(e.message));
    centralApi.carregar().then(c => setPendencias(c.contratos.find(x => x.idObra === idObra)?.pendencias || [])).catch(() => setPendencias([]));
  }, [idObra]);
  useEffect(() => { carregar(); }, [carregar]);
  // na trilha do topo: "Central › Obras e orçamentos › Obra nº 4 · cliente"; subir fecha a obra
  useNivelPocos(`Obra nº ${idObra}${obra?.cliente ? ` · ${obra.cliente}` : ''}`, onVoltar);
  if (!obra) return null;
  const parte = parteEscolhida || parteDaSituacao(obra.situacao);
  const passo = proximoPasso(obra.situacao, pendencias);
  const outras = pendencias.filter(p => p.texto !== passo.texto);
  const irPara = (d: DestinoPasso) => {
    if (d === 'DADOS_OBRA') setEditando(true);
    else if (d === 'POCO') { if (obra.idPoco) abrirFichaPoco(obra.idPoco); else setEditando(true); }
    else if (d === 'CLIENTE') abrirFichaCliente(obra.idCliente);
    else setParte(d);
  };
  // sair do orçamento pede o fechamento do contrato (escrito ou informal), se a obra ainda não tem
  const pedeFechamento = (s: SituacaoObra) => obra.situacao === 'ORCAMENTO' && s !== 'CANCELADA' && !obra.formaContrato;
  const mudar = async (s: SituacaoObra, fechamento?: FechamentoContrato) => {
    try {
      const r = await obrasApi.mudarSituacao(obra.idObra, s, fechamento);
      setFechando(null);
      message.success(`Obra ${SITUACOES_OBRA[s].texto.toLowerCase()}.${r.pocoAtualizado ? ' A ficha do poço recebeu o que o relatório mediu.' : ''}${r.conjuntoRegistrado ? ' A bomba do relatório entrou como instalada no poço.' : ''}`);
      carregar();
      setVersaoCobranca(v => v + 1);
    } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };
  const indice = ORDEM.indexOf(obra.situacao);
  return (
    <Space direction="vertical" size={0} style={{ width: '100%' }}>
      <Card size="small" style={{ marginBottom: 8 }}>
        <Flex justify="space-between" wrap gap={8} align="start">
          <div>
            <Text strong style={{ fontSize: 16 }}>Obra {obra.idObra}{obra.titulo ? ` · ${obra.titulo}` : ''}</Text>
            <div>
              <Text type="secondary">{obra.cliente}{obra.telefone ? ` · ${foneBr(obra.telefone)}` : ''}{obra.poco ? ` · poço ${obra.poco}` : ''}</Text>
              <span style={{ marginLeft: 8 }}>{obra.servicos.map(s => <Tag key={s}>{SERVICOS[s]}</Tag>)}</span>
            </div>
          </div>
          <Space wrap>
            {obra.proximas.filter(s => s !== obra.situacao).map(s => pedeFechamento(s) ? (
              <Button key={s} type="primary" onClick={() => setFechando({ para: s })}>{SITUACOES_OBRA[s].acao}</Button>
            ) : (
              <Popconfirm key={s} title={`${SITUACOES_OBRA[s].acao}?`} okText="Sim" cancelText="Voltar" onConfirm={() => mudar(s)}
                description={s === 'CONCLUIDA' && obra.servicos.includes('PERFURACAO') ? 'A ficha do poço recebe a profundidade, a vazão e os níveis do relatório.' : undefined}>
                <Button type={s === 'CANCELADA' || ORDEM.indexOf(s) < indice ? 'default' : 'primary'} danger={s === 'CANCELADA'}>{SITUACOES_OBRA[s].acao}</Button>
              </Popconfirm>
            ))}
            <Button icon={<EditOutlined />} onClick={() => setEditando(true)}>Dados da obra</Button>
            <Button icon={<UserOutlined />} onClick={() => abrirFichaCliente(obra.idCliente)}>Cliente</Button>
            {obra.situacao !== 'CANCELADA' && <Button icon={<CalendarOutlined />} onClick={() => agendarObra(obra.idObra)}>Agendar</Button>}
            <Tooltip title={obra.latitude === null ? 'O poço desta obra ainda não tem GPS' : undefined}>
              <Button icon={<EnvironmentOutlined />} disabled={obra.latitude === null || obra.longitude === null}
                onClick={() => verNoMapa(obra.latitude!, obra.longitude!, obra.idPoco ?? undefined)}>Ver no mapa</Button>
            </Tooltip>
          </Space>
        </Flex>
        {obra.situacao === 'CANCELADA'
          ? <Alert type="warning" showIcon style={{ marginTop: 8 }} message="Obra cancelada." />
          : <Steps size="small" style={{ marginTop: 10 }} current={indice} items={ORDEM.map(s => ({ title: SITUACOES_OBRA[s].texto }))} />}
        <Descriptions size="small" column={{ xs: 2, md: 6 }} style={{ marginTop: 8 }} items={[
          { key: 'p', label: 'Previsto', children: dataBr(obra.dataPrevisao) },
          { key: 'i', label: 'Início', children: dataBr(obra.dataInicio) },
          { key: 't', label: 'Conclusão', children: dataBr(obra.dataTermino) },
          { key: 'g', label: 'Garantia até', children: dataBr(obra.garantiaAte) },
          { key: 'm', label: 'Metros', children: obra.metrosPrevistos ? `${obra.metrosPrevistos} m` : '—' },
          {
            key: 'k', label: 'Contrato', children: obra.formaContrato
              ? <Tooltip title={obra.combinadoComo || undefined}>
                  <a onClick={() => setFechando({})}>
                    <Tag color={obra.formaContrato === 'ESCRITO' ? 'green' : 'orange'} style={{ margin: 0 }}>{obra.formaContrato === 'ESCRITO' ? 'escrito' : 'informal'}</Tag>
                    {obra.fechadoEm ? ` ${dataBr(obra.fechadoEm)}` : ''}
                  </a>
                </Tooltip>
              : obra.situacao === 'ORCAMENTO' || obra.situacao === 'CANCELADA' ? '—' : <a onClick={() => setFechando({})}>registrar</a>,
          },
          { key: 'v', label: 'Contratado', children: <>{brl(obra.valorContratado)}{obra.valorSinal ? <Text type="secondary" style={{ fontSize: 12 }}> · sinal {brl(obra.valorSinal)}</Text> : null}</> },
        ]} />
        {obra.situacao !== 'CANCELADA' && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 6,
            background: passo.destino ? '#e6f4ff' : '#f6ffed', border: `1px solid ${passo.destino ? '#91caff' : '#b7eb8f'}`,
          }}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <span>
                {passo.destino ? <ArrowRightOutlined style={{ color: '#1677ff' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                <Text strong style={{ marginLeft: 6 }}>Próximo passo:</Text> {passo.texto}
              </span>
              {passo.destino && passo.botao && <Button size="small" type="primary" onClick={() => irPara(passo.destino!)}>{passo.botao}</Button>}
            </Flex>
            {outras.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 12, marginRight: 6 }}>Também falta:</Text>
                {outras.map((p, i) => (
                  <Tooltip key={i} title={`Abrir ${rotuloDestino(p.acao).toLowerCase()}`}>
                    <Tag color={GRAVIDADES[p.gravidade]} style={{ cursor: 'pointer', marginBottom: 3, whiteSpace: 'normal' }} onClick={() => irPara(p.acao)}>{p.texto}</Tag>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Segmented value={parte} onChange={v => setParte(v as ParteObra)}
          options={[{ value: 'ORCAMENTO', label: 'Orçamento e contrato' }, { value: 'RELATORIO', label: 'Relatório técnico' }, { value: 'PROCESSO', label: 'Processo e fotos' },
            { value: 'COBRANCA', label: 'Sinal e cobrança' },
            { value: 'MATERIAIS', label: 'Materiais' }]} />
        {parte !== 'RELATORIO' && <Button onClick={onVoltar}>Voltar para as obras</Button>}
      </Flex>
      {parte === 'RELATORIO'
        ? (
          <div style={{ margin: '0 -16px' }}>
            <RelatorioPocoPage key={versao} titulo={`Relatório técnico · obra ${obra.idObra}`} onVoltar={onVoltar}
              obra={{ dados: obra.relatorio || {}, salvar: dados => obrasApi.salvarRelatorio(obra.idObra, dados) }} />
          </div>
        )
        : parte === 'ORCAMENTO'
          ? <OrcamentoEContrato obra={obra} onMudou={() => { carregar(); setVersaoCobranca(v => v + 1); }} />
        : parte === 'PROCESSO'
          ? <ProcessoDaObra idObra={obra.idObra} cancelada={obra.situacao === 'CANCELADA'} />
        : parte === 'COBRANCA'
          ? <CobrancaDaObra key={versaoCobranca} idObra={obra.idObra} cancelada={obra.situacao === 'CANCELADA'} />
          : <MateriaisDaObra idObra={obra.idObra} cancelada={obra.situacao === 'CANCELADA'} />}
      <FechamentoModal aberto={!!fechando} inicial={obra} onFechar={() => setFechando(null)}
        titulo={fechando?.para ? `Como o contrato foi fechado? · ${SITUACOES_OBRA[fechando.para].acao}` : 'Contrato da obra'}
        okTexto={fechando?.para ? SITUACOES_OBRA[fechando.para].acao : 'Salvar'}
        onConfirmar={async f => {
          if (fechando?.para) { await mudar(fechando.para, f); return; }
          try { await obrasApi.definirContrato(obra.idObra, f); message.success('Contrato registrado.'); setFechando(null); carregar(); }
          catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
        }} />
      <ObraModal obra={editando ? obra : null} onFechar={() => setEditando(false)}
        onSalva={() => { setEditando(false); carregar(); setVersao(v => v + 1); setVersaoCobranca(v => v + 1); }} />
    </Space>
  );
};

const ListaObras: React.FC<{ onAbrir: (id: number) => void }> = ({ onAbrir }) => {
  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [situacao, setSituacao] = useState<SituacaoObra | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');
  const [nova, setNova] = useState(false);
  const [orcamento, setOrcamento] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setObras(await obrasApi.obras({ busca })); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [busca]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);
  const c = contarObras(obras);
  const visiveis = obras.filter(o => situacao === 'TODAS' || o.situacao === situacao);
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {(['ORCAMENTO', 'AGUARDANDO_SINAL', 'EM_EXECUCAO', 'CONCLUIDA'] as SituacaoObra[]).map(s => (
          <Col xs={12} md={6} key={s}>
            <Card size="small" hoverable onClick={() => setSituacao(situacao === s ? 'TODAS' : s)} style={situacao === s ? { borderColor: '#1677ff' } : undefined}>
              <Statistic title={SITUACOES_OBRA[s].texto} value={c[s]} valueStyle={s === 'AGUARDANDO_SINAL' && c[s] ? { color: '#d48806' } : undefined} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card size="small"
        title={<Input allowClear placeholder="Cliente, título, poço, cidade ou nº da obra" style={{ width: 320 }} value={busca} onChange={e => setBusca(e.target.value)} />}
        extra={<Space>
          <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
          <Button icon={<PlusOutlined />} onClick={() => setNova(true)}>Nova obra</Button>
          <Button type="primary" icon={<CalculatorOutlined />} onClick={() => setOrcamento(true)}>Orçamento rápido</Button>
        </Space>}>
        <Table<Obra>
          size="small" rowKey="idObra" loading={carregando} dataSource={visiveis} pagination={{ pageSize: 50, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhuma obra ainda" /> }}
          onRow={o => ({ onClick: () => onAbrir(o.idObra), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Nº', dataIndex: 'idObra', width: 60 },
            {
              title: 'Obra', render: (_, o) => (
                <div style={{ lineHeight: 1.35 }}>
                  <Text strong>{o.titulo || o.servicos.map(s => SERVICOS[s]).join(' + ')}</Text>
                  <div><Text type="secondary" style={{ fontSize: 12 }}>{o.cliente}{o.poco ? ` · ${o.poco}` : ''}{o.cidade ? ` · ${o.cidade}` : ''}</Text></div>
                </div>
              ),
            },
            { title: 'Serviços', width: 220, render: (_, o) => o.servicos.map(s => <Tag key={s} style={{ marginBottom: 2 }}>{SERVICOS[s]}</Tag>) },
            { title: 'Contratado', width: 120, align: 'right', render: (_, o) => brl(o.valorContratado) },
            { title: 'Datas', width: 150, render: (_, o) => <Text style={{ fontSize: 12 }}>{o.dataTermino ? `concluída ${dataBr(o.dataTermino)}` : o.dataInicio ? `iniciada ${dataBr(o.dataInicio)}` : `prevista ${dataBr(o.dataPrevisao)}`}</Text> },
            { title: 'Situação', width: 150, render: (_, o) => <Tag color={SITUACOES_OBRA[o.situacao].cor}>{SITUACOES_OBRA[o.situacao].texto}</Tag> },
          ]}
        />
      </Card>
      <ObraModal obra={nova ? 'nova' : null} onFechar={() => setNova(false)} onSalva={o => { setNova(false); onAbrir(o.idObra); }} />
      <OrcamentoRapido aberto={orcamento} onFechar={() => setOrcamento(false)} />
    </Space>
  );
};

const ListaPocos: React.FC<{ abrir?: number; pedido?: number }> = ({ abrir, pedido }) => {
  const [pocos, setPocos] = useState<Poco[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Poco | 'novo' | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try { setPocos(await obrasApi.pocos({ busca })); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, [busca]);
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [carregar]);
  useEffect(() => {
    if (!abrir) return;
    const achado = pocos.find(p => p.idPoco === abrir);
    if (achado) setEditando(achado);
    else obrasApi.pocos({}).then(l => { const p = l.find(x => x.idPoco === abrir); if (p) setEditando(p); }).catch(() => undefined);
  }, [abrir, pedido]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card size="small"
      title={<Input allowClear placeholder="Identificação, cidade, endereço ou proprietário" style={{ width: 320 }} value={busca} onChange={e => setBusca(e.target.value)} />}
      extra={<Space>
        <Tooltip title="Recarregar"><Button icon={<ReloadOutlined />} loading={carregando} onClick={carregar} /></Tooltip>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditando('novo')}>Novo poço</Button>
      </Space>}>
      <Table<Poco>
        size="small" rowKey="idPoco" loading={carregando} dataSource={pocos} pagination={{ pageSize: 50, hideOnSinglePage: true }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum poço ainda: eles nascem das obras de perfuração ou cadastre os que vocês atendem" /> }}
        onRow={p => ({ onClick: () => abrirFichaPoco(p.idPoco), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Poço', render: (_, p) => (
              <div style={{ lineHeight: 1.35 }}>
                <Text strong><AimOutlined /> {p.identificacao}</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>{[p.proprietario, p.cidade && `${p.cidade}${p.uf ? `/${p.uf}` : ''}`].filter(Boolean).join(' · ')}</Text></div>
              </div>
            ),
          },
          { title: 'Profundidade', width: 110, align: 'right', render: (_, p) => (p.profundidadeM ? `${p.profundidadeM} m` : '—') },
          { title: 'Vazão', width: 110, align: 'right', render: (_, p) => (p.vazaoLh ? `${Number(p.vazaoLh).toLocaleString('pt-BR')} L/h` : '—') },
          { title: 'NE / ND', width: 110, align: 'right', render: (_, p) => (p.nivelEstaticoM || p.nivelDinamicoM ? `${p.nivelEstaticoM ?? '—'} / ${p.nivelDinamicoM ?? '—'} m` : '—') },
          {
            title: 'Mapa', width: 70, align: 'center', render: (_, p) => (p.latitude !== null && p.longitude !== null
              ? <Tooltip title={`Ver no mapa (${p.latitude}, ${p.longitude})`}>
                  <Button size="small" type="text" icon={<EnvironmentOutlined style={{ color: '#389e0d' }} />}
                    onClick={e => { e.stopPropagation(); verNoMapa(p.latitude!, p.longitude!, p.idPoco); }} />
                </Tooltip>
              : <Tooltip title="Sem GPS"><Text type="secondary">—</Text></Tooltip>),
          },
          { title: 'Perfurado por', width: 130, render: (_, p) => (p.perfuradoPor === 'NOS' ? <Tag color="blue">nós</Tag> : p.perfuradoPor === 'TERCEIRO' ? <Tag>{p.perfuradoPorNome || 'terceiro'}</Tag> : <Tag>não sei</Tag>) },
          { title: 'Obras', dataIndex: 'obras', width: 70, align: 'center' },
          { title: 'Situação', width: 100, render: (_, p) => <Tag color={p.situacao === 'ATIVO' ? 'green' : 'default'}>{p.situacao === 'ATIVO' ? 'Ativo' : p.situacao === 'SECO' ? 'Seco' : 'Desativado'}</Tag> },
        ]}
      />
      <PocoModal poco={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar(); }} />
    </Card>
  );
};

const ObrasAba: React.FC = () => {
  const nav = useNavPocos();
  const [vista, setVista] = useState<VistaObras>(nav.vista || 'OBRAS');
  const [aberta, setAberta] = useState<number | null>(nav.abrirObra ?? null);
  const [parte, setParte] = useState(nav.parteObra);
  // pedidos vindos do mapa ou da ficha do cliente ("abrir obra", "ficha do poço", "ficha do cliente")
  useEffect(() => {
    if (nav.aba !== 'obras' || !nav.vista) return;
    setVista(nav.vista);
    setAberta(nav.abrirObra ?? null);
    setParte(nav.parteObra);
  }, [nav.pedido]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (aberta) return <ObraAberta key={`${aberta}-${nav.pedido}`} idObra={aberta} parte={parte} onVoltar={() => setAberta(null)} />;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {vista === 'OBRAS' && <ListaObras onAbrir={setAberta} />}
      {vista === 'POCOS' && <ListaPocos abrir={nav.abrirPoco} pedido={nav.pedido} />}
      {vista === 'CLIENTES' && <ListaClientes abrir={nav.abrirCliente} pedido={nav.pedido} />}
      {vista === 'RECEBER' && <AReceberObras />}
      {vista === 'MATERIAIS' && <CadastroMateriais />}
    </Space>
  );
};

export default ObrasAba;
