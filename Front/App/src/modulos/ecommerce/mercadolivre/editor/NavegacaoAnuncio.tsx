// Navegação do editor: "Geral" (o que vale para o anúncio inteiro) e os produtos do anúncio com as formas de venda
// dentro (unidade, kit c/2, kit c/10...). Cada produto é um cartão; cada forma mostra a situação no ML (pela cor), o
// preço e o que pede atenção, para achar de cara o que está pausado, bloqueado, em prejuízo ou diferente do ML.
import React from 'react';
import { Tooltip, Typography } from 'antd';
import { AppstoreOutlined, RightOutlined, StopOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, DivergenciasLinha, foraDoMl, formatarMoeda, ItemDoAnuncio, ROTULO_STATUS_ML } from '../mercadoLivreApi';
import { produtosDoAnuncio, rotuloDaUnidade } from '../linhasAnuncio';
import { tipoDoAviso } from '../AvisoMl';

const { Text } = Typography;

export type SelecaoEditor = 'geral' | number;   // número = idItem do produto

/** Cores da forma pela situação: fundo, borda/ponto e texto curto. */
const situacao = (i: ItemDoAnuncio): { fundo: string; cor: string; texto: string } => {
  if (!i.ml.mlbId) return i.linhaAtiva === false
    ? { fundo: '#f5f5f5', cor: '#bfbfbf', texto: 'não vende' }
    : { fundo: '#f5f5f5', cor: '#8c8c8c', texto: 'a publicar' };
  if (foraDoMl(i.ml.status)) return { fundo: '#fff1f0', cor: '#ff4d4f', texto: ROTULO_STATUS_ML[i.ml.status || '']?.texto || 'fora do ML' };
  if (i.linhaAtiva === false) return { fundo: '#f5f5f5', cor: '#bfbfbf', texto: 'desligado no ERP' };
  if (i.ml.status === 'active') return { fundo: '#f6ffed', cor: '#52c41a', texto: 'ativo' };
  if (i.ml.status === 'paused') return { fundo: '#fffbe6', cor: '#faad14', texto: 'pausado' };
  return { fundo: '#e6f4ff', cor: '#1677ff', texto: ROTULO_STATUS_ML[i.ml.status || '']?.texto || i.ml.status || '' };
};

const clicavel = (onClick: () => void) => ({
  role: 'button' as const, tabIndex: 0, onClick,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onClick(); },
});

const NavegacaoAnuncio: React.FC<{
  det: AnuncioDetalhe;
  selecao: SelecaoEditor;
  onSelecionar: (s: SelecaoEditor) => void;
  divergencias?: DivergenciasLinha[] | null;
}> = ({ det, selecao, onSelecionar, divergencias }) => {
  const produtos = produtosDoAnuncio(det.itens);
  const diferente = (idLinha: number) => (divergencias || []).some(d => d.idLinha === idLinha && d.diferencas.some(x => x.enviavel));
  const geral = selecao === 'geral';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* o anúncio inteiro */}
      <div
        {...clicavel(() => onSelecionar('geral'))}
        style={{
          cursor: 'pointer', borderRadius: 8, padding: '10px 12px',
          background: geral ? '#1677ff' : '#fff', border: `1px solid ${geral ? '#1677ff' : '#d6e4ff'}`,
        }}
      >
        <Text strong style={{ color: geral ? '#fff' : '#1677ff' }}><AppstoreOutlined /> Geral do anúncio</Text>
        <div><Text style={{ fontSize: 11, color: geral ? 'rgba(255,255,255,0.85)' : '#8c8c8c' }}>título, categoria, descrição, fotos, ficha</Text></div>
      </div>

      <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.6, padding: '4px 4px 0' }}>PRODUTOS ({produtos.length})</Text>

      {produtos.map(p => {
        const ativo = selecao === p.idItem;
        return (
          <div
            key={p.idItem}
            style={{
              background: '#fff', borderRadius: 8, overflow: 'hidden',
              border: `1px solid ${ativo ? '#1677ff' : '#e8e8e8'}`,
              borderLeft: `4px solid ${ativo ? '#1677ff' : '#d9d9d9'}`,
              boxShadow: ativo ? '0 2px 8px rgba(22,119,255,0.15)' : undefined,
            }}
          >
            {/* produto */}
            <div {...clicavel(() => onSelecionar(p.idItem))} style={{ cursor: 'pointer', padding: '8px 10px', background: ativo ? '#e6f4ff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <Text strong style={{ fontSize: 13, color: ativo ? '#0958d9' : undefined }} ellipsis>{p.sku}</Text>
                <RightOutlined style={{ fontSize: 10, color: ativo ? '#1677ff' : '#bfbfbf' }} />
              </div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }} ellipsis={{ tooltip: p.nome }}>{p.nome}</Text>
            </div>

            {/* formas de venda */}
            <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {p.linhas.map(l => {
                const s = situacao(l);
                const aviso = l.ml.mlbId ? tipoDoAviso(l.ml.erro) : null;
                return (
                  <Tooltip key={l.idLinha} placement="right" title={`${l.sku} · ${s.texto}${l.ml.mlbId ? ` · ${l.ml.mlbId}` : ''}`}>
                    <div
                      {...clicavel(() => onSelecionar(p.idItem))}
                      style={{
                        cursor: 'pointer', borderRadius: 6, padding: '4px 8px', background: s.fundo, borderLeft: `3px solid ${s.cor}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
                        opacity: l.linhaAtiva === false ? 0.7 : 1,
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 12 }}>{l.unidadeMl ? rotuloDaUnidade(l) : 'Unidade'}</Text>
                        {aviso === 'MODERACAO' && <Tooltip title={l.ml.erro}><StopOutlined style={{ color: '#cf1322' }} /></Tooltip>}
                        {aviso === 'PREJUIZO' && <Tooltip title={l.ml.erro}><WarningOutlined style={{ color: '#cf1322' }} /></Tooltip>}
                        {aviso === 'ERRO' && <Tooltip title={l.ml.erro}><WarningOutlined style={{ color: '#d46b08' }} /></Tooltip>}
                        {diferente(l.idLinha) && <Tooltip title="Diferente do ML: precisa enviar"><SyncOutlined style={{ color: '#d46b08' }} /></Tooltip>}
                      </span>
                      <span style={{ textAlign: 'right', lineHeight: 1.15, flexShrink: 0 }}>
                        <Text style={{ fontSize: 12 }}>{formatarMoeda(l.precoAnuncio)}</Text>
                        <div><Text style={{ fontSize: 10, color: s.cor }}>{s.texto}</Text></div>
                      </span>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NavegacaoAnuncio;
