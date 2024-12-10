export interface Transformation {
  type: string;
  params: Record<string, string | number>;
}

export function parseTransformationUrl(url: string): {
  publicId: string;
  transformations: Transformation[];
} {
  const parts = url.split("/");
  const uploadIndex = parts.indexOf("upload");
  if (uploadIndex === -1) {
    throw new Error("Invalid transformation URL.");
  }

  // Extract the transformation string and public ID
  const transformationParts = parts.slice(uploadIndex + 1, -1); // Transformations are between "upload" and the public ID
  let publicId = parts[parts.length - 1];

  // Handle publicId with extensions (e.g., "penguin.jpg")
  if (publicId.includes("?")) {
    publicId = publicId.split("?")[0]; // Remove query parameters if present
  }

  // Parse transformations and filter out invalid entries
  const transformations: Transformation[] = transformationParts
    .filter((part) => part.includes("_")) // Ensure it has "_" (e.g., "c_scale" or "w_600")
    .map((part) => {
      const [type, ...paramPairs] = part.split(",");
      const params: Record<string, string | number> = {};

      paramPairs.forEach((pair) => {
        const [key, value] = pair.split("_");
        params[key] = isNaN(Number(value)) ? value : Number(value);
      });

      return { type, params };
    });

  return { publicId, transformations };
}
