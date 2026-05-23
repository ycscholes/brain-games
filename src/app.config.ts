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
    'pages/pet/index',
    'pages/settings/index',
    'pages/training-records/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '小芋圆',
    navigationBarTextStyle: 'black',
    enablePullDownRefresh: false
  },
  lazyCodeLoading: 'requiredComponents',
  sitemapLocation: 'sitemap.json'
})
