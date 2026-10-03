import type {
  PluginAgentPanelProps,
  PluginPanelTab,
  PluginWorkspacePanelProps,
} from "@getpaseo/plugin/client";
import type { JsonValue } from "@getpaseo/protocol/agent-types";
import type { PluginTheme } from "@getpaseo/plugin";
import { PluginClientStateProvider } from "@getpaseo/plugin/client/host";
import { CircleAlert } from "lucide-react-native";
import { type ComponentType, useMemo, useRef } from "react";
import { Image, Text, View } from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import invariant from "tiny-invariant";
import { useIsCompactFormFactor } from "@/constants/layout";
import { usePaneContext } from "@/panels/pane-context";
import {
  definePanel,
  type PanelDescriptor,
  type PanelDescriptorContext,
  type PanelIconProps,
} from "@/panels/panel-registry";
import { useHostRuntimeClient, useHosts } from "@/runtime/host-runtime";
import { useSessionStore } from "@/stores/session-store";
import { useWorkspaceExists } from "@/stores/session-store-hooks";
import type { Theme } from "@/styles/theme";
import { normalizeWorkspaceOpaqueId } from "@/utils/workspace-identity";
import { usePluginHostNavigation } from "../host-navigation";
import { createPluginClientStateSource } from "../client-state/source";
import { toPluginTheme } from "../theme";
import { resolvePluginIcon } from "../icons";
import { useInstalledPlugin } from "../registry";
import { PluginInstallationProvider } from "../installation-provider";
import { SurfaceErrorBoundary } from "../surface-error-boundary";
import { resolvePluginWorkspacePanel } from "./resolution";
import {
  isImageIcon,
  type PluginTabState,
  readPluginTabState,
  toTabStateJson,
  withPluginState,
  withPresentation,
} from "./tab-state";
import { resolvePluginPlatform } from "../platform";

function usePluginPanelTab(): PluginPanelTab {
  const { state, setCurrentTabState } = usePaneContext();
  // Calls in the same tick (setState then setPresentation) must not drop each other.
  const latest = useRef<PluginTabState>({});
  latest.current = readPluginTabState(state);
  return useMemo(() => {
    const write = (next: PluginTabState) => {
      latest.current = next;
      setCurrentTabState(toTabStateJson(next));
    };
    return {
      state: readPluginTabState(state).plugin,
      setState: (plugin) => write(withPluginState(latest.current, plugin as JsonValue)),
      setPresentation: (presentation) => write(withPresentation(latest.current, presentation)),
    };
  }, [state, setCurrentTabState]);
}

const imageIcons = new Map<string, ComponentType<PanelIconProps>>();

function PluginTabImage({ uri, size }: { uri: string; size: number }) {
  const source = useMemo(() => ({ uri }), [uri]);
  const style = useMemo(() => ({ width: size, height: size }), [size]);
  return <Image source={source} style={style} resizeMode="contain" />;
}

// Same component per URL, so the tab bar does not remount the image on every render.
function imageIcon(uri: string): ComponentType<PanelIconProps> {
  let icon = imageIcons.get(uri);
  if (!icon) {
    const PluginImageIcon = ({ size }: PanelIconProps) => <PluginTabImage uri={uri} size={size} />;
    icon = PluginImageIcon;
    imageIcons.set(uri, icon);
  }
  return icon;
}

function resolveTabIcon(icon: string | undefined, fallback: string): ComponentType<PanelIconProps> {
  if (icon && isImageIcon(icon)) return imageIcon(icon);
  try {
    return resolvePluginIcon(icon ?? fallback);
  } catch {
    return resolvePluginIcon(fallback);
  }
}

const pluginThemeMapping = (theme: Theme) => ({
  theme: toPluginTheme(theme),
});

