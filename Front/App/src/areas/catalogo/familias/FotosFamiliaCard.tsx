// Fotos da família na tela de famílias: a galeria (a 1ª é a modelo) e o editor de imagem, que aplica as cotas e
// textos em todos os itens ativos da família, cada um com a sua medida (a imagem entra como 2ª foto de cada item).
import React, { useState } from 'react';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { EditOutlined, PictureOutlined } from '@ant-design/icons';
import GaleriaFamilia from './GaleriaFamilia';
import EditorDaFamilia from './EditorDaFamilia';

const { Text } = Typography;

const FotosFamiliaCard: React.FC<{ idFamilia: number; qtdItens?: number }> = ({ idFamilia, qtdItens }) => {
  const [editor, setEditor] = useState<{ idFoto: number | null; vez: number } | null>(null);
  const [versao, setVersao] = useState(0);
  const abrir = (idFoto: number | null) => setEditor(e => ({ idFoto, vez: (e?.vez || 0) + 1 }));
  return (
    <Card
      size="small"
      title={<Space><PictureOutlined />Fotos da família<Tag color="purple">valem para todas as variações</Tag></Space>}
      extra={(
        <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => abrir(null)}>
          Editor de imagem{qtdItens ? ` (${qtdItens} itens)` : ''}
        </Button>
      )}
    >
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        Papel de cada foto (troque na etiqueta): <b>principal</b> (foto limpa do produto: 1ª das variações sem foto limpa própria), <b>comum</b>
        (entra em todas) ou <b>só editor</b> (gabarito, não vai ao ML). O lápis abre o editor na foto: as cotas vão para cada item com a medida dele.
      </Text>
      <GaleriaFamilia idFamilia={idFamilia} tamanho={80} recarregar={versao} onEditar={idFoto => abrir(idFoto)} />
      <EditorDaFamilia idFamilia={idFamilia} aberto={editor} onFechar={() => setEditor(null)} onSalvo={() => setVersao(v => v + 1)} />
    </Card>
  );
};

export default FotosFamiliaCard;
