export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/memory-challenge/index',
    'pages/rock-paper-scissors/index',
    'pages/dual-task/index',
    'pages/mental-math/index',
    'pages/twenty-four/index',
    'pages/digit-span/index',
    'pages/multiple-object-tracking/index',
    'pages/pattern-completion/index',
    'pages/number-order/index',
    'pages/head-count/index',
    'pages/word-scramble/index',
    'pages/bird-count/index',
    'pages/color-trap/index',
    'pages/pet/index',
    'pages/settings/index',
    'pages/training-records/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'Cici的脑部锻炼',
    navigationBarTextStyle: 'black',
    enablePullDownRefresh: false
  },
  lazyCodeLoading: 'requiredComponents',
  sitemapLocation: 'sitemap.json'
})
