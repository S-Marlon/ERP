// Configurações compartilhadas por todas as telas (perfil, empresa, preferências, notificações).
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Configuracoes, gravarConfiguracoes, lerConfiguracoes } from './configuracoes';

interface ConfiguracoesApi {
  config: Configuracoes;
  salvar: <K extends keyof Configuracoes>(parte: K, valor: Configuracoes[K]) => void;
}

const ConfiguracoesContext = createContext<ConfiguracoesApi | null>(null);

export const ConfiguracoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<Configuracoes>(lerConfiguracoes);
  const salvar = useCallback(<K extends keyof Configuracoes>(parte: K, valor: Configuracoes[K]) => {
    setConfig(atual => {
      const proximo = { ...atual, [parte]: valor };
      gravarConfiguracoes(proximo);
      return proximo;
    });
  }, []);
  return <ConfiguracoesContext.Provider value={{ config, salvar }}>{children}</ConfiguracoesContext.Provider>;
};

export const useConfiguracoes = (): ConfiguracoesApi => {
  const ctx = useContext(ConfiguracoesContext);
  if (!ctx) throw new Error('useConfiguracoes precisa estar dentro de ConfiguracoesProvider.');
  return ctx;
};
