import React, { ChangeEvent } from 'react';
import Fieldset from '../../../ui/Fieldset/Fieldset';
import Card from '../../../ui/Card/Card';
import FormControl from '../../../ui/FormControl/FormControl';
import Button from '../../../ui/Button/Button';

// Supondo que essas interfaces venham de CadastroCliente.tsx
interface ContatoItem {
  id: number;
  tipo: "Telefone" | "Email";
  valor: string;
  referencia: string; // OK
  principal: boolean; // Adicionar principal aqui
}

// 2. Interface para o objeto de dados que contém o array de contatos
// (Assumindo que ela é parte do estado maior de CadastroCliente, mas aqui só tipamos a parte relevante)
export interface ContatoData {
  contatos: ContatoItem[];
  // Poderia ter outros campos de dados do cliente aqui, como:
  // nome: string; 
  // cpf: string;
}

// 3. Interface principal para as Props do componente Contato
// Ela tipa o objeto de dados e todas as funções de callback (handlers)
export interface ContatoProps {
  // Recebe o objeto de dados completo (ou a parte relevante)
  data: ContatoData;

  // Handler para atualizar um campo de um contato específico
  // id: O ID do contato a ser atualizado
  // name: A chave do campo a ser atualizado ('tipo', 'valor', 'referencia', 'principal')
  // value: O novo valor (string para texto/select, boolean para checkbox)
  handleContatoChange: (
    id: number,
    name: keyof ContatoItem,
    value: string | boolean // Aceita string (para input/select) OU boolean (para checkbox)
  ) => void;

  // Handler para adicionar um novo contato ao array
  handleAddContato: () => void;

  // Handler para remover um contato pelo ID
  handleRemoveContato: (id: number) => void;
}

// O componente recebe as props
const Contato: React.FC<ContatoProps> = ({ data, handleContatoChange, handleAddContato, handleRemoveContato }) => {
    
    // Handler para os inputs
    const getChangeHandler = (id: number) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        handleContatoChange(id, name as keyof ContatoItem, value);
    };

    return (
        <Fieldset variant='standard' legend='Contatos'>

            {data.contatos.map((contato) => (
                <Card variant='highlight' key={contato.id} >

                    <div className="form-row">
                        {/* ... (Tipo e Valor estão corretos) ... */}

                        {/* Tipo de Contato */}
                        <FormControl
                            // ... (props: name="tipo", value={contato.tipo}, onChange={getChangeHandler(contato.id)})
                            label="Tipo" control="select" name="tipo"
                            value={contato.tipo} onChange={getChangeHandler(contato.id)}
                            options={[ { value: 'Email', label: 'E-mail' }, { value: 'Telefone', label: 'Telefone' }, ]}
                        />

                        {/* Valor do Contato */}
                        <FormControl
                            // ... (props: name="valor", value={contato.valor}, onChange={getChangeHandler(contato.id)})
                            label="Valor" name="valor"
                            value={contato.valor} onChange={getChangeHandler(contato.id)}
                            placeholder={`Digite o ${contato.tipo}...`} required
                        />
                        
                        <div className='flex-column'>
                            {/* NOME DE REFERÊNCIA: ADICIONADO 'name="referencia"' */}
                            <FormControl 
                                control='input' 
                                label='Nome de Referência' 
                                placeholder={`Ex: Comercial, Diretor...`} 
                                name="referencia" // <--- AQUI ESTÁ A CORREÇÃO
                                value={contato.referencia} // OK
                                onChange={getChangeHandler(contato.id)} // OK
                            />
                            
                            {/* Contato Principal (A lógica para checkboxes/booleans é diferente, mas para o texto está OK) */}
                          <FormControl 
    control='checkbox' 
    label='Contato Principal' 
    name="principal" 
    checked={contato.principal} 
    
    // ✅ Use esta função anônima para garantir que o booleano está sendo passado
    onChange={(e: ChangeEvent<HTMLInputElement>) => {
        handleContatoChange(
            contato.id, 
            e.target.name as keyof ContatoItem, 
            e.target.checked // <--- AQUI ESTÁ O BOOLEANO (true/false)
        );
    }}
/>
                        </div>

                        {/* ... (Botão de Remover) ... */}
                        <Button
                            style={{maxWidth:'30px', alignSelf: 'center', marginTop: '10px'}}
                            variant='danger'
                            onClick={() => handleRemoveContato(contato.id)}
                            >
                            X
                        </Button>
                    </div>
                </Card>
            ))}

            <Button variant='primary' onClick={handleAddContato}>
              + Adicionar Contato
            </Button>
            
        </Fieldset>
    );
};
export default Contato;