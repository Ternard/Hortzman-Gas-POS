import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hortzman Gas POS",
    short_name: "Hortzman POS",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f3",
    theme_color: "#ea580c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
