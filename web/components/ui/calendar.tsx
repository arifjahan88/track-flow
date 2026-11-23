"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1 select-none", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex flex-col gap-3",
        month_caption: "relative flex h-8 items-center justify-center px-8",
        caption_label: "text-sm font-semibold text-foreground",
        nav: "absolute inset-x-0 top-0 flex h-8 items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "size-7 rounded-lg bg-transparent p-0 opacity-75 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "size-7 rounded-lg bg-transparent p-0 opacity-75 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-center text-[0.75rem] font-medium text-muted-foreground",
        week: "mt-1.5 flex w-full",
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
          "[&:has([aria-selected])]:bg-primary/15",
          "[&:has([aria-selected].day-range-end)]:rounded-r-lg",
          "[&:has([aria-selected].day-range-start)]:rounded-l-lg",
          "first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-lg p-0 font-normal transition-colors aria-selected:opacity-100"
        ),
        range_start:
          "day-range-start rounded-l-lg bg-primary/15 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        range_end:
          "day-range-end rounded-r-lg bg-primary/15 [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90 [&>button]:hover:text-primary-foreground",
        today:
          "[&>button]:border [&>button]:border-primary/50 [&>button]:font-semibold",
        outside:
          "text-muted-foreground/50 aria-selected:bg-primary/10 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground/40 opacity-50",
        range_middle:
          "rounded-none bg-primary/15 [&>button]:rounded-none [&>button]:bg-transparent [&>button]:text-foreground [&>button]:hover:bg-primary/25",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
