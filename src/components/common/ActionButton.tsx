type Props = {
  label: string;
  onClick: () => void;
};

export default function ActionButton({ label, onClick }: Props) {
  return <button onClick={onClick}>{label}</button>;
}
