// Ajuda rápida: anunciar no catálogo do Mercado Livre ou criar anúncio próprio.
import React, { useState } from 'react';
import { Button, Modal, Table, Tag, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text, Title } = Typography;

const LINHAS = [
  { tipo: 'Marca conhecida com código de barras (Starrett, Tramontina, Vonder…)', onde: 'Catálogo (e próprio junto, se o ML deixar)', cor: 'blue', porque: 'O comprador procura o produto exato e o catálogo concentra as vendas.' },
  { tipo: 'Genérico / sem marca (abraçadeiras, terminais e conexões JIC, adaptadores)', onde: 'Próprio', cor: 'green', porque: 'Normalmente não existe catálogo; o seu título com a medida exata é o que vende.' },
  { tipo: 'Kits e pacotes seus (Kit Registro, pacote c/12)', onde: 'Próprio', cor: 'green', porque: 'A combinação é sua: não existe no catálogo.' },
];

const AjudaCatalogo: React.FC = () => {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button icon={<QuestionCircleOutlined />} onClick={() => setAberto(true)}>Catálogo ou anúncio próprio?</Button>
      <Modal open={aberto} onCancel={() => setAberto(false)} footer={null} width={760} title="Catálogo do Mercado Livre ou anúncio próprio?">
        <Title level={5}>Anúncio de catálogo (o "padrão do Meli")</Title>
        <Paragraph>
          O ML já tem a página do produto (título, fotos e ficha). Vários vendedores disputam o <b>botão de compra</b> dessa página:
          ganha quem tem a melhor combinação de preço, frete, reputação e prazo.
        </Paragraph>
        <Paragraph>
          <Text type="success">Bom:</Text> muita visibilidade, sem montar título nem fotos.{' '}
          <Text type="danger">Ruim:</Text> guerra de preço direta, não controla título/fotos/descrição e o produto precisa bater exatamente com o do catálogo
          (marca, modelo, código de barras).
        </Paragraph>

        <Title level={5}>Anúncio próprio (o que o ERP publica)</Title>
        <Paragraph>
          A página é sua: título, fotos, descrição e atributos. <b>Não precisa de aprovação</b> (só a moderação normal do ML).{' '}
          <Text type="success">Bom:</Text> não divide a página com concorrente.{' '}
          <Text type="danger">Ruim:</Text> em produto que tem catálogo, costuma aparecer abaixo da página do catálogo na busca.
        </Paragraph>

        <Title level={5}>"Criar o meu e aguardar aprovação"</Title>
        <Paragraph>
          É sugerir um produto novo para o catálogo do ML. Demora, pode ser recusado e, para peça técnica sem marca forte, quase nunca compensa.
        </Paragraph>

        <Title level={5}>Na loja</Title>
        <Table
          size="small" pagination={false} rowKey="tipo" dataSource={LINHAS}
          columns={[
            { title: 'Tipo de produto', dataIndex: 'tipo' },
            { title: 'Onde', dataIndex: 'onde', width: 170, render: (v, l) => <Tag color={l.cor}>{v}</Tag> },
            { title: 'Por quê', dataIndex: 'porque' },
          ]}
        />
        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Em algumas categorias o ML <b>obriga</b> o catálogo quando o produto existe nele: o "Conferir no ML" avisa quando for o caso.
        </Paragraph>
      </Modal>
    </>
  );
};

export default AjudaCatalogo;
