# flexbox-rule-polyfill

Частичный полифил CSS Gap Decorations (`rule`) для Flexbox. Он рисует сплошные разделительные линии между
flex-элементами
и flex-строками через Canvas.

Автор: [Artemeey](https://github.com/Artemeey/)

English version: [README.md](./README.md)

## Demo

- [Открыть demo на русском языке](https://artemeey.github.io/flex-rule-polyfill/#language=ru)
- [Открыть demo локально](./demo/)

Demo проверяет поддержку нативного CSS `rule`. Если браузер поддерживает это свойство, Canvas-полифил не используется и
показывается настоящая работа CSS. В остальных браузерах включается Canvas-полифил.

## Сборка

```sh
npm install
npm run build
```

Сборка создаёт два browser-файла:

- `dist/flex-rule-polyfill.js` — ES-модуль для Vite, Webpack, Rollup и других сборщиков;
- `dist/flex-rule-polyfill.browser.js` — minified browser-сборка для обычного тега `<script>`, около 4,8 KB.

## Использование как ES-модуля

Скачайте `dist/flex-rule-polyfill.js`, положите его в исходники проекта и импортируйте функцию:

```ts
import {polyfillFlexRule} from './flex-rule-polyfill.js';

const flex = document.querySelector<HTMLElement>('.flex');
if (!flex) throw new Error('Flex container not found');

const destroy = polyfillFlexRule(flex);

// При удалении компонента:
// destroy();
```

Контейнер должен использовать `display: flex` или `display: inline-flex`:

```css
.flex {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    rule: 2px solid #e11d48;

    /* Настройки Canvas для браузеров без нативной поддержки rule. */
    --flex-rule-color: #e11d48;
    --flex-rule-width: 2px;
}
```

Сборщик включит импортированный модуль в итоговый bundle.

## Использование как обычного browser-скрипта

Скачайте minified-файл `dist/flex-rule-polyfill.browser.js` и подключите его без `import` и сборщика:

```html

<script src="flex-rule-polyfill.browser.js"></script>
<script>
    const { polyfillFlexRule } = window.FlexRulePolyfill;
    polyfillFlexRule(document.querySelector('.flex'));
</script>
```

Размер browser-сборки — около 4,8 KB, после gzip — около 2,2 KB.

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

Приоритет `color` и `width`: параметры API, значения из вычисленного shorthand `rule`, CSS-переменные Canvas и значения
по умолчанию.

Полифил поддерживает `flex-wrap`, элементы разных размеров, `order`, направления `row` и `column`, reverse-направления,
RTL, прокрутку и динамические изменения, отслеживаемые браузером. Измеряются только прямые HTML-потомки
Flexbox-контейнера.

В браузере с нативной поддержкой `rule` функция ничего не делает (`CSS.supports('rule', '1px solid')`). В остальных
случаях создаётся Canvas. Для программного тестирования можно использовать `{ force: true }`, но перед этим нужно
отключить
нативный `rule`, чтобы не получить два слоя линий.

## Реализуемые CSS-свойства

Это визуальный fallback, а не полная реализация CSS Gaps.

| Свойство                                | Состояние         | Поведение                                                                              |
|-----------------------------------------|-------------------|----------------------------------------------------------------------------------------|
| `rule`                                  | Частично          | Читаются `width` и `color` из вычисленного shorthand, рисуются сплошные линии.         |
| `rule-style`                            | Фиксировано       | Поддерживается только `solid`.                                                         |
| `rule-color`                            | Визуальный аналог | Используйте `options.color` или `--flex-rule-color`; стандартный longhand не парсится. |
| `rule-width`                            | Визуальный аналог | Используйте `options.width` или `--flex-rule-width`; стандартный longhand не парсится. |
| `row-rule` / `column-rule`              | Частично          | Линии рисуются с учётом направления Flexbox, стиль общий.                              |
| `rule-break` и связанные свойства       | Не реализовано    | Разрывы в местах пересечений не поддерживаются.                                        |
| `rule-inset` и связанные свойства       | Не реализовано    | Отступы сегментов не поддерживаются.                                                   |
| `rule-overlap`, `rule-visibility-items` | Не реализовано    | Специфичное поведение перекрытий и видимости не поддерживается.                        |
| `repeat(...)` и списки правил           | Не реализовано    | Нельзя чередовать стили между правилами.                                               |
| `gap`, `row-gap`, `column-gap`          | Не полифилятся    | Промежутки задаёт нативный Flexbox, Canvas только рисует поверх результата.            |

`flex-direction`, `flex-wrap`, `order`, `direction`, `padding` и реальные размеры элементов используются как входные
данные.
Саму раскладку Flexbox браузер продолжает выполнять самостоятельно.

## Как это работает

Полифил добавляет один абсолютно позиционированный Canvas внутрь Flexbox-контейнера. Canvas не участвует в раскладке
Flexbox и использует `pointer-events: none`.

1. Контейнер и прямые потомки измеряются через `getComputedStyle()` и `getBoundingClientRect()`.
2. Элементы нормализуются с учётом направления Flexbox, reverse-направления, RTL и CSS `order`.
3. Элементы группируются в виртуальные flex-строки по фактическим координатам.
4. Линии рисуются между соседними элементами и соседними виртуальными строками.
5. Resize- и mutation-наблюдатели, прокрутка, изменение окна и завершение анимации планируют перерисовку.
6. Частые события объединяются через `requestAnimationFrame`, поэтому за кадр выполняется не более одной отрисовки.

Это геометрическая эвристика по DOM-координатам, а не доступ к внутренней модели строк браузера. В сложных случаях с
`justify-content`, трансформациями, перекрытиями или нестандартными writing modes результат может быть приблизительным.

## Ограничения

- Это не полная реализация CSS Gaps или CSS `rule`.
- Longhand-свойства, списки правил и дополнительные значения не парсятся.
- Поддерживаются только сплошные одноцветные линии; `dashed`, `dotted`, `double`, градиенты и `repeat()` не реализованы.
- Раздельные стили для двух направлений и `rule-inset` не поддерживаются.
- Canvas рисуется поверх flex-элементов с `z-index: 1`, но события мыши проходят сквозь него.
- Текстовые узлы, псевдоэлементы и нестандартные flex-items не измеряются.
- Определение flex-строк основано на геометрии и может быть неточным в сложных раскладках.

## Спецификация и поддержка браузеров

- [MDN: `rule`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/rule)
- [MDN: `rule-break`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/rule-break)
- [MDN: CSS gap rules](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Gaps/Defining_rules)
- [W3C: CSS Gaps Module Level 1](https://www.w3.org/TR/css-gaps-1/)
