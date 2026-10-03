// Cabeçalho do PDV: enxuto (a tela do PDV mostra cliente, busca e último item bipado).
import { useEffect, useState } from "react";
import { Tooltip } from "antd";
import { darkColors, colors } from "../../../styles/colors";
import { ListaTrabalhoBotao } from "../../../core/listaTrabalho/ListaTrabalhoBotao";
import styles from "./PDVHeader.module.css";
import { CaixaIndicador, CaixaPaineis } from "../../../pages/PDV/caixa/CaixaPainel";
import { operadorAtual } from "../../../pages/PDV/caixa/caixaApi";

interface PDVHeaderProps {
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

const PDVHeader: React.FC<PDVHeaderProps> = ({ isDarkMode, onThemeToggle }) => {
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
        <CaixaIndicador />
        <span className={styles.empty} style={{ marginLeft: 10 }}>F2 finalizar · F3 buscar · F4 cliente</span>
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
          <span className={styles.value}>{operadorAtual()}</span>
        </div>
      </div>
      <CaixaPaineis />
    </header>
  );
};

export default PDVHeader;
