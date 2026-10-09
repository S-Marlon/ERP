// Resumo de nomenclatura da família (modelos e um exemplo) + botão para o editor de nomes e SKUs das variações.
import React, { useState } from 'react';
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { EditOutlined, WarningOutlined } from '@ant-design/icons';
import { Familia, ItemAssociado } from '../CatalogManager.types';
import { EditorNomenclaturaModal } from './EditorNomenclaturaModal';

const { Text } = Typography;

interface PainelSimuladorProps {
  familiaSelecionada?: Familia;
  onAtualizarTemplateComercial: (valor: string) => void;
  onAtualizarTemplateSku: (valor: string) => void;
  onAtualizarSiglaSku: (valor: string) => void;
  onAtualizarSeparadorSku?: (valor: string) => void;
  previewNomeSimulado: string;
  previewSkuSimulado: string;
  brandColor?: string;
  itensDaFamilia?: ItemAssociado[];
  /** A família tem alterações não salvas */
  temAlteracoes?: boolean;
  onSalvarFamilia?: () => Promise<unknown> | void;
  /** Variações gravadas pelo editor: recarregar os itens */
  onVariacoesGravadas?: () => void;
  // Mantidos por compatibilidade com quem ainda passa (o editor novo não usa)
  valoresTeste?: Record<string, string>;
  onMudancaValorTeste?: (id: string, valor: string) => void;
  onAtualizarOrdemSku?: (atributoId: string, ordem: number) => void;
  carregandoItens?: boolean;
}

export const PainelSimulador: React.FC<PainelSimuladorProps> = ({
  familiaSelecionada, onAtualizarTemplateComercial, onAtualizarTemplateSku, onAtualizarSiglaSku, onAtualizarSeparadorSku,
  previewNomeSimulado, previewSkuSimulado, brandColor = '#1677ff', itensDaFamilia = [], temAlteracoes, onSalvarFamilia, onVariacoesGravadas,
}) => {
  const [aberto, setAberto] = useState(false);
  const temGradeNoSku = (familiaSelecionada?.atributos || []).some(a => a.classificacao === 'grade'
    && new RegExp(`\\{${a.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'i').test(familiaSelecionada?.templateSku || ''));

  return (
    <>
      <Card
        size="small"
        style={{ borderRadius: 10, height: '100%' }}
        title={(
          <Space size={6}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: brandColor, display: 'inline-block' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Nomes e SKUs</span>
          </Space>
        )}
        extra={(
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => setAberto(true)} style={{ background: brandColor, borderColor: brandColor }}>
            Editar variações ({itensDaFamilia.length})
          </Button>
        )}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Row gutter={8}>
            <Col xs={24} sm={16}>
              <Text type="secondary" style={{ fontSize: 10, display: 'block', fontWeight: 600 }}>MODELO DO NOME</Text>
              <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{familiaSelecionada?.templateNomeComercial || '{FAMILIA}'}</Text>
              <Text style={{ fontSize: 12, fontWeight: 700, display: 'block' }}>{previewNomeSimulado}</Text>
            </Col>
            <Col xs={24} sm={8}>
              <Text type="secondary" style={{ fontSize: 10, display: 'block', fontWeight: 600 }}>MODELO DO SKU</Text>
              <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{familiaSelecionada?.templateSku || '—'}</Text>
              <Text style={{ color: brandColor, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', display: 'block' }}>{previewSkuSimulado}</Text>
            </Col>
          </Row>
          {!temGradeNoSku && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <WarningOutlined style={{ color: '#d97706', fontSize: 12 }} />
              <Text style={{ fontSize: 11, color: '#b45309' }}>
                O modelo do SKU não usa nenhum atributo de <b>grade</b>: as variações podem ficar com o mesmo SKU.
              </Text>
            </div>
          )}
        </Space>
      </Card>

      <EditorNomenclaturaModal
        open={aberto}
        onClose={() => setAberto(false)}
        familia={familiaSelecionada}
        temAlteracoes={temAlteracoes}
        onSalvarFamilia={onSalvarFamilia}
        onAtualizarTemplateComercial={onAtualizarTemplateComercial}
        onAtualizarTemplateSku={onAtualizarTemplateSku}
        onAtualizarSiglaSku={onAtualizarSiglaSku}
        onAtualizarSeparadorSku={onAtualizarSeparadorSku}
        onSalvo={onVariacoesGravadas}
      />
    </>
  );
};
