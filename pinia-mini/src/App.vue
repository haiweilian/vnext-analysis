<template>
  <div>
    Clicked: {{ store.count }} times, count is {{ store.evenOrOdd }}.
    <button @click="store.increment">+</button>
    <button @click="store.decrement">-</button>
    <button @click="store.incrementIfOdd">Increment if odd</button>
    <button @click="store.incrementAsync">Increment async</button>
  </div>
</template>

<script>
import { useStore } from './store/main'
export default {
  setup() {
    const store = useStore()
    return {
      store
    }
  }
}
</script>
