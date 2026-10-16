// Ficha de cada forma de venda do produto: cada atributo com de onde vem, o que o ERP manda e o que está no anúncio
// do ML. A ligação (do cadastro, marca ou valor fixo) é do anúncio inteiro e se muda no Geral › Ficha do anúncio;
// aqui se vê, por forma, o resultado e o que está diferente do ML.
import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Flex, Segmented, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import { DownloadOutlined, SettingOutlined } from '@ant-design/icons';
import { AnuncioDetalhe, anunciosApi, FichaForma, LinhaFicha, PacoteMl } from '../mercadoLivreApi';
import { rotuloDaUnidade } from '../linhasAnuncio';

const { Text } = Typography;

const ORIGEM: Record<LinhaFicha['origem'], { texto: string; cor: string; dica: string }> = {
  cadastro: { texto: 'do cadastro', cor: 'blue', dica: 'Vem de um dado do cadastro do item (muda por item)' },
  marca: { texto: 'marca', cor: 'geekblue', dica: 'A marca do item no cadastro' },
  fixo: { texto: 'valor fixo', cor: 'purple', dica: 'O mesmo valor para o anúncio todo (Ficha do anúncio)' },
  automatico: { texto: 'automático', cor: 'cyan', dica: 'O ERP preenche sozinho (SKU, código de barras, embalagem, unidades por kit)' },
  nenhuma: { texto: 'não ligado', cor: 'default', dica: 'O ERP não manda este atributo: ligue na Ficha do anúncio (Geral) se quiser mandar' },
};

const SITUACAO: Record<LinhaFicha['situacao'], { texto: string; cor: string; dica: string }> = {
  FALTA: { texto: 'falta', cor: 'red', dica: 'Obrigatório e sem valor no ERP nem no ML' },
  DIFERENTE: { texto: 'diferente', cor: 'orange', dica: 'O ERP manda um valor diferente do que está no ML: "Enviar atributos, fotos e descrição" troca pelo do ERP' },
  SO_ML: { texto: 'só no ML', cor: 'gold', dica: 'O ML tem um valor que o ERP não manda (fica como está no ML)' },
  A_PUBLICAR: { texto: 'a publicar', cor: 'default', dica: 'Ainda não está no ML: vai na publicação' },
  IGUAL: { texto: 'igual', cor: 'green', dica: 'O ERP e o ML têm o mesmo valor' },
  SEM_VALOR: { texto: 'vazio', cor: 'default', dica: 'Opcional e sem valor (preencher ajuda na busca do ML)' },
};

const PEDEM_ATENCAO: LinhaFicha['situacao'][] = ['FALTA', 'DIFERENTE', 'SO_ML'];

