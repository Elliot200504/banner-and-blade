interface ChoiceGroupProps<Value extends string> {
  label: string
  options: readonly Value[]
  labels: Record<Value, string>
  value: Value
  onChange: (value: Value) => void
}

/** A row of joined buttons where exactly one is picked, like the theme and sound switches. */
export function ChoiceGroup<Value extends string>({ label, options, labels, value, onChange }: ChoiceGroupProps<Value>) {
  return (
    <div className="choice-group" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={value === option}
          className={`choice-group__option${value === option ? ' choice-group__option--active' : ''}`}
          onClick={() => onChange(option)}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}
