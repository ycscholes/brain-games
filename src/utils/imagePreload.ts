export function shouldPreloadImageWithGetImageInfo(url: string) {
  return !/^data:image\/svg\+xml(?:;|,)/i.test(url) && !/\.svg(?:[?#]|$)/i.test(url);
}
