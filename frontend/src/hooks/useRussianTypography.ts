import { useEffect } from "react";

import { watchRussianTypography } from "../utils/typography";

export function useRussianTypography() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const root = document.getElementById("root") ?? document.body;

    return watchRussianTypography(root);
  }, []);
}
