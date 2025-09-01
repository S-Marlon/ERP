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

                    <table className="subflex-item" >
                        Cliente:
                        <tbody style={{ backgroundColor: '#262626ff', }}>
                            <tr>
                                <td><button>
                                    Nome
                                </button></td>
                                <td> <button>
                                    Email
                                </button></td>

                            </tr>
                            <tr>
                                <td><button>
                                    Telefone
                                </button></td>
                                <td><button>
                                    CPF
                                </button></td>

                            </tr>

                        </tbody>

                    </table>

                     <table className="subflex-item" >
                        Dados do serviço:
                        <tbody style={{ backgroundColor: '#262626ff', }}>
                            <tr>
                                <td><button>
                                    numero de ordem
                                </button></td>
                                <td> <button>
                                    Status Atual
                                </button></td>

                            </tr>
                            <tr>
                                <td><button>
                                    Tipo Serviço
                                </button></td>
                                

                            </tr>

                        </tbody>

                    </table>

                     <table className="subflex-item" >
                        Dados do serviço:
                        <tbody style={{ backgroundColor: '#262626ff', }}>
                            <tr>
                                <td><button>
                                    Data
                                </button></td>
                                <td> <button>
                                    Hora
                                </button></td>

                            </tr>
                            <tr>
                                <td><button>
                                    Forma de pagamento
                                </button></td>
                                

                            </tr>

                        </tbody>

                    </table>


<button>
                       Limpar campos
                    </button>
                    <button>
                        Aplicar Filtro de {text}
                    </button>
                </div>

                <div className="grid-item" >

                    <div className="flex-container">
                        <div className="flex-item">

                            <div className="flex-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>


                                <div className="subgrid-container" >


                                    <div className="subflex-content" >
                                        <div className="subflex-item" style={{ backgroundColor: 'red', flexGrow: "0", padding: '10px', borderRadius: '5px' }}>01</div>
                                        <div className="subflex-item" style={{ textAlign: "left" }} >Watson jHonson <br /> tiua mae</div>
                                    </div>
                                    <div className="subflex-item" style={{ backgroundColor: 'green', flexGrow: "0", padding: '2px', borderRadius: '5px' }}>Completo</div>




                                    <div className="subflex-content">
                                        <div className="subflex-item">Quarta</div>
                                        <div className="subflex-item" >16:48</div>
                                        <div className="subflex-item">28/08/2025</div>
                                    </div>




                                    <div className="subflex-content">

                                        <table className="subflex-item" >
                                            <thead style={{ backgroundColor: 'gray', }}>
                                                <tr >
                                                    <th>qtd</th>
                                                    <th>itens</th>
                                                    <th>preços</th>
                                                </tr>
                                            </thead>
                                            <tbody style={{ backgroundColor: '#262626ff', }}>
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
                                        <div className="subflex-item">sub total</div>
                                        <div className="subflex-item">R$ 16,98</div>
                                    </div>




                                    <div className="subflex-content">
                                        <div className="subflex-item"><button>Lapis</button></div>
                                        <div className="subflex-item"><button>Pai bill</button></div>

                                    </div>

                                    <div className="subflex-item">responsavel: cleonardones</div>

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
