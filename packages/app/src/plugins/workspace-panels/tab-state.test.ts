import { describe, expect, it } from "vitest";
import {
  isImageIcon,
  readPluginTabState,
  toTabStateJson,
  withPluginState,
  withPresentation,
} from "./tab-state";

describe("readPluginTabState", () => {
  it("keeps the plugin value and non-blank presentation", () => {
    expect(
      readPluginTabState({ plugin: { selected: "a" }, title: " Forgejo ", icon: "Box" }),
    ).toEqual({ plugin: { selected: "a" }, title: "Forgejo", icon: "Box" });
  });

  it("ignores missing, malformed, and blank values", () => {
    expect(readPluginTabState(undefined)).toEqual({});
    expect(readPluginTabState(["x"])).toEqual({});
    expect(readPluginTabState("x")).toEqual({});
    expect(readPluginTabState({ title: "  ", icon: 3 })).toEqual({});
  });
});

describe("tab state updates", () => {
  it("replaces the plugin value and keeps the presentation", () => {
    const next = withPluginState({ plugin: 1, title: "A" }, { selected: "b" });
    expect(next).toEqual({ plugin: { selected: "b" }, title: "A" });
  });

  it("replaces the presentation and keeps the plugin value", () => {
    const next = withPresentation({ plugin: 1, title: "A", icon: "Box" }, { title: "B" });
    expect(next).toEqual({ plugin: 1, title: "B" });
  });

  it("falls back to the contribution when the presentation is cleared", () => {
    expect(toTabStateJson(withPresentation({ plugin: 1, title: "A" }, {}))).toEqual({ plugin: 1 });
  });
});

describe("isImageIcon", () => {
  it("tells image URLs from Lucide names", () => {
    expect(isImageIcon("https://example.com/logo.svg")).toBe(true);
    expect(isImageIcon("data:image/png;base64,AAAA")).toBe(true);
    expect(isImageIcon("LayoutGrid")).toBe(false);
  });
});
