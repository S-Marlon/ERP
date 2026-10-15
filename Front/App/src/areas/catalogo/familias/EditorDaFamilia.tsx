// Abre o editor de imagem a partir da família: todos os itens ativos dela (com as medidas do cadastro) recebem a
// imagem, cada um com a sua medida. idFoto abre direto naquela foto da galeria; sem ele, o editor pede a escolha.
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { message } from 'antd';
import { fotosFamiliaApi } from './FamilyManager.api';
import type { EntradaEditor } from '../imagens/editor/entradaEditor';

const EditorImagemModal = lazy(() => import('../imagens/editor/EditorImagemModal'));

interface Props {
  idFamilia: number;
  aberto: { idFoto: number | null; vez: number } | null;   // null = fechado
  onFechar: () => void;
  onSalvo?: () => void;
}

const EditorDaFamilia: React.FC<Props> = ({ idFamilia, aberto, onFechar, onSalvo }) => {
  const [entrada, setEntrada] = useState<EntradaEditor | null>(null);
  useEffect(() => {
    if (!aberto) { setEntrada(null); return; }
    let vivo = true;
    fotosFamiliaApi.dadosEditor(idFamilia)
      .then(d => {
        if (!vivo) return;
        if (!d.itens.length) { message.info('A família não tem itens ativos para receber a imagem.'); onFechar(); return; }
        setEntrada({
          chave: `familia-${idFamilia}`, idFamilia, familia: d.familia.nome, modeloPadrao: d.modeloPadrao,
          fotoPorItem: false, idFotoFamiliaInicial: aberto.idFoto,
          itens: d.itens.map(i => ({ idItem: i.idItem, sku: i.sku, nome: i.nome, foto: i.foto, fotos: i.fotos, campos: i.campos })),
        });
      })
      .catch(e => { message.error(e instanceof Error ? e.message : 'Erro ao abrir o editor.'); onFechar(); });
    return () => { vivo = false; };
  }, [idFamilia, aberto?.vez]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!entrada) return null;
  return (
    <Suspense fallback={null}>
      <EditorImagemModal entrada={entrada} onFechar={onFechar} onSalvo={() => onSalvo?.()} />
    </Suspense>
  );
};

export default EditorDaFamilia;
