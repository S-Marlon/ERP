import { createContext, useContext, useState } from "react";

type User = {
  name: string;
  role: "admin" | "operador" | "caixa";
};

type UIContextType = {
  user: User;
  notifications: number;
  setNotifications: (n: number) => void;
  isPDVMode: boolean;
  setPDVMode: (v: boolean) => void;
};

const UIContext = createContext({} as UIContextType);

export const UIProvider = ({ children }: any) => {
  const [notifications, setNotifications] = useState(3);

  const [user] = useState<User>({
    name: "João",
    role: "admin",
  });

  const [isPDVMode, setPDVMode] = useState(false);

  return (
    <UIContext.Provider
      value={{
        user,
        notifications,
        setNotifications,
        isPDVMode,
        setPDVMode,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);