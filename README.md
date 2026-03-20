> [!IMPORTANT]
> 🤖 このプロジェクトのソースコード・設計・ドキュメントは **AIによって生成** されています。  
> これは「AI駆動開発の学習」と「非ゲームエンジニアがAIに指示するだけでゲームを作れるかの検証」を目的とした実験プロジェクトです。

# AiCraft

ブラウザで動作する Minecraft 風 3D ボクセルゲーム。

## 技術スタック

| 項目 | 技術 |
|------|------|
| ビルドツール | Vite 8 (Rolldown) |
| 3D レンダリング | Three.js |
| UI フレームワーク | Preact |
| 状態管理 | Zustand |
| 言語 | JavaScript (ES Modules) |

## 必要環境

- Node.js 18 以上
- npm 9 以上

## セットアップ

```bash
git clone <repository-url>
cd aicraft
npm install
```

## 開発

```bash
npm run dev
```

ブラウザで `http://localhost:5173` が自動的に開きます。
ファイル変更時は HMR で即座に反映されます。

### 開発チェックフロー

実装後は最低限、以下の順で確認します。

```bash
npm run build
npm run preview
```

- `npm run build` でビルドが通ることを確認
- `npm run preview` で成果物起動後、主要操作（移動・採掘・設置・設定変更）を確認

## ビルド

```bash
npm run build
```

成果物は `dist/` に出力されます。

### ビルド成果物のプレビュー

```bash
npm run preview
```

## プロジェクト構成

```
aicraft/
├── index.html              # エントリ HTML
├── vite.config.js          # Vite 設定
├── package.json
└── src/
    ├── main.js             # エントリポイント（モジュール初期化・Preact 描画）
    ├── GameController.js   # ゲームループ・シーン管理・セーブ/ロード
    ├── InputManager.js     # キーボード・マウス入力の捕捉
    ├── SoundManager.js     # 効果音・BGM 管理
    ├── eventBus.js         # Pub/Sub イベントシステム
    ├── config.js           # 定数・ユーティリティ関数
    ├── world.js            # チャンク管理・地形生成・メッシュ構築
    ├── player.js           # プレイヤー操作・物理・衝突判定
    ├── mobs.js             # モブ管理・AI・レンダリング（MobManager）
    ├── blocks.js           # ブロック定義・テクスチャ生成
    ├── tools.js            # ツール定義・破壊速度補正
    ├── noise.js            # Perlin ノイズ
    ├── stores/             # Zustand ストア（状態管理）
    │   ├── settingsStore.js
    │   ├── inventoryStore.js
    │   ├── chestStore.js
    │   ├── toolStore.js
    │   ├── hungerStore.js
    │   ├── playerStore.js
    │   ├── gameStore.js
    │   ├── dayNightStore.js
    │   ├── breakStore.js
    │   └── uiStore.js
    └── ui/                 # Preact UI コンポーネント
        ├── App.jsx
        ├── hooks/          # カスタムフック（useDraggable 等）
        ├── screens/        # 全画面表示（スタート・ローディング・デス）
        ├── hotbar/         # ホットバー
        ├── health/         # 体力・空腹表示
        ├── info/           # 情報オーバーレイ
        ├── panels/         # 設定・クラフト・インベントリ・チェストパネル
        └── overlays/       # 水中・破壊プログレス・ヒット・キーヒント等
```

## デプロイ

`main` ブランチに push すると **GitHub Actions** が自動でビルド・デプロイします。

デプロイ先: https://soltic315.github.io/aicraft/

> **初回設定:** リポジトリの **Settings → Pages → Source** を **"GitHub Actions"** に変更してください。

## 関連ドキュメント

- [GAME_DESIGN.md](GAME_DESIGN.md) — ゲーム仕様
- [CHANGELOG.md](CHANGELOG.md) — 変更履歴
- [SAVE_SCHEMA.md](SAVE_SCHEMA.md) — セーブ形式設計メモ（JSON スキーマ草案）
- [TODO.md](TODO.md) — タスク管理・バックログ