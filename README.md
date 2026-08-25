# 苔账

一款面向 iPhone 的本地优先记账 App。功能按参考视频重建，配色与视觉层级重新设计。

## 已实现

- 明细：首页日历、月份切换、搜索、收支筛选、月度汇总与流水列表。
- 概览：月度 / 学期 / 年度切换、总预算进度、收支结余、分类支出图表和文字总结。
- 记账：支出 / 收入、金额、名称、分类的手动录入。
- 删除：每条日常或项目记录都可删除；删除前确认，删除后可以撤销，并同步更新本地持久化数据。
- AI 记账：iOS 系统语音识别、中文金额转换，一句话自动拆分多笔收支并识别明细、收支类型和分类，写入前可预览。
- 项目账本：创建项目、记录投入 / 收入、查看净收入与回本进度。
- 借贷垫付：记录借出款、查看未收回金额、结清与恢复。
- 预算管理：编辑各分类月度预算并持久化保存。
- 本地持久化：使用 AsyncStorage，关闭 App 后数据仍保留。
- 云同步：Supabase 匿名身份配合私密同步码，不注册应用账号即可在多台设备实时查看同一账本；离线修改会排队并在联网后自动重试。

## 本机运行

```powershell
npm install
npm run web
```

浏览器预览默认由 Expo 输出地址。Web 版本用于开发和验收，除浏览器自身不支持语音识别的情况外，其余功能与 iOS 共用同一套代码和本地数据逻辑。

## 安装为 iPhone PWA

PWA 版本不需要 Apple Developer 会员。在 iPhone Safari 打开 `https://moss-ledger.expo.app`，使用 Safari 分享菜单中的“添加到主屏幕”即可安装。

- 首次打开需要联网，加载完成后核心记账页面可以离线使用。
- 浏览器支持语音识别时可直接使用悬浮麦克风；不支持时，点按文字输入框并使用 iPhone 键盘自带的麦克风听写。
- 未启用云同步时，账本只保存在当前浏览器中；启用后可用私密同步码在另一台设备恢复并实时查看。
- 私密同步码等同于账本密码。数据库只保存同步码摘要，但用户仍需妥善保管原始同步码。

```powershell
npm run icons:pwa
npm run build:pwa
```

## 在 iPhone 上运行

语音识别依赖原生模块，不能使用普通 Expo Go。请选择下面一种方式：

### 有 Mac

```powershell
npm install
npm run ios
```

Xcode 会生成并运行包含语音模块的原生开发版本。首次使用麦克风时，允许“麦克风”和“语音识别”权限。

### Windows + EAS 云构建

需要 Expo 账号和 Apple Developer 账号：

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile preview
```

构建完成后，通过 EAS 返回的安装链接安装到已登记的 iPhone。`preview` 包已包含业务代码和语音原生模块，不依赖电脑上的开发服务器。

当前界面已经按 iPhone 15 Pro 的 393 × 852 点位尺寸检查，顶部安全区、底部手势区、底栏和悬浮麦克风不会遮挡记账内容。

## 验证命令

```powershell
npm run typecheck
npm test
npx expo install --check
npx expo export --platform web --output-dir dist
```

## 当前边界

- 不接入银行自动导入，也不提供独立管理后台。
- 未启用云同步时，删除 PWA 或清除 Safari 网站数据会删除本机账本；启用云同步后可用私密同步码恢复。
- 云同步使用 Supabase 免费项目，前端只包含公开项目地址和 publishable key；账本访问由匿名身份、成员关系和 RLS 限制。
- Windows 无法本地编译或签名 iOS 安装包，必须使用 Mac/Xcode 或 EAS 云构建。
