export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/memory-challenge/index',
    'pages/rock-paper-scissors/index',
    'pages/dual-task/index'
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
