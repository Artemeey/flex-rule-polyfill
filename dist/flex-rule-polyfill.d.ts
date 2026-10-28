/**
 * Options for solid gap decorations on a flex container.
 */
export interface FlexRuleOptions {
    /**
     * Render the canvas even if the browser supports native `rule` (useful for testing).
     */
    force?: boolean;
    color?: string;
    width?: number;
}
/**
 * Draw solid `rule` gap decorations on a flex container in browsers without native support.
 * The returned cleanup function disconnects observers and removes the canvas.
 * Supports flex-wrap, row/column directions, reverse directions, and changing item sizes.
 * Does not implement every CSS Gaps feature (lists, dashed, writing modes).
 */
export declare const polyfillFlexRule: (flex: HTMLElement, options?: FlexRuleOptions) => (() => void);
