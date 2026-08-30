interface GreetingCodeProps {
  name: string;
  packageName: string;
  punctuation: string;
}

export function GreetingCode({
  name,
  packageName,
  punctuation,
}: GreetingCodeProps) {
  const source = `import { createGreeting } from ${JSON.stringify(packageName)};

const greeting = createGreeting(${JSON.stringify(name)}, {
  punctuation: ${JSON.stringify(punctuation)},
});`;

  return (
    <section className="col-12" aria-labelledby="example-code-title">
      <div className="playground-code-panel">
        <div className="playground-code-header">
          <h2 id="example-code-title" className="h6 mb-0">
            TypeScript
          </h2>
          <span>Current example</span>
        </div>
        <pre tabIndex={0}>
          <code>{source}</code>
        </pre>
      </div>
    </section>
  );
}
