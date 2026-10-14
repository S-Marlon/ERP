// Aba Anúncio do editor: título (e o de cada item), categoria, tipo, condição, ajuste de preço e descrição.
// Tudo vai para o rascunho, menos a categoria (troca na hora: ela muda os atributos que o ML pede).
import React from 'react';
import { Alert, Button, Card, Col, Flex, Form, Input, InputNumber, Row, Segmented, Tag, Tooltip, Typography } from 'antd';
import { AnuncioDetalhe } from '../mercadoLivreApi';
import { ModeloTituloCampo, ModoPublicacaoAviso } from '../TituloMl';
import type { RascunhoAnuncio } from '../rascunhoAnuncio';

const { Text } = Typography;

interface Props {
  salvo: AnuncioDetalhe;
  det: AnuncioDetalhe;                      // com o rascunho aplicado
  rascunho: RascunhoAnuncio;
  onMudar: <K extends Exclude<keyof RascunhoAnuncio, 'atributos'>>(campo: K, valor: RascunhoAnuncio[K]) => void;
  onTrocarCategoria: () => void;
}

const Marca: React.FC<{ mudou: boolean }> = ({ mudou }) => (mudou ? <Tag color="processing" style={{ marginLeft: 6, fontSize: 11 }}>alterado</Tag> : null);

const AbaDados: React.FC<Props> = ({ salvo, det, rascunho, onMudar, onTrocarCategoria }) => {
  const publicado = salvo.publicados > 0;
  const max = det.categoria?.maxTitulo || 60;
  return (
    <Card size="small">
      {publicado && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message="Anúncio publicado: título e categoria ficam como estão no ML"
          description="O Mercado Livre não deixa mudar título nem categoria depois de publicado (só republicando: Encerrar no ML). O tipo só sobe (Clássico → Premium). Descrição, atributos e fotos vão pelo Salvar e enviar ao ML; preço, estoque, tipo e frete grátis vão ao salvar." />
      )}
      <ModoPublicacaoAviso det={salvo} />
      <Form layout="vertical">
        <Form.Item
          label={<>{det.modo === 'FAMILIA' ? 'Título' : 'Título do anúncio'}<Marca mudou={'titulo' in rascunho} /></>}
          help={<Text type="secondary" style={{ fontSize: 12 }}>{det.modo === 'FAMILIA' ? 'Produto + o que o comprador busca (tipo, medida, material). Sem caixa alta, sem "promoção" ou "frete grátis".' : 'Nome do grupo no ERP. No ML vai o título de cada item (abaixo).'}</Text>}
          style={{ marginBottom: 14 }}
        >
          <Input value={det.titulo || ''} maxLength={max} showCount disabled={publicado} onChange={e => onMudar('titulo', e.target.value)} />
        </Form.Item>

        {det.modo === 'SEPARADO' && (
          <Form.Item
            label={<>Título de cada item no ML<Marca mudou={'modeloTitulo' in rascunho} /></>}
            tooltip="Use os tokens: cada item recebe os valores dele. Títulos iguais travam a publicação (o ML juntaria itens diferentes)."
            style={{ marginBottom: 14 }}
          >
            <ModeloTituloCampo det={det} disabled={publicado} onSalvar={m => onMudar('modeloTitulo', m)} />
          </Form.Item>
        )}

        <Form.Item label="Categoria do Mercado Livre" style={{ marginBottom: 14 }}>
          <Flex gap={8} align="center" wrap>
            {det.categoria
              ? <Text>{det.categoria.caminho} <Tag>{det.categoria.id}</Tag>{!det.categoria.final && <Tag color="red">tem subcategorias</Tag>}</Text>
              : <Text type="danger">Nenhuma categoria escolhida</Text>}
            {!publicado && (
              <Tooltip title="A troca de categoria vale na hora (ela muda os atributos que o ML pede)">
                <Button size="small" onClick={onTrocarCategoria}>{det.categoria ? 'Trocar' : 'Escolher categoria'}</Button>
              </Tooltip>
            )}
          </Flex>
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label={<>Tipo de anúncio<Marca mudou={'tipoAnuncio' in rascunho} /></>} style={{ marginBottom: 14 }}>
              <Segmented value={det.tipoAnuncio} disabled={publicado && !salvo.vendaMl} onChange={v => onMudar('tipoAnuncio', String(v))} options={[
                { value: 'gold_special', label: 'Clássico', disabled: publicado && !!salvo.vendaMl && salvo.vendaMl.tipo !== 'gold_special' && !salvo.vendaMl.tiposPermitidos.includes('gold_special') },
                { value: 'gold_pro', label: <Tooltip title="Comissão maior, parcelamento sem juros para o comprador">Premium</Tooltip>, disabled: publicado && !!salvo.vendaMl && salvo.vendaMl.tipo !== 'gold_pro' && !salvo.vendaMl.tiposPermitidos.includes('gold_pro') },
              ]} />
            </Form.Item>
          </Col>
          <Col xs={12} md={7}>
            <Form.Item label={<>Condição<Marca mudou={'condicao' in rascunho} /></>} style={{ marginBottom: 14 }}>
              <Segmented value={det.condicao} disabled={publicado} onChange={v => onMudar('condicao', String(v))} options={[{ value: 'new', label: 'Novo' }, { value: 'used', label: 'Usado' }]} />
            </Form.Item>
          </Col>
          <Col xs={12} md={9}>
            <Form.Item
              label={<>Ajuste sobre o preço do ERP<Marca mudou={'ajustePreco' in rascunho} /></>} style={{ marginBottom: 14 }}
              tooltip="Ex.: 15% cobre a comissão. Item com preço próprio (aba Itens) ignora o ajuste."
            >
              <InputNumber value={det.ajustePreco} suffix="%" min={-50} max={300} step={1} style={{ width: '100%' }} decimalSeparator=","
                onChange={v => onMudar('ajustePreco', Number(v) || 0)} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label={<>Descrição<Marca mudou={'descricao' in rascunho} /></>} style={{ marginBottom: 0 }}>
          <Input.TextArea
            value={det.descricao} autoSize={{ minRows: 4, maxRows: 14 }} onChange={e => onMudar('descricao', e.target.value)}
            placeholder="Medidas, aplicação, material, o que vem na embalagem. Texto simples (o ML não aceita HTML nem links)."
          />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AbaDados;
