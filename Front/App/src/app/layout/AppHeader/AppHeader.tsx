import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AutoComplete, Input, Badge, Tooltip, Avatar, Popover, Button, Empty, Tag, Spin } from "antd";
import {
  SearchOutlined,
  BellOutlined,
  SunOutlined,
  MoonOutlined,
  UserOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { useConfiguracoes } from "../../../shared/core/configuracoes/ConfiguracoesContext";
import { useNotificacoes } from "../../../shared/core/notificacoes/NotificacoesContext";
import { ListaTrabalhoBotao } from "../../../shared/core/listaTrabalho/ListaTrabalhoBotao";
import { MENU_CONFIGURACOES, MENU_PRINCIPAL, tituloDaRota } from "../menuRotas";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  title?: string;
  headerHeight?: number;
  onThemeToggle: () => void;
  isDarkMode: boolean;
}

// Telas do menu para a busca "Ir para..."
const TELAS = [...MENU_PRINCIPAL, MENU_CONFIGURACOES].flatMap(g => (g.children
  ? g.children.map(c => ({ rota: c.key, rotulo: `${g.label} › ${c.label}` }))
  : [{ rota: g.key, rotulo: g.label }]));

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const AppHeader: React.FC<AppHeaderProps> = ({ title, onThemeToggle, isDarkMode }) => {
  const { config } = useConfiguracoes();
  const notificacoes = useNotificacoes();
  const [sinoAberto, setSinoAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const safeUser = { name: config.perfil.nome || "Usuário", role: config.perfil.cargo || "" };

  // Título da tela atual (vem do mapa do menu)
  const titulo = tituloDaRota(location.pathname) || title || "ERP";

  // Contador do sino: avisos novos (vistos somem até a quantidade mudar)
  const qtdNotificacoes = notificacoes.novas.length;
  const corNivel = { critico: "red", atencao: "orange", info: "blue" } as const;
  const painelNotificacoes = (
    <div style={{ width: 340 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <b>Notificações</b>
        <span>
          <Button size="small" type="text" icon={<ReloadOutlined />} loading={notificacoes.carregando} onClick={notificacoes.recarregar} />
          <Button size="small" type="link" disabled={qtdNotificacoes === 0} onClick={notificacoes.marcarTodasComoLidas}>Marcar como lidas</Button>
        </span>
      </div>
      <Spin spinning={notificacoes.carregando && notificacoes.todas.length === 0}>
        {notificacoes.todas.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum aviso" /> : (
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notificacoes.todas.map(n => (
              <div key={n.id} onClick={() => { setSinoAberto(false); navigate(n.rota); }}
                style={{ padding: "6px 8px", borderRadius: 6, cursor: "pointer", marginBottom: 2, background: notificacoes.ehNova(n) ? "#f0f7ff" : undefined }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <Tag color={corNivel[n.nivel]} style={{ margin: 0, fontSize: 10 }}>{n.nivel === "critico" ? "crítico" : n.nivel === "atencao" ? "atenção" : "aviso"}</Tag>
                  <span style={{ fontSize: 13, fontWeight: notificacoes.ehNova(n) ? 600 : 400 }}>{n.titulo}</span>
                </div>
                <div style={{ fontSize: 11, color: "#8c8c8c", marginTop: 2 }}>{n.descricao}</div>
              </div>
            ))}
          </div>
        )}
      </Spin>
      <Button block size="small" type="text" style={{ marginTop: 4 }} onClick={() => { setSinoAberto(false); navigate("/configuracoes/notificacoes"); }}>
        Central de notificações
      </Button>
    </div>
  );

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

        <Popover content={painelNotificacoes} trigger="click" placement="bottomRight" open={sinoAberto} onOpenChange={setSinoAberto}>
          <button className={styles.iconBtn} title="Notificações">
            <Badge count={qtdNotificacoes} size="small" overflowCount={99}>
              <BellOutlined style={{ fontSize: "19px", color: corIcone }} />
            </Badge>
          </button>
        </Popover>

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
