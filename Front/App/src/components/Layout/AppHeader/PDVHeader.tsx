import { useEffect, useState } from "react";
import { darkColors, colors } from "../../../styles/colors";
import styles from "./PDVHeader.module.css";

interface Cliente {
  nome: string;
  cnpj: string;
}

interface PDVHeaderProps {
  isDarkMode: boolean;
  onThemeToggle: () => void;
  lastScan?: any;
  operador?: string;
  cliente?: Cliente;
}

const PDVHeader: React.FC<PDVHeaderProps> = ({
  isDarkMode,
  onThemeToggle,
  lastScan,
  operador = "Operador não definido",
  cliente,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const themeColors = isDarkMode ? darkColors : colors;
  const notifications = 5; // Vem do contexto depois

  return (
    <header
      className={styles.pdvHeader}
      style={{ borderBottomColor: themeColors.primary }}
    >
      {/* LEFT - SISTEMA */}
      <div className={styles.left}>
        <span className={styles.title}>🛒 PDV</span>

  <div className={styles.divider} />

        <span className={styles.status}>● CAIXA ABERTO</span>
        
      </div>

      {/* CENTER - LAST SCAN */}
      <div className={styles.center}>
        {lastScan ? (
          <div className={styles.lastScan}>
            <span className={styles.check}>✔</span>
            <strong>{lastScan.name}</strong>
            <span>x{lastScan.quantity}</span>
            <span className={styles.price}>
              R$ {Number(lastScan.price).toFixed(2)}
            </span>
          </div>
        ) : (
          <span className={styles.empty}>Aguardando leitura...</span>
        )}
      </div>

      {/* RIGHT - CONTEXTO OPERACIONAL */}
      <div className={styles.right}>

       <div className={styles.clientWrapper}>
  <div className={styles.divider} />


  {/* CLIENTE */}
  <div className={styles.block}>
    <span className={styles.label}>Cliente</span>
    <span className={styles.value}>
      {cliente?.nome ?? "Consumidor"}
    </span>
  </div>

  <div className={styles.divider} />

  {/* CNPJ */}
  <div className={styles.block}>
    <span className={styles.label}>CNPJ</span>
    <span className={styles.value}>
      {cliente?.cnpj ?? "—"}
    </span>
  </div>

  <div className={styles.divider} />

</div>

        {/* AÇÕES */}
        <button onClick={onThemeToggle} className={styles.btn}>
          {isDarkMode ? "🌙" : "☀️"}
        </button>

       <button
  className={styles.btn}
  title="Marcar item para revisão ou ação futura"
  // onClick={handleAddToQueue}
>
  🏷️
</button>

{/* ITEMS MARCADOS
----------------------
⚠ Produto A → estoque baixo
🧾 Produto B → revisar preço
📦 Produto C → comprar reposição
🏷 Produto D → etiqueta incorreta */}

        <span className={styles.clock}>
          {currentTime.toLocaleTimeString("pt-BR")}
        </span>
  <div className={styles.divider} />

        {/* USUÁRIO */}
        {/* OPERADOR */}
        <div className={styles.block}>
          <span className={styles.label}>Operador</span>
          <span className={styles.value}>{operador}</span>
        </div>

         {/* NOTIFICAÇÕES */}
                 <button className={styles.iconBtn}>
                  🔔 {notifications}
                </button>
      </div>
    </header>
  );
};

export default PDVHeader;