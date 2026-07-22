"use client"

import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"

export type ComboboxOption = { label: string; value: string; disabled?: boolean }
type Props = { value: string; onValueChange: (value: string) => void; options: readonly ComboboxOption[]; placeholder?: string; emptyMessage?: string; className?: string; contentClassName?: string; disabled?: boolean; required?: boolean; name?: string; id?: string; "aria-label"?: string; "aria-invalid"?: boolean }

export function ComboboxField({ value, onValueChange, options, placeholder, emptyMessage = "No items found.", className, contentClassName, disabled, required, name, id, "aria-label": ariaLabel, "aria-invalid": ariaInvalid }: Props) {
  const selected = options.find((option) => option.value === value) ?? null
  return <Combobox items={options} value={selected} onValueChange={(option) => onValueChange(option?.value ?? "")} isItemEqualToValue={(option, selectedOption) => option.value === selectedOption.value}>
    <ComboboxInput id={id} name={name} placeholder={placeholder} className={className} disabled={disabled} required={required} aria-label={ariaLabel} aria-invalid={ariaInvalid || undefined} />
    <ComboboxContent className={contentClassName}><ComboboxEmpty>{emptyMessage}</ComboboxEmpty><ComboboxList>{(option) => <ComboboxItem key={option.value || option.label} value={option} disabled={option.disabled}>{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent>
  </Combobox>
}
