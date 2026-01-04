interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-400 mb-2">
        Amount
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min="0"
        step="any"
        className="input text-2xl font-semibold text-center"
        placeholder="Enter amount"
      />
    </div>
  );
}
