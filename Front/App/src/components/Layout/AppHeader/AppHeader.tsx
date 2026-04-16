import styles from "./AppHeader.module.css";
import { useUI } from "../../../context/UIContext";
import { useLocation } from "react-router-dom";

const AppHeader = ({ title, onThemeToggle, isDarkMode }: any) => {
const { user, notifications } = useUI();

const safeUser = user ?? { name: "Usuário", role: "guest" };  const location = useLocation();

const isPDV = location.pathname === "/vendas/pdv";

  return (
    <header className={styles.header}>

      {/* ESQUERDA */}
      <div className={styles.left}>
        <h1>{title}</h1>
      </div>

      {/* CENTRO (BUSCA GLOBAL FUTURA) */}
      <div className={styles.center}>
        <input placeholder="Buscar cliente, produto, pedido..." />
      </div>

      {/* DIREITA */}
      <div className={styles.right}>

        {/* NOTIFICAÇÕES */}
       

        {/* TEMA */}
        <button onClick={onThemeToggle}>
          {isDarkMode ? "🌙" : "☀️"}
        </button>

        {/* USUÁRIO */}
        <div className={styles.user}>
            👤 {safeUser.name}
        </div>

 {/* NOTIFICAÇÕES */}
         <button className={styles.iconBtn}>
          🔔 {notifications}
        </button>

      </div>

    </header>
  );
};

export default AppHeader;