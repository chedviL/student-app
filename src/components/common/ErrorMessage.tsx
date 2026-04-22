type Props = { message: string };

export default function ErrorMessage({ message }: Props) {
  return <p style={{ color: "red" }}>{message}</p>;
}
