import './Estoque.css';

interface Props {
  text: string;
}


const Header: React.FC<Props> = ({ text }) => {
    
  return (
    <>
<div className="grids-container">
    <div className="grid-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
    150 produtos Em Registro
    <button>
        adcionar produto
    </button>
    </div>
    <div className="grid-item">
   
    Filtro de produto
    <button>
        Aplicar Filtro de produto  
    </button>

    Status:
    <select>
        <option>Todos</option>
        <option>Ativo</option>
        <option>Inativo</option>
        <option>baixo estoque</option>
    </select>
    Categoria:
    <select>
        <option>Todos</option>
        <option>Categoria 1</option>
        <option>Categoria 2</option>
        <option>Categoria 3</option>
    </select>
    Preço:
    <select>
        <option>Todos</option>
        <option>Menor que 50</option>
        <option>Entre 50 e 100</option>
        <option>Maior que 100</option>
    </select>
    Quantidade em estoque:
    <select>
        <option>Todos</option>
        <option>Menor que 10</option>
        <option>Entre 10 e 50</option>
        <option>Maior que 50</option>
    </select>


    </div>
    <div className="grid-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 10px' }}>
    <button>
        Resetar Filtro de produto
    </button>
    150 produtos encontrados
    </div>
    <div className="grid-item">
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', backgroundColor: '#2f2f2fff' , padding: '100px', color: 'white'}}>
  <tbody>
    <tr style={{ borderBottom: '1px solid #ddd' , padding: '150px'}}>
      <td  style={{ borderBottom: '1px solid #ddd' , paddingTop: '15px', paddingBottom: "15px"}}>{text}</td>
      <td>Chicken Parmesan</td>
      <td>picture</td>
      <td>SKU</td>
      <td>Category</td>
      <td>10 in stock</td>
      <td>Status</td>
      <td>Preco venda</td>
      <td>✏️</td>
      <td>🗑️</td>
    </tr>
</tbody>
</table>
    </div>
  
</div>



</>
  );
};

export default Header;
