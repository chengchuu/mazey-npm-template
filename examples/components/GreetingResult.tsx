interface GreetingResultProps {
  error: string;
  message: string;
}

export function GreetingResult({ error, message }: GreetingResultProps) {
  return (
    <section className="col-lg-5" aria-labelledby="result-title">
      <div className="playground-panel p-4">
        <h2 id="result-title" className="h4">
          Result
        </h2>
        <p
          className="playground-output"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message ? <code>{message}</code> : null}
        </p>
        {error ? (
          <p className="alert alert-danger mt-3 mb-0" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
