type Props = {
  titulo: string;
  valor: number;
};

function Resumen({ titulo, valor }: Props) {
  return (
    <div className="summary-card">
      <p className="summary-value">{valor}</p>
      <p className="summary-label">{titulo}</p>
    </div>
  );
}

export default Resumen;
