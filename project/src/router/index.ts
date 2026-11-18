import { createRouter, createWebHashHistory } from 'vue-router'

const MyTripsView = () => import('../views/MyTripsView.vue')
const TripEditorView = () => import('../views/TripEditorView.vue')

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'trips', component: MyTripsView },
    { path: '/trip/:id', name: 'editor', component: TripEditorView, props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
