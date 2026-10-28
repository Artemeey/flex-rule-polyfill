# flexbox-rule-polyfill

Partial polyfill for CSS Gap Decorations (`rule`) in Flexbox. It draws solid separator lines between flex items and
flex lines using Canvas.

Author: [Artemeey](https://github.com/Artemeey/)

Russian version: [README.ru.md](./README.ru.md)

## Demo

- [Open the demo on GitHub Pages](https://artemeey.github.io/flex-rule-polyfill/)
- [Open the demo locally](./demo/)

The demo checks whether the browser supports native CSS `rule`. If it does, the Canvas polyfill is not used and the
demo shows the real CSS behavior. Otherwise, the Canvas fallback is enabled.

## Build

```sh
npm install
npm run build
```

The build creates two browser files:

- `dist/flex-rule-polyfill.js` — ES module for Vite, Webpack, Rollup, and other bundlers;
- `dist/flex-rule-polyfill.browser.js` — minified browser build for a regular `<script>` tag, about 4.8 KB.

## Use as an ES module

Download `dist/flex-rule-polyfill.js`, put it in your project sources, and import it from your code:

```ts
import {polyfillFlexRule} from './flex-rule-polyfill.js';

const flex = document.querySelector<HTMLElement>('.flex');
if (!flex) throw new Error('Flex container not found');

const destroy = polyfillFlexRule(flex);

// When the component is removed:
// destroy();
```

The container must use `display: flex` or `display: inline-flex`:

```css
.flex {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    rule: 2px solid #e11d48;

    /* Canvas fallback values for browsers without native rule support. */
    --flex-rule-color: #e11d48;
    --flex-rule-width: 2px;
}
```

Your bundler includes the imported module in the final bundle.

## Use as a regular browser script

Download the minified `dist/flex-rule-polyfill.browser.js` and include it without `import` or a bundler:

```html
<script src="flex-rule-polyfill.browser.js"></script>
<script>
    const { polyfillFlexRule } = window.FlexRulePolyfill;
    polyfillFlexRule(document.querySelector('.flex'));
</script>
```

The browser build is about 4.8 KB, or about 2.2 KB with gzip.

## API

```ts
interface FlexRuleOptions {
    force?: boolean;
    color?: string;
    width?: number;
}

const destroy = polyfillFlexRule(element, options);
destroy();
```

The priority for `color` and `width` is: API options, values read from the computed `rule` shorthand, Canvas custom
properties, and defaults.

`rule-inset` shortens both ends of each line. The polyfill reads one or two pixel values from the computed property;
use `--flex-rule-inset` with the same values when the browser does not support it. To hide vertical lines on mobile while
keeping horizontal ones, set `column-rule: none` and `--flex-column-rule: none` in the same media query. The custom
property tells the polyfill that `none` was set explicitly rather than being the default value.

The polyfill supports `flex-wrap`, different item sizes, `order`, row and column directions, reverse directions, RTL,
scrolling, and dynamic changes observed by the browser. It measures only direct HTML element children of the Flexbox
container.

In a browser with native `rule` support, the function does nothing (`CSS.supports('rule', '1px solid')`). Otherwise it
creates a Canvas overlay. For programmatic testing, the fallback can be forced with `{ force: true }`, but native
`rule` decorations must be disabled first to avoid drawing both layers.

## Implemented CSS properties

This project provides a visual fallback, not a complete CSS Gaps implementation.

| Property | Status | Behavior |
| --- | --- | --- |
| `rule` | Partial | Reads `width` and `color` from the computed shorthand and draws solid lines. |
| `rule-style` | Fixed | Only `solid` is supported. |
| `rule-color` | Visual equivalent | Use `options.color` or `--flex-rule-color`; the standard longhand is not parsed. |
| `rule-width` | Visual equivalent | Use `options.width` or `--flex-rule-width`; the standard longhand is not parsed. |
| `row-rule` / `column-rule` | Partial | Both directions share a color and width; `--flex-column-rule: none` hides vertical lines. |
| `rule-break` and related properties | Not implemented | Intersection breaks are not supported. |
| `rule-inset` | Partial | One or two pixel values inset line ends; use `--flex-rule-inset` when CSS support is absent. |
| Other inset properties | Not implemented | Cap/junction variants and percentages are not supported. |
| `rule-overlap`, `rule-visibility-items` | Not implemented | Specification-specific overlap and visibility behavior is not supported. |
| `repeat(...)` and rule lists | Not implemented | Styles cannot be alternated between rules. |
| `gap`, `row-gap`, `column-gap` | Not polyfilled | Native Flexbox determines the gaps; Canvas only draws over the result. |

`flex-direction`, `flex-wrap`, `order`, `direction`, `padding`, and actual element sizes are used as input. The browser
continues to implement those properties; the polyfill does not replace Flexbox layout.

## How it works

The polyfill adds one absolutely positioned Canvas overlay inside the Flexbox container. The Canvas does not participate
in Flexbox layout and uses `pointer-events: none`.

1. The container and its direct children are measured with `getComputedStyle()` and `getBoundingClientRect()`.
2. Elements are normalized according to Flexbox direction, reverse direction, RTL, and CSS `order`.
3. The measured elements are grouped into virtual flex lines using their actual coordinates.
4. Lines are drawn between neighboring items and between neighboring virtual flex lines.
5. Resize and mutation observers, scrolling, viewport resize, and animation completion schedule a redraw.
6. Multiple events are combined with `requestAnimationFrame`, so no more than one paint is performed per frame.

This is a geometric heuristic based on DOM rectangles, not access to the browser's internal Flexbox line model. Complex
`justify-content`, transforms, overlaps, or unusual writing modes may therefore produce an approximate result.

## Limitations

- This is not a full CSS Gaps or CSS `rule` implementation.
- Longhand properties, rule lists, and additional values are not parsed.
- Only solid, single-color lines are supported; `dashed`, `dotted`, `double`, gradients, and `repeat()` are not.
- Separate colors and widths for the two directions are not supported.
- The Canvas is drawn above the flex items with `z-index: 1`, although pointer events pass through it.
- Text nodes, pseudo-elements, and non-element flex items are not measured.
- The detected flex lines are inferred from geometry and may be inaccurate in complex layouts.

## Specification and browser support

- [MDN: `rule`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/rule)
- [MDN: `rule-break`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/rule-break)
- [MDN: CSS gap rules](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Gaps/Defining_rules)
- [W3C: CSS Gaps Module Level 1](https://www.w3.org/TR/css-gaps-1/)
