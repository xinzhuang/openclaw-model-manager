import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"

interface ComboboxOption {
  value: string
  label: string
  group?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  emptyMessage = "No results found.",
  searchPlaceholder = "Search...",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)

  const groups = React.useMemo(() => {
    const map = new Map<string, ComboboxOption[]>()
    for (const opt of options) {
      const key = opt.group || ""
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(opt)
    }
    return map
  }, [options])

  const hasGroups = options.some((o) => o.group)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-mono text-sm transition-all duration-200",
            "hover:border-primary/50 hover:shadow-[0_0_0_1px_rgba(var(--primary)/0.1)]",
            "focus-visible:ring-1 focus-visible:ring-primary/30",
            className
          )}
          disabled={disabled}
        >
          {selected ? (
            <span className="truncate font-medium">{selected.label}</span>
          ) : (
            <span className="text-muted-foreground/70 font-normal">{placeholder}</span>
          )}
          <ChevronsUpDown className={cn(
            "ml-2 h-4 w-4 shrink-0 opacity-40 transition-transform duration-200",
            open && "rotate-180 opacity-70"
          )} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "w-[--radix-popover-trigger-width] p-0 overflow-hidden",
          "border-border/80 bg-card/95 backdrop-blur-sm",
          "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]",
          "dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]"
        )}
        align="start"
      >
        <Command className="[&_[cmdk-input-wrapper]]:px-3 [&_[cmdk-input-wrapper]]:py-2">
          <div className="flex items-center border-b border-border/50 px-3 py-2" cmdk-input-wrapper>
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-40" />
            <CommandInput
              placeholder={searchPlaceholder}
              className={cn(
                "flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none",
                "placeholder:text-muted-foreground/50",
                "font-mono text-sm"
              )}
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto p-1">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </CommandEmpty>
            {hasGroups ? (
              Array.from(groups.entries()).map(([group, items]) => (
                <CommandGroup
                  key={group || "_"}
                  heading={group || undefined}
                  className="px-2 py-1.5"
                >
                  {items.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.value}
                      onSelect={() => {
                        onValueChange?.(opt.value)
                        setOpen(false)
                      }}
                      className={cn(
                        "font-mono text-sm rounded-md px-2 py-1.5 cursor-pointer",
                        "aria-selected:bg-primary/10 aria-selected:text-primary",
                        "transition-colors duration-100"
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          value === opt.value ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                      <span className={value === opt.value ? "font-medium" : "font-normal"}>
                        {opt.label}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onValueChange?.(opt.value)
                      setOpen(false)
                    }}
                    className={cn(
                      "font-mono text-sm rounded-md px-2 py-1.5 cursor-pointer",
                      "aria-selected:bg-primary/10 aria-selected:text-primary",
                      "transition-colors duration-100"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        value === opt.value ? "opacity-100 text-primary" : "opacity-0"
                      )}
                    />
                    <span className={value === opt.value ? "font-medium" : "font-normal"}>
                      {opt.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
