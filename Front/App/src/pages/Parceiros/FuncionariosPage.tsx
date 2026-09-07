import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Button,
  Input,
  Select,
  Table,
  Tag,
  Space,
  Breadcrumb,
  Avatar,
  Statistic,
  Dropdown,
  MenuProps,
  Modal,
  Form,
  DatePicker,
  Tooltip,
  Badge,
  message
} from 'antd';
import {
  IdcardOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  EditOutlined,
  EyeOutlined,
  UserDeleteOutlined,
  ExportOutlined,
  MailOutlined,
  PhoneOutlined,
  
  CalendarOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// --- Interface de Dados do Funcionário ---
interface Funcionario {
  key: string;
  codigo: string;
  nome: string;
  avatarUrl?: string;
  cargo: string;
  departamento: string;
  email: string;
  telefone: string;
  dataAdmissao: string;
  status: 'Ativo' | 'Férias' | 'Licença' | 'Inativo';
}

// --- Dados Mockados de Exemplo ---
const mockFuncionarios: Funcionario[] = [
  {
    key: '1',
    codigo: 'FUNC-001',
    nome: 'Carlos Eduardo Silva',
    cargo: 'Desenvolvedor Senior',
    departamento: 'Tecnologia',
    email: 'carlos.silva@empresa.com.br',
    telefone: '(11) 98765-4321',
    dataAdmissao: '15/03/2021',
    status: 'Ativo',
  },
  {
    key: '2',
    codigo: 'FUNC-002',
    nome: 'Ana Paula Oliveira',
    cargo: 'Gerente de RH',
    departamento: 'Recursos Humanos',
    email: 'ana.oliveira@empresa.com.br',
    telefone: '(11) 97654-3210',
    dataAdmissao: '10/01/2019',
    status: 'Ativo',
  },
  {
    key: '3',
    codigo: 'FUNC-003',
    nome: 'Roberto Almeida',
    cargo: 'Analista Financeiro',
    departamento: 'Financeiro',
    email: 'roberto.almeida@empresa.com.br',
    telefone: '(21) 99876-5432',
    dataAdmissao: '01/08/2022',
    status: 'Férias',
  },
  {
    key: '4',
    codigo: 'FUNC-004',
    nome: 'Mariana Costa',
    cargo: 'Coordenadora de Vendas',
    departamento: 'Comercial',
    email: 'mariana.costa@empresa.com.br',
    telefone: '(31) 98877-6655',
    dataAdmissao: '05/11/2020',
    status: 'Ativo',
  },
  {
    key: '5',
    codigo: 'FUNC-005',
    nome: 'Lucas Santos Ferraz',
    cargo: 'Assistente de Logística',
    departamento: 'Operações',
    email: 'lucas.ferraz@empresa.com.br',
    telefone: '(11) 91234-5678',
    dataAdmissao: '12/05/2023',
    status: 'Licença',
  },
  {
    key: '6',
    codigo: 'FUNC-006',
    nome: 'Fernanda Lima',
    cargo: 'Designer UX/UI',
    departamento: 'Tecnologia',
    email: 'fernanda.lima@empresa.com.br',
    telefone: '(11) 93456-7890',
    dataAdmissao: '20/09/2018',
    status: 'Inativo',
  },
];

// --- Estilos Reutilizáveis (Sem CSS Inline direto / Tailwind) ---
const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh',
  },
  headerCard: {
    marginBottom: '20px',
    borderRadius: '8px',
  },
  statCard: {
    borderRadius: '8px',
    height: '100%',
  },
  filterCard: {
    marginBottom: '16px',
    borderRadius: '8px',
  },
  tableCard: {
    borderRadius: '8px',
  },
  actionIcon: {
    fontSize: '16px',
    cursor: 'pointer',
    color: '#8c8c8c',
  },
};

