import type { Student } from "../../types/student";

type Props = { students: Student[] };

export default function DatabaseTable({ students }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>ת.ז</th>
          <th>שם</th>
          <th>שם משפחה</th>
          <th>כיתה</th>
        </tr>
      </thead>
      <tbody>
        {students.map((s) => (
          <tr key={s.passportOrId}>
            <td>{s.passportOrId}</td>
            <td>{s.firstName}</td>
            <td>{s.lastName}</td>
            <td>{s.className}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
