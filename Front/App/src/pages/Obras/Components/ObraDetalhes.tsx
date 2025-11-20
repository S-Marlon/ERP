import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import FlexGridContainer from '../../../components/Layout/FlexGridContainer/FlexGridContainer';
import Fieldset from '../../../components/ui/Fieldset/Fieldset';
import Card from '../../../components/ui/Card/Card';
import Typography from '../../../components/ui/Typography/Typography';
import Button from '../../../components/ui/Button/Button';
import FormControl from '../../../components/ui/FormControl/FormControl';
import Badge from '../../../components/ui/Badge/Badge';
// tipos das entidades
import { Cliente } from '../../../types/entities/client';
import { Contrato } from '../../../types/entities/contract';
import { Poco } from '../../../types/entities/poco';
import { mockObras, mockClientes, mockAtividades, mockRegistrosTempo, Obra } from '../../../types/Obras';
import TabsContainer from '../../../components/ui/TabsContainer';

interface ObraDetalhesProps {
  cliente?: Cliente | null;
  contrato?: Contrato | null;
  poco?: Poco | null;
  clienteId?: string | null;
  contratoId?: string | null;
  pocoId?: string | null;
}

const AbaGeral: React.FC<{ obra: Obra; clienteNome: string }> = ({ obra, clienteNome }) => (
  <Card>
    <Typography variant="h2">Dados Gerais da Obra</Typography>
    <FormControl label="Nome do Cliente" name="clienteNome" value={clienteNome} control="input" disabled />
    <FormControl label="Título da Obra" name="obraTitulo" value={obra.titulo} control="input" disabled />
    <FormControl label="Endereço" name="obraEndereco" value={obra.endereco} control="input" disabled />
    <Button type="button" variant="outline">Perfil geológico detalhado</Button>
    <Button type="button" variant="outline">Documentação técnica do poço</Button>
    <Button type="button" variant="outline">Análises de qualidade da água</Button>
    <Button type="button" variant="outline">Monitoramento de níveis e vazões</Button>
  </Card>
);

const AbaAtividades: React.FC<{ obraId: string }> = ({ obraId }) => {
  const atividades = mockAtividades.filter(a => a.obraId === obraId);
  return (
    <Card variant="panel">
      <Typography variant="h2Alt">Atividades da Obra</Typography>
      <ul style={{ listStyleType: "none", padding: 0 }}>
        {atividades.map(atv => (
          <li key={atv.id} style={{ display: "flex", alignItems: "center", marginBottom: "1em" }}>
            <Typography variant="p">{atv.descricao}</Typography>
            <Badge color="warning">{atv.obraId}</Badge>
          </li>
        ))}
      </ul>
      <Button variant="primary">Adicionar Atividade</Button>
    </Card>
  );
};

