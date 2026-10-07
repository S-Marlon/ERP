// Notificações do sistema: consulta as fontes (notas, estoque, PIM, preços, duplicados) no intervalo das preferências
// e guarda neste navegador o que já foi visto.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useConfiguracoes } from '../configuracoes/ConfiguracoesContext';
import { DadosNotificacao, marcarComoLidas, montarNotificacoes, naoLidas, Notificacao } from './notificacoes';
import { listarNotas } from '../../pages/Compras/NotasEntrada/notasEntradaApi';
import { getSaldos } from '../../pages/Estoque/api/estoqueItensApi';
import { getPendenciasPim } from '../../pages/Catalogo/pages/PendenciasPim/pendenciasApi';
import { getDuplicados } from '../../pages/Catalogo/pages/ItensDuplicados/duplicadosApi';
import { API_URL } from '../../shared/api/config';

const CHAVE_LIDAS = 'erp.notificacoes.lidas';
const CHAVE_DUPLICADOS_IGNORADOS = 'erp.duplicados.ignorados';

const lerJson = <T,>(chave: string, padrao: T): T => {
  try { return JSON.parse(localStorage.getItem(chave) || 'null') ?? padrao; } catch { return padrao; }
};

const getPainelPrecos = async () => {
  const r = await fetch(`${API_URL}/api/catalogo/precos/painel?tenant_id=1&limit=1`);
  if (!r.ok) throw new Error('painel de preços indisponível');
  return (await r.json()).resumo?.porSituacao as Record<string, number> | undefined;
};

const valor = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

/** Consulta as fontes; cada uma que falhar vira null (as outras continuam). */
const carregarDadosNotificacao = async (): Promise<DadosNotificacao> => {
  const [notas, saldos, pim, precos, duplicados] = await Promise.allSettled([
    listarNotas({}), getSaldos({ deposito: 'VENDA', page: 1, limit: 1 }), getPendenciasPim({ tipo: 'VENDA', limit: 1 }),
    getPainelPrecos(), getDuplicados(),
  ]);
  const n = valor(notas)?.data || null;
  const ignorados = lerJson<string[]>(CHAVE_DUPLICADOS_IGNORADOS, []);
  const p = valor(precos);
  return {
    notasEmConferencia: n ? n.filter(x => x.situacao === 'EM_CONFERENCIA' || x.situacao === 'PRONTA').length : null,
    notasProntas: n ? n.filter(x => x.situacao === 'PRONTA').length : null,
    abaixoMinimo: valor(saldos)?.resumo.abaixoMinimo ?? null,
    estoqueNegativo: valor(saldos)?.resumo.negativos ?? null,
    pimCriticos: valor(pim)?.criticos ?? null,
    semPreco: p ? (p.SEM_PRECO ?? 0) : null,
    custoDefasado: p ? (p.CUSTO_DEFASADO ?? 0) : null,
    duplicados: valor(duplicados)?.filter(g => !ignorados.includes(g.chave)).length ?? null,
  };
};

interface NotificacoesApi {
  todas: Notificacao[];
  novas: Notificacao[];
  carregando: boolean;
  atualizadoEm: Date | null;
  recarregar: () => void;
  marcarTodasComoLidas: () => void;
  ehNova: (n: Notificacao) => boolean;
}

const NotificacoesContext = createContext<NotificacoesApi | null>(null);

export const NotificacoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config } = useConfiguracoes();
  const [dados, setDados] = useState<DadosNotificacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [lidas, setLidas] = useState<Record<string, number>>(() => lerJson(CHAVE_LIDAS, {}));

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await carregarDadosNotificacao());
      setAtualizadoEm(new Date());
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
    const t = setInterval(recarregar, Math.max(1, config.notificacoes.intervaloMinutos) * 60000);
    return () => clearInterval(t);
  }, [recarregar, config.notificacoes.intervaloMinutos]);

  const todas = useMemo(() => (dados ? montarNotificacoes(dados, config.notificacoes) : []), [dados, config.notificacoes]);
  const novas = useMemo(() => naoLidas(todas, lidas), [todas, lidas]);

  const marcarTodasComoLidas = useCallback(() => {
    setLidas(atual => {
      const proximo = marcarComoLidas(todas, atual);
      try { localStorage.setItem(CHAVE_LIDAS, JSON.stringify(proximo)); } catch { /* sem armazenamento */ }
      return proximo;
    });
  }, [todas]);

  const ehNova = useCallback((n: Notificacao) => lidas[n.id] !== n.quantidade, [lidas]);

  return (
    <NotificacoesContext.Provider value={{ todas, novas, carregando, atualizadoEm, recarregar, marcarTodasComoLidas, ehNova }}>
      {children}
    </NotificacoesContext.Provider>
  );
};

export const useNotificacoes = (): NotificacoesApi => {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error('useNotificacoes precisa estar dentro de NotificacoesProvider.');
  return ctx;
};
