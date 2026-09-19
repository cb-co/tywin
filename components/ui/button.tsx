import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Note-ink text is near-white, so the currentColor outline would vanish
        // on paper: filled variants take the ink colour for their focus ring.
        // In dark, --primary (#4a1f8c) on paper is ~1.4:1, so the edge is drawn
        // in --note-line to keep the button's boundary above 3:1.
        default:
          "bg-primary text-primary-foreground hover:bg-(--note-deep) focus-visible:outline-foreground dark:border-(--note-line)",
        outline:
          "border-foreground bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-(--secondary-hover) aria-expanded:bg-secondary",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "border-(--red) bg-transparent text-(--red) hover:bg-(--red) hover:text-white",
        link: "text-brand underline underline-offset-4 decoration-1 hover:decoration-2",
        brand:
          "rounded-full bg-(--note) text-(--note-ink) shadow-(--shadow-float) hover:bg-(--note-deep) focus-visible:outline-foreground dark:border-(--note-line)",
      },
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 rounded-[3px] px-3 text-xs in-data-[slot=button-group]:rounded-[3px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-[3px] px-4 text-[0.8rem] in-data-[slot=button-group]:rounded-[3px] has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-7 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-[3px] in-data-[slot=button-group]:rounded-[3px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-[3px] in-data-[slot=button-group]:rounded-[3px]",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  isLoading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { isLoading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <Loader2Icon className="animate-spin" /> : null}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
