export function JsonLd({ data }: { data: Record<string, unknown> }): JSX.Element {
  // Safe: data is always hardcoded structured data from our own schemas, never user input.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
