import { createRouter, createWebHistory } from "../components/vue-router";

import Home from "./components/Home.vue";
import HomeChild from "./components/HomeChild.vue";
import About from "./components/About.vue";
import AboutLeft from "./components/AboutLeft.vue";
import AboutRight from "./components/AboutRight.vue";

const routes = [
  {
    path: "/",
    component: Home,
    children: [
      {
        path: "home-child",
        component: HomeChild,
      },
    ],
  },
  {
    path: "/about",
    component: About,
    children: [
      {
        path: "about-child",
        components: {
          left: AboutLeft,
          right: AboutRight,
        },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  console.log("beforeEach", to, from);
  next();
});

router.afterEach((to, from) => {
  console.log("afterEach", to, from);
});

export default router;
