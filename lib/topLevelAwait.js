/* Babel plugin: transform-top-level-await
 * ------------------------------------------------------------------
 * Enables use of true "top-level await" in environments that execute
 * code as CommonJS (e.g. Node.js REPL, scripts evaluated with `vm`).
 *
 * The plugin transforms code containing top-level await by:
 * 1. Detecting top-level await and illegal top-level return statements
 * 2. Preserving statements before the first top-level await
 * 3. Wrapping remaining code in an async IIFE while maintaining proper
 *    variable scoping and declaration behavior
 *
 * Key behaviours:
 *   1. Abort when the source does NOT contain a top-level `await` or
 *      when it DOES contain an illegal top-level `return`.
 *   2. Preserve statements before the first top-level await without modification
 *   3. Hoist all variable declarations as `let` declarations, so the bindings
 *      stay visible after evaluation.
 *   4. Rewrite top-level variable declarations into assignment
 *      expressions executed *inside* the async IIFE.
 *   5. Ensure the last expression's value is exposed by returning the value,
 *      except when it is an assignment expression.
 */

module.exports = function topLevelAwait({ types: t }) {
  return {
    name: 'transform-top-level-await',

    visitor: {
      Program: {
        enter(programPath) {
          const { node } = programPath

          // 1. Detect presence of top-level await and illegal top-level return.
          let containsTopLevelAwait = false
          let hasIllegalReturn = false

          programPath.traverse({
            AwaitExpression(path) {
              if (!path.findParent((p) => p.isFunction())) {
                containsTopLevelAwait = true
                path.stop()
              }
            },
            ReturnStatement(path) {
              if (!path.findParent((p) => p.isFunction())) {
                hasIllegalReturn = true
                path.stop()
              }
            },
          })

          if (hasIllegalReturn) {
            throw programPath.buildCodeFrameError(
              'Illegal top-level return in module using top-level await.'
            )
          }

          // Abort early if there is no top-level await – nothing to transform.
          if (!containsTopLevelAwait) return

          // 2. Identify index of first statement that contains top-level await.
          const bodyPaths = programPath.get('body')
          let firstAwaitIdx = -1

          for (let i = 0; i < bodyPaths.length && firstAwaitIdx === -1; i++) {
            const stmtPath = bodyPaths[i]
            stmtPath.traverse({
              AwaitExpression(path) {
                if (!path.findParent((p) => p.isFunction())) {
                  firstAwaitIdx = i
                  path.stop()
                }
              },
            })
          }

          // If somehow none found (shouldn't get here), bail.
          if (firstAwaitIdx === -1) return

          // 2. Preserve statements before the first await.
          const prefixStmts = node.body.slice(0, firstAwaitIdx)
          const transformStmts = node.body.slice(firstAwaitIdx)

          // 3. Prepare hoisting containers and IIFE body collector.
          const letDeclarators = []
          const iifeBody = []

          // Helper to collect binding identifiers from any pattern.
          const collectIds = (pattern) =>
            Object.values(t.getBindingIdentifiers(pattern))

          // 4. Transform statements that need to be inside the IIFE.
          transformStmts.forEach((stmt) => {
            if (t.isVariableDeclaration(stmt)) {
              stmt.declarations.forEach((decl) => {
                // Collect ids for hoisting.
                const ids = collectIds(decl.id)
                ids.forEach((id) => {
                  letDeclarators.push(
                    t.variableDeclarator(t.identifier(id.name))
                  )
                })

                // Build assignment expression for inside the IIFE.
                const assignment = t.expressionStatement(
                  t.assignmentExpression(
                    '=',
                    decl.id,
                    decl.init || t.identifier('undefined')
                  )
                )
                iifeBody.push(assignment)
              })
            } else if (t.isClassDeclaration(stmt) && stmt.id) {
              // Hoist class declarations as `let` and assign inside IIFE.
              letDeclarators.push(
                t.variableDeclarator(t.identifier(stmt.id.name))
              )
              const assignClass = t.expressionStatement(
                t.assignmentExpression('=', stmt.id, t.toExpression(stmt))
              )
              iifeBody.push(assignClass)
            } else {
              // Other statements are pushed unmodified.
              iifeBody.push(stmt)
            }
          })

          // 5. Ensure last expression value is returned (unless it is an assignment).
          if (iifeBody.length) {
            const last = iifeBody[iifeBody.length - 1]
            if (
              t.isExpressionStatement(last) &&
              !t.isAssignmentExpression(last.expression)
            ) {
              iifeBody[iifeBody.length - 1] = t.returnStatement(last.expression)
            }
          }

          // Compose hoisted declarations.
          const hoisted = []
          if (letDeclarators.length) {
            hoisted.push(t.variableDeclaration('let', letDeclarators))
          }

          // 3. Wrap remaining logic inside an async IIFE.
          const asyncIIFECall = t.expressionStatement(
            t.callExpression(
              t.arrowFunctionExpression([], t.blockStatement(iifeBody), true),
              []
            )
          )

          // Replace program body in-place (prefix + transform result).
          programPath.node.body = [...prefixStmts, ...hoisted, asyncIIFECall]
        },
      },
    },
  }
}
