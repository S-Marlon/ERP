import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Button, Popover, Flex, Typography } from "antd";
import type { MenuProps } from "antd";
import { 
  LeftOutlined, 
  RightOutlined, 
  SettingOutlined, 
  UserOutlined, 
  ShopOutlined, 
  SlidersOutlined, 
  LogoutOutlined,
  HomeOutlined,
  TeamOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  ShoppingCartOutlined,
  ShopTwoTone,
  FileTextOutlined,
  InboxOutlined,
  ToolOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  DollarOutlined
} from "@ant-design/icons";

const { Text } = Typography;

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function AppSidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  const getSelectedKey = () => {
    return location.pathname;
  };

  const getOpenKey = () => {
    if (location.pathname.startsWith('/estoque')) return ['/estoque'];
    return [];
  };

  const items: MenuProps['items'] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/parceiros',
      icon: <TeamOutlined />,
      label: 'Parceiros',
    },
     {
      key: '/financeiro',
      icon: <DollarOutlined />,
      label: 'Financeiro',
    },
    {
      key: '/produtos',
      icon: <ShoppingOutlined />,
      label: 'Produtos',
    },
    {
      key: '/catalogo',
      icon: <AppstoreOutlined />,
      label: 'Catálogo',
    },
    {
      key: '/compras',
      icon: <ShoppingCartOutlined />,
      label: 'Compras',
    },
    {
      key: '/vendas',
      icon: <ShopTwoTone />,
      label: 'Vendas',
    },
    {
      key: '/relatorios',
      icon: <FileTextOutlined />,
      label: 'Relatórios',
    },
    {
      key: '/estoque',
      icon: <InboxOutlined />,
      label: 'Estoque',
      children: [
        { key: '/estoque/consulta', label: 'Consulta de Saldo' },
        { key: '/estoque/notas', label: 'Notas Fiscais' },
        { key: '/estoque/operacoes', label: 'Movimentações' },
        { key: '/estoque/etiquetagem', label: 'Etiquetagem' },
      ],
    },
    {
      key: '/obras',
      icon: <ToolOutlined />,
      label: 'Obras / Projetos',
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

const configContent = (
    <Flex vertical gap={4} style={{ width: 220, padding: 4 }}>
      <Button type="text" icon={<UserOutlined />} style={{ justifyContent: 'flex-start' }}>
        Meu Perfil
      </Button>
      <Button type="text" icon={<ShopOutlined />} style={{ justifyContent: 'flex-start' }}>
        Dados da Empresa
      </Button>
      <Button type="text" icon={<SlidersOutlined />} style={{ justifyContent: 'flex-start' }}>
        Preferências do Sistema
      </Button>
      <Button type="text" icon={<BellOutlined />} style={{ justifyContent: 'flex-start' }}>
        Notificações
      </Button>
      <Button type="text" icon={<QuestionCircleOutlined />} style={{ justifyContent: 'flex-start' }}>
        Ajuda e Suporte
      </Button>
      
      <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.06)', margin: '6px 0' }} />
      
      <Button type="text" danger icon={<LogoutOutlined />} style={{ justifyContent: 'flex-start' }}>
        Encerrar Sessão
      </Button>
    </Flex>
  );

  return (
    <Flex 
      vertical 
      justify="space-between" 
      style={{ 
        height: '100%', 
        color: '#fff',
        overflow: 'hidden', 
        background: 'linear-gradient(180deg, #9c2e2e 0%, #712626 35%, #1e0d0d 85%, #0f0606 100%)' 
      }}
    >
      
      {/* HEADER / LOGO & TOGGLE */}
      <Flex 
        align="center" 
        justify={isOpen ? "space-between" : "center"} 
        style={{ padding: '12px 16px', minHeight: 50, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        {isOpen && (
          <Flex align="center" gap={8}>
            <div style={{ background: '#1677ff', color: '#fff', fontWeight: 'bold', padding: '2px 8px', borderRadius: 4 }}>ERP</div>
            <Text strong style={{ color: '#fff', whiteSpace: 'nowrap' }}>Core System</Text>
          </Flex>
        )}
        <Button 
          type="text" 
          style={{ color: '#fff' }}
          icon={isOpen ? <LeftOutlined /> : <RightOutlined />} 
          onClick={toggleSidebar} 
        />
      </Flex>

      {/* NAVIGATION MENU */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isOpen && (
          <div style={{ padding: '12px 16px 4px 16px' }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
              MENU PRINCIPAL
            </Text>
          </div>
        )}
        
        {/* Usando theme="dark" e background transparente para o gradiente aparecer no menu */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          defaultOpenKeys={getOpenKey()}
          items={items}
          onClick={handleMenuClick}
          style={{ borderRight: 0, background: 'transparent' }}
          inlineCollapsed={!isOpen}
        />
      </div>

      {/* FOOTER / CONFIGURAÇÕES */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <Popover content={configContent} trigger="click" placement="rightBottom">
          <Button 
            type="text" 
            icon={<SettingOutlined />} 
            style={{ width: '100%', color: '#fff', justifyContent: isOpen ? 'flex-start' : 'center' }}
          >
            {isOpen && <span style={{ marginLeft: 8 }}>Configurações</span>}
          </Button>
        </Popover>
      </div>

    </Flex>
  );
}


// 1. Botões Recomendados para Adicionar
// Central de Notificações / Alertas (para ver avisos do sistema, estoque baixo, notas pendentes)

// Ajuda / Documentação / Suporte (essencial para abrir chamados ou ver manuais)

// Versão / Sobre o Sistema (para auditoria e suporte técnico)

// 2. O que deve ter em cada tela/funcionalidade
// 👤 Meu Perfil
// Funcionalidades:

// Alteração de dados cadastrais (Nome, E-mail, Telefone, Foto de perfil).

// Alteração de senha de acesso.

// Visualização do cargo/perfil atual (ex: Administrador) e permissões vinculadas.

// 🏢 Dados da Empresa
// Funcionalidades:

// Informações fiscais e cadastrais (Razão Social, CNPJ, Inscrição Estadual/Municipal).

// Endereço completo e contatos comerciais.

// Upload do logotipo da empresa (usado em relatórios e impressões de notas/orçamentos).

// ⚙️ Preferências do Sistema
// Funcionalidades:

// Alternância de tema (Claro / Escuro).

// Configurações regionais (formato de data, moeda padrão - R$, número de casas decimais para valores e quantidades).

// Preferências de notificações sonoras ou visuais.

// 🔔 Central de Notificações (Novo)
// Funcionalidades:

// Lista de alertas recentes (ex: "Produto X atingiu o estoque mínimo", "Nota fiscal autorizada", "Nova venda realizada").

// Botão de "Marcar todas como lidas".

// ❓ Ajuda e Suporte (Novo)
// Funcionalidades:

// Links rápidos para a documentação ou base de conhecimento.

// Canal de contato com o suporte técnico (E-mail, WhatsApp ou abertura de ticket).

// Exibição da Versão atual do ERP (ex: v2.4.1).