function PluginPanelBody({ theme }: { theme: PluginTheme }) {
  const { serverId, workspaceId, target } = usePaneContext();
  invariant(target.kind === "plugin", "PluginPanel requires plugin target");
  const plugin = useInstalledPlugin(serverId, target.pluginId);
  const contribution = resolvePluginWorkspacePanel(plugin, target);
  const workspaceExists = useWorkspaceExists(serverId, workspaceId);
  const agentExists = useSessionStore((state) => {
    if (target.context !== "agent") return null;
    const session = state.sessions[serverId];
    const agent = session?.agents.get(target.agentId) ?? session?.agentDetails.get(target.agentId);
    return (
      Boolean(agent) &&
      normalizeWorkspaceOpaqueId(agent?.workspaceId) === normalizeWorkspaceOpaqueId(workspaceId)
    );
  });
  const client = useHostRuntimeClient(serverId);
  const compact = useIsCompactFormFactor();
  const hosts = useHosts();
  const hostLabel = hosts.find((host) => host.serverId === serverId)?.label ?? serverId;
  const host = useMemo(() => ({ id: serverId, label: hostLabel }), [hostLabel, serverId]);
  const layout = useMemo(() => ({ compact, platform: resolvePluginPlatform() }), [compact]);
  const stateSource = useMemo(() => createPluginClientStateSource(serverId), [serverId]);
  const navigation = usePluginHostNavigation(serverId);
  const tab = usePluginPanelTab();

  if (!plugin || !contribution || !workspaceExists) {
    return <PluginPanelUnavailable />;
  }
  if (!client) {
    return <PluginPanelUnavailable message="Plugin host is offline." />;
  }

  let panel;
  let Surface: unknown;
  if (contribution.context === "workspace") {
    const props: PluginWorkspacePanelProps = {
      context: "workspace",
      theme,
      host,
      layout,
      navigation,
      tab,
      workspaceId,
    };
    const Component = contribution.Component;
    Surface = Component;
    panel = <Component {...props} />;
  } else if (agentExists && target.context === "agent") {
    const props: PluginAgentPanelProps = {
      context: "agent",
      theme,
      host,
      layout,
      navigation,
      tab,
      workspaceId,
      agentId: target.agentId,
    };
    const Component = contribution.Component;
    Surface = Component;
    panel = <Component {...props} />;
  } else {
    return <PluginPanelUnavailable />;
  }

  return (
    <SurfaceErrorBoundary
      installation={plugin}
      Surface={Surface}
      key={`${serverId}/${target.pluginId}/${target.panelId}/${target.context}`}
    >
      <PluginInstallationProvider plugin={plugin}>
        <PluginClientStateProvider source={stateSource}>{panel}</PluginClientStateProvider>
      </PluginInstallationProvider>
    </SurfaceErrorBoundary>
  );
}

const ThemedPluginPanelBody = withUnistyles(PluginPanelBody);

function PluginPanel() {
  return <ThemedPluginPanelBody uniProps={pluginThemeMapping} />;
}

function PluginPanelUnavailable({
  message = "This plugin panel is unavailable.",
}: {
  message?: string;
}) {
  return (
    <View style={styles.unavailable}>
      <Text style={styles.unavailableText}>{message}</Text>
    </View>
  );
}

function usePluginPanelDescriptor(
  target: Extract<import("@/workspace-tabs/model").WorkspaceTabTarget, { kind: "plugin" }>,
  context: PanelDescriptorContext,
): PanelDescriptor {
  const plugin = useInstalledPlugin(context.serverId, target.pluginId);
  const panel = plugin?.workspacePanels.find(
    (contribution) => contribution.id === target.panelId && contribution.context === target.context,
  );
  if (!panel) {
    return {
      label: "Plugin unavailable",
      subtitle: target.pluginId,
      tooltip: "This plugin panel is unavailable",
      titleState: "ready",
      icon: CircleAlert,
      statusBucket: null,
    };
  }
  const { title, icon } = readPluginTabState(context.state);
  return {
    label: title ?? panel.title,
    subtitle: target.pluginId,
    tooltip: title ?? panel.title,
    titleState: "ready",
    icon: resolveTabIcon(icon, panel.icon),
    statusBucket: null,
  };
}

export const pluginPanelRegistration = definePanel("plugin", {
  component: PluginPanel,
  useDescriptor: usePluginPanelDescriptor,
});

const styles = StyleSheet.create((theme) => ({
  unavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[4],
    backgroundColor: theme.colors.surface0,
  },
  unavailableText: {
    color: theme.colors.foregroundMuted,
  },
}));
