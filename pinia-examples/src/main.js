import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "../../pinia-2.0.0/packages/pinia/dist/pinia.mjs";

const app = createApp(App);
const store = createPinia();
app.use(store);
app.mount("#app");
