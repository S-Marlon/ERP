import React, { useState, ChangeEvent, FormEvent } from "react";
import "./CadastroCliente.css";
import Button from "../../ui/Button";
import FlexGridContainer from "../../Layout/FlexGridContainer/FlexGridContainer";
import DadosGeraisFiscais from "./DadosGeraisFiscais";
import Contato from "./Contatos";
import Endereco from "./Endereco";
import Card from "../../ui/Card";
import Typography from "../../ui/Typography";

// ... [ Interfaces ]

interface Contato {
    id: number;
    tipo: "Telefone" | "Email";
    valor: string;
    referencia: string;
    principal: boolean; // Adicionar principal aqui
}

interface Endereco {
    id: number;
    cep: string;
    rua: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    principal: boolean;
}

interface ClienteData {
    nomeCompleto: string;
    tipoPessoa: "PF" | "PJ";
    documento: string;
    inscricaoEstadual: string;
    dataNascimento: string;

    contatos: Contato[];
    enderecos: Endereco[];
}

const initialState: ClienteData = {
    nomeCompleto: "",
    tipoPessoa: "PF",
    documento: "",
    inscricaoEstadual: "",
    dataNascimento: "",
    contatos: [{ id: 1, tipo: "Email", valor: "" ,referencia: "" , principal: false, }],
    enderecos: [
        {
            id: 1,
            cep: "",
            rua: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            estado: "",
            principal: true,
        },
    ],
};

const CadastroCliente: React.FC = () => {
    // ----------------- ESTADO -----------------
    const [clienteData, setClienteData] = useState<ClienteData>(initialState);

    // ----------------- HANDLER PARA CAMPOS SIMPLES -----------------
    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setClienteData(prevData => ({
            ...prevData,
            [name]: value,
        }));
    };

    // ----------------- HANDLERS PARA ARRAYS (CONTATOS) -----------------
   const handleContatoChange = (id: number, name: keyof Contato, value: string | boolean) => { 
// Ou use 'value: any' se for mais simples
    setClienteData(prevData => ({
        ...prevData,
        contatos: prevData.contatos.map(contato => 
            contato.id === id 
            // [name]: value irá funcionar corretamente se 'value' for booleano
            ? { ...contato, [name]: value } 
            : contato
        ),
    }));
};

  const handleAddContato = () => {
        setClienteData(prevData => {
            // Garante que o ID seja sempre único e crescente
            const newId = prevData.contatos.length ? Math.max(...prevData.contatos.map(c => c.id)) + 1 : 1;
            
            // CORREÇÃO AQUI: Adicionar 'referencia' e 'principal'
            const novoContato: Contato = { id: newId, tipo: "Email", valor: "", referencia: "", principal: false }; // <--- CORRIGIDO
            
            return {
                ...prevData,
                contatos: [...prevData.contatos, novoContato],
            };
        });
    };
    
    const handleRemoveContato = (id: number) => {
        setClienteData(prevData => ({
            ...prevData,
            contatos: prevData.contatos.filter(contato => contato.id !== id),
        }));
    };
    // -------------------------------------------------------------------


    // ----------------- HANDLERS PARA ARRAYS (ENDEREÇOS) -----------------
const handleEnderecoChange = (id: number, name: keyof Endereco, value: any) => {
    setClienteData(prevData => ({
        ...prevData,
        enderecos: prevData.enderecos.map(endereco => 
            endereco.id === id 
            ? { ...endereco, [name]: value } // Atualiza o item correto
            : endereco // Mantém os outros itens
        ),
    }));
};

const handleAddEndereco = () => {
    setClienteData(prevData => {
        const newId = prevData.enderecos.length ? Math.max(...prevData.enderecos.map(e => e.id)) + 1 : 1;
        const novoEndereco: Endereco = { 
            id: newId, 
            cep: "", 
            rua: "", 
            numero: "", 
            complemento: "",
            bairro: "",
            cidade: "",
            estado: "",
            principal: false // Novo endereço é false por padrão
        };
        return {
            ...prevData,
            enderecos: [...prevData.enderecos, novoEndereco],
        };
    });
};

const handleRemoveEndereco = (id: number) => {
    setClienteData(prevData => ({
        ...prevData,
        enderecos: prevData.enderecos.filter(endereco => endereco.id !== id),
    }));
};

    // ----------------- RENDERIZAÇÃO -----------------
    return (
        <Card variant="highlight">
            {/* ... [Cabeçalho e Botões] ... */}
            <div className="form-row">
                <Typography variant="h1Alt">Registro de Novo Cliente</Typography>
                <div>
                    <Button variant="primary">Salvar Cliente</Button>
                    <Button variant="success">Salvar Cliente e Adicionar Contrato</Button>
                </div>
            </div>

            <FlexGridContainer
                layout="grid"
                gap="5px"
                template="1fr 1fr"
                mobileTemplate="1fr" 
            >
                {/* ======================= COLUNA 1 ======================= */}
                <div>
                    {/* DADOS GERAIS: Passa o handler de campos simples */}
                    <DadosGeraisFiscais 
                        data={clienteData} 
                        handleInputChange={handleInputChange} 
                    />

                    {/* CONTATO: Passa o array de contatos e os handlers de array */}
                    <Contato 
                        data={clienteData} 
                        handleContatoChange={handleContatoChange}
                        handleAddContato={handleAddContato}
                        handleRemoveContato={handleRemoveContato}
                    />
                </div>
                {/* ======================= COLUNA 2 ======================= */}
                <div>
                    <Endereco 
                    data={clienteData} 
                    handleEnderecoChange={handleEnderecoChange}
                    handleAddEndereco={handleAddEndereco}
                    handleRemoveEndereco={handleRemoveEndereco}
                    />
                </div>
            </FlexGridContainer>

            {/* ========================================================= */}
            {/* ============ SNIPPET PARA VISUALIZAÇÃO DE VARIÁVEIS ======== */}
            {/* ========================================================= */}
            <Card variant="default" style={{ marginTop: '20px', backgroundColor: '#f0f0f0' }}>
                <Typography variant="h3">Dados Atuais do Formulário (Snippet)</Typography>
                <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-all', 
                    backgroundColor: 'black', 
                    padding: '10px', 
                    borderRadius: '5px',
                    fontSize: '12px', // Tamanho de fonte reduzido para caber melhor
                    color: 'lime' // Cor alterada para lime para melhor visualização em fundo preto
                }}>
                    {JSON.stringify(clienteData, null, 2)}
                </pre>
            </Card>
            {/* ========================================================= */}
            {/* ========================================================= */}

        </Card>
    );
};
export default CadastroCliente;