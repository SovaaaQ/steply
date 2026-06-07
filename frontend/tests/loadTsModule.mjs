import { readFile } from "node:fs/promises";

import ts from "typescript";

export async function loadTsModule(relativePath) {
  const sourceUrl = new URL(`../${relativePath}`, import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2020
    }
  });

  const encoded = Buffer.from(outputText, "utf8").toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}
