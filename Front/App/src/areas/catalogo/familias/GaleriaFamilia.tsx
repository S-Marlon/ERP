// Galeria da família: fotos-modelo das variações. A 1ª é a modelo, base crua do editor de imagem (não vai às variações,
// só à que não tem nenhuma foto); as outras (aplicação, embalagem) entram em todas as variações depois das fotos de cada
// item. Arrastar ordena, a estrela faz principal; a foto com o modelo do editor guardado mostra a etiqueta.
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Spin, Tag, Tooltip, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import GaleriaImagens from '../skus/GaleriaImagens';
import type { AnexoItem } from '../skus/CatalogSku.service';
import { FotoFamilia, fotosFamiliaApi } from './FamilyManager.api';

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
  return (
    <GaleriaImagens
      imagens={fotos.map(comoAnexo)} tamanho={tamanho} rotuloPrincipal="modelo" regraMedidas={false} corBorda={COR_FAMILIA}
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
      etiqueta={f => comModelo.has(f.id_anexo) && (
        <Tooltip title="Tem o modelo do editor de imagem (cotas e textos) guardado: o editor abre com ele em qualquer anúncio">
          <Tag color="purple" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>modelo</Tag>
        </Tooltip>
      )}
    />
  );
};

export default GaleriaFamilia;
