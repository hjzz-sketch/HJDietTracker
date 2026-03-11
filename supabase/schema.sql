-- ================================================================
-- 个人健康追踪器 — Supabase 建表 SQL
-- ================================================================
-- 使用方法：
--   1. 登录你的 Supabase 项目
--   2. 进入 SQL Editor
--   3. 复制粘贴此文件全部内容，点击 Run
-- ================================================================

-- 设置项（密码 hash、API key 等）
create table if not exists settings (
  id          bigserial primary key,
  device_id   text not null,
  key         text not null,
  value       text,
  updated_at  timestamptz default now(),
  unique (device_id, key)
);

-- 每日饮食记录（整天的四餐数据存为一个 JSON）
create table if not exists diet_logs (
  id          bigserial primary key,
  device_id   text not null,
  date        date not null,
  data        jsonb default '{}'::jsonb,
  updated_at  timestamptz default now(),
  unique (device_id, date)
);

-- 自定义食物库
create table if not exists custom_foods (
  id          bigserial primary key,
  device_id   text not null unique,
  data        jsonb default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- 个人资料（身高、体重、目标等）
create table if not exists profiles (
  id          bigserial primary key,
  device_id   text not null unique,
  height      numeric,
  weight      numeric,
  goal        text,
  gender      text,
  birth_date  date,
  extra       jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- 运动记录
create table if not exists workout_logs (
  id          bigserial primary key,
  device_id   text not null,
  date        date not null,
  data        jsonb default '{}'::jsonb,
  updated_at  timestamptz default now(),
  unique (device_id, date)
);

-- 睡眠记录
create table if not exists sleep_logs (
  id          bigserial primary key,
  device_id   text not null,
  date        date not null,
  data        jsonb default '{}'::jsonb,
  updated_at  timestamptz default now(),
  unique (device_id, date)
);

-- 月经周期记录
create table if not exists period_logs (
  id          bigserial primary key,
  device_id   text not null unique,
  data        jsonb default '[]'::jsonb,
  updated_at  timestamptz default now()
);

-- 通用追踪器（水、步数等各类打卡）
create table if not exists tracker_logs (
  id           bigserial primary key,
  device_id    text not null,
  tracker_key  text not null,
  data         jsonb default '{}'::jsonb,
  updated_at   timestamptz default now(),
  unique (device_id, tracker_key)
);

-- ── Row Level Security（推荐开启）────────────────────────────
-- 注意：本项目使用 device_id 作为用户标识（非 Supabase Auth）
-- 以下 RLS 策略允许任何持有 anon key 的人读写自己 device_id 的数据
-- 如需更严格的隔离，请改用 Supabase Auth

alter table settings      enable row level security;
alter table diet_logs     enable row level security;
alter table custom_foods  enable row level security;
alter table profiles      enable row level security;
alter table workout_logs  enable row level security;
alter table sleep_logs    enable row level security;
alter table period_logs   enable row level security;
alter table tracker_logs  enable row level security;

-- 允许匿名用户对所有表进行 CRUD（依靠应用层 device_id 隔离）
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'settings','diet_logs','custom_foods','profiles',
    'workout_logs','sleep_logs','period_logs','tracker_logs'
  ] loop
    execute format('
      create policy if not exists "anon_all_%s"
      on %s for all
      to anon
      using (true)
      with check (true);
    ', tbl, tbl);
  end loop;
end $$;