const AbaRegistrosTempo: React.FC<{ obraId: string }> = ({ obraId }) => {
  const registros = mockRegistrosTempo.filter(r => r.obraId === obraId);
  return (
    <Card variant="panel">
      <Typography variant="h2Alt">Registros de Tempo</Typography>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th><Typography variant="strong">Descrição</Typography></th>
            <th><Typography variant="strong">Horário</Typography></th>
          </tr>
        </thead>
        <tbody>
          {registros.map((reg, idx) => (
            <tr key={reg.id} style={{ background: idx % 2 ? "#f8f9fa" : "#fff" }}>
              <td><Typography variant="p">{reg.descricao}</Typography></td>
              <td><Typography variant="p">{reg.horas}</Typography></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const ObraLocalizacao: React.FC<{ latitude: number; longitude: number; titulo: string }> = ({
  latitude, longitude, titulo,
}) => (
  <Card variant="panel">
    <Typography variant="h2Alt">Localização</Typography>
    <Typography variant="small"><strong>Latitude:</strong> {latitude}</Typography>
    <Typography variant="small"><strong>Longitude:</strong> {longitude}</Typography>
    <Typography variant="small"><strong>Título:</strong> {titulo}</Typography>
  </Card>
);

export const ObraDetalhes: React.FC<ObraDetalhesProps> = ({
  cliente, contrato, poco, clienteId, contratoId, pocoId,
}) => {
  const { id } = useParams<{ id?: string }>();

  // se houver id na rota, tenta carregar obra do mock (ou do backend)
  const obraFromRoute = useMemo(() => (id ? mockObras.find(o => o.id === id) : undefined), [id]);

  // Se não houver obra por rota, mas houver seleções, cria uma obra temporária mínima
  const obraGenerated = useMemo<Obra | undefined>(() => {
    if (obraFromRoute) return obraFromRoute;
    if (!cliente && !contrato && !poco) return undefined;

    return {
      id: `temp-${clienteId ?? contratoId ?? pocoId ?? 'x'}`,
      titulo: contrato?.titulo ?? poco?.nomeIdentificacao ?? `Obra - ${cliente?.nome ?? 'Sem nome'}`,
      endereco: cliente?.endereco ?? '',
      latitude: (poco && (poco.latitude as number)) ,
      longitude: (poco && (poco.longitude as number)) ,
      // demais campos do tipo Obra podem ficar vazios ou com defaults
    } as Obra;
  }, [obraFromRoute, cliente, contrato, poco, clienteId, contratoId, pocoId]);

  const obra = obraFromRoute ?? obraGenerated;

  if (!obra) {
    return <Typography variant="h2Alt">Selecione um cliente, contrato ou poço para ver detalhes.</Typography>;
  }

  // buscar nome do cliente (pode usar mockClientes como fallback)
  const clienteData = cliente ?? mockClientes.find(c => String(c.id) === String(obra.clienteId ?? clienteId));

  // Defina as abas como objetos TabItem
  const tabs = [
    {
      id: 'Geral',
      label: 'Geral',
      content: <AbaGeral obra={obra} clienteNome={clienteData?.nome || 'N/A'} />
    },
    {
      id: 'Atividades',
      label: 'Atividades/Tarefas',
      content: <AbaAtividades obraId={obra.id} />
    },
    {
      id: 'Registros',
      label: 'Registros de Tempo',
      content: <AbaRegistrosTempo obraId={obra.id} />
    },
    {
      id: 'Localizacao',
      label: 'Localização',
      content: <ObraLocalizacao latitude={obra.latitude ?? 0} longitude={obra.longitude ?? 0} titulo={obra.titulo} />
    },
    {
      id: 'Acervo',
      label: 'Acervo',
      content: <Button type="button" variant="outline">📸 Adicionar Fotos/Mídias 📁 Anexar Documentos/Laudos</Button>
    },
    {
      id: 'Servicos',
      label: 'Serviços Futuros',
      content: <Typography variant="pMuted">Conteúdo da aba Serviços Futuros</Typography>
    },
  ];

  const temDados = !!(cliente || contrato || poco);

  return (
    <Card className="obra-detalhes-card">
      <Typography variant="h3">Detalhes da Obra</Typography>
      <hr style={{ margin: '8px 0' }} />

      {temDados ? (
        <div>
          {cliente && (
            <Fieldset legend="Cliente" variant="basic">
              <FlexGridContainer layout="flex" template="column" gap="6px">
                <Typography variant="small"><strong>Nome:</strong> {cliente.nome || '—'}</Typography>
                <Typography variant="small"><strong>Documento:</strong> {cliente.documento || '—'}</Typography>
                <Typography variant="small"><strong>ID:</strong> {clienteId || cliente.id || '—'}</Typography>
              </FlexGridContainer>
            </Fieldset>
          )}

          {contrato && (
            <Fieldset legend="Contrato" variant="basic" style={{ marginTop: 12 }}>
              <FlexGridContainer layout="flex" template="column" gap="6px">
                <Typography variant="small"><strong>Título:</strong> {contrato.titulo || '—'}</Typography>
                <Typography variant="small"><strong>Código / ID:</strong> {contratoId || contrato.id || '—'}</Typography>
                <Typography variant="small"><strong>Status:</strong> {contrato.status || '—'}</Typography>
              </FlexGridContainer>
            </Fieldset>
          )}

          {poco && (
            <Fieldset legend="Poço" variant="basic" style={{ marginTop: 12 }}>
              <FlexGridContainer layout="flex" template="column" gap="6px">
                <Typography variant="small"><strong>Identificação:</strong> {poco.nomeIdentificacao || '—'}</Typography>
                <Typography variant="small"><strong>ID:</strong> {pocoId || poco.id || '—'}</Typography>
                <Typography variant="small"><strong>Profundidade:</strong> {poco.profundidadeTotalMetros ?? '—'}</Typography>
                <Typography variant="small"><strong>Vazão:</strong> {poco.vazao ?? '—'}</Typography>
              </FlexGridContainer>
            </Fieldset>
          )}

          <Fieldset legend="Resumo de Identificadores" variant="basic" style={{ marginTop: 12 }}>
            <Typography variant="small"><strong>Cliente ID:</strong> {clienteId || 'Nenhum'}</Typography><br />
            <Typography variant="small"><strong>Contrato ID:</strong> {contratoId || 'Nenhum'}</Typography><br />
            <Typography variant="small"><strong>Poço ID:</strong> {pocoId || 'Nenhum'}</Typography>
          </Fieldset>
        </div>
      ) : (
        <Typography variant="pMuted">Nenhum cliente, contrato ou poço selecionado.</Typography>
      )}

      {/* 3. Navegação por abas */}
      <TabsContainer tabs={tabs} />
    </Card>
  );
};

export default ObraDetalhes;