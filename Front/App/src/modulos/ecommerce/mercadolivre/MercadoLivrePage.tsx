// Mercado Livre: conexão da conta (passo a passo) e as próximas etapas do módulo.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Flex, Input, Popconfirm, Result, Row, Space, Spin, Steps, Tag, Typography, message } from 'antd';
import { ApiOutlined, CheckCircleOutlined, DisconnectOutlined, LinkOutlined, ReloadOutlined, ShopOutlined } from '@ant-design/icons';
import { ContaML, mercadoLivreApi, StatusML } from './mercadoLivreApi';

const { Title, Text, Paragraph } = Typography;

const MercadoLivrePage: React.FC = () => {
  const [status, setStatus] = useState<StatusML | null>(null);
  const [conta, setConta] = useState<ContaML | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [endereco, setEndereco] = useState('');
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const s = await mercadoLivreApi.status();
      setStatus(s);
      setConta(s.conectado ? await mercadoLivreApi.conta().catch(e => { setErro(e.message); return null; }) : null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro.');
    } finally {
      setCarregando(false);
    }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const conectar = async () => {
    setConectando(true);
    try {
      const r = await mercadoLivreApi.conectar(endereco);
      message.success(`Conta ${r.apelido || ''} conectada.`);
      setEndereco('');
      carregar();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao conectar.');
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    try { await mercadoLivreApi.desconectar(); message.success('Conta desconectada.'); carregar(); } catch (e) { message.error(e instanceof Error ? e.message : 'Erro.'); }
  };

  const conexao = () => {
    if (!status) return null;
    if (!status.configurado) {
      return (
        <Result status="warning" title="Aplicativo do Mercado Livre não configurado"
          subTitle={<>Falta no <Text code>Backend/.env</Text>: {status.faltando.join(', ')}. Copie o <Text code>Backend/.env.exemplo</Text>, preencha com o App ID e a Secret do seu aplicativo (developers.mercadolivre.com.br › Meus aplicativos) e reinicie o backend.</>}
          extra={<Button icon={<ReloadOutlined />} onClick={carregar}>Verificar de novo</Button>} />
      );
    }
    if (!status.conectado) {
      return (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Steps direction="vertical" size="small" current={-1} items={[
            {
              title: 'Autorize o ERP no Mercado Livre',
              description: (
                <Space direction="vertical" size={4}>
                  <Text type="secondary">Abre a página do Mercado Livre: faça login com a conta da loja e clique em autorizar.</Text>
                  <Button type="primary" icon={<LinkOutlined />} href={status.urlAutorizacao || undefined} target="_blank">Autorizar no Mercado Livre</Button>
                </Space>
              ),
            },
            {
              title: 'Copie o endereço para onde o Mercado Livre voltou',
              description: <Text type="secondary">Depois de autorizar, o navegador abre <Text code>{status.redirectUri}</Text> com <Text code>?code=TG-...</Text> no fim do endereço. Copie o endereço inteiro da barra do navegador (a página em si pode ficar em branco ou dar erro, tudo bem).</Text>,
            },
            {
              title: 'Cole aqui e conecte',
              description: (
                <Space.Compact style={{ width: '100%', maxWidth: 680 }}>
                  <Input placeholder="https://www.google.com.br/?code=TG-...&state=..." value={endereco} onChange={e => setEndereco(e.target.value)} onPressEnter={conectar} />
                  <Button type="primary" icon={<ApiOutlined />} loading={conectando} disabled={!endereco.trim()} onClick={conectar}>Conectar</Button>
                </Space.Compact>
              ),
            },
          ]} />
          <Alert type="info" showIcon message="O código vale poucos minutos e só uma vez: se der erro, clique em Autorizar de novo e cole o endereço novo." />
        </Space>
      );
    }
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
            <Text strong style={{ fontSize: 16 }}>Conectado como {status.apelido || conta?.apelido}</Text>
            {conta?.mercadoLider && <Tag color="gold">MercadoLíder {conta.mercadoLider}</Tag>}
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={carregar} loading={carregando}>Testar conexão</Button>
            <Popconfirm title="Desconectar a conta?" description="Os anúncios continuam no Mercado Livre; o ERP para de sincronizar." okText="Desconectar" okButtonProps={{ danger: true }} onConfirm={desconectar}>
              <Button danger icon={<DisconnectOutlined />}>Desconectar</Button>
            </Popconfirm>
          </Space>
        </Flex>
        {conta && (
          <Descriptions size="small" bordered column={{ xs: 1, md: 2, xl: 3 }} items={[
            { key: 'id', label: 'Vendedor', children: <>{conta.apelido} <Text type="secondary">#{conta.id}</Text></> },
            { key: 'rep', label: 'Reputação', children: conta.reputacao },
            { key: 'vendas', label: 'Vendas concluídas', children: conta.vendasConcluidas },
            { key: 'anuncios', label: 'Anúncios na conta', children: conta.anuncios },
            { key: 'local', label: 'Local', children: [conta.cidade, conta.estado].filter(Boolean).join(' / ') || '—' },
            { key: 'link', label: 'Perfil', children: conta.link ? <a href={conta.link} target="_blank" rel="noreferrer">abrir no Mercado Livre</a> : '—' },
          ]} />
        )}
        {status.expiraEm && <Text type="secondary" style={{ fontSize: 12 }}>Acesso renovado automaticamente (próxima renovação até {new Date(status.expiraEm).toLocaleString('pt-BR')}).</Text>}
      </Space>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><ShopOutlined /> Mercado Livre</Title>
          <Text type="secondary">Anúncios a partir do catálogo, preço e estoque sincronizados e pedidos que viram venda no ERP.</Text>
        </div>
      </Flex>
      {erro && <Alert type="error" showIcon message={erro} style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="1. Conexão da conta">
            <Spin spinning={carregando && !status}>{conexao()}</Spin>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Próximas etapas">
            <Steps direction="vertical" size="small" current={status?.conectado ? 1 : 0} items={[
              { title: 'Conectar a conta', description: 'Autorização pela API (feito uma vez).' },
              { title: 'Fotos dos itens', description: 'Arraste as fotos na ficha do item (Catálogo › Produtos). O Mercado Livre exige ao menos uma.' },
              { title: 'Categoria e atributos por família', description: 'Sugestão da categoria do ML pelo título e o mapa dos atributos obrigatórios.' },
              { title: 'Pronto para anunciar', description: 'Pendências por item (foto, título até 60, peso/medidas, marca, GTIN).' },
              { title: 'Preço do canal e publicação', description: 'Comissão real do ML + frete + margem-alvo; publicar e ligar o código MLB.' },
              { title: 'Pedidos', description: 'Vendas pagas viram venda no ERP com baixa de estoque.' },
            ]} />
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>Em construção: estas etapas entram aos poucos nesta tela.</Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MercadoLivrePage;
