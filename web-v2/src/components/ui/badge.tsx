import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "pending" | "approved" | "denied"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-primary text-primary-foreground": variant === "default",
          "bg-secondary text-secondary-foreground": variant === "secondary",
          "bg-destructive text-destructive-foreground": variant === "destructive",
          "border border-input": variant === "outline",
          "bg-yellow-500/20 text-yellow-400": variant === "pending",
          "bg-green-500/20 text-green-400": variant === "approved",
          "bg-red-500/20 text-red-400": variant === "denied",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
