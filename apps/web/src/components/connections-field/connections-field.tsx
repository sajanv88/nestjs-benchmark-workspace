import { Field, FieldControl, FieldDescription, FieldLabel, Slider } from "@nuvui/react";
import { DEFAULT_CONNECTIONS, MAX_CONNECTIONS } from "@repo/types";
import "./connections-field.scss";

const STEP = 100;

type ConnectionsFieldProps = {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
};

export function ConnectionsField({ value, disabled, onChange }: ConnectionsFieldProps) {
  return (
    <Field className="connections-field" disabled={disabled}>
      <div className="connections-field__heading">
        <FieldLabel>Connections</FieldLabel>
        <output className="connections-field__value">{value}</output>
      </div>
      <FieldControl>
        <Slider
          min={DEFAULT_CONNECTIONS}
          max={MAX_CONNECTIONS}
          step={STEP}
          value={[value]}
          onValueChange={([next]) => {
            if (next !== undefined) onChange(next);
          }}
        />
      </FieldControl>
      <FieldDescription>Above 100, the load generator may become the limit.</FieldDescription>
    </Field>
  );
}
