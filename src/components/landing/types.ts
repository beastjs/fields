import type { MouseEventHandler } from 'octane'

/**
 * The actions every landing section shares. `LandingPage.btsx` owns the state behind them so the
 * sections stay presentational and the sign-in flow has one home.
 */
export interface LandingActions {
  /** Starts the Google sign-in flow. */
  signIn: () => void
  /**
   * Opens the playground. The elements carrying this are real `/playground` links, so a modified
   * click (new tab, new window) still behaves like one; a plain click routes without a reload.
   */
  enter: MouseEventHandler<HTMLAnchorElement>
  /** True while a sign-in attempt is in flight. */
  isPending: boolean
}
