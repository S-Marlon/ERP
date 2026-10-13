// Situação do anúncio: publicado/pausado ou, no rascunho, pronto x pendências.
import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import type { AnuncioResumo } from './mercadoLivreApi';

const SituacaoTag: React.FC<{ a: Pick<AnuncioResumo, 'situacao' | 'preparo' | 'erros' | 'avisos' | 'permalink'> }> = ({ a }) => {
  if (a.situacao !== 'RASCUNHO') {
    const cor = a.situacao === 'PUBLICADO' ? 'green' : a.situacao === 'PAUSADO' ? 'orange' : 'default';
    const tag = <Tag color={cor}>{a.situacao === 'PUBLICADO' ? 'Publicado' : a.situacao === 'PAUSADO' ? 'Pausado' : 'Encerrado'}</Tag>;
    return a.permalink ? <a href={a.permalink} target="_blank" rel="noreferrer">{tag}</a> : tag;
  }
  if (a.preparo === 'PRONTO') {
    return <Tag color="green" icon={<CheckCircleOutlined />}>Pronto para publicar{a.avisos ? ` · ${a.avisos} aviso(s)` : ''}</Tag>;
  }
  return <Tag color="red" icon={<ExclamationCircleOutlined />}>{a.erros} pendência(s){a.avisos ? ` · ${a.avisos} aviso(s)` : ''}</Tag>;
};

export default SituacaoTag;
