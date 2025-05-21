import { test, expect } from 'vitest'
import { esmcjs } from '../lib/index.js'
import babel from '@babel/core'

test('transforms named imports to require', () => {
  const result = babel.transformSync('import { test } from "test"', {
    plugins: [esmcjs],
  })

  expect(result.code).toMatchInlineSnapshot(`
    "const {
      test
    } = require("test");"
  `)
})

test('transforms default imports to require', () => {
  const result = babel.transformSync('import test from "test"', {
    plugins: [esmcjs],
  })

  expect(result.code).toMatchInlineSnapshot(`
    "const test = require("test");"
  `)
})

test('transforms multiple specifiers in a single import statement', () => {
  const result = babel.transformSync(
    'import { test1, test2, test3 } from "test"',
    {
      plugins: [esmcjs],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "const {
      test1,
      test2,
      test3
    } = require("test");"
  `)
})

test('transforms mixed default and named imports', () => {
  const result = babel.transformSync(
    'import defaultExport, { named1, named2 } from "test"',
    {
      plugins: [esmcjs],
    }
  )

  expect(result.code).toMatchInlineSnapshot(`
    "const defaultExport = require("test"),
      {
        named1,
        named2
      } = require("test");"
  `)
})
