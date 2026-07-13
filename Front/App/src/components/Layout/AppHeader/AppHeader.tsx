import React from "react";
import { useLocation } from "react-router-dom";
import { Input, Badge, Tooltip, Avatar } from "antd";
import { 
  SearchOutlined, 
  BellOutlined, 
  SunOutlined, 
  MoonOutlined, 
  UserOutlined 
} from "@ant-design/icons";
import { useUI } from "../../../context/UIContext";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  title: string;
  onThemeToggle: () => void;
  isDarkMode: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title, onThemeToggle, isDarkMode }) => {
  const { user, notifications } = useUI();
  const location = useLocation();

  const safeUser = user ?? { name: "Usuário", role: "guest" };
  const isPDV = location.pathname === "/vendas/pdv";

  // Retorna as iniciais do nome do usuário para o Avatar caso não tenha foto
  const getUserInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <header className={styles.header}>
      
      {/* ESQUERDA - Título Dinâmico da Tela */}
      <div className={styles.left}>
        <h1 className={styles.titleText}>{title}</h1>
      </div>

      {/* CENTRO - Busca Global Avançada */}
      <div className={styles.center}>
        <Input 
          placeholder="Buscar cliente, produto, pedido... (Pressione /)" 
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />} 
          className={styles.globalSearch}
          allowClear
        />
      </div>

      {/* DIREITA - Ações de Controle e Perfil */}
      <div className={styles.right}>
        
        {/* Alternador de Tema (Dark / Light) */}
        <Tooltip title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}>
          <button onClick={onThemeToggle} className={styles.iconBtn}>
            {isDarkMode ? (
              <SunOutlined style={{ fontSize: "18px", color: "#ffbc05" }} />
            ) : (
              <MoonOutlined style={{ fontSize: "18px", color: "#595959" }} />
            )}
          </button>
        </Tooltip>

        {/* Central de Notificações com Badge Inteligente */}
        <Tooltip title="Notificações">
          <button className={styles.iconBtn}>
            <Badge count={notifications?.length || 0} size="small" overflowCount={99}>
              <BellOutlined style={{ fontSize: "19px", color: isDarkMode ? "#fff" : "#595959" }} />
            </Badge>
          </button>
        </Tooltip>

        {/* Divisor Visual Sutil (Opcional, caso seu CSS dê suporte) */}
        <span className={styles.divider} />

        {/* Perfil do Usuário Logado */}
        <div className={styles.user}>
          <Avatar 
            size="small" 
            icon={<UserOutlined />} 
            style={{ backgroundColor: "#1890ff", marginRight: "8px" }}
          >
            {getUserInitials(safeUser.name)}
          </Avatar>
          <span className={styles.userName}>{safeUser.name}</span>
        </div>

      </div>

    </header>
  );
};

export default AppHeader;