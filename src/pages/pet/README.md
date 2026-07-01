# 宠物小院

## 模块目标

宠物小院承接脑力训练的长期奖励循环。玩家通过游戏获得积分，用积分领养和喂养宠物，并在首页与农场类游戏中看到自己的伙伴。

## 数据模型

支持小猫、小狗、小兔、小熊、熊猫、守宫和小乌龟。每只宠物保存名称、皮肤、状态、饱食度、等级、经验、创建时间、最后更新时间和离开时间。存储根对象还包含当前宠物、积分余额和领养数量。

宠物状态包括：

- `alive`：状态正常。
- `hungry`：饱食度较低。
- `dead`：饱食度归零超过 24 小时后离开，不能继续喂食或互动。

## 领养与切换

第一只宠物免费，后续每只需要 50 积分。领养时必须输入名称并选择皮肤。已领养宠物可以在选择弹窗中切换为当前伙伴，离开的宠物仍保留记录和纪念状态。

用户也可以上传一张单只宠物图片生成 AI 自定义宠物。服务端冻结 300 积分，生成 `idle/feed/cuddle/hungry` 四张私有图片，确认领养后才结算积分；最终技术失败、预览前取消或主动放弃会退回积分。每个用户最多成功生成 10 次自定义宠物，生成出首个完整预览后计 1 次；同一预览结果的重做次数暂不限制。同一用户同一时间仍只能存在一个活动生成任务，避免并发任务覆盖资格与积分冻结记录。自定义宠物可永久删除，删除后仍可重新发起新的自定义宠物生成，直到累计成功生成次数达到 10 次。

## 喂食与饱食

满饱食度为 100，约 3 天自然衰减至 0。归零后继续经过 24 小时会转为离开状态。

每种宠物配置三档食物：

| 档位 | 价格 | 恢复饱食 |
| --- | ---: | ---: |
| 小份公共食物 | 5 | 8 |
| 中份公共食物 | 10 | 16 |
| 宠物专属食物 | 20 | 32 |

公共食物可以跨宠物复用，最高档是各皮肤的专属奖励。详细经济规则以 [积分系统文档](../../../docs/points-economy.md) 为准。

## 舞台与反馈

主页面使用全屏小院舞台：顶部展示名称、状态、饱食度和积分，中部展示当前宠物与状态气泡，底部提供喂食、互动、切换和领养操作。

喂食、抚摸和切换会触发短时动作与文字反馈。新操作可以覆盖旧反馈定时器。离开的宠物不会触发正向喂食或抚摸反馈。

## 图片与远程素材

宠物和食物图片从 CloudBase Storage 加载。仓库源文件存放在 `asset-backups/cloudbase-images/`，运行时代码不得从备份目录导入图片。

`PetSprite` 先读取缓存 URL，再异步解析远程地址。公有读素材返回的无签名 HTTPS 地址永久缓存；私有或带签名地址仍按有效期刷新。图片加载失败时会重新解析一次，随后保留固定尺寸占位，不回退到本地宠物图片或 emoji，以避免增加小程序包体。

自定义宠物只保存 `customAssetId`，四状态文件位于用户私有 CloudBase Storage 路径。客户端通过 `customPetApi` 验证 OPENID 后获取短期 URL，并在本地按有效期缓存；首页、小院、宠物速数和奇趣记忆都通过同一资产引用加载。界面显示“AI 生成”标识，PNG 元数据和云端资源记录也保存 AI 生成标记。

素材路径通过 `config/remote-assets.json` 版本化。发布替换图片时提升版本并上传到新目录，禁止覆盖现有版本路径。

永久缓存还要求本地环境设置 `TARO_REMOTE_ASSETS_PUBLIC=true`。若云端套餐不支持修改存储规则，必须保持为 `false`。私有素材会请求最长 30 天的临时链接，并按服务端返回值或 URL 签名中的实际截止时间提前一分钟刷新；图片加载失败时也会立即重新解析链接。

生成或替换素材时遵循 [图片生成与验收流程](../../../docs/superpowers/generation/image-gen-asset-workflow.md)，并运行：

```bash
npm run assets:check
npm run assets:upload
```

上传命令只在云环境配置和凭据可用时执行。

## 积分与同步

游戏奖励只能通过 `getAwardedPoints()` 和 `addPointsToPet()` 进入宠物余额。领养和喂食消费由 `src/utils/petStorage.ts` 处理，并触发用户数据变更通知，供 CloudBase 同步服务上传。

## 实现与测试

- `types.ts`：宠物、食物和饱食参数。
- `index.tsx`：小院交互、弹窗、舞台和反馈。
- `components/PetSprite/`：远程宠物图片、动作状态和占位。
- `components/CustomPetFlow/`：上传、生成进度、预览、重做、领养和取消。
- `src/services/custom-pet/`：云函数调用、私有图片 URL 与缓存。
- `cloudfunctions/customPetApi`：资格、积分和领养事务。
- `cloudfunctions/customPetImageGenerator`：按 CloudBase 生图云函数契约接收 `prompt`、`referenceImageUrl` 和 `poseImageUrl`，返回 24 小时 `imageUrl` 与 `revised_prompt`。
- `cloudfunctions/customPetWorker`：上传姿态参考图、签出用户参考图和姿态图临时 URL、调用生图云函数、下载 24 小时图片 URL、透明 PNG 处理、上传私有云存储和可恢复任务。
- `cloudfunctions/customPetRecovery`：每五分钟恢复停滞任务与执行删除。
- `src/utils/petStorage.ts`：领养、喂食、状态更新和积分余额。
- `tests/unit/petStorage.test.ts`：宠物状态与消费。
- `tests/unit/petFoodConfig.test.ts`：食物配置。
- `tests/unit/remoteAssets.test.ts`：远程地址解析。
- `tests/unit/customPetService.test.ts`：私有图片 URL 缓存。
- `tests/unit/customPetDomain.test.js`：任务状态和错误分类。

### 生图云函数验收

AI 生图服务开通后，可先单独验证 `customPetImageGenerator`：

```js
wx.cloud.callFunction({
  name: "customPetImageGenerator",
  data: {
    prompt: "一只可爱的猫咪在阳光下玩耍",
    referenceImageUrl: "https://example.com/source.jpg",
    poseImageUrl: "https://example.com/pose-sheet.png",
  },
  success: (res) => {
    const result = res.result;
    if (result.success) {
      console.log("图片URL:", result.imageUrl);
      console.log("优化后的提示词:", result.revised_prompt);
      console.log("注意: 图片URL有效期为24小时");
    } else {
      console.error("生成失败:", result.code, result.message);
    }
  },
});
```

自定义宠物业务不会直接保存这个 24 小时 URL；`customPetWorker` 会下载该 URL、透明化处理，并上传到用户私有 CloudBase Storage 路径后再进入预览/领养流程。
