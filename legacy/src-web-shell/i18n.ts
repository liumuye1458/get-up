import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from './locales/en-US'
import zhCN from './locales/zh-CN'

void i18n.use(initReactI18next).init({
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  resources: {
    'zh-CN': {
      translation: zhCN,
    },
    'en-US': {
      translation: enUS,
    },
  },
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
