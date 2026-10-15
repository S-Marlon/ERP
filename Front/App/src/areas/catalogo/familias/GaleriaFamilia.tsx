// Galeria da família. Cada foto tem um papel, que se troca na etiqueta: PRINCIPAL (a foto limpa do produto: 1ª das
// variações que não têm foto limpa própria; uma só), COMUM (aplicação, embalagem: entra em todas as variações depois das
// fotos de cada uma) ou SÓ EDITOR (gabarito, ex.: desenho sem medidas: base do editor de imagem, não vai ao canal).
// Arrastar ordena as comuns; a foto com cotas guardadas do editor mostra a etiqueta "cotas".
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Dropdown, Spin, Tag, Tooltip, message } from 'antd';
import { DownOutlined, EditOutlined } from '@ant-design/icons';
import GaleriaImagens from '../skus/GaleriaImagens';
import type { AnexoItem } from '../skus/CatalogSku.service';
import { FotoFamilia, fotosFamiliaApi, UsoFotoFamilia } from './FamilyManager.api';

interface Props {
  idFamilia: number;
  onChange?: (fotos: FotoFamilia[]) => void;   // depois de qualquer mudança (ex.: recarregar o anúncio)
  tamanho?: number;
  /** muda quando alguém de fora mexeu na galeria (ex.: "levar para a família" numa foto do item) */
  recarregar?: number;
  /** abre o editor de imagem sobre esta foto (aplicar nas variações) */
  onEditar?: (idFoto: number) => void;
}

/** Roxo marca o que vem da família (o pai) em todas as telas de fotos; azul, o que é da variação. */
export const COR_FAMILIA = '#9254de';
export const COR_VARIACAO = '#1677ff';

export const PAPEL_FOTO: Record<UsoFotoFamilia, { texto: string; cor: string; borda: string; dica: string }> = {
  PRINCIPAL: { texto: 'principal', cor: 'purple', borda: `3px solid ${COR_FAMILIA}`, dica: 'Foto limpa do produto: vai como 1ª nas variações que não têm foto limpa própria (uma só por família).' },
  COMUM: { texto: 'comum', cor: 'default', borda: `2px solid ${COR_FAMILIA}`, dica: 'Entra em todas as variações, depois das fotos de cada uma (aplicação, embalagem...).' },
  EDITOR: { texto: 'só editor', cor: 'default', borda: '2px dashed #bfbfbf', dica: 'Gabarito do editor de imagem (ex.: desenho sem medidas): não vai ao ML.' },
};

const comoAnexo = (f: FotoFamilia): AnexoItem => ({ id_anexo: f.idFoto, tipo_anexo: f.ordem === 0 ? 'IMAGEM_PRINCIPAL' : 'FOTO_GALERIA', nome_arquivo: f.nome, url_anexo: f.url, ordem: f.ordem });

const GaleriaFamilia: React.FC<Props> = ({ idFamilia, onChange, tamanho = 88, recarregar, onEditar }) => {
  const [fotos, setFotos] = useState<FotoFamilia[] | null>(null);
  const carregar = useCallback(async () => {
    try { setFotos((await fotosFamiliaApi.listar(idFamilia)).fotos); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Erro ao ler as fotos da família.'); setFotos([]); }
  }, [idFamilia]);
  useEffect(() => { carregar(); }, [carregar, recarregar]);

  if (!fotos) return <Spin size="small" />;
  const comModelo = new Set(fotos.filter(f => f.temModelo).map(f => f.idFoto));
  const usoDe = new Map(fotos.map(f => [f.idFoto, f.uso]));
  const mudarUso = async (idFoto: number, uso: UsoFotoFamilia) => {
    try {
      const r = await fotosFamiliaApi.definirUso(idFamilia, idFoto, uso);
      setFotos(r.fotos);
      onChange?.(r.fotos);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Erro ao mudar o papel da foto.');
    }
  };
  return (
    <GaleriaImagens
      imagens={fotos.map(comoAnexo)} tamanho={tamanho} regraMedidas={false} semPrincipal
      bordaDe={f => PAPEL_FOTO[usoDe.get(f.id_anexo) || 'COMUM'].borda}
      onChange={async () => { const r = await fotosFamiliaApi.listar(idFamilia).catch(() => null); if (r) { setFotos(r.fotos); onChange?.(r.fotos); } }}
      acoes={{
        ordenar: ids => fotosFamiliaApi.ordenar(idFamilia, ids),
        remover: id => fotosFamiliaApi.remover(idFamilia, id),
        enviar: f => fotosFamiliaApi.enviar(idFamilia, f),
        link: u => fotosFamiliaApi.link(idFamilia, u),
      }}
      acaoExtra={onEditar ? f => (
        <Tooltip title="Editar esta foto e aplicar nas variações (cada uma com a sua medida)">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditar(f.id_anexo)} />
        </Tooltip>
      ) : undefined}
      etiqueta={f => {
        const uso = usoDe.get(f.id_anexo) || 'COMUM';
        return (
          <>
            <Dropdown trigger={['click']} menu={{
              selectedKeys: [uso],
              items: (Object.keys(PAPEL_FOTO) as UsoFotoFamilia[]).map(k => ({ key: k, label: <span><b>{PAPEL_FOTO[k].texto}</b> · <span style={{ fontSize: 12, color: '#888' }}>{PAPEL_FOTO[k].dica}</span></span> })),
              onClick: ({ key }) => { if (key !== uso) mudarUso(f.id_anexo, key as UsoFotoFamilia); },
            }}>
              <Tooltip title={`${PAPEL_FOTO[uso].dica} Clique para trocar.`}>
                <Tag color={PAPEL_FOTO[uso].cor} style={{ margin: 0, fontSize: 10, lineHeight: '16px', cursor: 'pointer' }}>{PAPEL_FOTO[uso].texto} <DownOutlined style={{ fontSize: 8 }} /></Tag>
              </Tooltip>
            </Dropdown>
            {comModelo.has(f.id_anexo) && (
              <Tooltip title="Tem cotas e textos do editor de imagem guardados: o editor abre com eles">
                <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>cotas</Tag>
              </Tooltip>
            )}
          </>
        );
      }}
    />
  );
};

export default GaleriaFamilia;
