// Telas de configuração: Meu Perfil, Dados da Empresa, Preferências, Central de Notificações e Ajuda.
// Perfil, empresa e preferências ficam salvos neste navegador até existir login e tabela de configurações.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Button, Card, Col, Divider, Empty, Form, Input, InputNumber, List, Row, Select, Space, Switch, Tag, Typography, message,
} from 'antd';
import {
  BellOutlined, BookOutlined, CheckOutlined, QuestionCircleOutlined, ReloadOutlined, SaveOutlined, ShopOutlined, SlidersOutlined, UserOutlined,
} from '@ant-design/icons';
import { useConfiguracoes } from '../../core/configuracoes/ConfiguracoesContext';
import { cnpjValido, DadosEmpresa, formatarCnpj, Perfil, Preferencias, TipoNotificacao } from '../../core/configuracoes/configuracoes';
import { useNotificacoes } from '../../core/notificacoes/NotificacoesContext';
import { TIPOS_NOTIFICACAO } from '../../core/notificacoes/notificacoes';

const { Text, Title, Paragraph } = Typography;
const COR_NIVEL = { critico: 'red', atencao: 'orange', info: 'blue' } as const;
const ROTULO_NIVEL = { critico: 'Crítico', atencao: 'Atenção', info: 'Aviso' } as const;

