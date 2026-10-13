// Como o anúncio vai para o ML (página única com opções x um anúncio por item) e o modelo do título de cada item.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Input, Space, Tag, Tooltip, Typography } from 'antd';
import type { InputRef } from 'antd';
import type { AnuncioDetalhe } from './mercadoLivreApi';

const { Text } = Typography;

const TOKENS_FIXOS = [
  { token: '{nome}', dica: 'Nome do item no ERP (ex.: ABRAÇADEIRA de NYLON - 3.6x100mm - C/ 100 UN)' },
  { token: '{titulo}', dica: 'Título do anúncio (acima)' },
  { token: '{familia}', dica: 'Nome da família no ERP' },
  { token: '{marca}', dica: 'Marca do item' },
  { token: '{sku}', dica: 'SKU do item' },
];

/** Explica o modo escolhido pelo ERP. */
export const ModoPublicacaoAviso: React.FC<{ det: AnuncioDetalhe }> = ({ det }) => {
  if (det.itens.length < 2) return null;
  const variaveis = det.atributosCategoria.filter(a => a.permiteVariar).map(a => a.nome);
  if (det.modo === 'FAMILIA') {
    const eixos = det.eixos.map(e => det.atributosCategoria.find(a => a.id === e)?.nome || e).join(', ');
    return (
      <Alert type="success" showIcon style={{ marginBottom: 12 }}
        message={`Página única com opções: o comprador escolhe por ${eixos}.`}
        description="Todos os itens vão com o título do anúncio e o ML junta numa página só." />
    );
  }
  return (
    <Alert type="info" showIcon style={{ marginBottom: 12 }}
      message="Um anúncio por item, cada um com o título dele"
      description={variaveis.length
        ? `Nesta categoria o ML só deixa o comprador escolher por ${variaveis.join(', ')}, e isso não diferencia os itens. Com o mesmo título, o ML juntaria itens diferentes como se fossem o mesmo produto.`
        : 'Esta categoria não tem opções de escolha no ML: cada item vira um anúncio próprio.'} />
  );
};

/** Modelo do título dos itens (anúncios separados), com os tokens clicáveis. */
export const ModeloTituloCampo: React.FC<{ det: AnuncioDetalhe; disabled?: boolean; onSalvar: (modelo: string) => void }> = ({ det, disabled, onSalvar }) => {
  const [modelo, setModelo] = useState(det.modeloTitulo || '');
  const ref = useRef<InputRef>(null);
  useEffect(() => { setModelo(det.modeloTitulo || ''); }, [det.modeloTitulo]);

  const inserir = (token: string) => {
    const el = ref.current?.input;
    const pos = el?.selectionStart ?? modelo.length;
    const novo = `${modelo.slice(0, pos)}${modelo && pos > 0 && !modelo.slice(0, pos).endsWith(' ') ? ' ' : ''}${token}${modelo.slice(pos)}`;
    setModelo(novo);
    onSalvar(novo);
  };

  const exemplo = det.itens[0]?.tituloMl;
  const cortados = det.itens.filter(i => i.tituloCortado).length;

  return (
    <div>
      <Input
        ref={ref} value={modelo} disabled={disabled} placeholder="{nome}  (vazio = o nome do item no ERP)"
        onChange={e => setModelo(e.target.value)} onBlur={() => modelo !== (det.modeloTitulo || '') && onSalvar(modelo)}
      />
      <Space size={[4, 4]} wrap style={{ marginTop: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Inserir:</Text>
        {TOKENS_FIXOS.map(t => (
          <Tooltip key={t.token} title={t.dica}>
            <Tag style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => !disabled && inserir(t.token)}>{t.token}</Tag>
          </Tooltip>
        ))}
        {[...new Set(det.atributosErp.map(a => a.nome))].map(nome => (
          <Tooltip key={nome} title="Atributo do cadastro do item">
            <Tag color="blue" style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => !disabled && inserir(`{${nome}}`)}>{`{${nome}}`}</Tag>
          </Tooltip>
        ))}
      </Space>
      {exemplo && (
        <div style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Ex.: </Text><Text style={{ fontSize: 12 }}>{exemplo}</Text>
          {cortados > 0 && <Tag color="orange" style={{ marginLeft: 6 }}>{cortados} cortado(s) em {det.categoria?.maxTitulo || 60}</Tag>}
        </div>
      )}
    </div>
  );
};
