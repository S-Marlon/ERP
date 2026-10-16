// Guia: como baixar o frete no Mercado Livre. Cobre o que a central de sugestões não consegue ver sozinha
// (produto que dobra ou enrola, embalagem que dá para trocar) e mostra as faixas de frete lidas do ML na hora.
import React, { useState } from 'react';
import { Alert, Button, Modal, Spin, Table, Tag, Typography } from 'antd';
import { CarOutlined } from '@ant-design/icons';
import { anunciosApi, FaixasFrete, formatarMoeda } from './mercadoLivreApi';

const { Paragraph, Text, Title } = Typography;

const PRODUTOS = [
  { tipo: 'Flexíveis: abraçadeiras, mangueiras, cabos, correias, fitas', cor: 'green', como: 'Dobrar ou enrolar e embalar já assim. A caixa fica do tamanho do rolo, não do produto esticado.' },
  { tipo: 'Peças pequenas: terminais, conexões, parafusos, anéis', cor: 'green', como: 'Envelope plástico ou de bolha no lugar da caixa: o pacote pesa menos e o volume quase some.' },
  { tipo: 'Produto que chega em caixa grande do fornecedor', cor: 'gold', como: 'Trocar pela sua embalagem justa. Caixa com sobra paga pelo volume (ar também é cobrado).' },
  { tipo: 'Pesados e compactos: rolamentos, buchas, peças de aço', cor: 'blue', como: 'Aqui o peso manda: caixa justa e calço leve (papel, plástico bolha), nada de madeira ou papelão grosso.' },
  { tipo: 'Kits do mesmo item', cor: 'purple', como: 'Várias unidades num pacote só costumam ficar na mesma faixa de peso de uma: o frete quase não sobe e o kit passa de R$ 79.' },
];

const gramas = (g: number) => (g >= 1000 ? `${g / 1000} kg` : `${g} g`);

const AjudaFrete: React.FC<{ pequeno?: boolean }> = ({ pequeno }) => {
  const [aberto, setAberto] = useState(false);
  const [faixas, setFaixas] = useState<FaixasFrete | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrir = () => {
    setAberto(true);
    if (!faixas) anunciosApi.faixasFrete().then(setFaixas).catch(e => setErro(e instanceof Error ? e.message : String(e)));
  };
  const m = (v: number | null) => (v === null ? '—' : formatarMoeda(v));

  return (
    <>
      {pequeno
        ? <Button size="small" type="link" icon={<CarOutlined />} onClick={abrir}>Como baixar o frete?</Button>
        : <Button icon={<CarOutlined />} onClick={abrir}>Como baixar o frete?</Button>}
      <Modal open={aberto} onCancel={() => setAberto(false)} footer={null} width={820} title="Como baixar o frete no Mercado Livre?">
        <Title level={5}>Como o ML cobra</Title>
        <Paragraph>
          O frete sai pelo <b>maior</b> entre o peso real do pacote e o <b>peso de volume</b>: comprimento × largura × altura (cm) ÷ 6.
          Uma caixa de 43 × 19 × 4 cm conta <b>545 g</b> mesmo pesando 425 g. Depois o peso cai numa faixa, e cada faixa tem um preço.
        </Paragraph>

        <Title level={5}>As faixas hoje (lidas do ML agora)</Title>
        {erro ? <Alert type="error" showIcon message={erro} /> : !faixas ? <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div> : (
          <Table
            size="small" pagination={false} rowKey="ateG" dataSource={faixas.linhas}
            columns={[
              { title: 'Pacote de até', dataIndex: 'ateG', render: gramas },
              { title: 'Abaixo de R$ 79, frete grátis ligado', dataIndex: 'gratisAbaixo79', render: m },
              { title: 'Abaixo de R$ 79, comprador paga (R$ 20 · R$ 50)', render: (_, l) => `${m(l.compradorPaga20)} · ${m(l.compradorPaga50)}` },
              { title: 'R$ 79 ou mais (grátis obrigatório)', dataIndex: 'acima79', render: m },
            ]}
          />
        )}
        <Paragraph type="secondary" style={{ marginTop: 6 }}>
          Valores que <b>você</b> paga por venda. Abaixo de R$ 79, mesmo com o comprador pagando o envio, o ML cobra a tarifa de envio do item barato.
          A diferença entre as faixas é pequena perto da diferença entre ligar ou não o frete grátis abaixo de R$ 79.
        </Paragraph>

        <Title level={5}>O que o sistema avisa sozinho</Title>
        <Paragraph>
          Em <b>Sugestões</b>: frete grátis ligado abaixo de R$ 79, embalagem que paga por volume, peso perto de uma faixa mais barata,
          kit que passa de R$ 79, preço abaixo do alvo e peso ou medidas diferentes entre o ERP e o ML.
        </Paragraph>

        <Title level={5}>O que só você sabe: o produto e a embalagem</Title>
        <Paragraph>O sistema não sabe se o produto dobra ou se a embalagem pode mudar. Veja pelo tipo:</Paragraph>
        <Table
          size="small" pagination={false} rowKey="tipo" dataSource={PRODUTOS}
          columns={[
            { title: 'Tipo de produto', dataIndex: 'tipo', width: 300, render: (v, l) => <Tag color={l.cor} style={{ whiteSpace: 'normal' }}>{v}</Tag> },
            { title: 'Como baixar', dataIndex: 'como' },
          ]}
        />

        <Title level={5} style={{ marginTop: 16 }}>Regras de ouro</Title>
        <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
          <li><b>Declare o pacote como ele sai</b>, nunca menor. O ML pesa e mede no centro de distribuição: se for maior, cobra a diferença e corrige o anúncio.</li>
          <li><b>Pese numa balança</b> com a embalagem fechada. Peso "de cabeça" costuma sair maior que o real e joga para a faixa de cima.</li>
          <li><b>Meça os três lados</b> com o pacote fechado e arredonde para cima.</li>
          <li>Ponha no cadastro (<Text code>Itens e estoque › Cadastro</Text>) e mande ao ML com <b>Enviar atributos, fotos e descrição</b>: assim o frete do ERP e o do ML ficam iguais.</li>
        </ul>
      </Modal>
    </>
  );
};

export default AjudaFrete;
