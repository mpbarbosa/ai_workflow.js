declare module 'react' {
  export interface ReactElement<P = unknown> {
    readonly type: unknown;
    readonly props: P;
    readonly key: string | number | null;
  }

  interface ReactNamespace {
    readonly Fragment: symbol;
    createElement(
      type: unknown,
      props?: Record<string, unknown> | null,
      ...children: unknown[]
    ): ReactElement;
  }

  const React: ReactNamespace;

  export default React;
}
