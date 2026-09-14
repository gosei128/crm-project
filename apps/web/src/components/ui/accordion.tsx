import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type AccordionType = "single" | "multiple";

interface AccordionContextValue {
  openItems: string[];
  toggle: (value: string) => void;
}

interface AccordionItemContextValue {
  value: string;
  open: boolean;
  toggle: () => void;
  triggerId: string;
  contentId: string;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(
  null,
);
const AccordionItemContext =
  React.createContext<AccordionItemContextValue | null>(null);

function useAccordionContext() {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion parts must be used within <Accordion>");
  return ctx;
}

function useAccordionItemContext() {
  const ctx = React.useContext(AccordionItemContext);
  if (!ctx) {
    throw new Error("AccordionTrigger/Content must be used within <AccordionItem>");
  }
  return ctx;
}

function Accordion({
  type = "single",
  defaultValue,
  value,
  onValueChange,
  ...props
}: React.ComponentProps<"div"> & {
  type?: AccordionType;
  defaultValue?: string[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
}) {
  const [uncontrolled, setUncontrolled] = React.useState<string[]>(
    defaultValue ?? [],
  );
  const openItems = value ?? uncontrolled;

  const toggle = React.useCallback(
    (itemValue: string) => {
      const next =
        type === "single"
          ? openItems.includes(itemValue)
            ? []
            : [itemValue]
          : openItems.includes(itemValue)
            ? openItems.filter((v) => v !== itemValue)
            : [...openItems, itemValue];
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [type, openItems, value, onValueChange],
  );

  const context = React.useMemo(
    () => ({ openItems, toggle }),
    [openItems, toggle],
  );

  return (
    <AccordionContext.Provider value={context}>
      <div data-slot="accordion" {...props} />
    </AccordionContext.Provider>
  );
}

function AccordionItem({
  className,
  value,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const { openItems, toggle } = useAccordionContext();
  const open = openItems.includes(value);
  const triggerId = React.useId();
  const contentId = React.useId();

  const itemContext = React.useMemo(
    () => ({
      value,
      open,
      toggle: () => toggle(value),
      triggerId,
      contentId,
    }),
    [value, open, toggle, triggerId, contentId],
  );

  return (
    <AccordionItemContext.Provider value={itemContext}>
      <div
        data-slot="accordion-item"
        data-open={open || undefined}
        className={cn(
          "group border-b border-espresso/10 bg-cream last:border-0",
          className,
        )}
        {...props}
      />
    </AccordionItemContext.Provider>
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const { open, toggle, triggerId, contentId } = useAccordionItemContext();

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const root = (e.currentTarget as HTMLElement).closest(
      '[data-slot="accordion"]',
    );
    if (!root) return;
    const triggers = Array.from(
      root.querySelectorAll<HTMLElement>('[data-slot="accordion-trigger"]'),
    );
    const index = triggers.indexOf(e.currentTarget as HTMLElement);
    const next =
      triggers[
        (index + (e.key === "ArrowDown" ? 1 : -1) + triggers.length) %
          triggers.length
      ];
    e.preventDefault();
    next?.focus();
  }

  return (
    <h3 className="m-0">
      <button
        type="button"
        data-slot="accordion-trigger"
        id={triggerId}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-espresso outline-none transition-colors hover:text-oxblood focus-visible:ring-2 focus-visible:ring-brass/60 focus-visible:ring-inset",
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-brass transition-transform duration-300 ease-out group-data-[open]:rotate-180"
          aria-hidden="true"
        />
      </button>
    </h3>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open, triggerId, contentId } = useAccordionItemContext();
  return (
    <div
      data-slot="accordion-content"
      id={contentId}
      role="region"
      aria-labelledby={triggerId}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
      {...props}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "max-w-2xl px-5 pb-5 text-sm leading-relaxed text-espresso/70",
            className,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
