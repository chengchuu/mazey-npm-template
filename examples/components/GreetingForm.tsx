import type { FormEvent, RefObject } from "react";

interface GreetingFormProps {
  name: string;
  nameInputRef: RefObject<HTMLInputElement | null>;
  onBlankName(): void;
  onNameChange(value: string): void;
  onPunctuationChange(value: string): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  punctuation: string;
}

export function GreetingForm({
  name,
  nameInputRef,
  onBlankName,
  onNameChange,
  onPunctuationChange,
  onSubmit,
  punctuation,
}: GreetingFormProps) {
  return (
    <section className="col-lg-7" aria-labelledby="controls-title">
      <div className="playground-panel p-4">
        <h2 id="controls-title" className="h4">
          Create a greeting
        </h2>
        <form noValidate onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="greeting-name">
              Name
            </label>
            <input
              id="greeting-name"
              ref={nameInputRef}
              className="form-control"
              name="name"
              type="text"
              value={name}
              maxLength={80}
              aria-describedby="name-help"
              onChange={(event) => onNameChange(event.currentTarget.value)}
            />
            <div id="name-help" className="form-text">
              Blank or whitespace-only input uses the library fallback name,{" "}
              <code>friend</code>.
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="greeting-punctuation">
              Punctuation
            </label>
            <select
              id="greeting-punctuation"
              className="form-select"
              name="punctuation"
              value={punctuation}
              onChange={(event) =>
                onPunctuationChange(event.currentTarget.value)
              }
            >
              <option value="!">Exclamation mark (!)</option>
              <option value=".">Period (.)</option>
              <option value="?">Question mark (?)</option>
              <option value="">No punctuation</option>
            </select>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-primary" type="submit">
              Generate greeting
            </button>
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={onBlankName}
            >
              Try blank-name fallback
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
