import { inject } from 'vue'
import { routerKey, routeLocationKey } from './injectionSymbols'
import { Router } from './router'
import { RouteLocationNormalizedLoaded } from './types'

/**
 * Returns the router instance. Equivalent to using `$router` inside
 * templates.
 */
// VUEROUTER-路由原理 9-useRouter
export function useRouter(): Router {
  return inject(routerKey)!
}

/**
 * Returns the current route location. Equivalent to using `$route` inside
 * templates.
 */
// VUEROUTER-路由原理 9-useRoute
export function useRoute(): RouteLocationNormalizedLoaded {
  return inject(routeLocationKey)!
}
