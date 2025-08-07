
import type { Config } from "tailwindcss"
import sharedConfig from "@workspace/ui/tailwind.config"

const config: Pick<Config, "prefix" | "presets"> = {
  prefix: sharedConfig.prefix,
  presets: [sharedConfig],
}

export default config
