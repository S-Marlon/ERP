// Cabeçalho do PDV: enxuto (a tela do PDV mostra cliente, busca e último item bipado).
import { useEffect, useState } from "react";
import { Grid, Tooltip } from "antd";
import { darkColors, colors } from "../../../shared/styles/colors";
import { ListaTrabalhoBotao } from "../../../shared/core/listaTrabalho/ListaTrabalhoBotao";
import styles from "./PDVHeader.module.css";
import { CaixaIndicador, CaixaPaineis } from "../../../areas/vendas/caixa/CaixaPainel";
import { operadorAtual } from "../../../areas/vendas/caixa/caixaApi";

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
  // Janela estreita (ex.: meia tela): some com data, atalhos e relógio para não quebrar a linha
  const telas = Grid.useBreakpoint();

  return (
    <header className={styles.pdvHeader} style={{ borderBottomColor: themeColors.primary }}>
      <div className={styles.left}>
        <span className={styles.title}>🛒 PDV</span>
        {telas.lg && <div className={styles.divider} />}
        {telas.lg && (
          <span className={styles.empty}>
            {agora.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </div>

      <div className={styles.center}>
        <CaixaIndicador />
        {telas.xl && <span className={styles.empty} style={{ marginLeft: 10 }}>F2 finalizar · F3 buscar · F4 cliente</span>}
      </div>

      <div className={styles.right}>
        <ListaTrabalhoBotao />

        <Tooltip title={isDarkMode ? "Modo claro" : "Modo escuro"}>
          <button onClick={onThemeToggle} className={styles.btn}>
            {isDarkMode ? "🌙" : "☀️"}
          </button>
        </Tooltip>

        {telas.md && <span className={styles.clock}>{agora.toLocaleTimeString("pt-BR")}</span>}
        {telas.md && <div className={styles.divider} />}

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
