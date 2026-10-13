// Visualizador das alterações do editor: o que mudou (antes → depois), desfazer por linha ou tudo,
// e o que vai ao ML ao salvar.
import React from 'react';
import { Button, Card, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import { ArrowRightOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons';
import type { Alteracao } from '../rascunhoAnuncio';

const { Text } = Typography;

const VAI_AO_ML: Record<Alteracao['vaiAoMl'], { texto: string; cor: string; dica: string } | null> = {
  NA_HORA: { texto: 'vai ao ML', cor: 'green', dica: 'Ao salvar, vai sozinho para o Mercado Livre.' },
  BOTAO: { texto: 'enviar ao ML', cor: 'gold', dica: 'Vai ao Mercado Livre pelo "Salvar e enviar ao ML".' },
  NAO: null,
};

interface Props { alteracoes: Alteracao[]; onDesfazer: (chave: string) => void; onDesfazerTudo: () => void }

const PainelAlteracoes: React.FC<Props> = ({ alteracoes, onDesfazer, onDesfazerTudo }) => {
  const grupos = [...new Set(alteracoes.map(a => a.grupo))];
  return (
    <Card
      size="small" style={{ marginBottom: 12, borderColor: alteracoes.length ? '#91caff' : undefined }}
      title={<Space><EditOutlined style={{ color: alteracoes.length ? '#1677ff' : undefined }} />Alterações não salvas{alteracoes.length ? ` (${alteracoes.length})` : ''}</Space>}
      extra={alteracoes.length > 0 && <Button size="small" type="link" icon={<UndoOutlined />} onClick={onDesfazerTudo}>Desfazer tudo</Button>}
      styles={{ body: { maxHeight: 300, overflowY: 'auto', padding: alteracoes.length ? '4px 12px 8px' : 12 } }}
    >
      {alteracoes.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 0 }}
          description={<Text type="secondary" style={{ fontSize: 12 }}>Nada a salvar. As mudanças aparecem aqui antes de ir para o banco e o ML.</Text>} />
      ) : grupos.map(g => (
        <div key={g} style={{ marginTop: 6 }}>
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{g}</Text>
          {alteracoes.filter(a => a.grupo === g).map(a => (
            <div key={a.chave} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px dashed #f0f0f0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space size={4} wrap>
                  <Text strong style={{ fontSize: 13 }}>{a.rotulo}</Text>
                  {VAI_AO_ML[a.vaiAoMl] && <Tooltip title={VAI_AO_ML[a.vaiAoMl]!.dica}><Tag color={VAI_AO_ML[a.vaiAoMl]!.cor} style={{ fontSize: 10, margin: 0 }}>{VAI_AO_ML[a.vaiAoMl]!.texto}</Tag></Tooltip>}
                </Space>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  <Text delete type="secondary" style={{ fontSize: 12 }}>{a.antes}</Text>
                  <ArrowRightOutlined style={{ margin: '0 6px', fontSize: 10, color: '#8c8c8c' }} />
                  <Text style={{ fontSize: 12, color: '#237804' }}>{a.depois}</Text>
                </div>
              </div>
              <Tooltip title="Desfazer"><Button size="small" type="text" icon={<UndoOutlined />} onClick={() => onDesfazer(a.chave)} /></Tooltip>
            </div>
          ))}
        </div>
      ))}
      {alteracoes.length > 0 && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          Fotos, adicionar/tirar itens, trocar a categoria e as ações (publicar, pausar, encerrar) valem na hora e não entram aqui.
        </Text>
      )}
    </Card>
  );
};

export default PainelAlteracoes;
