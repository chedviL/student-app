type Props = {
  onSort: (field: string) => void;
};

export default function SortControls({ onSort }: Props) {
  return (
    <div>
      <button onClick={() => onSort("firstName")}>מיין לפי שם</button>
      <button onClick={() => onSort("lastName")}>מיין לפי שם משפחה</button>
    </div>
  );
}
