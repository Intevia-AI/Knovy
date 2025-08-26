
"use client";

import * as React from "react";
import { Check, Languages } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { useLanguage } from "@/context/language-context";

export function LanguageSwitcher() {
  const [open, setOpen] = React.useState(false);
  const { locale, setLocale, t } = useLanguage();

  const languages = [
    { value: "en", label: t("language_switcher.en") },
    { value: "zh-TW", label: t("language_switcher.zh_tw") },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change language" className="transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          {/* <CommandInput placeholder={t("language_switcher.search_placeholder")} /> */}
          <CommandList>
            <CommandEmpty>{t("language_switcher.no_language_found")}</CommandEmpty>
            <CommandGroup>
              {languages.map((language) => (
                <CommandItem
                  key={language.value}
                  value={language.value}
                  onSelect={(currentValue) => {
                    setLocale(currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      locale === language.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {language.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
