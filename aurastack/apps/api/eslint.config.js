export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json"
      }
    },
    rules: {
      "no-console": "off"
    }
  }
];
