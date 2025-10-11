import React from "react";
import "./Card.css";

type CardVariant = "default" | "panel" | "highlight";

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  variant = "default",
  className = "",
  children,
}) => (
  <div className={`ui-card ui-card--${variant} ${className}`}>
    {children}
  </div>
);

export default Card;