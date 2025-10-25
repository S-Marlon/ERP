import React from 'react';
import Fieldset from '../../ui/Fieldset';
import Card from '../../ui/Card';
import FormControl from '../../ui/FormControl';
import Button from '../../ui/Button';
const Contato: React.FC = () => {
    
    
    return (
       <Fieldset variant='standard' legend='Contatos'>

            
            <Card  variant='highlight' >

              <div className="form-row">

                {/* Tipo de Contato */}
                <FormControl
                  label="Tipo"
                  control="select"
                  options={[
                    { value: 'Email', label: 'E-mail' },
                    { value: 'Telefone', label: 'Telefone' },
                  ]}

                />

                {/* Valor do Contato */}
                <FormControl
                  label="Valor"
                  placeholder={`Digite o ...`}
                  required

                />


                <div className='flex-column'>


                  <FormControl control='input' label='Nome de Referência' placeholder={`Ex: Comercial, Diretor...`}></FormControl>
                  
                
                
                  <FormControl control='checkbox' label='Contato Principal' ></FormControl>
                </div>
                <Button
                  style={{maxWidth:'30px'}}
                  variant='danger'
                  >
                  X
                </Button>

              </div>
                </Card>
           

            <Button variant='primary' >
              + Adicionar Contato
            </Button>
          </Fieldset>
    );
};
export default Contato;