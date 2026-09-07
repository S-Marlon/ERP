import React from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Typography, 
  Button, 
  Statistic, 
  Badge, 
  Space, 
  Breadcrumb, 
  Tooltip 
} from 'antd';
import { 
  UserOutlined, 
  ShopOutlined, 
  IdcardOutlined, 
  TeamOutlined, 
  ArrowRightOutlined, 
  LockOutlined, 
  UserAddOutlined,
  SolutionOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// --- Estilos Isolados (Sem CSS Inline / Tailwind) ---
const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  headerCard: {
    marginBottom: '24px',
    borderRadius: '8px',
  },
  cardAction: {
    borderRadius: '8px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    transition: 'all 0.3s ease',
  },
  cardDisabled: {
    borderRadius: '8px',
    height: '100%',
    backgroundColor: '#fafafa',
    borderColor: '#f0f0f0',
    opacity: 0.7,
  },
  iconWrapper: {
    fontSize: '32px',
    padding: '12px',
    borderRadius: '8px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  footerAction: {
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
};

export const ParceirosDashboard: React.FC = () => {

  // Handlers para navegação (substituir por seu router, ex: useNavigate do react-router-dom)
  const handleNavigate = (path: string) => {
    console.log(`Navegando para: ${path}`);
  };

  return (
    <div style={styles.container}>
      {/* Navegação e Cabeçalho */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>Dashboard</Breadcrumb.Item>
        <Breadcrumb.Item>Parceiros de Negócio</Breadcrumb.Item>
      </Breadcrumb>

      <Card style={styles.headerCard}>
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Gestão de Parceiros
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Gerencie relacionamentos com clientes, fornecedores, colaboradores e outros contatos estratégicos.
            </Paragraph>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<UserAddOutlined size={16} />}>
                Novo Parceiro
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Grid Principal de Módulos */}
      <Row gutter={[24, 24]}>

        {/* 1. CLIENTES */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card 
            hoverable 
            style={styles.cardAction}
            onClick={() => handleNavigate('/parceiros/clientes')}
          >
            <div>
              <div style={{ ...styles.iconWrapper, backgroundColor: '#e6f7ff', color: '#1890ff' }}>
                <UserOutlined />
              </div>
              <Title level={4}>Clientes</Title>
              <Paragraph type="secondary">
                Base de clientes ativos, histórico de compras, crédito e contatos.
              </Paragraph>
            </div>
            <div style={styles.footerAction}>
              <Statistic title="Cadastrados" value={1240} groupSeparator="." />
              <Button href='/parceiros/clientes' type="link" icon={<ArrowRightOutlined />}>Acessar</Button>
            </div>
          </Card>
        </Col>

        {/* 2. FORNECEDORES */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card 
            hoverable 
            style={styles.cardAction}
            onClick={() => handleNavigate('/parceiros/fornecedores')}
          >
            <div>
              <div style={{ ...styles.iconWrapper, backgroundColor: '#f6ffed', color: '#52c41a' }}>
                <ShopOutlined />
              </div>
              <Title level={4}>Fornecedores</Title>
              <Paragraph type="secondary">
                Gestão de compras, parceiros de insumos, serviços e cotações.
              </Paragraph>
            </div>
            <div style={styles.footerAction}>
              <Statistic title="Cadastrados" value={312} groupSeparator="." />
              <Button href='/parceiros/fornecedores' type="link" icon={<ArrowRightOutlined />}>Acessar</Button>
            </div>
          </Card>
        </Col>

        {/* 3. FUNCIONÁRIOS / COLABORADORES */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card 
            hoverable 
            style={styles.cardAction}
            onClick={() => handleNavigate('/parceiros/funcionarios')}
          >
            <div>
              <div style={{ ...styles.iconWrapper, backgroundColor: '#fff7e6', color: '#fa8c16' }}>
                <IdcardOutlined />
              </div>
              <Title level={4}>Funcionários</Title>
              <Paragraph type="secondary">
                Quadro de colaboradores, dados contratuais e cargos internos.
              </Paragraph>
            </div>
            <div style={styles.footerAction}>
              <Statistic title="Ativos" value={85} groupSeparator="." />
              <Button href='/parceiros/funcionarios' type="link" icon={<ArrowRightOutlined />}>Acessar</Button>
            </div>
          </Card>
        </Col>

        {/* 4. MÓDULO EM BREVE: Transportadoras (Exemplo Cinza / Desabilitado) */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Tooltip title="Módulo em desenvolvimento">
            <Card style={styles.cardDisabled}>
              <div>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ ...styles.iconWrapper, backgroundColor: '#f5f5f5', color: '#bfbfbf' }}>
                    <TeamOutlined />
                  </div>
                  <Badge count="Em Breve" style={{ backgroundColor: '#d9d9d9', color: '#595959' }} />
                </Space>
                <Title level={4} style={{ color: '#8c8c8c' }}>Transportadoras</Title>
                <Paragraph style={{ color: '#bfbfbf' }}>
                  Gestão de fretes, parceiros logísticos e tabelas de frete contratadas.
                </Paragraph>
              </div>
              <div style={styles.footerAction}>
                <Text type="secondary"><LockOutlined /> Indisponível</Text>
              </div>
            </Card>
          </Tooltip>
        </Col>

        {/* 5. MÓDULO EM BREVE: Representantes / Comissionados */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Tooltip title="Módulo em desenvolvimento">
            <Card style={styles.cardDisabled}>
              <div>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ ...styles.iconWrapper, backgroundColor: '#f5f5f5', color: '#bfbfbf' }}>
                    <SolutionOutlined />
                  </div>
                  <Badge count="Em Breve" style={{ backgroundColor: '#d9d9d9', color: '#595959' }} />
                </Space>
                <Title level={4} style={{ color: '#8c8c8c' }}>Representantes</Title>
                <Paragraph style={{ color: '#bfbfbf' }}>
                  Controle de vendedores externos, regras de comissionamento e metas.
                </Paragraph>
              </div>
              <div style={styles.footerAction}>
                <Text type="secondary"><LockOutlined /> Indisponível</Text>
              </div>
            </Card>
          </Tooltip>
        </Col>

      </Row>
    </div>
  );
};

export default ParceirosDashboard;