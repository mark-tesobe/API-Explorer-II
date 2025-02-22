import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'

import App from './App.vue'
import appRouter from './router'
import { createI18n } from 'vue-i18n'
import { languages, defaultLocale } from './language'

import { cache as cacheResourceDocs, cacheDoc as cacheResourceDocsDoc } from './obp/resource-docs'
import { cache as cacheMessageDocs, cacheDoc as cacheMessageDocsDoc } from './obp/message-docs'
import { version, getMyAPICollections, getMyAPICollectionsEndpoint } from './obp'
import { getOBPGlossary } from './obp/glossary'

import 'element-plus/dist/index.css'
import './assets/main.css'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/700.css'
;(async () => {
  const app = createApp(App)
  const router = await appRouter()
  try {
    const worker = new Worker('/js/worker/web-worker.js')
    const isDataSetup = await setupData(app, worker)

    const messages = Object.assign(languages)
    const i18n = createI18n({
      locale: defaultLocale,
      fallbackLocale: 'ES',
      messages
    })
    app.provide('i18n', i18n)

    app.use(ElementPlus)
    app.use(i18n)
    app.use(createPinia())
    app.use(router)

    app.mount('#app')

    if (!isDataSetup) router.replace({ path: 'api-server-error' })
    app.config.errorHandler = (error) => {
      console.log(error)
      router.replace({ path: 'error' })
    }
  } catch (error) {
    console.log(error)
    router.replace({ path: 'error' })
  }
})()

async function setupData(app: App<Element>, worker: Worker) {
  try {
    const resourceDocsCache = await caches.open('obp-resource-docs-cache')
    const resourceDocsCacheResponse = await resourceDocsCache.match('/')
    const messageDocsCache = await caches.open('obp-message-docs-cache')
    const messageDocsCacheResponse = await messageDocsCache.match('/')

    //Listen to Web worker
    worker.onmessage = async (event) => {
      //Update cache docs data in the background
      if (event.data === 'update-resource-docs') {
        await cacheResourceDocsDoc(resourceDocsCache)
        console.log('Resource Docs cache was updated.')
      }
      if (event.data === 'update-message-docs') {
        await cacheMessageDocsDoc(messageDocsCache)
        console.log('Message Docs cache was updated.')
      }
    }

    const { resourceDocs, groupedDocs } = await cacheResourceDocs(
      resourceDocsCache,
      resourceDocsCacheResponse,
      worker
    )
    const messageDocs = await cacheMessageDocs(messageDocsCache, messageDocsCacheResponse, worker)

    app.provide('OBP-ResourceDocs', resourceDocs)
    app.provide('OBP-APIActiveVersions', Object.keys(resourceDocs).sort())
    app.provide('OBP-GroupedResourceDocs', groupedDocs)
    app.provide('OBP-GroupedMessageDocs', messageDocs)
    app.provide('OBP-API-Host', import.meta.env.VITE_OBP_API_HOST)
    const glossary = await getOBPGlossary()
    app.provide('OBP-Glossary', glossary)

    const apiCollections = (await getMyAPICollections()).api_collections
    if (apiCollections && apiCollections.length > 0) {
      //Uncomment this when other collection will be supported.
      //for (const { api_collection_name } of apiCollections) {
      //  const apiCollectionsEndpoint = (
      //    await getMyAPICollectionsEndpoint(api_collection_name)
      //  ).api_collection_endpoints.map((api) => api.operation_id)
      //  app.provide('OBP-MyCollectionsEndpoint', apiCollectionsEndpoint)
      //}
      const apiCollectionsEndpoint = (
        await getMyAPICollectionsEndpoint('Favourites')
      ).api_collection_endpoints.map((api) => api.operation_id)
      app.provide('OBP-MyCollectionsEndpoint', apiCollectionsEndpoint)
    } else {
      app.provide('OBP-MyCollectionsEndpoint', undefined)
    }
    return true
  } catch (error) {
    app.provide('OBP-APIActiveVersions', [version])
    return false
  }
}
