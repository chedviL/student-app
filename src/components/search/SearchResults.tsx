import type { Student } from "../../types/student";

type Props = { results: Student[] };

export default function SearchResults({ results }: Props) {
  return (
    <ul>
      {results.map((s) => (
        <li key={s.id}>{s.firstName} {s.lastName}</li>
      ))}
    </ul>
  );
}
