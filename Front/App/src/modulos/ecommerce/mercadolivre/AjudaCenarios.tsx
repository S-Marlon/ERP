// Ajuda: quando vale o frete grátis e quando escolher Clássico ou Premium (lida junto com a tabela de cenários).
import React, { useState } from 'react';
import { Button, Modal, Table, Tag, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text, Title } = Typography;

const REGRAS = [
  { quando: 'Item barato (até ~R$ 30)', frete: 'Em geral não', tipo: 'Clássico', cor: 'orange', porque: 'O frete come quase todo o lucro e ninguém parcela compra pequena. Melhor: pacote/kit ou preço por quantidade.' },
  { quando: 'Item médio (R$ 30 a R$ 79)', frete: 'Depende da conta', tipo: 'Clássico', cor: 'blue', porque: 'Use a coluna "para lucrar o mesmo": se o frete grátis precisa de 2× ou menos de vendas, costuma valer; 4× ou mais, raramente.' },
  { quando: 'A partir de R$ 79', frete: 'Obrigatório', tipo: 'Premium tende a valer', cor: 'green', porque: 'O ML obriga o frete grátis (ele entra no preço). O parcelamento sem juros do Premium pesa na decisão de quem compra caro.' },
  { quando: 'Concorrentes todos com frete grátis', frete: 'Quase obrigatório', tipo: '—', cor: 'purple', porque: 'Sem o selo você aparece pouco na busca: se a margem não aguenta, ajuste o preço (coluna "preço p/ alvo") ou venda em pacote.' },
];

const AjudaCenarios: React.FC = () => {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button size="small" icon={<QuestionCircleOutlined />} onClick={() => setAberto(true)}>Como decidir?</Button>
      <Modal open={aberto} onCancel={() => setAberto(false)} footer={null} width={800} title="Frete grátis, Clássico ou Premium: como decidir">
        <Title level={5}>A pergunta certa: quanto preciso vender a mais?</Title>
        <Paragraph>
          Cada cenário dá um lucro <b>por venda</b>. O que importa é o lucro <b>no mês</b>: lucro por venda × vendas. Frete grátis e Premium
          diminuem o lucro por venda, mas podem aumentar as vendas (selo de frete grátis, melhor posição na busca, parcelamento sem juros).
        </Paragraph>
        <Paragraph>
          Exemplo (abraçadeira a R$ 12,74): Premium sem frete grátis dá <b>R$ 7,07</b> por venda; com frete grátis, <b>R$ 1,12</b>.
          Vendendo 10 por mês hoje (R$ 70,70), o frete grátis precisaria fazer você vender <b>64 por mês (6,4×)</b> só para empatar.
          É isso que a coluna <Text code>Para lucrar o mesmo</Text> mostra: informe quanto você vende hoje e compare.
        </Paragraph>
        <Paragraph>
          <Text strong>Regra prática:</Text> até <Tag color="green">2×</Tag> costuma valer testar; de 2× a 4× só se os concorrentes todos têm;
          <Tag color="red">4× ou mais</Tag> quase nunca compensa.
        </Paragraph>

        <Title level={5}>Resumo por faixa de preço</Title>
        <Table
          size="small" pagination={false} rowKey="quando" dataSource={REGRAS} style={{ marginBottom: 16 }}
          columns={[
            { title: 'Situação', dataIndex: 'quando', width: 190, render: v => <Text strong>{v}</Text> },
            { title: 'Frete grátis', dataIndex: 'frete', width: 130, render: (v, r) => <Tag color={r.cor}>{v}</Tag> },
            { title: 'Tipo', dataIndex: 'tipo', width: 130 },
            { title: 'Por quê', dataIndex: 'porque' },
          ]}
        />

        <Title level={5}>Clássico × Premium</Title>
        <Paragraph>
          O Premium cobra cerca de <b>5 pontos a mais</b> de comissão (ex.: 17% contra 12%) e dá parcelamento sem juros e um pouco mais de exposição.
          Em item barato ninguém parcela: <b>Clássico</b>. A partir de ~R$ 100–150 o parcelamento pesa e o <b>Premium</b> tende a pagar a diferença.
        </Paragraph>

        <Title level={5}>Usando o preço a seu favor</Title>
        <Paragraph>
          A coluna <Text code>Preço p/ alvo</Text> mostra, em cada cenário, o menor preço que ainda dá a sua margem alvo. Se o preço com frete grátis
          ainda fica competitivo (compare com "Por unidade" e o mercado), dá para oferecer frete grátis sem perder margem. Cuidado com os degraus:
          até R$ 12,50 o ML cobra taxa fixa e a partir de R$ 79 o frete grátis fica mais caro.
        </Paragraph>

        <Title level={5}>Confirme com números reais</Title>
        <Paragraph style={{ marginBottom: 0 }}>
          Faça o teste: 2 a 3 semanas num cenário, depois no outro. Compare visitas e conversão nas métricas do ML e o lucro de verdade em
          <b> Pedidos › Resultado real</b>. Com histórico, a decisão deixa de ser palpite.
        </Paragraph>
      </Modal>
    </>
  );
};

export default AjudaCenarios;
