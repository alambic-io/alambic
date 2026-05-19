declare module 'alpinejs' {
  interface AlpineGlobal {
    start(): void;
  }
  const Alpine: AlpineGlobal;
  export default Alpine;
}
