<template>
  <div id="app">
    <h1>Hello App!</h1>
    <p>
      <router-link to="/">Go to Home</router-link>
      <router-link to="/about">Go to About</router-link>
    </p>
    <router-view></router-view>
  </div>
</template>
<style scoped>
a {
  display: inline-block;
  padding: 10px;
}
</style>
