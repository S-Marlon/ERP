import React from 'react';
import '../pages/Estoque.css';
import { Product } from '../types';

interface ProductTableProps {
    products: Product[];
}

const ProductTable: React.FC<ProductTableProps> = ({ products }) => {
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>

                    <p>{99999} produtos encontrados</p>
                </div>
                <div>

                    <button>A-</button>
                    <button>A+</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>

                    <p>
                        <button>°</button>
                        <button>1</button>
                        <button><strong>2</strong></button>
                        <button>3</button>
                        <button>°</button>
                    </p>

                    <div>

                        aba
                        <button>2</button>
                    </div>

                    <div>


                        <button>20</button>
                        por pagina
                    </div>
                </div>

            </div>

            <table className="product-table">
                <thead>
                    <tr>
                        <th style={{ width: '6%' }}>Número</th>
                        <th style={{ width: '25%' }}>Nome do Produto</th>

                        <th style={{ width: '6%' }}>SKU</th>
                        <th style={{ width: '7%' }}>Categoria</th>
                        <th style={{ width: '9%' }}>sub-Categoria</th>
                        <th style={{ width: '4%' }}>Estoque</th>
                        <th style={{ width: '8%' }}>Status</th>
                        <th style={{ width: '8%' }}>Preço de Venda</th>
                        {/* <th style={{ width: '10%' }}>Detealhes</th> */}

                        <th style={{ width: '5%' }}>Editar</th>

                    </tr>
                </thead>
                <tbody>
                    {products.map(product => (
                        <tr key={product.id}>
                            <td>100</td>

                            <td>{product.name}</td>
                            {/* <td><img src={product.pictureUrl} alt={product.name} style={{ width: '50px' }} /></td> */}
                            <td>{product.sku}</td>
                            <td>{product.category}</td>
                            <td>{product.category}</td>
                            <td>{product.stock}</td>
                            <td > <span>{product.status}</span></td>
                            <td>R$ {product.price.toFixed(2)}</td>
                            {/* <td>3/8, arcondicionado</td>   */}
                            <td>
                                <button className="icon-button" style={{ fontSize: 'small', background: 'black' }}>✏️</button>
                            </td>

                        </tr>
                    ))}
                </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>

                    <p>{99999} produtos encontrados</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>

                    <p>
                        <button>°</button>
                        <button>1</button>
                        <button><strong>2</strong></button>
                        <button>3</button>
                        <button>°</button>
                    </p>

                    <div>

                        aba
                        <button>2</button>
                    </div>

                    <div>


                        <button>20</button>
                        por pagina
                    </div>
                </div>

            </div>
        </>
    );
};

export default ProductTable;