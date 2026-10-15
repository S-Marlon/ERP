// Como o anúncio vai para o ML (página única com opções x um anúncio por item), o modelo do título de cada item e a
// descrição com {Campo} (cada item recebe a sua, com a prévia).
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Input, Select, Space, Tag, Tooltip, Typography } from 'antd';
import type { InputRef } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type { AnuncioDetalhe } from './mercadoLivreApi';
import { camposDesconhecidos, descricaoDoItem, temCampos } from './descricaoModelo';

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

/** Tags clicáveis dos {Campo}: os fixos e os atributos do cadastro dos itens do anúncio. */
const TagsDeCampos: React.FC<{ det: AnuncioDetalhe; disabled?: boolean; onInserir: (token: string) => void }> = ({ det, disabled, onInserir }) => (
  <Space size={[4, 4]} wrap style={{ marginTop: 6 }}>
    <Text type="secondary" style={{ fontSize: 12 }}>Inserir:</Text>
    {TOKENS_FIXOS.map(t => (
      <Tooltip key={t.token} title={t.dica}>
        <Tag style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => !disabled && onInserir(t.token)}>{t.token}</Tag>
      </Tooltip>
    ))}
    {[...new Set(det.atributosErp.map(a => a.nome))].map(nome => (
      <Tooltip key={nome} title="Atributo do cadastro do item">
        <Tag color="blue" style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => !disabled && onInserir(`{${nome}}`)}>{`{${nome}}`}</Tag>
      </Tooltip>
    ))}
  </Space>
);

/**
 * Descrição do anúncio com {Campo}: escreve uma vez e cada item recebe a sua, com os valores dele (na publicação e no
 * "Enviar atributos, fotos e descrição"). Sem {Campo}, o texto vai igual para todos.
 */
export const DescricaoCampo: React.FC<{ det: AnuncioDetalhe; onMudar: (texto: string) => void }> = ({ det, onMudar }) => {
  const ref = useRef<TextAreaRef>(null);
  const [idLinha, setIdLinha] = useState<number | null>(null);
  const texto = det.descricao || '';
  const item = det.itens.find(i => i.idLinha === idLinha) || det.itens[0];
  const desconhecidos = camposDesconhecidos(texto, det);

  const inserir = (token: string) => {
    const el = ref.current?.resizableTextArea?.textArea;
    const ini = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? ini;
    onMudar(`${texto.slice(0, ini)}${token}${texto.slice(fim)}`);
    // volta o cursor para depois do campo inserido
    window.setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(ini + token.length, ini + token.length); } }, 0);
  };

  return (
    <div>
      <Input.TextArea
        ref={ref} value={texto} autoSize={{ minRows: 5, maxRows: 16 }} onChange={e => onMudar(e.target.value)}
        placeholder={'Medidas, aplicação, material, o que vem na embalagem. Texto simples (o ML não aceita HTML nem links).\nUse {Campo} para cada item sair com o valor dele, ex.: Abraçadeira {Cor} de {Tamanho} mm.'}
      />
      <TagsDeCampos det={det} onInserir={inserir} />
      {desconhecidos.length > 0 && (
        <Alert type="warning" showIcon style={{ marginTop: 8, padding: '4px 10px' }}
          message={`Campo que não existe: ${desconhecidos.map(c => `{${c}}`).join(', ')} (sai em branco). Use as etiquetas acima para não errar o nome.`} />
      )}
      {temCampos(texto) && item && (
        <div style={{ marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 10px', background: '#fafafa' }}>
          <Space size={6} wrap style={{ marginBottom: 6 }}>
            <Tag color="processing" style={{ margin: 0 }}>cada item recebe a sua</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>Prévia de</Text>
            <Select size="small" style={{ minWidth: 260 }} value={item.idLinha} onChange={setIdLinha} showSearch optionFilterProp="label"
              options={det.itens.map(i => ({ value: i.idLinha, label: `${i.sku} · ${i.tituloMl || i.nome}` }))} />
          </Space>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{descricaoDoItem(texto, item, det) || <Text type="secondary">(vazia)</Text>}</div>
        </div>
      )}
    </div>
  );
};
