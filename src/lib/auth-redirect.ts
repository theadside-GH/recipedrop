const DEFAULT_REDIRECT = "/";

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_REDIRECT;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return DEFAULT_REDIRECT;
    if (decoded.startsWith("/login") || decoded.startsWith("/auth")) return DEFAULT_REDIRECT;
    return decoded;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

export function pathWithSearch(pathname: string, search: string): string {
  return `${pathname}${search}`;
}
