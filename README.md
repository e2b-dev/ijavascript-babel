# ijavascript-babel

Babel transforms for the ijavascript kernel (typescript, top-level await, esm import).

- [esmcjs](./lib/esmcjs.js) - transforms esm imports to require
- [topLevelAwait](./lib/topLevelAwait.js) - transforms top-level await to async iife

## Example usage

```js
import { esmcjs, topLevelAwait } from './lib/index.js'

const result = await babel.transform(code, {
  plugins: [esmcjs, topLevelAwait],
})

console.log(result.code)
```
