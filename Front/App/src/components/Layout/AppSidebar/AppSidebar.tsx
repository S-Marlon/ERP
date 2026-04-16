import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import styles from "./AppSidebar.module.css";

import Home from "../../../assets/pic/icons8-casa-48.png";
import Clientes from "../../../assets/pic/icons8-grupo-de-negócios-50.png";
import Vendas from "../../../assets/pic/icons8-caixa-registradora-48.png";
import Produtos from "../../../assets/pic/icons8-novo-50.png";
import Estoque from "../../../assets/pic/icons8-empilhamento-50.png";
import Obras from "../../../assets/pic/icons8-guindaste-50.png";
import Config from "../../../assets/pic/icons8-guindaste-50.png";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

interface MenuItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
  children?: { to: string; label: string }[];
}

const AppSidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const role = "admin";

  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<MenuItem[]>([]);
  const [openConfig, setOpenConfig] = useState(false);

  const configRef = useRef<HTMLDivElement>(null);

  const menu: MenuItem[] = [
    { to: "/", label: "Home", icon: Home, roles: ["admin", "operador"] },
    { to: "/clientes", label: "Clientes", icon: Clientes, roles: ["admin"] },
    { to: "/produtos", label: "Produtos", icon: Produtos, roles: ["admin"] },
    { to: "/vendas", label: "Vendas", icon: Vendas, roles: ["admin", "operador"] },
    {
      to: "/estoque",
      label: "Estoque",
      icon: Estoque,
      children: [
        { to: "/estoque/consulta", label: "Consulta" },
        { to: "/estoque/notas", label: "Notas" },
        { to: "/estoque/operacoes", label: "Operações" },
        { to: "/estoque/etiquetagem", label: "Etiquetagem" },
      ],
    },
    { to: "/obras", label: "Obras", icon: Obras, roles: ["admin"] },
  ];

  /* ===================== */
  /* MENU TOGGLE */
  /* ===================== */

  const toggleMenu = (path: string) => {
    setOpenMenus((prev) =>
      prev.includes(path)
        ? prev.filter((m) => m !== path)
        : [...prev, path]
    );
  };

  /* ===================== */
  /* AUTO OPEN SUBMENU */
  /* ===================== */

  useEffect(() => {
    menu.forEach((item) => {
      if (item.children?.some((sub) => location.pathname.startsWith(sub.to))) {
        setOpenMenus((prev) =>
          prev.includes(item.to) ? prev : [...prev, item.to]
        );
      }
    });
  }, [location.pathname]);

  /* ===================== */
  /* FAVORITES */
  /* ===================== */

  useEffect(() => {
    const saved = localStorage.getItem("favorites");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (item: MenuItem) => {
    setFavorites((prev) =>
      prev.some((f) => f.to === item.to)
        ? prev.filter((f) => f.to !== item.to)
        : [...prev, item]
    );
  };

  const isFavorite = (item: MenuItem) =>
    favorites.some((f) => f.to === item.to);

  const isActive = (path: string) =>
    location.pathname.startsWith(path);

  /* ===================== */
  /* OUTSIDE CLICK */
  /* ===================== */

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setOpenConfig(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>

      {/* TOGGLE */}
      <button className={styles.toggle} onClick={toggleSidebar}>
        {isOpen ? "<<" : ">>"}
      </button>

      {/* PROFILE */}
      <div className={`${styles.profile} ${!isOpen ? styles.profileMini : ""}`}>
        {isOpen ? (
          <>
            👤 
            <span className={styles.role}>{role}</span>
          </>
        ) : (
          <span title="Admin">👤</span>
        )}
      </div>

      {/* MODULES */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>
          {isOpen ? "📦 Módulos" : "📦"}
        </span>

        {menu
          .filter((item) => item.roles?.includes(role) || !item.roles)
          .map((item) => {
            const isOpenMenu = openMenus.includes(item.to);

            return (
              <div key={item.to}>

                {/* 🔥 ROW COMPLETA (LINK + ACTIONS DENTRO) */}
                <div
                  className={`${styles.menuItem} ${
                    isActive(item.to) ? styles.activeRow : ""
                  }`}
                >

                  <Link
                    to={item.to}
                    title={item.label}
                    className={styles.link}
                  >
                    <img src={item.icon} className={styles.icon} />
                    {isOpen && <span>{item.label}</span>}
                  </Link>

                  {/* ACTIONS SEM BUG DE LAYOUT */}
                  <div className={styles.actions}>
 {item.children && (
                      <button
                        className={styles.arrowBtn}
                        onClick={() => toggleMenu(item.to)}
                        title="Expandir"
                      >
                        {isOpenMenu ? "▾" : "▸"}
                      </button>
                    )}


                    {isOpen && (
                    <button
                      className={styles.starBtn}
                      onClick={() => toggleFavorite(item)}
                      title="Favoritar"
                    >
                      {isFavorite(item) ? "★" : "☆"}
                    </button>
                    )}

                   

                  </div>

                </div>

                {/* SUBMENU */}
                {item.children && (
                  <div
                    className={`${styles.submenu} ${
                      isOpenMenu ? styles.submenuOpen : ""
                    }`}
                  >
                    {item.children.map((sub) => (
                      <Link
                        key={sub.to}
                        to={sub.to}
                        title={sub.label}
                        className={styles.sublink}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}

              </div>
            );
          })}
      </div>

      {/* CONFIG */}
      <div className={styles.sectionBottom} ref={configRef}>
        <button className={styles.link} onClick={() => setOpenConfig((p) => !p)}>
          <img src={Config} className={styles.icon} />
          {isOpen && <span>Configurações</span>}
        </button>

        {openConfig && (
          <div className={styles.configPopover}>
            <button>👤 Perfil</button>
            <button>🏢 Empresa</button>
            <button>⚙ Preferências</button>
            <button>🚪 Sair</button>
          </div>
        )}
      </div>

    </aside>
  );
};

export default AppSidebar;