const Pagina: React.FC<{ icone: React.ReactNode; titulo: string; descricao: string; children: React.ReactNode; extra?: React.ReactNode }> =
  ({ icone, titulo, descricao, children, extra }) => (
    <div style={{ padding: 16, maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><Space>{icone}{titulo}</Space></Title>
          <Text type="secondary">{descricao}</Text>
        </div>
        {extra}
      </div>
      {children}
    </div>
  );

const AVISO_LOCAL = (
  <Alert type="info" showIcon style={{ marginBottom: 12 }}
    message="Salvo neste navegador" description="Ainda não há login nem tabela de configurações no banco: estes dados valem para este computador." />
);

// ---------------------------------------------------------------- Meu Perfil
export const MeuPerfil: React.FC = () => {
  const { config, salvar } = useConfiguracoes();
  const [form] = Form.useForm<Perfil>();
  useEffect(() => { form.setFieldsValue(config.perfil); }, [config.perfil, form]);
  const iniciais = (config.perfil.nome || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Pagina icone={<UserOutlined />} titulo="Meu Perfil" descricao="Seus dados no sistema (aparecem no cabeçalho).">
      {AVISO_LOCAL}
      <Card>
        <Row gutter={24}>
          <Col xs={24} md={6} style={{ textAlign: 'center' }}>
            <Avatar size={88} style={{ background: '#1677ff', fontSize: 32 }}>{iniciais}</Avatar>
            <div style={{ marginTop: 8, fontWeight: 600 }}>{config.perfil.nome}</div>
            <Text type="secondary">{config.perfil.cargo}</Text>
          </Col>
          <Col xs={24} md={18}>
            <Form form={form} layout="vertical" onFinish={v => { salvar('perfil', { ...config.perfil, ...v }); message.success('Perfil salvo.'); }}>
              <Row gutter={12}>
                <Col span={12}><Form.Item name="nome" label="Nome" rules={[{ required: true, message: 'Informe o nome' }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="cargo" label="Cargo / função"><Input placeholder="Ex.: Comprador, Caixa, Gerente" /></Form.Item></Col>
                <Col span={12}><Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'E-mail inválido' }]}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="telefone" label="Telefone"><Input /></Form.Item></Col>
              </Row>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Salvar</Button>
            </Form>
            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>Senha e permissões por usuário entram quando o login for implementado.</Text>
          </Col>
        </Row>
      </Card>
    </Pagina>
  );
};

// ---------------------------------------------------------------- Dados da Empresa
export const DadosDaEmpresa: React.FC = () => {
  const { config, salvar } = useConfiguracoes();
  const [form] = Form.useForm<DadosEmpresa>();
  useEffect(() => { form.setFieldsValue(config.empresa); }, [config.empresa, form]);
  const logo = Form.useWatch('logoUrl', form);

  return (
    <Pagina icone={<ShopOutlined />} titulo="Dados da Empresa" descricao="Identificação da empresa para impressões, etiquetas e documentos.">
      {AVISO_LOCAL}
      <Card>
        <Form form={form} layout="vertical" onFinish={v => { salvar('empresa', { ...config.empresa, ...v }); message.success('Dados da empresa salvos.'); }}>
          <Row gutter={12}>
            <Col xs={24} md={12}><Form.Item name="razaoSocial" label="Razão social" rules={[{ required: true, message: 'Informe a razão social' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="nomeFantasia" label="Nome fantasia"><Input /></Form.Item></Col>
            <Col xs={24} md={8}>
              <Form.Item name="cnpj" label="CNPJ" normalize={formatarCnpj}
                rules={[{ validator: (_, v) => (!v || cnpjValido(v) ? Promise.resolve() : Promise.reject(new Error('CNPJ inválido'))) }]}>
                <Input placeholder="00.000.000/0000-00" />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}><Form.Item name="inscricaoEstadual" label="Inscrição estadual"><Input /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="inscricaoMunicipal" label="Inscrição municipal"><Input /></Form.Item></Col>
            <Col xs={24} md={8}>
              <Form.Item name="regimeTributario" label="Regime tributário">
                <Select allowClear options={[{ value: 'SIMPLES', label: 'Simples Nacional' }, { value: 'PRESUMIDO', label: 'Lucro Presumido' }, { value: 'REAL', label: 'Lucro Real' }]} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}><Form.Item name="telefone" label="Telefone"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="email" label="E-mail" rules={[{ type: 'email', message: 'E-mail inválido' }]}><Input /></Form.Item></Col>
          </Row>
          <Divider titlePlacement="start" plain>Endereço</Divider>
          <Row gutter={12}>
            <Col xs={24} md={14}><Form.Item name="logradouro" label="Logradouro"><Input /></Form.Item></Col>
            <Col xs={8} md={4}><Form.Item name="numero" label="Número"><Input /></Form.Item></Col>
            <Col xs={16} md={6}><Form.Item name="bairro" label="Bairro"><Input /></Form.Item></Col>
            <Col xs={14} md={10}><Form.Item name="cidade" label="Cidade"><Input /></Form.Item></Col>
            <Col xs={4} md={4}><Form.Item name="uf" label="UF" normalize={(v: string) => String(v || '').toUpperCase().slice(0, 2)}><Input /></Form.Item></Col>
            <Col xs={6} md={6}><Form.Item name="cep" label="CEP"><Input /></Form.Item></Col>
          </Row>
          <Divider titlePlacement="start" plain>Logotipo</Divider>
          <Row gutter={12} align="middle">
            <Col xs={24} md={16}><Form.Item name="logoUrl" label="Endereço (URL) da imagem do logotipo"><Input placeholder="https://..." /></Form.Item></Col>
            <Col xs={24} md={8}>
              {logo ? <img src={logo} alt="Logotipo" style={{ maxHeight: 60, maxWidth: '100%' }} /> : <Text type="secondary">Sem logotipo</Text>}
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Salvar</Button>
        </Form>
      </Card>
    </Pagina>
  );
};

// ---------------------------------------------------------------- Preferências
export const PreferenciasSistema: React.FC = () => {
  const { config, salvar } = useConfiguracoes();
  const [form] = Form.useForm<Preferencias>();
  useEffect(() => { form.setFieldsValue(config.preferencias); }, [config.preferencias, form]);

  return (
    <Pagina icone={<SlidersOutlined />} titulo="Preferências do Sistema" descricao="Comportamento padrão das telas.">
      {AVISO_LOCAL}
      <Card>
        <Form form={form} layout="vertical" onFinish={v => { salvar('preferencias', { ...config.preferencias, ...v }); message.success('Preferências salvas.'); }}>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item name="itensPorPagina" label="Itens por página nas listas">
                <Select options={[20, 50, 100, 200].map(n => ({ value: n, label: n }))} />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}><Form.Item name="casasDecimaisPreco" label="Casas decimais de preço"><InputNumber min={2} max={4} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="casasDecimaisQuantidade" label="Casas decimais de quantidade"><InputNumber min={0} max={4} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={12}>
              <Form.Item name="somNoPdv" label="Som ao bipar no PDV" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="confirmarAoSairComAlteracoes" label="Confirmar ao sair de uma tela com alterações não salvas" valuePropName="checked"><Switch /></Form.Item>
            </Col>
          </Row>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            O tema claro/escuro é trocado pelo botão do cabeçalho. As preferências serão aplicadas às telas conforme forem atualizadas.
          </Text>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Salvar</Button>
        </Form>
      </Card>
    </Pagina>
  );
};

// ---------------------------------------------------------------- Central de Notificações
export const CentralNotificacoes: React.FC = () => {
  const navigate = useNavigate();
  const { config, salvar } = useConfiguracoes();
  const { todas, novas, carregando, atualizadoEm, recarregar, marcarTodasComoLidas, ehNova } = useNotificacoes();
  const [ativas, setAtivas] = useState(config.notificacoes.ativas);
  useEffect(() => { setAtivas(config.notificacoes.ativas); }, [config.notificacoes.ativas]);
  const alternar = (t: TipoNotificacao, v: boolean) => {
    const proximo = { ...ativas, [t]: v };
    setAtivas(proximo);
    salvar('notificacoes', { ...config.notificacoes, ativas: proximo });
  };

  return (
    <Pagina
      icone={<BellOutlined />}
      titulo="Central de Notificações"
      descricao="Avisos calculados a partir dos dados do sistema; cada um leva à tela que resolve."
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} loading={carregando} onClick={recarregar}>Atualizar</Button>
          <Button icon={<CheckOutlined />} disabled={novas.length === 0} onClick={marcarTodasComoLidas}>Marcar todas como lidas</Button>
        </Space>
      }
    >
      <Row gutter={14}>
        <Col xs={24} lg={15}>
          <Card size="small" title={`Avisos (${todas.length})`} extra={atualizadoEm && <Text type="secondary" style={{ fontSize: 11 }}>atualizado às {atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>}>
            {todas.length === 0 ? <Empty description="Nenhum aviso no momento." image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <List
                dataSource={todas}
                renderItem={n => (
                  <List.Item
                    style={{ cursor: 'pointer', background: ehNova(n) ? '#f0f7ff' : undefined, paddingLeft: 8, paddingRight: 8 }}
                    onClick={() => navigate(n.rota)}
                    actions={[<Button key="ir" size="small" type="link">Abrir</Button>]}
                  >
                    <List.Item.Meta
                      title={<Space size={6}><Tag color={COR_NIVEL[n.nivel]} style={{ margin: 0 }}>{ROTULO_NIVEL[n.nivel]}</Tag>{n.titulo}{ehNova(n) && <Tag color="blue" style={{ margin: 0 }}>novo</Tag>}</Space>}
                      description={n.descricao}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card size="small" title="O que avisar">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {(Object.keys(TIPOS_NOTIFICACAO) as TipoNotificacao[]).map(t => (
                <div key={t} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{TIPOS_NOTIFICACAO[t].rotulo}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{TIPOS_NOTIFICACAO[t].descricao}</Text>
                  </div>
                  <Switch size="small" checked={ativas[t] !== false} onChange={v => alternar(t, v)} />
                </div>
              ))}
              <Divider style={{ margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13 }}>Atualizar a cada</span>
                <Select
                  size="small"
                  style={{ width: 120 }}
                  value={config.notificacoes.intervaloMinutos}
                  onChange={v => salvar('notificacoes', { ...config.notificacoes, intervaloMinutos: v })}
                  options={[1, 5, 15, 30].map(m => ({ value: m, label: `${m} min` }))}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </Pagina>
  );
};

// ---------------------------------------------------------------- Ajuda e Suporte
export const AjudaSuporte: React.FC = () => {
  const navigate = useNavigate();
  const guias = [
    { titulo: 'Entrada de mercadorias por NF-e', texto: 'Importe o XML, vincule ou cadastre cada item, confira quantidades, revise e aprove. O estoque só muda na aprovação.', rota: '/compras/entrada-nfe' },
    { titulo: 'Corrigir uma entrada', texto: 'Em Notas de Entrada, abra a nota e use "Corrigir" na linha para trocar o item ou a conversão. Há simulação antes de gravar.', rota: '/compras/notas' },
    { titulo: 'Catálogo (PIM)', texto: 'Categoria → Família (DNA, grade, ficha) → Item → Preço → PDV. Itens com cadastro incompleto aparecem em Pendências do PIM.', rota: '/catalogo' },
    { titulo: 'Preços', texto: 'Na Precificação veja custo, preço e margem; clique no item para ajustar unidades de venda e faixas de atacado.', rota: '/catalogo/preco' },
    { titulo: 'Estoque por depósito', texto: 'Venda (aparece no PDV), Almoxarifado (uso interno) e Patrimônio. Transferências e consumo interno na Consulta de Saldo.', rota: '/estoque/consulta' },
    { titulo: 'Lista de trabalho', texto: 'O carrinho do cabeçalho guarda itens para etiquetar, comprar ou conferir enquanto você navega entre as telas.', rota: '/estoque/etiquetagem' },
  ];
  const atalhos = [
    ['/', 'Ir para uma tela (busca do cabeçalho)'],
    ['Duplo clique no módulo', 'Abre o painel do módulo na barra lateral'],
  ];
  return (
    <Pagina icone={<QuestionCircleOutlined />} titulo="Ajuda e Suporte" descricao="Guias rápidos das rotinas do ERP.">
      <Row gutter={[12, 12]}>
        {guias.map(g => (
          <Col key={g.titulo} xs={24} md={12}>
            <Card size="small" hoverable onClick={() => navigate(g.rota)} style={{ height: '100%' }}>
              <Space><BookOutlined style={{ color: '#1677ff' }} /><Text strong>{g.titulo}</Text></Space>
              <Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0' }}>{g.texto}</Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}>
          <Card size="small" title="Atalhos">
            {atalhos.map(([tecla, acao]) => (
              <div key={tecla} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                <Tag style={{ fontFamily: 'monospace' }}>{tecla}</Tag><span>{acao}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="Sobre">
            <div style={{ fontSize: 13 }}>ERP Core System</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Documentação técnica da entrada por NF no repositório: <Text code>docs/entrada-nf.md</Text>.
            </Text>
          </Card>
        </Col>
      </Row>
    </Pagina>
  );
};
