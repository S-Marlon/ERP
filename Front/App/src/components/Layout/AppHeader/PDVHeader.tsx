// Cabeçalho do PDV: enxuto (a tela do PDV mostra cliente, busca e último item bipado).
import { useEffect, useState } from "react";
import { Tooltip } from "antd";
import { darkColors, colors } from "../../../styles/colors";
import { useUI } from "../../../context/UIContext";
import { ListaTrabalhoBotao } from "../../../core/listaTrabalho/ListaTrabalhoBotao";
import styles from "./PDVHeader.module.css";

interface PDVHeaderProps {
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

const PDVHeader: React.FC<PDVHeaderProps> = ({ isDarkMode, onThemeToggle }) => {
  const { user } = useUI();
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const themeColors = isDarkMode ? darkColors : colors;

  return (
    <header className={styles.pdvHeader} style={{ borderBottomColor: themeColors.primary }}>
      <div className={styles.left}>
        <span className={styles.title}>🛒 PDV</span>
        <div className={styles.divider} />
        <span className={styles.empty}>
          {agora.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
        </span>
      </div>

      <div className={styles.center}>
        <span className={styles.empty}>F2 finalizar · F3 buscar · F4 cliente</span>
      </div>

      <div className={styles.right}>
        <ListaTrabalhoBotao />

        <Tooltip title={isDarkMode ? "Modo claro" : "Modo escuro"}>
          <button onClick={onThemeToggle} className={styles.btn}>
            {isDarkMode ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        <span className={styles.clock}>{agora.toLocaleTimeString("pt-BR")}</span>
        <div className={styles.divider} />

        <div className={styles.block}>
          <span className={styles.label}>Operador</span>
          <span className={styles.value}>{user?.name || "Operador"}</span>
        </div>
      </div>
    </header>
  );
};

export default PDVHeader;
