import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "./src/index.ts",
        "./src/adapters/react.ts",
        "./src/adapters/vue.ts",
        "./src/adapters/svelte.ts",
        "./src/adapters/solid.ts",
        "./src/adapters/element.ts",
      ],
      minify: true,
    },
  ],
});
