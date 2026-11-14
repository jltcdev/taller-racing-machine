import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { formatCOPInput, parseCOPInput } from "@/lib/orders";

type CurrencyInputProps = Omit<
  ComponentProps<typeof Input>,
  "onChange" | "type" | "value"
> & {
  onValueChange: (value: string) => void;
  value: string;
};

export function CurrencyInput({
  onValueChange,
  value,
  ...props
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const digitsToKeepBeforeCaret = digitsBeforeCaret.current;
    if (digitsToKeepBeforeCaret === null || !inputRef.current) return;

    const formattedValue = formatCOPInput(value);
    let caretPosition = 0;
    let digitsCounted = 0;
    while (
      caretPosition < formattedValue.length &&
      digitsCounted < digitsToKeepBeforeCaret
    ) {
      if (/\d/.test(formattedValue.charAt(caretPosition))) digitsCounted += 1;
      caretPosition += 1;
    }

    inputRef.current.setSelectionRange(caretPosition, caretPosition);
    digitsBeforeCaret.current = null;
  }, [value]);

  return (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={formatCOPInput(value)}
      onChange={(event) => {
        const inputValue = event.currentTarget.value;
        const cursorPosition =
          event.currentTarget.selectionStart ?? inputValue.length;
        digitsBeforeCaret.current = parseCOPInput(
          inputValue.slice(0, cursorPosition),
        ).length;
        onValueChange(parseCOPInput(inputValue));
      }}
    />
  );
}
