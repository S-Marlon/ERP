import React, { createContext, useState, ReactNode } from "react";
import { ServiceProduct } from "../types/types";
import { mockServices } from "../data/mockServices";

interface ServiceProductContextProps {
  services: ServiceProduct[];
  setServices: React.Dispatch<React.SetStateAction<ServiceProduct[]>>;
}

export const ServiceProductContext = createContext<ServiceProductContextProps | undefined>(undefined);

export const ServiceProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [services, setServices] = useState<ServiceProduct[]>(mockServices);

  return (
    <ServiceProductContext.Provider value={{ services, setServices }}>
      {children}
    </ServiceProductContext.Provider>
  );
};
