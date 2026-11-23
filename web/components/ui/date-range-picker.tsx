"use client"

import * as React from "react"
import dayjs from "dayjs"
import type { DateRange } from "react-day-picker"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { offsetIsoDate, parseIsoDate, toIsoDate } from "@/lib/format"

export interface DateRangeValue {
  fromDate: string
  toDate: string
}

interface DateRangePickerProps {
  id?: string
  fromDate: string
  toDate: string
  onChange: (range: DateRangeValue) => void
  placeholder?: string
  presets?: boolean
  disabled?: boolean
  className?: string
  align?: "start" | "center" | "end"
  "aria-label"?: string
}

export function DateRangePicker({
  id,
  fromDate,
  toDate,
  onChange,
  placeholder = "Select date range",
  presets = true,
  disabled = false,
  className,
  align = "start",
  "aria-label": ariaLabel,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedRange = React.useMemo<DateRange | undefined>(() => {
    const from = parseIsoDate(fromDate)
    const to = parseIsoDate(toDate)
    if (!from && !to) return undefined
    return { from, to }
  }, [fromDate, toDate])

  const label = React.useMemo(() => {
    const fromParsed = fromDate ? dayjs(fromDate) : null
    const toParsed = toDate ? dayjs(toDate) : null

    if (fromParsed?.isValid() && toParsed?.isValid()) {
      return `${fromParsed.format("MMM D, YYYY")} – ${toParsed.format("MMM D, YYYY")}`
    }
    if (fromParsed?.isValid()) {
      return `From ${fromParsed.format("MMM D, YYYY")}`
    }
    if (toParsed?.isValid()) {
      return `Until ${toParsed.format("MMM D, YYYY")}`
    }
    return null
  }, [fromDate, toDate])

  const applyPreset = (range: DateRangeValue) => {
    onChange(range)
    setOpen(false)
  }

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
            !label && "text-muted-foreground",
            label && "pr-8"
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label ?? placeholder}</span>
          </span>
        </PopoverTrigger>

        {label && !disabled ? (
          <button
            type="button"
            aria-label="Clear date range"
            onClick={(e) => {
              e.stopPropagation()
              onChange({ fromDate: "", toDate: "" })
            }}
            className="absolute right-2 flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <PopoverContent align={align} className="w-auto p-3">
        {presets ? (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-2.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="rounded-lg"
              onClick={() =>
                applyPreset({
                  fromDate: offsetIsoDate(-7),
                  toDate: offsetIsoDate(0),
                })
              }
            >
              Last 7 days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="rounded-lg"
              onClick={() =>
                applyPreset({
                  fromDate: offsetIsoDate(-30),
                  toDate: offsetIsoDate(0),
                })
              }
            >
              Last 30 days
            </Button>
            <Button
              type="button"
              variant="outline"
              size="xs"
              className="rounded-lg"
              onClick={() =>
                applyPreset({
                  fromDate: dayjs().startOf("month").format("YYYY-MM-DD"),
                  toDate: offsetIsoDate(0),
                })
              }
            >
              This month
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto rounded-lg text-muted-foreground"
              onClick={() => applyPreset({ fromDate: "", toDate: "" })}
            >
              All time
            </Button>
          </div>
        ) : null}

        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selectedRange}
          defaultMonth={selectedRange?.from ?? new Date()}
          onSelect={(range) => {
            onChange({
              fromDate: range?.from ? toIsoDate(range.from) : "",
              toDate: range?.to ? toIsoDate(range.to) : "",
            })
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
