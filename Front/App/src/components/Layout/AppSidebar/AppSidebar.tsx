import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Button, Popover, Flex, Typography, Tooltip, Badge } from "antd";
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
import { useNotificacoes } from "../../../core/notificacoes/NotificacoesContext";

const { Text } = Typography;

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

// Grupo com tela principal: duplo clique no nome abre o painel do módulo (um clique só abre/fecha o grupo)
const paraItensAntd = (itens: ItemMenu[], abrirPainel: (rota: string) => void): MenuProps['items'] =>
  itens.map(i => ({
    key: i.key,
    icon: i.icon,
    label: i.children && i.rota
      ? (
        <Tooltip title="Duplo clique: abrir o painel" placement="right" mouseEnterDelay={0.8}>
          <span onDoubleClick={e => { e.stopPropagation(); abrirPainel(i.rota!); }} style={{ display: 'inline-block', width: '100%' }}>{i.label}</span>
        </Tooltip>
      )
      : i.label,
    children: i.children ? paraItensAntd(i.children, abrirPainel) : undefined,
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

  const items = useMemo(() => paraItensAntd(MENU_PRINCIPAL, rota => navigate(rota)), [navigate]);
  const { novas } = useNotificacoes();
  const [configAberto, setConfigAberto] = useState(false);
  const irPara = (rota: string) => { setConfigAberto(false); navigate(rota); };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    if (!e.key.startsWith('grp:')) navigate(e.key);
  };

  // Configurações
  const configContent = (
    <Flex vertical gap={4} style={{ width: 230, padding: 4 }}>
      <Button type="text" icon={<UserOutlined />} style={{ justifyContent: 'flex-start' }} onClick={() => irPara('/configuracoes/perfil')}>Meu Perfil</Button>
      <Button type="text" icon={<ShopOutlined />} style={{ justifyContent: 'flex-start' }} onClick={() => irPara('/configuracoes/empresa')}>Dados da Empresa</Button>
      <Button type="text" icon={<SlidersOutlined />} style={{ justifyContent: 'flex-start' }} onClick={() => irPara('/configuracoes/preferencias')}>Preferências do Sistema</Button>
      <Button type="text" icon={<BellOutlined />} style={{ justifyContent: 'flex-start' }} onClick={() => irPara('/configuracoes/notificacoes')}>
        Notificações {novas.length > 0 && <Badge count={novas.length} size="small" style={{ marginLeft: 6 }} />}
      </Button>
      <Button type="text" icon={<QuestionCircleOutlined />} style={{ justifyContent: 'flex-start' }} onClick={() => irPara('/ajuda')}>Ajuda e Suporte</Button>
      <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.06)', margin: '6px 0' }} />
      <Tooltip title="O sistema ainda não tem login" placement="right">
        <Button type="text" danger disabled icon={<LogoutOutlined />} style={{ justifyContent: 'flex-start' }}>Encerrar Sessão</Button>
      </Tooltip>
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
        <Popover content={configContent} trigger="click" placement="rightBottom" open={configAberto} onOpenChange={setConfigAberto}>
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