export const FuncionariosPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // Filtragem local
  const filteredData = mockFuncionarios.filter((item) => {
    const matchesSearch =
      item.nome.toLowerCase().includes(searchText.toLowerCase()) ||
      item.codigo.toLowerCase().includes(searchText.toLowerCase()) ||
      item.cargo.toLowerCase().includes(searchText.toLowerCase());

    const matchesDept = departmentFilter ? item.departamento === departmentFilter : true;
    const matchesStatus = statusFilter ? item.status === statusFilter : true;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Função para renderizar as tags de status
  const renderStatusTag = (status: Funcionario['status']) => {
    const config = {
      Ativo: { color: 'green', text: 'Ativo' },
      Férias: { color: 'gold', text: 'Em Férias' },
      Licença: { color: 'blue', text: 'Licença' },
      Inativo: { color: 'red', text: 'Inativo' },
    };
    const { color, text } = config[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  // Ações de cada linha da tabela
  const getActionMenuItems = (record: Funcionario): MenuProps['items'] => [
    {
      key: 'view',
      label: 'Ver Detalhes',
      icon: <EyeOutlined />,
      onClick: () => message.info(`Visualizando detalhes de ${record.nome}`),
    },
    {
      key: 'edit',
      label: 'Editar Ficha',
      icon: <EditOutlined />,
      onClick: () => message.info(`Editando ${record.nome}`),
    },
    {
      type: 'divider',
    },
    {
      key: 'deactivate',
      label: record.status === 'Inativo' ? 'Reativar' : 'Desligar / Inativar',
      icon: <UserDeleteOutlined />,
      danger: record.status !== 'Inativo',
      onClick: () => message.warning(`Alterando status de ${record.nome}`),
    },
  ];

  // Definição das Colunas da Tabela
  const columns: ColumnsType<Funcionario> = [
    {
      title: 'Colaborador',
      dataIndex: 'nome',
      key: 'nome',
      sorter: (a, b) => a.nome.localeCompare(b.nome),
      render: (_, record) => (
        <Space size="middle">
          <Avatar 
            style={{ backgroundColor: '#1890ff' }}
            icon={<IdcardOutlined />}
          >
            {record.nome.charAt(0)}
          </Avatar>
          <div>
            <Text bold>{record.nome}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {record.codigo}
              </Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Cargo & Departamento',
      key: 'cargo_dept',
      render: (_, record) => (
        <div>
          <Text style={{ display: 'block' }}>{record.cargo}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.departamento}
          </Text>
        </div>
      ),
    },
    {
      title: 'Contatos',
      key: 'contatos',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            <MailOutlined style={{ marginRight: 6 }} />
            {record.email}
          </Text>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            <PhoneOutlined style={{ marginRight: 6 }} />
            {record.telefone}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Admissão',
      dataIndex: 'dataAdmissao',
      key: 'dataAdmissao',
      sorter: (a, b) => a.dataAdmissao.localeCompare(b.dataAdmissao),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: Funcionario['status']) => renderStatusTag(status),
    },
    {
      title: 'Ações',
      key: 'acoes',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={['click']}>
          <Button type="text" icon={<MoreOutlined style={styles.actionIcon} />} />
        </Dropdown>
      ),
    },
  ];

  const handleCreateSubmit = () => {
    form.validateFields().then((values) => {
      message.success('Funcionário cadastrado com sucesso!');
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  return (
    <div style={styles.container}>
      {/* Navegação por Breadcrumb */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>Dashboard</Breadcrumb.Item>
        <Breadcrumb.Item href="/parceiros">Parceiros de Negócio</Breadcrumb.Item>
        <Breadcrumb.Item>Funcionários</Breadcrumb.Item>
      </Breadcrumb>

      {/* Cabeçalho */}
      <Card style={styles.headerCard}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Title level={2} style={{ margin: 0 }}>
              Quadro de Funcionários
            </Title>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Gerencie cadastros, cargos, contatos e dados contratuais da equipe.
            </Paragraph>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ExportOutlined />}>Exportar</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsModalVisible(true)}
              >
                Novo Funcionário
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Resumo/Estatísticas em Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col xs={12} sm={6}>
          <Card style={styles.statCard} bodyStyle={{ padding: '16px 24px' }}>
            <Statistic
              title="Total de Colaboradores"
              value={mockFuncionarios.length}
              prefix={<IdcardOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={styles.statCard} bodyStyle={{ padding: '16px 24px' }}>
            <Statistic
              title="Ativos"
              value={mockFuncionarios.filter((f) => f.status === 'Ativo').length}
              valueStyle={{ color: '#3f8600' }}
              prefix={<UserDeleteOutlined style={{ marginRight: 8 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={styles.statCard} bodyStyle={{ padding: '16px 24px' }}>
            <Statistic
              title="Em Férias"
              value={mockFuncionarios.filter((f) => f.status === 'Férias').length}
              valueStyle={{ color: '#d4b106' }}
              prefix={<CalendarOutlined style={{ marginRight: 8 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={styles.statCard} bodyStyle={{ padding: '16px 24px' }}>
            <Statistic
              title="Afastados / Licença"
              value={mockFuncionarios.filter((f) => f.status === 'Licença').length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Barra de Filtros e Pesquisa */}
      <Card style={styles.filterCard} bodyStyle={{ padding: '16px' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={10} md={8}>
            <Input
              placeholder="Buscar por nome, código ou cargo..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={7} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Departamento"
              allowClear
              onChange={(value) => setDepartmentFilter(value)}
            >
              <Option value="Tecnologia">Tecnologia</Option>
              <Option value="Recursos Humanos">Recursos Humanos</Option>
              <Option value="Financeiro">Financeiro</Option>
              <Option value="Comercial">Comercial</Option>
              <Option value="Operações">Operações</Option>
            </Select>
          </Col>
          <Col xs={12} sm={7} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Status"
              allowClear
              onChange={(value) => setStatusFilter(value)}
            >
              <Option value="Ativo">Ativo</Option>
              <Option value="Férias">Em Férias</Option>
              <Option value="Licença">Licença</Option>
              <Option value="Inativo">Inativo</Option>
            </Select>
          </Col>
          {(searchText || departmentFilter || statusFilter) && (
            <Col xs={24} md={6}>
              <Button
                type="link"
                onClick={() => {
                  setSearchText('');
                  setDepartmentFilter(null);
                  setStatusFilter(null);
                }}
              >
                Limpar Filtros
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Tabela Principal */}
      <Card style={styles.tableCard} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20'],
            showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} funcionários`,
          }}
        />
      </Card>

      {/* Modal para Cadastro de Novo Funcionário */}
      <Modal
        title="Cadastrar Novo Funcionário"
        open={isModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setIsModalVisible(false)}
        okText="Salvar Cadastro"
        cancelText="Cancelar"
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="nome"
                label="Nome Completo"
                rules={[{ required: true, message: 'Informe o nome completo' }]}
              >
                <Input placeholder="Ex: João da Silva" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="cpf"
                label="CPF"
                rules={[{ required: true, message: 'Informe o CPF' }]}
              >
                <Input placeholder="000.000.000-00" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="E-mail Corporativo"
                rules={[
                  { required: true, message: 'Informe o e-mail' },
                  { type: 'email', message: 'E-mail inválido' },
                ]}
              >
                <Input placeholder="usuario@empresa.com.br" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="telefone" label="Telefone / Celular">
                <Input placeholder="(00) 00000-0000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cargo"
                label="Cargo"
                rules={[{ required: true, message: 'Informe o cargo' }]}
              >
                <Input placeholder="Ex: Analista de Sistemas" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="departamento"
                label="Departamento"
                rules={[{ required: true, message: 'Selecione o departamento' }]}
              >
                <Select placeholder="Selecione">
                  <Option value="Tecnologia">Tecnologia</Option>
                  <Option value="Recursos Humanos">Recursos Humanos</Option>
                  <Option value="Financeiro">Financeiro</Option>
                  <Option value="Comercial">Comercial</Option>
                  <Option value="Operações">Operações</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dataAdmissao"
                label="Data de Admissão"
                rules={[{ required: true, message: 'Selecione a data' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Selecione" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status Inicial" initialValue="Ativo">
                <Select>
                  <Option value="Ativo">Ativo</Option>
                  <Option value="Férias">Em Férias</Option>
                  <Option value="Licença">Licença</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default FuncionariosPage;