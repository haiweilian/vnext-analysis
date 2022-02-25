<template>
  <div>
    Clicked: {{ count }} times, count is {{ evenOrOdd }}.
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
    <button @click="incrementIfOdd">Increment if odd</button>
    <button @click="incrementAsync">Increment async</button>
  </div>
</template>
<script>
import { computed } from 'vue'
import { useStore } from '../vuex/index'
export default {
  setup() {
    const store = useStore()
    console.log(store)
    return {
      count: computed(() => store.state.count),
      evenOrOdd: computed(() => store.getters.evenOrOdd),

      increment: () => store.commit('increment'),
      decrement: () => store.commit('decrement'),

      incrementIfOdd: () => store.dispatch('incrementIfOdd'),
      incrementAsync: () => store.dispatch('incrementAsync')
    }
  }
}
</script>
