export function validateUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    const parsedUrl = new URL(url);

    // Allow data URIs used for image compression
    if (parsedUrl.protocol === "data:") {
      return true;
    }

    // Block unsafe protocols
    if (
      parsedUrl.protocol === "javascript:" ||
      parsedUrl.protocol === "vbscript:"
    ) {
      return false;
    }

    // Allow standard web protocols
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch (error) {
    // new URL() throws if it's not a valid URL (e.g. relative paths might fail if no base is provided)
    // Accept local SVG and image assets that match specific paths
    if (url.startsWith("/") || url.startsWith("blob:") || url.startsWith("src/") || url.startsWith("../")) {
      return true;
    }
    return false;
  }
}
