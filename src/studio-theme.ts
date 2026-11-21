import { defineTheme } from "@astryxdesign/core/theme";
import { themes, defaultThemeSlug } from "./astryx-themes";

/** Extend the installed Astryx neutral theme; keep native and Astryx controls in sync. */
export const studioTheme = defineTheme({
  name: "gradus",
  extends: themes[defaultThemeSlug],
  tokens: {
    "--color-accent": ["#245fa8", "#78b2ff"],
    "--color-text-accent": ["#245fa8", "#78b2ff"],
    "--color-accent-muted": ["#245fa814", "#78b2ff20"],
    "--color-background-body": ["#eef1f5", "#111827"],
    "--color-background-surface": ["#ffffff", "#192334"],
    "--color-background-card": ["#ffffff", "#192334"],
    "--color-background-popover": ["#ffffff", "#243247"],
    "--color-text-primary": ["#202c3c", "#e8eef7"],
    "--color-text-secondary": ["#536176", "#aab9cc"],
    "--color-border": ["#bec9d7", "#3a4b63"],
    "--color-border-emphasized": ["#9aaabd", "#536984"],
  },
});
