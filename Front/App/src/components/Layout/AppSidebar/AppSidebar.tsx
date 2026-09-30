import { useEffect, useMemo, useState } from "react";
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
  BellOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { ItemMenu, MENU_PRINCIPAL, itemDaRota } from "../menuRotas";

const { Text } = Typography;

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const paraItensAntd = (itens: ItemMenu[]): MenuProps['items'] =>
  itens.map(i => ({
    key: i.key,
    icon: i.icon,
    label: i.label,
    children: i.children ? paraItensAntd(i.children) : undefined,
  }));

export default function AppSidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Item e grupo da rota atual (sub-rotas também marcam o item certo)
  const atual = useMemo(() => itemDaRota(location.pathname), [location.pathname]);
  const grupoAtual = useMemo(
    () => MENU_PRINCIPAL.find(g => g.children?.some(c => c.key === atual?.item.key))?.key,
    [atual]
  );

  // Grupos abertos acompanham a navegação (sem fechar o que o usuário abriu)
  const [abertos, setAbertos] = useState<string[]>(grupoAtual ? [grupoAtual] : []);
  useEffect(() => {
    if (grupoAtual) setAbertos(prev => (prev.includes(grupoAtual) ? prev : [...prev, grupoAtual]));
  }, [grupoAtual]);

  const items = useMemo(() => paraItensAntd(MENU_PRINCIPAL), []);

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    if (!e.key.startsWith('grp:')) navigate(e.key);
  };

  // Configurações: telas ainda não implementadas (ficam desabilitadas até existirem)
  const configContent = (
    <Flex vertical gap={4} style={{ width: 220, padding: 4 }}>
      <Button type="text" disabled icon={<UserOutlined />} style={{ justifyContent: 'flex-start' }}>Meu Perfil</Button>
      <Button type="text" disabled icon={<ShopOutlined />} style={{ justifyContent: 'flex-start' }}>Dados da Empresa</Button>
      <Button type="text" disabled icon={<SlidersOutlined />} style={{ justifyContent: 'flex-start' }}>Preferências do Sistema</Button>
      <Button type="text" disabled icon={<BellOutlined />} style={{ justifyContent: 'flex-start' }}>Notificações</Button>
      <Button type="text" disabled icon={<QuestionCircleOutlined />} style={{ justifyContent: 'flex-start' }}>Ajuda e Suporte</Button>
      <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.06)', margin: '6px 0' }} />
      <Button type="text" danger disabled icon={<LogoutOutlined />} style={{ justifyContent: 'flex-start' }}>Encerrar Sessão</Button>
      <Text type="secondary" style={{ fontSize: 11, padding: '0 8px' }}>Em breve: estas telas ainda não existem.</Text>
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
      {/* LOGO & TOGGLE */}
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
        <Button type="text" style={{ color: '#fff' }} icon={isOpen ? <LeftOutlined /> : <RightOutlined />} onClick={toggleSidebar} />
      </Flex>

      {/* MENU */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isOpen && (
          <div style={{ padding: '12px 16px 4px 16px' }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
              MENU PRINCIPAL
            </Text>
          </div>
        )}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={atual ? [atual.item.key] : []}
          openKeys={isOpen ? abertos : undefined}
          onOpenChange={keys => setAbertos(keys as string[])}
          items={items}
          onClick={handleMenuClick}
          style={{ borderRight: 0, background: 'transparent' }}
          inlineCollapsed={!isOpen}
        />
      </div>

      {/* CONFIGURAÇÕES */}
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

// Próximas telas de configuração (roteiro):
// - Meu Perfil: dados, senha, cargo e permissões.
// - Dados da Empresa: razão social, CNPJ, IE/IM, endereço, logotipo (usado nas impressões).
// - Preferências: tema, formato de data/moeda, casas decimais, avisos sonoros.
// - Central de Notificações: estoque mínimo, NF autorizada, vendas; "marcar todas como lidas".
// - Ajuda e Suporte: documentação, contato, versão do ERP.
