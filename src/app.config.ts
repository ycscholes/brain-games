export default defineAppConfig({
  pages: [
    'pages/index/index'
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
