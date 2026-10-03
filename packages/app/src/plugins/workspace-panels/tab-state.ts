import type { JsonValue } from "@getpaseo/protocol/agent-types";

// A plugin tab's state: what the plugin stored, plus the title and icon it gave the tab. Kept in
// the tab state so the tab bar can show them while the panel is unmounted.
export interface PluginTabState {
  plugin?: JsonValue;
  title?: string;
  icon?: string;
}

export function readPluginTabState(state: JsonValue | undefined): PluginTabState {
  if (!state || typeof state !== "object" || Array.isArray(state)) return {};
  const { plugin, title, icon } = state;
  return {
    ...(plugin !== undefined ? { plugin } : {}),
    ...(typeof title === "string" && title.trim() ? { title: title.trim() } : {}),
    ...(typeof icon === "string" && icon.trim() ? { icon: icon.trim() } : {}),
  };
}

export function withPluginState(current: PluginTabState, plugin: JsonValue): PluginTabState {
  return { ...current, plugin };
}

/** Omitted or blank fields fall back to the panel contribution's title and icon. */
export function withPresentation(
  current: PluginTabState,
  presentation: { title?: string; icon?: string },
): PluginTabState {
  return readPluginTabState(
    toTabStateJson({
      plugin: current.plugin,
      title: presentation.title,
      icon: presentation.icon,
    }),
  );
}

export function toTabStateJson(state: PluginTabState): JsonValue {
  return Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined));
}

const IMAGE_ICON = /^(https?:\/\/|data:image\/)/;

/** A tab icon is an image URL, or else a Lucide icon name. */
export function isImageIcon(icon: string): boolean {
  return IMAGE_ICON.test(icon);
}
