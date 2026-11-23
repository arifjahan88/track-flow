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
        nav: "pointer-events-none absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "pointer-events-auto size-7 rounded-lg bg-transparent p-0 opacity-75 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline", size: "icon-sm" }),
          "pointer-events-auto size-7 rounded-lg bg-transparent p-0 opacity-75 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-center text-[0.75rem] font-medium text-muted-foreground",
        week: "mt-1.5 flex w-full",
        day: cn(
          "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 rounded-lg p-0 font-normal text-foreground transition-colors"
        ),
        selected:
          "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90 [&>button]:hover:text-primary-foreground",
        range_start:
          "rounded-l-lg bg-primary/15 dark:bg-primary/20 [&>button]:rounded-lg [&>button]:!bg-primary [&>button]:!font-semibold [&>button]:!text-primary-foreground [&>button]:hover:!bg-primary/90",
        range_end:
          "rounded-r-lg bg-primary/15 dark:bg-primary/20 [&>button]:rounded-lg [&>button]:!bg-primary [&>button]:!font-semibold [&>button]:!text-primary-foreground [&>button]:hover:!bg-primary/90",
        range_middle:
          "rounded-none bg-primary/15 dark:bg-primary/20 [&>button]:rounded-none [&>button]:!bg-transparent [&>button]:!font-medium [&>button]:!text-foreground [&>button]:hover:!bg-primary/25",
        today:
          "[&>button]:ring-1 [&>button]:ring-primary/70 [&>button]:ring-inset [&>button]:font-semibold",
        outside:
          "opacity-45 [&>button]:text-muted-foreground",
        disabled: "opacity-35 pointer-events-none",
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
