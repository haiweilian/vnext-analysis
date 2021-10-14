import { createRouter, createWebHistory } from "../../vue-router/index";

import Home from "./components/Home.vue";
import HomeChild from "./components/HomeChild.vue";
import About from "./components/About.vue";

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
  { path: "/about", component: About },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
