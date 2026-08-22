import { useRef, useState } from "react";
import { createGreeting } from "../src";
import { GreetingCode } from "./components/GreetingCode";
import { GreetingForm } from "./components/GreetingForm";
import { GreetingResult } from "./components/GreetingResult";

type GreetingGenerator = typeof createGreeting;

interface GreetingFeedback {
  error: string;
  message: string;
  name: string;
  punctuation: string;
}

export interface AppProps {
  generateGreeting?: GreetingGenerator;
  packageName: string;
}

const initialName = "developer";
const initialPunctuation = "!";

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? `The greeting could not be generated: ${cause.message}`
    : "The greeting could not be generated because of an unexpected error.";
}

function initialFeedback(
  generateGreeting: GreetingGenerator,
): GreetingFeedback {
  try {
    return {
      error: "",
      message: generateGreeting(initialName, {
        punctuation: initialPunctuation,
      }),
      name: initialName,
      punctuation: initialPunctuation,
    };
  } catch (cause) {
    return {
      error: errorMessage(cause),
      message: "",
      name: initialName,
      punctuation: initialPunctuation,
    };
  }
}

export function App({
  generateGreeting = createGreeting,
  packageName,
}: AppProps) {
  const [name, setName] = useState(initialName);
  const [punctuation, setPunctuation] = useState(initialPunctuation);
  const [feedback, setFeedback] = useState(() =>
    initialFeedback(generateGreeting),
  );
  const nameInputRef = useRef<HTMLInputElement>(null);

  const generate = (nextName: string, nextPunctuation: string) => {
    try {
      setFeedback({
        error: "",
        message: generateGreeting(nextName, {
          punctuation: nextPunctuation,
        }),
        name: nextName,
        punctuation: nextPunctuation,
      });
    } catch (cause) {
      setFeedback((current) => ({
        ...current,
        error: errorMessage(cause),
      }));
    }
  };

  const useBlankName = () => {
    const blankName = "   ";
    setName(blankName);
    generate(blankName, punctuation);
    nameInputRef.current?.focus();
  };

  return (
    <div className="row g-4 align-items-start">
      <GreetingForm
        name={name}
        nameInputRef={nameInputRef}
        punctuation={punctuation}
        onNameChange={setName}
        onPunctuationChange={setPunctuation}
        onSubmit={(event) => {
          event.preventDefault();
          generate(name, punctuation);
        }}
        onBlankName={useBlankName}
      />
      <GreetingResult error={feedback.error} message={feedback.message} />
      <GreetingCode
        name={feedback.name}
        packageName={packageName}
        punctuation={feedback.punctuation}
      />
    </div>
  );
}
