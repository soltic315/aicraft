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
├── index.html          # エントリ HTML
├── vite.config.js      # Vite 設定
├── package.json
└── src/
    ├── main.js         # ゲームループ・シーン構築・UI
    ├── world.js        # チャンク管理・地形生成・メッシュ構築
    ├── player.js       # プレイヤー操作・物理・衝突判定
    ├── blocks.js       # ブロック定義・テクスチャ生成
    └── noise.js        # Perlin ノイズ
```

## デプロイ

`main` ブランチに push すると **GitHub Actions** が自動でビルド・デプロイします。

デプロイ先: `https://soltic315.github.io/aicraft/`

> **初回設定:** リポジトリの **Settings → Pages → Source** を **"GitHub Actions"** に変更してください。

## 関連ドキュメント

- [GAME_DESIGN.md](GAME_DESIGN.md) — ゲーム仕様
- [CHANGELOG.md](CHANGELOG.md) — 変更履歴
