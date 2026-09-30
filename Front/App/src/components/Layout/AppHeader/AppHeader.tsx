import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AutoComplete, Input, Badge, Tooltip, Avatar } from "antd";
import {
  SearchOutlined,
  BellOutlined,
  SunOutlined,
  MoonOutlined,
  UserOutlined
} from "@ant-design/icons";
import { useUI } from "../../../context/UIContext";
import { ListaTrabalhoBotao } from "../../../core/listaTrabalho/ListaTrabalhoBotao";
import { MENU_PRINCIPAL, tituloDaRota } from "../menuRotas";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  title?: string;
  headerHeight?: number;
  onThemeToggle: () => void;
  isDarkMode: boolean;
}

// Telas do menu para a busca "Ir para..."
const TELAS = MENU_PRINCIPAL.flatMap(g => (g.children
  ? g.children.map(c => ({ rota: c.key, rotulo: `${g.label} › ${c.label}` }))
  : [{ rota: g.key, rotulo: g.label }]));

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const AppHeader: React.FC<AppHeaderProps> = ({ title, onThemeToggle, isDarkMode }) => {
  const { user, notifications } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const safeUser = user ?? { name: "Usuário", role: "guest" };

  // Título da tela atual (vem do mapa do menu)
  const titulo = tituloDaRota(location.pathname) || title || "ERP";

  // Contador: o contexto guarda um número (antes era lido como lista e sempre dava 0)
  const qtdNotificacoes = typeof notifications === "number" ? notifications : 0;

  // Busca "Ir para...": atalho "/" foca o campo
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<any>(null);
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      const digitando = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (e.key === "/" && !digitando) { e.preventDefault(); buscaRef.current?.focus(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
  const opcoes = useMemo(() => {
    const termo = semAcento(busca.trim());
    return TELAS
      .filter(t => !termo || semAcento(t.rotulo).includes(termo))
      .slice(0, 12)
      .map(t => ({ value: t.rota, label: t.rotulo }));
  }, [busca]);

  const getUserInitials = (name: string) => name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const corIcone = isDarkMode ? "#fff" : "#595959";

  return (
    <header className={styles.header}>
      {/* ESQUERDA - título da tela atual */}
      <div className={styles.left}>
        <h1 className={styles.titleText}>{titulo}</h1>
      </div>

      {/* CENTRO - ir para uma tela */}
      <div className={styles.center}>
        <AutoComplete
          value={busca}
          options={opcoes}
          onChange={setBusca}
          onSelect={(rota: string) => { setBusca(""); navigate(rota); buscaRef.current?.blur(); }}
          style={{ width: "100%" }}
        >
          <Input
            ref={buscaRef}
            placeholder="Ir para uma tela... (pressione /)"
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            className={styles.globalSearch}
            allowClear
          />
        </AutoComplete>
      </div>

      {/* DIREITA - ações e perfil */}
      <div className={styles.right}>
        <ListaTrabalhoBotao cor={corIcone} />

        <Tooltip title={isDarkMode ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}>
          <button onClick={onThemeToggle} className={styles.iconBtn}>
            {isDarkMode ? <SunOutlined style={{ fontSize: "18px", color: "#ffbc05" }} /> : <MoonOutlined style={{ fontSize: "18px", color: "#595959" }} />}
          </button>
        </Tooltip>

        <Tooltip title="Notificações (em breve)">
          <button className={styles.iconBtn}>
            <Badge count={qtdNotificacoes} size="small" overflowCount={99}>
              <BellOutlined style={{ fontSize: "19px", color: corIcone }} />
            </Badge>
          </button>
        </Tooltip>

        <span className={styles.divider} />

        <div className={styles.user}>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: "#1890ff", marginRight: "8px" }}>
            {getUserInitials(safeUser.name)}
          </Avatar>
          <span className={styles.userName}>{safeUser.role}</span> - <span className={styles.userName}>{safeUser.name}</span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
