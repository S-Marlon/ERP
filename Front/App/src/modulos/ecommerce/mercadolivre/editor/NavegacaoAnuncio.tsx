// Navegação do editor: "Geral" (o que vale para o anúncio inteiro) e os produtos do anúncio com as formas de venda
// dentro (unidade, kit c/2, kit c/10...). Cada forma mostra a situação no ML e o que pede atenção, para achar de cara o
// que está pausado, bloqueado, em prejuízo ou diferente do ML.
import React from 'react';
import { Badge, Tooltip, Typography } from 'antd';
import { AppstoreOutlined, StopOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, DivergenciasLinha, foraDoMl, ItemDoAnuncio, ROTULO_STATUS_ML } from '../mercadoLivreApi';
import { produtosDoAnuncio, rotuloDaUnidade } from '../linhasAnuncio';
import { tipoDoAviso } from '../AvisoMl';

const { Text } = Typography;

export type SelecaoEditor = 'geral' | number;   // número = idItem do produto

const corDoStatus = (i: ItemDoAnuncio) => {
  if (i.linhaAtiva === false) return '#bfbfbf';
  if (!i.ml.mlbId) return '#d9d9d9';
  if (foraDoMl(i.ml.status)) return '#ff4d4f';
  return i.ml.status === 'active' ? '#52c41a' : i.ml.status === 'paused' ? '#faad14' : '#1677ff';
};
const textoDoStatus = (i: ItemDoAnuncio) => {
  if (!i.ml.mlbId) return i.linhaAtiva === false ? 'não vende (fora da publicação)' : 'a publicar';
  return `${ROTULO_STATUS_ML[i.ml.status || '']?.texto || i.ml.status}${i.linhaAtiva === false ? ' · desligado no ERP' : ''}`;
};

const Opcao: React.FC<{ ativo: boolean; onClick: () => void; children: React.ReactNode; recuo?: boolean }> = ({ ativo, onClick, children, recuo }) => (
  <div
    role="button" tabIndex={0} onClick={onClick} onKeyDown={e => { if (e.key === 'Enter') onClick(); }}
    style={{
      padding: recuo ? '4px 10px 4px 22px' : '7px 10px', borderRadius: 6, cursor: 'pointer',
      background: ativo ? '#e6f4ff' : undefined, boxShadow: ativo ? 'inset 3px 0 0 #1677ff' : undefined,
    }}
  >
    {children}
  </div>
);

const NavegacaoAnuncio: React.FC<{
  det: AnuncioDetalhe;
  selecao: SelecaoEditor;
  onSelecionar: (s: SelecaoEditor) => void;
  divergencias?: DivergenciasLinha[] | null;
}> = ({ det, selecao, onSelecionar, divergencias }) => {
  const produtos = produtosDoAnuncio(det.itens);
  const diferente = (idLinha: number) => (divergencias || []).some(d => d.idLinha === idLinha && d.diferencas.some(x => x.enviavel));
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: 8 }}>
      <Text type="secondary" style={{ fontSize: 11, padding: '0 10px', letterSpacing: 0.5 }}>ANÚNCIO</Text>
      <Opcao ativo={selecao === 'geral'} onClick={() => onSelecionar('geral')}>
        <Text strong={selecao === 'geral'}><AppstoreOutlined /> Geral</Text>
        <div><Text type="secondary" style={{ fontSize: 11 }}>título, categoria, descrição, fotos, ficha</Text></div>
      </Opcao>

      <Text type="secondary" style={{ fontSize: 11, padding: '0 10px', letterSpacing: 0.5, display: 'block', marginTop: 10 }}>
        PRODUTOS ({produtos.length})
      </Text>
      {produtos.map(p => (
        <div key={p.idItem} style={{ marginBottom: 4 }}>
          <Opcao ativo={selecao === p.idItem} onClick={() => onSelecionar(p.idItem)}>
            <Text strong style={{ fontSize: 13 }}>{p.sku}</Text>
            <div><Text type="secondary" style={{ fontSize: 11 }} ellipsis>{p.nome}</Text></div>
          </Opcao>
          {p.linhas.map(l => {
            const aviso = l.ml.mlbId ? tipoDoAviso(l.ml.erro) : null;
            return (
              <Opcao key={l.idLinha} recuo ativo={false} onClick={() => onSelecionar(p.idItem)}>
                <Tooltip title={textoDoStatus(l)} placement="right">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, opacity: l.linhaAtiva === false ? 0.6 : 1 }}>
                    <Badge color={corDoStatus(l)} />
                    {l.unidadeMl ? rotuloDaUnidade(l) : 'Unidade'}
                    {aviso === 'MODERACAO' && <Tooltip title={l.ml.erro}><StopOutlined style={{ color: '#cf1322' }} /></Tooltip>}
                    {aviso === 'PREJUIZO' && <Tooltip title={l.ml.erro}><WarningOutlined style={{ color: '#cf1322' }} /></Tooltip>}
                    {aviso === 'ERRO' && <Tooltip title={l.ml.erro}><WarningOutlined style={{ color: '#d46b08' }} /></Tooltip>}
                    {diferente(l.idLinha) && <Tooltip title="Diferente do ML: precisa enviar"><SyncOutlined style={{ color: '#d46b08' }} /></Tooltip>}
                  </span>
                </Tooltip>
              </Opcao>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default NavegacaoAnuncio;
