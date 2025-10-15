// src/modules/Obras/ObraDetalhes.tsx
import React, {  useMemo } from 'react';
import { useParams  } from 'react-router-dom';
import { mockObras, mockClientes, mockAtividades, mockRegistrosTempo, Obra } from '../../../types/Obras';
import Badge from '../../../components/ui/Badge';
import Typography from '../../../components/ui/Typography';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import FormControl from '../../../components/ui/FormControl';
import TabsContainer from '../../../components/ui/TabsContainer';


// Componentes das Abas (Implementação SIMPLIFICADA e ESTILIZADA)

// 1. Aba Geral: Estrutura em duas colunas para campos
const AbaGeral: React.FC<{ obra: Obra, clienteNome: string }> = ({ obra, clienteNome }) => (
    <Card>
        <Typography variant="h2">Dados Gerais da Obra</Typography>
        <FormControl
          label="Nome do Cliente"
          name="clienteNome"
          value={clienteNome}
          control="input"
          disabled
        />
        <FormControl
          label="Título da Obra"
          name="obraTitulo"
          value={obra.titulo}
          control="input"
          disabled
        />
        <FormControl
          label="Endereço"
          name="obraEndereco"
          value={obra.endereco}
          control="input"
          disabled
        />
    </Card>
);

// 2. Aba Atividades: Ícone para status
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

// 3. Aba Registros Tempo: Estilização de tabela simples (linhas zebradas)
const AbaRegistrosTempo: React.FC<{ obraId: string }> = ({ obraId }) => {
    const registros = mockRegistrosTempo.filter(r => r.obraId === obraId);
    return (
        <Card variant="panel">
            <Typography variant="h2Alt">Registros de Tempo</Typography>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr>
                        <th>
                            <Typography variant="strong">Descrição</Typography>
                        </th>
                        <th>
                            <Typography variant="strong">Horário</Typography>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {registros.map((reg, idx) => (
                        <tr key={reg.id} style={{ background: idx % 2 ? "#f8f9fa" : "#fff" }}>
                            <td>
                                <Typography variant="p">{reg.descricao}</Typography>
                            </td>
                            <td>
                                <Typography variant="p">{reg.horas}</Typography>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
};

// Componente separado para localização
const ObraLocalizacao: React.FC<{ latitude: number; longitude: number; titulo: string }> = ({
  latitude,
  longitude,
  titulo,
}) => (
  <Card variant="panel">
    <Typography variant="h2Alt">Localização</Typography>
    <Typography variant="pMuted">Aqui você teria um componente de mapa (Leaflet, Google Maps, etc.)</Typography>
    <Typography variant="small">
      <strong>Latitude:</strong> {latitude}
    </Typography>
    <Typography variant="small">
      <strong>Longitude:</strong> {longitude}
    </Typography>
    <Typography variant="pMuted">
      <strong>Título:</strong> {titulo}
    </Typography>
  </Card>
);


// -----------------------------------------------------------
// Componente Principal
// -----------------------------------------------------------

export const ObraDetalhes: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const obra = useMemo(() => mockObras.find(o => o.id === 'obra-1'), [id]);
    const cliente = useMemo(() => mockClientes.find(c => c.id === obra?.clienteId), [obra]);

    if (!obra) {
        return <Typography variant="h2Alt">Obra não encontrada!</Typography>;
    }

    // Defina as abas como objetos TabItem
    const tabs = [
        {
            id: 'Geral',
            label: 'Geral',
            content: <AbaGeral obra={obra} clienteNome={cliente?.nome || 'N/A'} />
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
            content: <ObraLocalizacao latitude={obra.latitude} longitude={obra.longitude} titulo={obra.titulo} />
        },
        {
            id: 'Imagens',
            label: 'Imagens',
            content: <Typography variant="pMuted">Conteúdo da aba Imagens</Typography>
        },
        {
            id: 'Serviços',
            label: 'Serviços Futuros',
            content: <Typography variant="pMuted">Conteúdo da aba Serviços Futuros</Typography>
        },
        {
            id: 'Galeria',
            label: 'Galeria',
            content: <Typography variant="pMuted">Conteúdo da aba Galeria</Typography>
        }
    ];

    return (
        <div>
            {/* 1. CABEÇALHO OTIMIZADO */}
            <header className="header-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column' }}>
                    
                    
                        <Typography variant="h1Alt">{obra.titulo}</Typography>
                        <div className='flex-row' style={{ alignItems: 'center', justifyContent:'space-between', marginTop: '5px' }}>   

                        <Typography variant="h2" className='title'>P001-0825 - {cliente?.nome || 'N/A'}</Typography>
                    <Badge color="warning">Em Andamento</Badge>
                        </div>
                    
                </div>
            </header>

            {/* 2. BARRA DE AÇÕES ESTILIZADA */}
            <div className="action-buttons-container" >
                <Button variant="secondary">Editar</Button>
                <Button variant="primary">Novo Registro de Tempo</Button>
                <FormControl
                    label=""
                    name="acoes"
                    control="select"
                    options={[
                        { value: "", label: "Ações" },
                        { value: "finalizar", label: "Finalizar Obra" },
                        { value: "pausar", label: "Pausar Obra" },
                        { value: "relatorio", label: "Gerar Relatório" }
                    ]}
                />
            </div>

            {/* 3. NAVEGAÇÃO POR ABAS PADRONIZADA */}
            <TabsContainer tabs={tabs} />

            {/* 4. O conteúdo da aba ativa já é gerenciado pelo TabsContainer */}
        </div>
    );
};