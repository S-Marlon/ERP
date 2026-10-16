// O que o ML devolveu de problema numa linha do anúncio publicado (gravado pela sincronização e pelos envios):
// moderação (em revisão / bloqueado / finalizado pelo ML, com o motivo e as categorias sugeridas), trava de prejuízo e
// envio recusado. Mostrado na lista, nos itens de cada anúncio e no editor, para corrigir no ERP.
import React from 'react';
import { Tag, Tooltip } from 'antd';
import { StopOutlined, WarningOutlined } from '@ant-design/icons';

export type TipoAviso = 'MODERACAO' | 'PREJUIZO' | 'ERRO';

/** Que tipo de aviso é o texto gravado na linha (pelo prefixo que o backend usa). */
export const tipoDoAviso = (erro: string | null | undefined): TipoAviso | null => {
  if (!erro) return null;
  if (erro.startsWith('Moderação do ML')) return 'MODERACAO';
  if (erro.startsWith('Pausado por prejuízo')) return 'PREJUIZO';
  return 'ERRO';
};

const COMO_CORRIGIR: Record<TipoAviso, string> = {
  MODERACAO: 'Corrija o que o ML pediu (ex.: a categoria, na aba Anúncio) e mande de novo; quando o ML liberar, o aviso sai sozinho.',
  PREJUIZO: 'A trava de prejuízo reativa sozinha quando o item voltar a dar lucro (preço, custo ou frete).',
  ERRO: 'Confira o item e tente de novo ("Enviar atributos, fotos e descrição" ou "Atualizar estoque no ML").',
};

/** Etiqueta do aviso de uma linha (null quando não há). */
export const AvisoMl: React.FC<{ erro: string | null | undefined; publicado?: boolean }> = ({ erro, publicado = true }) => {
  const tipo = tipoDoAviso(erro);
  if (!tipo || !publicado) return null;
  const texto = tipo === 'MODERACAO' ? 'bloqueado pelo ML' : tipo === 'PREJUIZO' ? 'pausado: prejuízo' : 'erro no ML';
  return (
    <Tooltip title={<div style={{ maxWidth: 420 }}>{erro}<div style={{ marginTop: 6, opacity: 0.85 }}>{COMO_CORRIGIR[tipo]}</div></div>}>
      <Tag color={tipo === 'ERRO' ? 'orange' : 'red'} icon={tipo === 'MODERACAO' ? <StopOutlined /> : <WarningOutlined />} style={{ fontSize: 11, marginInlineEnd: 0 }}>
        {texto}
      </Tag>
    </Tooltip>
  );
};
