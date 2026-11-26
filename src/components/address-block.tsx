/**
 * A printed address (v1.7): one line per part, empty parts already left out by
 * `addressLines`. Shared by the sender's and the client's invoice pages.
 */
export function AddressBlock({ id, lines }: { id: string; lines: string[] }) {
  return (
    <p id={id} className="text-(--color-text-secondary)">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}
