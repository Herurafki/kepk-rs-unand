import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import router from './router'
import { installResearcherRichText } from './utils/researcher-rich-text'
import { installDiklitDetailEnhancements } from './utils/diklit-detail-enhancements'
import { installResearcherEthicsReadonly } from './utils/researcher-ethics-readonly'
import { installEthicsParentAutofill } from './utils/ethics-parent-autofill'
import { installResearcherEthicsActionVisibility } from './utils/researcher-ethics-action-visibility'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')

installResearcherRichText()
installResearcherEthicsReadonly()
installEthicsParentAutofill()
installDiklitDetailEnhancements()
installResearcherEthicsActionVisibility()
