declare module "ignore" {
  interface Ignore {
    add(pattern: string | string[] | Ignore): Ignore;
    ignores(pathname: string): boolean;
  }

  function ignore(options?: { ignorecase?: boolean }): Ignore;
  export = ignore;
}
