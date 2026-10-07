// ButtonTypes.ts

// 💡 Copiado exatamente do seu componente Button
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "outline"
  | "switch";

// A interface para cada botão no grupo.
// Ela usa as props do seu componente, mais uma prop 'id' para a chave (key).
export interface GroupButton {
  id: string | number; // Necessário para a key do React
  label: string;      // O conteúdo (children) do botão
  variant: ButtonVariant;
  onClick: () => void;
  // Propriedades Opcionais do seu Button (adicionadas para flexibilidade)
  loading?: boolean;
  disabled?: boolean;
  active?: boolean;
}

// A interface para as props do componente ButtonGroup
export interface ButtonGroupProps {
  buttons: GroupButton[];
}