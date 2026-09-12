/// <reference types="@rsbuild/core/types" />

declare const __HOSTED_PREVIEW_URL__: string;

declare module '*.btsx' {
  import type { ComponentBody } from 'octane'

  const component: ComponentBody
  export default component
}
