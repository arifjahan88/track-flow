"use client"

import * as React from "react"
import dayjs from "dayjs"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "cn"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { parseIsoDate, toIsoDate } from "@/lib/format"

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  className?: string
  "aria-label"?: string
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  clearable = false,
  className,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = React.useMemo(() => parseIsoDate(value), [value])
  const formatted = React.useMemo(() => {
    if (!value) return null
    const parsed = dayjs(value)
    return parsed.isValid() ? parsed.format("MMM D, YYYY") : null
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative flex w-full items-center", className)}>
        <PopoverTrigger
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-transparent px-3 py-2 text-left text-sm transition-colors outline-none select-none hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
            !formatted && "text-muted-foreground",
            clearable && formatted && "pr-8"
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{formatted ?? placeholder}</span>
          </span>
        </PopoverTrigger>

        {clearable && formatted && !disabled ? (
          <button
            type="button"
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation()
              onChange("")
            }}
            className="absolute right-2 flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <PopoverContent align="start" className="w-auto p-2.5">
        {open ? (
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (date) {
                onChange(toIsoDate(date))
                setOpen(false)
              } else if (clearable) {
                onChange("")
                setOpen(false)
              }
            }}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
