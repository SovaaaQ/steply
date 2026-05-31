import { networkInterfaces } from "node:os";
import { resolve } from "node:path";

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_DEV_PORT = 5173;
const VIRTUAL_INTERFACE_PATTERN = /^(awdl|br-|docker|llw|lo|utun|veth|vmnet)/i;

function getPrivateLanAddress() {
  const interfaces = Object.entries(networkInterfaces()).sort(([left], [right]) => {
    const leftIsVirtual = VIRTUAL_INTERFACE_PATTERN.test(left);
    const rightIsVirtual = VIRTUAL_INTERFACE_PATTERN.test(right);

    return Number(leftIsVirtual) - Number(rightIsVirtual);
  });

  for (const [name, connections] of interfaces) {
    if (VIRTUAL_INTERFACE_PATTERN.test(name)) {
      continue;
    }

    for (const connection of connections ?? []) {
      if (connection.family !== "IPv4" || connection.internal) {
        continue;
      }

      if (
        connection.address.startsWith("10.") ||
        connection.address.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(connection.address)
      ) {
        return connection.address;
      }
    }
  }

  return null;
}

function formatPublicHost(host: string) {
  const trimmed = host.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.includes(":") && !trimmed.startsWith("[") ? `[${trimmed}]` : trimmed;
}

export default defineConfig(({ command, mode }) => {
  const env = {
    ...loadEnv(mode, resolve(process.cwd(), ".."), ""),
    ...loadEnv(mode, process.cwd(), "")
  };
  const explicitPublicAppUrl = env.VITE_PUBLIC_APP_URL?.trim();
  const publicHost = formatPublicHost(env.STEPLY_LAN_HOST ?? "");
  const lanAddress = command === "serve" ? getPrivateLanAddress() : null;
  const inferredPublicHost = publicHost ?? lanAddress;
  const publicAppUrl =
    explicitPublicAppUrl ||
    (inferredPublicHost ? `http://${inferredPublicHost}:${DEFAULT_DEV_PORT}` : null);

  return {
    plugins: [react()],
    define: publicAppUrl
      ? {
          "import.meta.env.VITE_PUBLIC_APP_URL": JSON.stringify(publicAppUrl)
        }
      : undefined,
    server: {
      host: true,
      port: DEFAULT_DEV_PORT
    }
  };
});
