import { requireOptionalNativeModule } from "expo-modules-core";

export type StreamResolution = { streamUrl: string; headers?: Record<string, string> };
type NativeResolver = { resolveStreamUrl(videoId: string): Promise<StreamResolution> };
const nativeResolver = requireOptionalNativeModule<NativeResolver>("NativeStreamResolver");
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { value: StreamResolution; expiresAt: number }>();

export async function resolveStreamUrl(videoId: string): Promise<StreamResolution> {
  const cached = cache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!nativeResolver) throw new Error("native_resolver_unavailable");
  const value = await nativeResolver.resolveStreamUrl(videoId);
  if (!value?.streamUrl) throw new Error("native_resolver_invalid_output");
  cache.set(videoId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
