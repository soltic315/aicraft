# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コマンド

```bash
npm run dev      # 開発サーバー起動（localhost:5173、HMR有効）
npm run build    # プロダクションビルド（dist/ に出力）
npm run preview  # ビルド成果物のプレビュー
```

実装後の確認フロー：`npm run build` でビルドが通ることを確認 → `npm run preview` で主要操作（移動・採掘・設置・設定変更）を確認。

## アーキテクチャ

### モジュール構成と依存関係

```
main.js
  ├── EventBus        ← モジュール間疎結合のためのPub/Subシステム
  ├── SoundManager    ← BGM・SE管理
  ├── InputManager    ← キーボード・マウス入力（EventBusにemit）
  ├── GameController  ← ゲームループ・シーン管理・セーブ/ロード（中枢）
  │     ├── World     ← チャンク管理・地形生成・メッシュ構築
  │     └── Player    ← 操作・物理・衝突判定
  └── Preact UI       ← Zustandストアを購読して描画（ゲームロジックから独立）
```

### ゲーム状態の流れ

- **ゲームロジック → UI**: `GameController` が Zustand ストアを直接更新し、Preact コンポーネントがリアクティブに再描画する
- **UI → ゲームロジック**: `EventBus` 経由でイベントをemit（UIからゲームへの命令）
- **モジュール間通信**: `EventBus.on/off/emit` で疎結合を維持

### Zustand ストア一覧

| ストア | 管理する状態 |
|--------|-------------|
| `gameStore` | gameStarted / fps / loading |
| `playerStore` | HP・最大HP |
| `inventoryStore` | インベントリ・ホットバー選択 |
| `toolStore` | 装備中のツール |
| `settingsStore` | 感度・音量・描画距離等 |
| `uiStore` | パネル開閉状態（設定・クラフト・チェスト） |
| `breakStore` | ブロック破壊進捗 |
| `chestStore` | チェスト内容物 |
| `dayNightStore` | 時刻・昼夜フラグ |

### ワールド生成

- チャンクサイズ: 16×16、ワールド高さ: 64、海面高度: 20
- `Noise`（Perlinノイズ）でシード付き地形生成
- フラスタムカリングで視野外チャンクを描画スキップ
- ブロック変更は `chunkEdits` に記録し、チャンク再生成時に適用

### セーブ/ロード

- `localStorage` にJSONで保存（キー: `aicraft_save_slot_1`）
- 30秒ごとの自動セーブ + ブラウザ終了直前にセーブ
- スキーマバージョン管理あり（`SAVE_SCHEMA_VERSION`）

### 定数・設定

すべてのゲーム定数は `src/config.js` に集約されている。ブロック定義・テクスチャは `src/blocks.js`、ツール定義は `src/tools.js`。

## ドキュメント更新ルール（AGENTS.md より）

コードを変更した場合、以下を必ず更新すること：

- **CHANGELOG.md**: 新機能・バグ修正・変更・削除のたびに [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) 形式で追記
- **GAME_DESIGN.md**: ブロック・操作・ワールド生成・UI・ゲームルール変更時に更新（テーブルを最新状態に保つ）
- **README.md**: 技術スタック・セットアップ・コマンド・構成が変わった場合のみ更新
- **TODO.md**: 新たな課題・フォローアップが見つかった場合に追記
- ドキュメントのみの変更は CHANGELOG.md を更新しない

バージョン番号はセマンティックバージョニング（パッチ=バグ修正、マイナー=新機能、メジャー=破壊的変更）。
