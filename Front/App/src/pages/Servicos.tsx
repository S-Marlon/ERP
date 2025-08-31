import './Servicos.css';

interface Props {
  text: string;
}

const Header: React.FC<Props> = ({ text }) => {
  return (
    <>
     
    <div className="grid-container">
        <div className="grid-item" style={{ backgroundColor: '#3c3c3cff' }}>
        Filtro de servico
        <button>
            Aplicar Filtro de {text}
        </button>
        </div>

        <div className="grid-item" >
         
         <div className="flex-container">
        <div className="flex-item">

        <div className="flex-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0px' , flexWrap: 'wrap'  }}>
           
           
                            <div className="subgrid-container" >
                            
                                
                                <div className="subflex-content" >
                                    <div className="subflex-item" style={{backgroundColor: 'red', flexGrow: "0" , padding: '5x', borderRadius: '5px'}}>01</div>
                                    <div className="subflex-item">Watson jHonson <br/> tiua mae</div>
                                    <div className="subflex-item" style={{backgroundColor: 'green', flexGrow: "0" , padding: '5x', borderRadius: '5px'}}>Completo</div>
                                </div>
                           

                            
                                
                                <div className="subflex-content">
                                    <div className="subflex-item">Quarta, 28, 2024</div>
                                    <div className="subflex-item">16:48</div>
                                </div>
                            

                            
                                
                                <div className="subflex-content">
                                    
                                    <table className="subflex-item">
                                        <thead>
                                            <tr>
                                                <th>qtd</th>
                                                <th>itens</th>
                                                <th>preços</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                           <tr>
                                                <td>qtd</td>
                                                <td>itens</td>
                                                <td>preços</td>
                                            </tr>
                                              <tr>
                                                <td>qtd</td>
                                                <td>itens</td>
                                                <td>preços</td>
                                            </tr>
                                              <tr>
                                                <td>qtd</td>
                                                <td>itens</td>
                                                <td>preços</td>
                                            </tr>
                                        </tbody>
                                        
                                    
                                    </table>
                                </div>
                            

                            
                               
                                <div className="subflex-content">
                                    <div className="subflex-item">responsavel</div>
                                    <div className="subflex-item">sub total</div>
                                    <div className="subflex-item">R$ 16,98</div>
                                </div>
                            

                            
                                
                                <div className="subflex-content">
                                    <div className="subflex-item"><button>Lapis</button></div>
                                    <div className="subflex-item"><button>Pai bill</button></div>
                                    
                                </div>

                            
                        </div>
                                

            
            
            

                

        </div>

        </div>
        <div className="flex-item">Lista de item 2</div>
        <div className="flex-item">Lista de item 3</div>
        <div className="flex-item">Lista de item 4</div>
       
    </div>

        </div>
    </div>
    
    </>
  );
};

export default Header;
