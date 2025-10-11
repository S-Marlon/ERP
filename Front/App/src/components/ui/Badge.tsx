import React from "react";
import "./Badge.css";

interface BadgeProps {
  color?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  color = "default",
  children,
  className = "",
}) => (
  <span className={`ui-badge ui-badge--${color} ${className}`}>{children}</span>
);

export default Badge;