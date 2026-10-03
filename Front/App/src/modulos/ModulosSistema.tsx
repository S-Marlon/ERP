// Configurações › Módulos: liga e desliga os módulos plugáveis desta loja. Desligar só esconde as telas e
// bloqueia as rotas do módulo; os dados dele ficam guardados para quando for religado.
import React, { useState } from 'react';
import { Alert, Card, Empty, List, Space, Switch, Tag, Typography, message } from 'antd';
import { AppstoreAddOutlined } from '@ant-design/icons';
import { salvarModulo, useModulos } from './modulosStore';

const { Text, Title } = Typography;

const ModulosSistema: React.FC = () => {
  const { lista, carregado } = useModulos();
  const [salvando, setSalvando] = useState<string | null>(null);

  const alternar = async (codigo: string, ativo: boolean) => {
    setSalvando(codigo);
    try {
      await salvarModulo(codigo, ativo);
      message.success(ativo ? 'Módulo ligado.' : 'Módulo desligado (os dados continuam guardados).');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 860 }}>
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}><AppstoreAddOutlined /> Módulos</Title>
          <Text type="secondary">Recursos específicos de um ramo de loja. Ligue só o que esta loja usa.</Text>
        </div>
        <Alert type="info" showIcon message="Desligar um módulo esconde as telas e botões dele; vendas, estoque e caixa continuam iguais e os dados do módulo ficam guardados." />
        <Card size="small">
          {carregado && lista.length === 0 ? <Empty description="Nenhum módulo disponível (o backend está rodando?)" /> : (
            <List
              loading={!carregado}
              dataSource={lista}
              renderItem={m => (
                <List.Item actions={[
                  <Switch key="s" checked={m.ativo} loading={salvando === m.codigo} onChange={v => alternar(m.codigo, v)} checkedChildren="ligado" unCheckedChildren="desligado" />,
                ]}>
                  <List.Item.Meta
                    title={<Space>{m.nome}<Tag>{m.area}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{m.codigo}</Text></Space>}
                    description={m.descricao}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </div>
  );
};

export default ModulosSistema;
