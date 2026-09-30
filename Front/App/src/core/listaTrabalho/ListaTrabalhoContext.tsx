// Estado global da lista de trabalho, salvo no navegador (localStorage) e sincronizado entre abas.
// Uso: const lista = useListaTrabalho(); lista.adicionar(item, { tags: ['ETIQUETAR'] });
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  adicionarItem, alternarTag, atualizarItem, contagemPorTag, ItemBase, ItemListaTrabalho, itensComTag,
  limparTag, normalizarListaSalva, OpcoesInclusao, removerItem, removerTag, TagLista,
} from './listaTrabalho';

const CHAVE_STORAGE = 'erp.listaTrabalho.v1';

const lerSalvo = (): ItemListaTrabalho[] => {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    return bruto ? normalizarListaSalva(JSON.parse(bruto)) : [];
  } catch {
    return [];
  }
};

interface ListaTrabalhoApi {
  itens: ItemListaTrabalho[];
  contagem: Record<TagLista, number>;
  adicionar: (item: ItemBase, opcoes: OpcoesInclusao) => void;
  adicionarVarios: (itens: ItemBase[], opcoes: OpcoesInclusao) => void;
  atualizar: (idItem: number, patch: Partial<Omit<ItemListaTrabalho, 'idItem'>>) => void;
  alternarTag: (idItem: number, tag: TagLista) => void;
  removerTag: (idItem: number, tag: TagLista) => void;
  concluirTag: (tag: TagLista, ids?: number[]) => void;
  remover: (idItem: number) => void;
  limparTudo: () => void;
  comTag: (tag: TagLista) => ItemListaTrabalho[];
  temItem: (idItem: number, tag?: TagLista) => boolean;
}

const ListaTrabalhoContext = createContext<ListaTrabalhoApi | null>(null);

export const ListaTrabalhoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [itens, setItens] = useState<ItemListaTrabalho[]>(lerSalvo);

  useEffect(() => {
    try { localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens)); } catch { /* armazenamento indisponível: a lista vale só nesta sessão */ }
  }, [itens]);

  // Outra aba alterou a lista
  useEffect(() => {
    const aoMudar = (e: StorageEvent) => { if (e.key === CHAVE_STORAGE) setItens(lerSalvo()); };
    window.addEventListener('storage', aoMudar);
    return () => window.removeEventListener('storage', aoMudar);
  }, []);

  const api = useMemo<ListaTrabalhoApi>(() => ({
    itens,
    contagem: contagemPorTag(itens),
    adicionar: (item, opcoes) => setItens(l => adicionarItem(l, item, opcoes)),
    adicionarVarios: (novos, opcoes) => setItens(l => novos.reduce((acc, item) => adicionarItem(acc, item, opcoes), l)),
    atualizar: (idItem, patch) => setItens(l => atualizarItem(l, idItem, patch)),
    alternarTag: (idItem, tag) => setItens(l => alternarTag(l, idItem, tag)),
    removerTag: (idItem, tag) => setItens(l => removerTag(l, idItem, tag)),
    concluirTag: (tag, ids) => setItens(l => limparTag(l, tag, ids)),
    remover: idItem => setItens(l => removerItem(l, idItem)),
    limparTudo: () => setItens([]),
    comTag: tag => itensComTag(itens, tag),
    temItem: (idItem, tag) => itens.some(i => i.idItem === idItem && (!tag || i.tags.includes(tag))),
  }), [itens]);

  return <ListaTrabalhoContext.Provider value={api}>{children}</ListaTrabalhoContext.Provider>;
};

export const useListaTrabalho = (): ListaTrabalhoApi => {
  const ctx = useContext(ListaTrabalhoContext);
  if (!ctx) throw new Error('useListaTrabalho precisa estar dentro de <ListaTrabalhoProvider>.');
  return ctx;
};

// Atalho para quem só precisa incluir (ex.: botões em tabelas)
export const useIncluirNaLista = () => {
  const { adicionar } = useListaTrabalho();
  return useCallback((item: ItemBase, opcoes: OpcoesInclusao) => adicionar(item, opcoes), [adicionar]);
};
