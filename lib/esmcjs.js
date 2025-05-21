/* Babel plugin: transform-imports-to-require
 * ------------------------------------------------------------------
 * Transforms ES Module import statements into CommonJS require() calls.
 * This plugin enables ES Module syntax to work in CommonJS environments.
 *
 * The plugin transforms code by:
 * 1. Converting import statements into equivalent require() calls
 * 2. Handling both default and named imports
 * 3. Maintaining proper variable declarations and scoping
 *
 * Key behaviors:
 *   1. Transforms default imports (import x from 'y') into const x = require('y')
 *   2. Transforms named imports (import { x } from 'y') into const { x } = require('y')
 *   3. Preserves the const declaration to maintain immutability
 *   4. Handles multiple specifiers in a single import statement
 */

module.exports = function transformImportsToRequire(babel) {
  const { types: t } = babel

  return {
    name: 'transform-imports-to-require',
    visitor: {
      ImportDeclaration(path) {
        const { node } = path
        const source = node.source.value
        const specifiers = node.specifiers

        // Handle side-effect only imports: `import 'module';`
        if (specifiers.length === 0) {
          path.replaceWith(
            t.expressionStatement(
              t.callExpression(t.identifier('require'), [
                t.stringLiteral(source),
              ])
            )
          )
          return
        }

        // Categorize specifiers
        const defaultSpecifiers = specifiers.filter((s) =>
          t.isImportDefaultSpecifier(s)
        )
        const namedSpecifiers = specifiers.filter((s) => t.isImportSpecifier(s))
        const namespaceSpecifiers = specifiers.filter((s) =>
          t.isImportNamespaceSpecifier(s)
        )

        const declarations = []

        // Default import: `import foo from 'bar'` → `const foo = require('bar');`
        if (defaultSpecifiers.length > 0) {
          const [{ local }] = defaultSpecifiers // There can be only one default
          declarations.push(
            t.variableDeclarator(
              t.identifier(local.name),
              t.callExpression(t.identifier('require'), [
                t.stringLiteral(source),
              ])
            )
          )
        }

        // Namespace import: `import * as ns from 'bar'` → `const ns = require('bar');`
        if (namespaceSpecifiers.length > 0) {
          const [{ local }] = namespaceSpecifiers // There can be only one namespace import
          declarations.push(
            t.variableDeclarator(
              t.identifier(local.name),
              t.callExpression(t.identifier('require'), [
                t.stringLiteral(source),
              ])
            )
          )
        }

        // Named imports: `import { x, y as z } from 'bar'` → `const { x, y: z } = require('bar');`
        if (namedSpecifiers.length > 0) {
          const properties = namedSpecifiers.map((s) =>
            t.objectProperty(
              t.identifier(s.imported.name),
              t.identifier(s.local.name),
              false,
              s.imported.name === s.local.name // Shorthand when names match
            )
          )

          declarations.push(
            t.variableDeclarator(
              t.objectPattern(properties),
              t.callExpression(t.identifier('require'), [
                t.stringLiteral(source),
              ])
            )
          )
        }

        // Replace the original import with one or more `const` declarations.
        path.replaceWith(t.variableDeclaration('const', declarations))
      },
    },
  }
}
