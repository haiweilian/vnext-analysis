<template>
  <div>
    <p>
      <router-link to="/about/about-child">子页面</router-link>
    </p>
    <router-view name="left"></router-view>
    <router-view name="right"></router-view>
    <button @click="goHome">返回首页</button>
  </div>
</template>

<script setup>
import {
  useRoute,
  useRouter,
} from "../../../vue-router-next-4.0.0/dist/vue-router.esm-bundler";
const route = useRoute();
const router = useRouter();

console.log(route);
console.log(router);

const goHome = () => {
  router.push({
    path: "/",
  });
};
</script>
