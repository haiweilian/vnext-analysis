<template>
  <div id="app">
    <h1>Hello App!</h1>
    <p>
      <router-link to="/">首页</router-link>
      <router-link to="/about">关于</router-link>
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
