// Na linha do item do anúncio: código de barras (GTIN) e peso/medidas da embalagem, que o ML pede e que ficam no
// cadastro do produto. Mostra o que já tem e, faltando, um botão para preencher ali mesmo (grava no cadastro do ERP).
import React, { useState } from 'react';
import { Button, Flex, Input, Popover, Space, Tooltip, Typography, message } from 'antd';
import { BarcodeOutlined, InboxOutlined } from '@ant-design/icons';
import type { ItemDoAnuncio } from '../mercadoLivreApi';
import { salvarGtin, updateProduto } from '../../../../areas/catalogo/skus/CatalogSku.service';
import { normalizarGtin, validarGtin } from '../../../../areas/compras/entradaNf/gtin';
import { rotuloDaUnidade } from '../linhasAnuncio';
import { CampoNumero } from '../../../../shared/formularios/CamposNumero';

const { Text } = Typography;

interface Props { item: ItemDoAnuncio; disabled?: boolean; onSalvo: () => void }

const erroMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erro ao salvar no cadastro.');

/** GTIN da linha: na linha em kit, o código da embalagem do kit (não o da unidade). */
export const GtinDoItem: React.FC<Props> = ({ item, disabled, onSalvo }) => {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(item.gtin || '');
  const [salvando, setSalvando] = useState(false);
  const codigo = normalizarGtin(valor);
  const invalido = !!codigo && !validarGtin(codigo);
  const salvar = async (novo: string) => {
    setSalvando(true);
    try {
      await salvarGtin(item.idItem, item.unidadeMl?.idUnidade ?? null, novo);
      message.success(novo ? `Código de barras de ${item.sku} salvo no cadastro.` : `Código de barras de ${item.sku} retirado.`);
      setAberto(false);
      onSalvo();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setSalvando(false);
    }
  };
  const conteudo = (
    <Flex vertical gap={8} style={{ width: 280 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {item.unidadeMl ? `Código da embalagem ${rotuloDaUnidade(item)} (não o da unidade).` : 'Código de barras da unidade (o da etiqueta do produto).'}
      </Text>
      {item.unidadeMl && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Kit montado na loja não tem código próprio: deixe vazio e o ML recebe "é um kit ou pack". Use só se a embalagem do kit
          vier com um código impresso diferente do da unidade.
        </Text>
      )}
      <Input autoFocus value={valor} onChange={e => setValor(e.target.value)} onPressEnter={() => !invalido && salvar(codigo)}
        placeholder="EAN de 8, 12, 13 ou 14 dígitos" status={invalido ? 'error' : undefined} maxLength={20} />
      {invalido && <Text type="danger" style={{ fontSize: 12 }}>Não confere: falta um número ou o último (verificador) está errado.</Text>}
      <Flex gap={6} justify="space-between">
        {item.gtin ? <Button size="small" danger onClick={() => salvar('')} loading={salvando}>Tirar</Button> : <span />}
        <Button type="primary" size="small" disabled={invalido || !codigo || codigo === item.gtin} loading={salvando} onClick={() => salvar(codigo)}>Salvar no cadastro</Button>
      </Flex>
      <Text type="secondary" style={{ fontSize: 11 }}>Sem código? Dá para publicar: vai como "produto sem código" (o aviso continua).</Text>
    </Flex>
  );
  return (
    <Popover trigger="click" open={aberto} onOpenChange={v => { setAberto(v); if (v) setValor(item.gtin || ''); }} title="Código de barras (GTIN)" content={conteudo}>
      {item.gtin
        ? <Tooltip title={`GTIN ${item.gtin}: clique para trocar`}><Button type="text" size="small" disabled={disabled} icon={<BarcodeOutlined style={{ color: '#52c41a' }} />} /></Tooltip>
        : <Button size="small" type="dashed" disabled={disabled} icon={<BarcodeOutlined />} style={{ color: '#d46b08', borderColor: '#ffd591', fontSize: 12 }}>GTIN</Button>}
    </Popover>
  );
};

/** Peso (kg) e medidas (cm) de uma unidade do produto; no kit o peso vai multiplicado ao ML. */
export const EmbalagemDoItem: React.FC<Props> = ({ item, disabled, onSalvo }) => {
  const [aberto, setAberto] = useState(false);
  const inicial = () => ({ peso: item.pesoKg, altura: item.medidasCm?.altura ?? null, largura: item.medidasCm?.largura ?? null, comprimento: item.medidasCm?.comprimento ?? null });
  const [v, setV] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const completo = !!item.pesoKg && !!item.medidasCm;
  const pronto = [v.peso, v.altura, v.largura, v.comprimento].every(x => x !== null && Number(x) > 0);
  const salvar = async () => {
    setSalvando(true);
    try {
      await updateProduto(item.idItem, { peso_bruto: v.peso, altura_cm: v.altura, largura_cm: v.largura, comprimento_cm: v.comprimento });
      message.success(`Peso e medidas de ${item.sku} salvos no cadastro.`);
      setAberto(false);
      onSalvo();
    } catch (e) {
      message.error(erroMsg(e));
    } finally {
      setSalvando(false);
    }
  };
  const campo = (chave: 'altura' | 'largura' | 'comprimento', rotulo: string) => (
    <div style={{ flex: 1 }}>
      <Text type="secondary" style={{ fontSize: 11 }}>{rotulo}</Text>
      <CampoNumero min={0.1} step={0.5} value={v[chave] ?? undefined} onChange={x => setV(o => ({ ...o, [chave]: x ?? null }))} style={{ width: '100%' }} />
    </div>
  );
  const conteudo = (
    <Flex vertical gap={8} style={{ width: 300 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Embalagem de <b>uma unidade</b>, como vai ao comprador.{item.unidadeMl ? ` No ${rotuloDaUnidade(item)} o peso vai multiplicado.` : ''}
      </Text>
      <div>
        <Text type="secondary" style={{ fontSize: 11 }}>Peso (kg)</Text>
        <CampoNumero min={0.001} step={0.05} value={v.peso ?? undefined} onChange={x => setV(o => ({ ...o, peso: x ?? null }))} style={{ width: '100%' }} addonAfter="kg" />
      </div>
      <Space.Compact style={{ width: '100%', gap: 6 }}>
        {campo('altura', 'Altura (cm)')}
        {campo('largura', 'Largura (cm)')}
        {campo('comprimento', 'Compr. (cm)')}
      </Space.Compact>
      <Flex justify="flex-end">
        <Button type="primary" size="small" disabled={!pronto} loading={salvando} onClick={salvar}>Salvar no cadastro</Button>
      </Flex>
    </Flex>
  );
  return (
    <Popover trigger="click" open={aberto} onOpenChange={x => { setAberto(x); if (x) setV(inicial()); }} title="Peso e medidas da embalagem" content={conteudo}>
      {completo
        ? <Tooltip title={`${item.pesoKg} kg · ${item.medidasCm!.altura}×${item.medidasCm!.largura}×${item.medidasCm!.comprimento} cm: clique para trocar`}><Button type="text" size="small" disabled={disabled} icon={<InboxOutlined style={{ color: '#52c41a' }} />} /></Tooltip>
        : <Button size="small" type="dashed" disabled={disabled} icon={<InboxOutlined />} style={{ color: '#d46b08', borderColor: '#ffd591', fontSize: 12 }}>Peso/medidas</Button>}
    </Popover>
  );
};
