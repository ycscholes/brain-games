# 农场进出兼容路由

`/pages/head-count/index` 不再承载独立游戏页面。它只负责将旧入口和历史分享链接重定向到：

```text
/pages/bird-count/index?mode=yard
```

完整玩法、计分、积分和训练记录规则见 [农场清点说明](../bird-count/README.md#农场进出)。

保留该页面注册是为了兼容旧路由；新入口应统一使用 `bird-count` 主页面。
