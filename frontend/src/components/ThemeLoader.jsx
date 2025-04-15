import { useEffect } from "react";

/**
 * ThemeLoader dynamically loads a CSS file for the selected theme.
 * Place your theme CSS files in /themes and pass the theme name (without .css).
 * Example: <ThemeLoader themeName="AlienBlood" />
 */
export default function ThemeLoader({ themeName }) {
  useEffect(() => {
    const linkId = "theme-css";
    let link = document.getElementById(linkId);
    const themeHref = `/themes/${themeName}.css`;
    if (link) {
      // Swap href if already present
      if (link.href !== window.location.origin + themeHref) {
        link.href = themeHref;
      }
    } else {
      // Create new link tag
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = themeHref;
      document.head.appendChild(link);
    }
    // Optionally: clean up on unmount
    // return () => { link && link.parentNode && link.parentNode.removeChild(link); };
  }, [themeName]);

  return null;
}
