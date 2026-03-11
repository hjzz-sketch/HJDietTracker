# 个人健康追踪器

一个轻量的个人饮食、运动、睡眠记录工具。

## 数据存储方式

本项目支持三种模式，按需选择：

---

### 方式一：本地存储（推荐新手，零配置）

数据存在浏览器的 `localStorage`，无需任何账号或服务器。

**步骤：**

1. 下载本仓库（或 `git clone`）
2. 直接用浏览器打开 `index.html`
3. 完成 ✅

> ⚠️ 注意：清除浏览器数据会导致记录丢失，建议定期导出备份。

---

### 方式二：云端备份（自建 Supabase，个人设备 → 云端）

数据存在**你自己的** Supabase 免费项目，不经过任何第三方。

**步骤：**

1. 前往 [supabase.com](https://supabase.com) 注册并新建项目
2. 进入项目 → **SQL Editor**，粘贴 [`supabase/schema.sql`](supabase/schema.sql) 全部内容并执行
3. 进入项目 → **Settings → API**，复制：
   - `Project URL`
   - `anon public` key
4. 打开本项目的 `config.js`，填入上面两个值：
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://你的项目.supabase.co",
     SUPABASE_KEY: "eyJ...",
   };
   ```
5. 用浏览器打开 `index.html`，右下角会显示「云端模式」

> ⚠️ `config.js` 已加入 `.gitignore`，不会被上传到 GitHub。

---

### 方式三：多设备同步（Vercel 部署）

Fork 本仓库 → 部署到 Vercel → 在任何设备通过网址访问。

**步骤：**

1. 点击下方按钮一键部署：

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/你的仓库名)

2. 部署时在 Vercel 的环境变量页面填入：
   | 变量名 | 值 |
   |--------|-----|
   | `SUPABASE_URL` | 你的 Supabase Project URL |
   | `SUPABASE_KEY` | 你的 Supabase anon key |

3. 部署完成后，通过 Vercel 分配的网址访问即可多设备同步

---

## 文件结构

```
├── index.html          # 主页面
├── config.js           # ⭐ 填写你的 Supabase 配置（不提交到 Git）
├── config.js.example   # 配置文件模板
├── data.js             # 食物数据库
├── js/
│   ├── storage.js      # 存储适配器（自动切换本地/云端）
│   ├── db.js           # 数据库操作封装
│   ├── diet.js
│   ├── workout.js
│   ├── sleep.js
│   └── ...
└── supabase/
    └── schema.sql      # Supabase 建表 SQL
```

## 隐私说明

- 使用方式一：数据 **只在你的浏览器**，任何人（包括作者）都无法访问
- 使用方式二/三：数据存在 **你自己的 Supabase 项目**，作者无法访问