const FichaDoProduto: React.FC<{
  det: AnuncioDetalhe;                                   // só as linhas do produto
  onIrParaFichaDoAnuncio: () => void;
  onTrazerPacote: (linha: { idItem: number; sku: string; pacoteMl: PacoteMl }) => void;
}> = ({ det, onIrParaFichaDoAnuncio, onTrazerPacote }) => {
  const [idLinha, setIdLinha] = useState<number | null>(det.itens[0]?.idLinha ?? null);
  const [ficha, setFicha] = useState<FichaForma | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'atencao' | 'todos'>('atencao');
  const linha = det.itens.find(i => i.idLinha === idLinha) || det.itens[0];

  useEffect(() => {
    if (!linha) return;
    let vivo = true;
    setFicha(null); setErro(null);
    anunciosApi.ficha(det.id, linha.idLinha).then(r => vivo && setFicha(r)).catch(e => vivo && setErro(e instanceof Error ? e.message : 'Erro.'));
    return () => { vivo = false; };
  }, [det, linha?.idLinha]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!linha) return <Card size="small"><Empty description="Sem formas de venda" /></Card>;
  const contagem = (s: LinhaFicha['situacao']) => (ficha?.linhas || []).filter(l => l.situacao === s).length;
  const atencao = (ficha?.linhas || []).filter(l => PEDEM_ATENCAO.includes(l.situacao)).length;
  const visiveis = (ficha?.linhas || []).filter(l => filtro === 'todos' || PEDEM_ATENCAO.includes(l.situacao) || l.obrigatorio);

  return (
    <Card
      size="small"
      title={(
        <Flex align="center" gap={10} wrap>
          <Text strong>Ficha</Text>
          {det.itens.length > 1 && (
            <Segmented
              size="small" value={linha.idLinha} onChange={v => setIdLinha(Number(v))}
              options={det.itens.map(l => ({ value: l.idLinha, label: l.unidadeMl ? `Kit c/${l.unidadeMl.fator}` : 'Unidade' }))}
            />
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>{linha.sku}{linha.unidadeMl ? ` · ${rotuloDaUnidade(linha)}` : ''}{ficha?.mlbId ? ` · ${ficha.mlbId}` : ''}</Text>
        </Flex>
      )}
      extra={<Button size="small" icon={<SettingOutlined />} onClick={onIrParaFichaDoAnuncio}>Mudar de onde vem (Ficha do anúncio)</Button>}
    >
      {erro && <Alert type="warning" showIcon message={erro} />}
      {!ficha && !erro && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
      {ficha && (
        <>
          <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 8 }}>
            <Space size={4} wrap>
              {(['FALTA', 'DIFERENTE', 'SO_ML', 'IGUAL'] as const).filter(s => contagem(s)).map(s => (
                <Tooltip key={s} title={SITUACAO[s].dica}><Tag color={SITUACAO[s].cor}>{contagem(s)} {SITUACAO[s].texto}</Tag></Tooltip>
              ))}
              {!ficha.publicado && <Tag>ainda não publicado: mostra o que vai na publicação</Tag>}
            </Space>
            <Segmented
              size="small" value={filtro} onChange={v => setFiltro(v as 'atencao' | 'todos')}
              options={[{ value: 'atencao', label: `Pedem atenção e obrigatórios${atencao ? ` (${atencao})` : ''}` }, { value: 'todos', label: `Todos (${ficha.linhas.length})` }]}
            />
          </Flex>
          {ficha.pacoteMl && (
            <Alert
              type="warning" showIcon style={{ marginBottom: 8, padding: '6px 12px' }}
              message={`A embalagem no ML (${ficha.pacoteMl.alturaCm} × ${ficha.pacoteMl.larguraCm} × ${ficha.pacoteMl.comprimentoCm} cm, ${ficha.pacoteMl.pesoG} g) é diferente da do cadastro`}
              action={<Button size="small" icon={<DownloadOutlined />} onClick={() => onTrazerPacote({ idItem: linha.idItem, sku: linha.sku, pacoteMl: ficha.pacoteMl! })}>Trazer do ML</Button>}
            />
          )}
          <Table<LinhaFicha>
            size="small" rowKey="id" pagination={false} dataSource={visiveis}
            locale={{ emptyText: 'Nada pedindo atenção: tudo igual ao ML' }}
            rowClassName={l => (l.situacao === 'FALTA' ? 'ml-linha-erro' : '')}
            columns={[
              {
                title: 'Atributo', width: 240,
                render: (_, l) => (
                  <div>
                    <Text strong={l.obrigatorio}>{l.nome}</Text>
                    {l.obrigatorio && <Tag color="red" style={{ fontSize: 10, marginLeft: 6 }}>obrigatório</Tag>}
                  </div>
                ),
              },
              { title: 'De onde vem', width: 120, render: (_, l) => <Tooltip title={ORIGEM[l.origem].dica}><Tag color={ORIGEM[l.origem].cor} style={{ marginInlineEnd: 0 }}>{ORIGEM[l.origem].texto}</Tag></Tooltip> },
              { title: 'O ERP manda', render: (_, l) => (l.erp ? <Text>{l.erp}</Text> : <Text type="secondary">—</Text>) },
              {
                title: 'No ML', render: (_, l) => (!ficha.publicado ? <Text type="secondary">—</Text> : l.ml
                  ? <Text style={{ color: l.situacao === 'DIFERENTE' ? '#d46b08' : undefined }}>{l.ml}</Text>
                  : <Text type="secondary">vazio</Text>),
              },
              { title: '', width: 100, render: (_, l) => <Tooltip title={SITUACAO[l.situacao].dica}><Tag color={SITUACAO[l.situacao].cor} style={{ marginInlineEnd: 0 }}>{SITUACAO[l.situacao].texto}</Tag></Tooltip> },
            ]}
          />
        </>
      )}
    </Card>
  );
};

export default FichaDoProduto;
