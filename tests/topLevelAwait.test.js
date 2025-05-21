import { test, expect } from 'vitest'
import { topLevelAwait } from '../lib/index.js'
import babel from '@babel/core'

test('transforms top-level await to a promise', () => {
  const result = babel.transformSync('await import("test")', {
    plugins: [topLevelAwait],
  })

  expect(result.code).toMatchInlineSnapshot(`
    "(async () => {
      return await import("test");
    })();"
  `)
})

test('handles variable declarations with await', () => {
  const result = babel.transformSync(
    `
    const x = 1;
    const y = await Promise.resolve(2);
    const z = 3;
  `,
    {
      plugins: [topLevelAwait],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "const x = 1;
    let y, z;
    (async () => {
      y = await Promise.resolve(2);
      z = 3;
    })();"
  `)
})

test('handles class declarations with await', () => {
  const result = babel.transformSync(
    `
    class MyClass {}
    const instance = await Promise.resolve(new MyClass());
  `,
    {
      plugins: [topLevelAwait],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "class MyClass {}
    let instance;
    (async () => {
      instance = await Promise.resolve(new MyClass());
    })();"
  `)
})

test('throws error on illegal top-level return', () => {
  expect(() => {
    babel.transformSync(
      `
      await Promise.resolve();
      return 42;
    `,
      {
        plugins: [topLevelAwait],
      }
    )
  }).toThrowError()
})

test('handles multiple await statements', () => {
  const result = babel.transformSync(
    `
    const x = await Promise.resolve(1);
    const y = await Promise.resolve(2);
    x + y;
  `,
    {
      plugins: [topLevelAwait],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "let x, y;
    (async () => {
      x = await Promise.resolve(1);
      y = await Promise.resolve(2);
      return x + y;
    })();"
  `)
})

test('preserves statements before first await', () => {
  const result = babel.transformSync(
    `
    const x = 1;
    console.log('before');
    const y = await Promise.resolve(2);
    console.log('after');
  `,
    {
      plugins: [topLevelAwait],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "const x = 1;
    console.log('before');
    let y;
    (async () => {
      y = await Promise.resolve(2);
      return console.log('after');
    })();"
  `)
})

test('handles assignment expressions correctly', () => {
  const result = babel.transformSync(
    `
    let x = 1;
    x = await Promise.resolve(2);
  `,
    {
      plugins: [topLevelAwait],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "let x = 1;
    (async () => {
      x = await Promise.resolve(2);
    })();"
  `)
})
