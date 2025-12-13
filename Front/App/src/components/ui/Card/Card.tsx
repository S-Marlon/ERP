import React from "react";
import "./Card.css";

type CardVariant = "default" | "panel" | "highlight";

interface CardProps {
  variant?: CardVariant;
  className?: string;
  padding?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  variant = "default",
  className = "",
  padding = "16px",
  children,
}) => (
  <div className={`ui-card ui-card--${variant} ${className}`} style={{'padding': padding}}>
    {children}
  </div>
);

export default Card;