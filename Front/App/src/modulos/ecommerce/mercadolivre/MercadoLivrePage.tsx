// E-commerce › Mercado Livre: central de anúncios (preparar, conferir e publicar) e a conexão da conta.
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Flex, Spin, Tabs, Tag, Typography } from 'antd';
import { ApiOutlined, ShopOutlined, ShoppingCartOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { mercadoLivreApi, StatusML } from './mercadoLivreApi';
import ContaMercadoLivre from './ContaMercadoLivre';
import AnunciosMercadoLivre from './AnunciosMercadoLivre';
import PedidosMercadoLivre from './PedidosMercadoLivre';

const { Title, Text } = Typography;

const MercadoLivrePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<StatusML | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try { setStatus(await mercadoLivreApi.status()); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro.'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const aba = params.get('aba') || (status && !status.conectado ? 'conta' : 'anuncios');
  const trocarAba = (k: string) => setParams(p => { p.set('aba', k); return p; }, { replace: true });

  return (
    <div style={{ padding: 24 }}>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 8 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><ShopOutlined /> Mercado Livre</Title>
          <Text type="secondary">Anúncios montados a partir do catálogo: o ERP aponta o que falta (fotos, categoria, atributos, preço) antes de publicar.</Text>
        </div>
        {status && (status.conectado
          ? <Tag color="green" style={{ fontSize: 13, padding: '2px 10px' }}>Conectado · {status.apelido}</Tag>
          : <Tag color="orange" style={{ fontSize: 13, padding: '2px 10px' }}>Conta não conectada</Tag>)}
      </Flex>
      {erro && <Alert type="error" showIcon message={erro} style={{ marginBottom: 16 }} />}
      <Spin spinning={carregando && !status}>
        <Tabs activeKey={aba} onChange={trocarAba} destroyOnHidden items={[
          {
            key: 'anuncios', label: <span><UnorderedListOutlined /> Anúncios</span>,
            children: status && !status.conectado
              ? <Alert type="warning" showIcon message="Conecte a conta do Mercado Livre na aba Conta para montar os anúncios (categorias e atributos vêm de lá)." />
              : <AnunciosMercadoLivre />,
          },
          {
            key: 'pedidos', label: <span><ShoppingCartOutlined /> Pedidos</span>,
            children: status && !status.conectado
              ? <Alert type="warning" showIcon message="Conecte a conta do Mercado Livre na aba Conta para receber os pedidos." />
              : <PedidosMercadoLivre />,
          },
          { key: 'conta', label: <span><ApiOutlined /> Conta</span>, children: <ContaMercadoLivre status={status} carregando={carregando} onAtualizar={carregar} /> },
        ]} />
      </Spin>
    </div>
  );
};

export default MercadoLivrePage;
