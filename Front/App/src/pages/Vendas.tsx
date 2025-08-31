
interface Props {
  text: string;
}

const Header: React.FC<Props> = ({ text }) => {
  return (
    <div
   
      
    >
      <h3>{text}</h3>
    </div>
  );
};

export default Header;
