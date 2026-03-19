# セーブ形式設計メモ（草案）

このドキュメントは、Phase 3 で予定しているセーブ / ロード機能のための JSON スキーマ草案です。
現時点では実装前の設計メモであり、後方互換の保証はありません。

## 目的

- ローカルストレージ保存に向けて最小限のデータ構造を定義する
- チャンク差分保存（生成値との差分のみ保存）を前提に容量を抑える
- 将来の互換性判定のため、セーブデータ自体にバージョンを持たせる

## 保存キー

- `aicraft_save_slot_1`

将来的に複数セーブスロットに対応する場合は末尾番号を増やす。

## JSON 例

```json
{
  "schemaVersion": 1,
  "savedAt": "2026-03-19T00:00:00.000Z",
  "worldSeed": 12345,
  "player": {
    "position": { "x": 8.0, "y": 24.0, "z": 8.0 },
    "yaw": 0.0,
    "pitch": 0.0,
    "inventory": {
      "1": 22,
      "2": 10,
      "3": 7,
      "4": 16,
      "5": 3,
      "6": 4,
      "7": 2
    },
    "selectedSlot": 0
  },
  "settings": {
    "sensitivity": 0.002,
    "bgmVolume": 0.35,
    "seVolume": 0.55,
    "renderDistance": 5
  },
  "chunkDiffs": [
    {
      "chunk": { "cx": 0, "cz": 0 },
      "edits": [
        { "x": 8, "y": 21, "z": 8, "type": 0 },
        { "x": 8, "y": 22, "z": 8, "type": 4 }
      ]
    }
  ]
}
```

## フィールド仕様

| キー | 型 | 必須 | 説明 |
|---|---|---:|---|
| `schemaVersion` | number | 必須 | セーブデータのスキーマバージョン |
| `savedAt` | string | 必須 | ISO 8601 形式の保存日時 |
| `worldSeed` | number | 必須 | ワールド生成シード |
| `player.position` | object | 必須 | プレイヤー座標 |
| `player.yaw` | number | 必須 | 水平視点角 |
| `player.pitch` | number | 必須 | 垂直視点角 |
| `player.inventory` | object | 必須 | ブロック ID をキーにした所持数 |
| `player.selectedSlot` | number | 必須 | 選択中スロット番号 |
| `settings` | object | 任意 | 直近設定（未保存なら読み込み時デフォルト適用） |
| `chunkDiffs` | array | 必須 | 生成済み地形との差分ブロック編集 |

## バリデーション方針（案）

- `schemaVersion` が不明な場合は読み込み拒否し、ユーザーへ互換性警告を表示
- 数値フィールドは許容範囲外なら丸めるかデフォルトにフォールバック
- `chunkDiffs.edits` は 1 件ずつ `x/y/z/type` の存在と型を検証する

## 将来拡張

- `health`、`craftingUnlockedRecipes`、`containerStates` を `player` / `world` 配下へ追加
- 差分データ圧縮（RLE または block palette + index）
- 自動保存と手動保存のメタ情報（`autosave`: true/false）
