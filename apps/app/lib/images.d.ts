// Metro asset modules: importing a bundled image yields its asset id (a
// number at runtime under Metro; a URL string under vite/vitest — tests never
// use the value). expo/types does not declare these.
declare module '*.png' {
  const value: number;
  export default value;
}
